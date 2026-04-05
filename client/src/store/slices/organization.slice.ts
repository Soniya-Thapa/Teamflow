/**
 * @file organization.slice.ts
 * @description Redux slice for active organization context.
 *
 * WHY SEPARATE FROM AUTH?
 * Auth = who you are (user identity)
 * Organization = which workspace you are in (context)
 * Separating them keeps each slice focused on one thing.
 *
 * ACTIVE ORG:
 * When user switches org → this slice updates
 * Axios interceptor reads from this slice to attach X-Organization-ID header
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Organization } from '@/types';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────

interface OrganizationState {
  activeOrg: Organization | null;
  userOrgs: Organization[];
  isLoading: boolean;
  error: string | null;
}

const initialState: OrganizationState = {
  activeOrg: null,
  userOrgs: [],
  isLoading: false,
  error: null,
};

// ─────────────────────────────────────────
// ASYNC ACTIONS
// ─────────────────────────────────────────

/**
 * Fetch all organizations the current user belongs to.
 * Called after login and on app boot.
 */
export const fetchUserOrganizations = createAsyncThunk(
  'organization/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/organizations');
      return response.data.data.organizations as Organization[];
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message || 'Failed to load organizations',
      );
    }
  },
);

// ─────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────

const organizationSlice = createSlice({
  name: 'organization',
  initialState,

  reducers: {
    /**
     * Set the active organization.
     * Also saves to localStorage so Axios interceptor can read it.
     */
    setActiveOrg(state, action: PayloadAction<Organization>) {
      state.activeOrg = action.payload;
      // if (typeof window !== 'undefined') {
      //   localStorage.setItem(
      //     'teamflow_active_org',
      //     JSON.stringify(action.payload),
      //   );
      // }
    },

    /**
     * Restore active org from localStorage on app boot.
     * Called in providers.tsx alongside fetchCurrentUser.
     */
    // restoreActiveOrg(state) {
    //   if (typeof window !== 'undefined') {
    //     const raw = localStorage.getItem('teamflow_active_org');
    //      if (raw) {
    //       try {
    //         state.activeOrg = JSON.parse(raw);
    //       } catch {
    //         state.activeOrg = null;
    //       }
    //     }
    //   }
    // },

    clearOrganization(state) {
      state.activeOrg = null;
      state.userOrgs = [];
      // if (typeof window !== 'undefined') {
      //   localStorage.removeItem('teamflow_active_org');
      // }
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchUserOrganizations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserOrganizations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.userOrgs = action.payload;

        // Auto-select first org if none active
        if (!state.activeOrg && action.payload.length > 0) {
          state.activeOrg = action.payload[0];
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'teamflow_active_org',
              JSON.stringify(action.payload[0]),
            );
          }
        }
      })
      .addCase(fetchUserOrganizations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setActiveOrg, clearOrganization } =
  organizationSlice.actions;

export default organizationSlice.reducer;