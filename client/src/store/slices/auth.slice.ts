/**
 * @file auth.slice.ts
 * @description Redux slice for authentication.
 *
 * WHAT IS A SLICE?
 * A slice = one piece of the Redux store.
 *
 * It has 3 parts:
 *   state    → the data (user, tokens, org)
 *   reducers → functions that change the data
 *   actions  → what you call to trigger changes
 *
 * ASYNC ACTIONS (createAsyncThunk):
 * For API calls like login, register, logout.
 * They handle loading/error states automatically.
 * 
 *  * TOKEN STORAGE:
 * Tokens are httpOnly cookies — invisible to JS, set by the backend.
 * Redux only holds: user profile, isAuthenticated, loading, error.
 *
 * SESSION RESTORE:
 * On app boot, fetchCurrentUser hits GET /auth/me.
 * The browser sends the httpOnly cookie automatically.
 * Backend returns the user if the cookie is valid.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User} from '@/types';
import api from '@/lib/axios';

// ─────────────────────────────────────────
// MIDDLEWARE FLAG COOKIE
// NOT the auth token — just a JS-readable boolean so Next.js
// middleware can redirect unauthenticated users without hitting the API
// ─────────────────────────────────────────

const setAuthCookie = (value: boolean) => {
  if (typeof document !== 'undefined') {
    if (value) {
      document.cookie = 'teamflow_authenticated=true; path=/; max-age=604800; SameSite=Strict';
    } else {
      document.cookie = 'teamflow_authenticated=; path=/; max-age=0; SameSite=Strict';
    }
  }
};

// ─────────────────────────────────────────
// STATE SHAPE
// ─────────────────────────────────────────

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// ─────────────────────────────────────────
// ASYNC ACTIONS
// ─────────────────────────────────────────

/**
 * Login action — calls /auth/login and  backend sets httpOnly cookies, we receive user data only
 */
export const loginUser = createAsyncThunk(
  'auth/login',
  async (
    credentials: { email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const { user } = response.data.data;
      return { user };
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Login failed';
      return rejectWithValue(message);
    }
  },
);

/**
 * Register action — calls /auth/register
 */
export const registerUser = createAsyncThunk(
  'auth/register',
  async (
    data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const response = await api.post('/auth/register', data);
      const { user } = response.data.data;
      return { user };
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Registration failed';
      return rejectWithValue(message);
    }
  },
);

/**
 * Logout — backend clears httpOnly cookies
 */
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Clear locally even if backend is unreachable
    }
  },
);

/**
 * Called on app boot — verifies session via httpOnly cookie
 * Cookie is sent automatically by the browser
 */
export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/auth/me');
      const { user } = response.data.data;
      return { user };
    } catch (error) {
      return rejectWithValue(null); // no retry
    }
  },
);

// ─────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,

  // Synchronous reducers
  reducers: {
    // setOrganization(state, action: PayloadAction<Organization>) {
    //   state.organization = action.payload;
    //   localStorage.setItem(
    //     'teamflow_organization',
    //     JSON.stringify(action.payload),
    //   );
    // },

       updateUser(state, action: PayloadAction<Partial<User>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },

    // setTokens(state, action: PayloadAction<Tokens>) {
    //   state.tokens = action.payload;
    //   localStorage.setItem('teamflow_tokens', JSON.stringify(action.payload));
    // },

    clearError(state) {
      state.error = null;
    },
  },

  // Async action handlers
  extraReducers: (builder) => {

    // ─── LOGIN ───
     builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        setAuthCookie(true);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // ─── REGISTER ───
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        setAuthCookie(true);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // ─── LOGOUT ───
     builder
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.error = null;
        setAuthCookie(false);
      });

       // ─── FETCH CURRENT USER (app boot) ───
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        setAuthCookie(true);
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        setAuthCookie(false);
      });
  },
});

export const { updateUser, clearError } = authSlice.actions;

export default authSlice.reducer;