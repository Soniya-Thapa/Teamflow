/**
 * @file organization.slice.ts
 * @description Redux slice for active organization context.
 *
 * WHY SEPARATE FROM AUTH?
 * Auth = who you are (user identity)
 * Organization = which workspace you are in (context)
 *
 * PERSISTENCE:
 * Active org is saved to localStorage so when user refreshes,
 * they return to the same org they were last using.
 *
 * SMART RESTORE:
 * On reload, we check if the saved org is still in the user's
 * membership list. If removed from org → fall back to first org.
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
// LOCALSTORAGE KEY
// Saves which org the user last had active
// ─────────────────────────────────────────

const ACTIVE_ORG_KEY = 'teamflow_active_org';

// ─────────────────────────────────────────
// ASYNC ACTIONS
// ─────────────────────────────────────────

/**
 * Fetch all organizations the current user belongs to.
 * Uses GET /auth/organizations — returns only orgs the user is a member of.
 *
 * Called:
 * 1. After login (in providers.tsx or login page)
 * 2. After registration
 * 3. On app boot (session restore)
 */
export const fetchUserOrganizations = createAsyncThunk(
  'organization/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      // Use /auth/organizations — returns user's memberships only
      // NOT /organizations which is admin-only list
      const response = await api.get('/auth/organizations');
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
     * Switch the active organization.
     * Called when user clicks org switcher in sidebar.
     * Saves to localStorage so the selection persists on reload.
     */
    setActiveOrg(state, action: PayloadAction<Organization>) {
      state.activeOrg = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_ORG_KEY, JSON.stringify(action.payload));
      }
    },

    /**
     * Clear all org state on logout.
     */
    clearOrganization(state) {
      state.activeOrg = null;
      state.userOrgs = [];
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ACTIVE_ORG_KEY);
      }
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

        if (action.payload.length === 0) {
          state.activeOrg = null;
          return;
        }

        /**
         * SMART ORG RESTORE:
         *
         * 1. Check localStorage for previously selected org
         * 2. Verify that org is still in user's membership list
         *    (they might have been removed since last session)
         * 3. If valid → restore it (user returns to same org)
         * 4. If not found → use first org in list
         */
        let restoredOrg: Organization | null = null;

        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem(ACTIVE_ORG_KEY);
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as Organization;
              // Verify user is still a member AND use fresh API data
              const freshOrg = action.payload.find((o) => o.id === parsed.id);
              if (freshOrg) {
                restoredOrg = freshOrg;
              }
            } catch {
              // Corrupt data in localStorage — clear it
              localStorage.removeItem(ACTIVE_ORG_KEY);
            }
          }
        }

        // Use restored org or default to first org
        state.activeOrg = restoredOrg || action.payload[0];

        // Always save the final selection to localStorage
        if (typeof window !== 'undefined' && state.activeOrg) {
          localStorage.setItem(
            ACTIVE_ORG_KEY,
            JSON.stringify(state.activeOrg),
          );
        }
      })
      .addCase(fetchUserOrganizations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setActiveOrg, clearOrganization } = organizationSlice.actions;
export default organizationSlice.reducer;