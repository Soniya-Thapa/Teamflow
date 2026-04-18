/**
 * @file search.slice.ts
 * @description Search state with history and results.
 *
 * FILTER PRESETS:
 * Saved to localStorage under 'teamflow_filter_presets'.
 * Each preset has a name + filter object.
 * Users can save the current filter state and recall it later.
 *
 * SEARCH HISTORY:
 * Last 5 searches saved to localStorage under 'teamflow_search_history'.
 * Shown below the search input when no query is typed.
 *
 * API PATH:
 * /organizations/{orgId}/search — reads orgId from Redux state.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/lib/axios';
import { RootState } from '@/store';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface FilterPreset {
  id: string;
  name: string;
  filters: TaskFilters;
  createdAt: string;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  assigneeId?: string;
  projectId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

interface SearchState {
  query: string;
  results: {
    projects: any[];
    tasks: any[];
    teams: any[];
    members: any[];
  };
  isLoading: boolean;
  error: string | null;
  history: string[];
  filterPresets: FilterPreset[];
}

// ─────────────────────────────────────────
// LOCAL STORAGE HELPERS
// ─────────────────────────────────────────

const HISTORY_KEY = 'teamflow_search_history';
const PRESETS_KEY = 'teamflow_filter_presets';
const MAX_HISTORY = 5;

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePresets(presets: FilterPreset[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

// ─────────────────────────────────────────
// ASYNC ACTIONS
// ─────────────────────────────────────────

export const performSearch = createAsyncThunk(
  'search/perform',
  async (query: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const orgId = state.organization.activeOrg?.id;
      if (!orgId) return rejectWithValue('No active organization');

      const response = await api.get(
        `/organizations/${orgId}/search?q=${encodeURIComponent(query)}`,
      );
      return { data: response.data.data, query };
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message || 'Search failed',
      );
    }
  },
);

export const fetchSuggestions = createAsyncThunk(
  'search/suggestions',
  async (query: string, { rejectWithValue, getState }) => {
    if (!query || query.length < 2) return { suggestions: [] };
    try {
      const state = getState() as RootState;
      const orgId = state.organization.activeOrg?.id;
      if (!orgId) return { suggestions: [] };

      const response = await api.get(
        `/organizations/${orgId}/search/suggestions?q=${encodeURIComponent(query)}`,
      );
      return response.data.data;
    } catch {
      return { suggestions: [] };
    }
  },
);

// ─────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────

const searchSlice = createSlice({
  name: 'search',
  initialState: {
    query: '',
    results: { projects: [], tasks: [], teams: [], members: [] },
    isLoading: false,
    error: null,
    history: loadHistory(),
    filterPresets: loadPresets(),
  } as SearchState,

  reducers: {
    setQuery(state, action: PayloadAction<string>) {
      state.query = action.payload;
    },

    clearSearch(state) {
      state.query = '';
      state.results = { projects: [], tasks: [], teams: [], members: [] };
    },

    clearHistory(state) {
      state.history = [];
      saveHistory([]);
    },

    removeFromHistory(state, action: PayloadAction<string>) {
      state.history = state.history.filter((h) => h !== action.payload);
      saveHistory(state.history);
    },

    /**
     * Save the current filter state as a named preset.
     * User can then recall it from a dropdown next time.
     */
    saveFilterPreset(
      state,
      action: PayloadAction<{ name: string; filters: TaskFilters }>,
    ) {
      const preset: FilterPreset = {
        id: Date.now().toString(),
        name: action.payload.name,
        filters: action.payload.filters,
        createdAt: new Date().toISOString(),
      };

      state.filterPresets = [...state.filterPresets, preset];
      savePresets(state.filterPresets);
    },

    deleteFilterPreset(state, action: PayloadAction<string>) {
      state.filterPresets = state.filterPresets.filter(
        (p) => p.id !== action.payload,
      );
      savePresets(state.filterPresets);
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(performSearch.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(performSearch.fulfilled, (state, action) => {
        state.isLoading = false;
        state.results = action.payload.data.results || {
          projects: [],
          tasks: [],
          teams: [],
          members: [],
        };

        // Add to history (deduplicated, max 5)
        const q = action.payload.query;
        state.history = [q, ...state.history.filter((h) => h !== q)].slice(
          0,
          MAX_HISTORY,
        );
        saveHistory(state.history);
      })
      .addCase(performSearch.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setQuery,
  clearSearch,
  clearHistory,
  removeFromHistory,
  saveFilterPreset,
  deleteFilterPreset,
} = searchSlice.actions;

export default searchSlice.reducer;