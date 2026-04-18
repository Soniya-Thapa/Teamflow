/**
 * @file notification.slice.ts
 * @description Notification state — list + unread count badge.
 *
 * TWO SOURCES OF TRUTH:
 * 1. HTTP fetch (fetchNotifications) — full list loaded on page open
 * 2. Socket push (addNotification) — single new notification prepended in real-time
 *
 * API PATHS:
 * All org-scoped: /organizations/{orgId}/notifications
 * orgId is read from Redux state.organization.activeOrg so components
 * don't need to pass it manually.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/lib/axios';
import { RootState } from '@/store';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────
// ASYNC ACTIONS
// ─────────────────────────────────────────

/**
 * Fetch recent notifications. Called when dropdown opens or notifications page loads.
 * Reads orgId from Redux state — no need to pass it from components.
 */
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchAll',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const orgId = state.organization.activeOrg?.id;
      if (!orgId) return rejectWithValue('No active organization');

      const res = await api.get(
        `/organizations/${orgId}/notifications?limit=20`,
      );
      return res.data.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message || 'Failed to load notifications',
      );
    }
  },
);

/**
 * Mark a single notification as read.
 * Updates the item in state and decrements unread count.
 */
export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const orgId = state.organization.activeOrg?.id;
      if (!orgId) return rejectWithValue('No active organization');

      const res = await api.patch(
        `/organizations/${orgId}/notifications/${id}/read`,
      );
      return res.data.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message || 'Failed to mark as read',
      );
    }
  },
);

/**
 * Mark ALL notifications as read in one call.
 */
export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const orgId = state.organization.activeOrg?.id;
      if (!orgId) return rejectWithValue('No active organization');

      const res = await api.patch(
        `/organizations/${orgId}/notifications/read-all`,
      );
      return res.data.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message || 'Failed to mark all as read',
      );
    }
  },
);

/**
 * Permanently delete a notification.
 * Returns the deleted ID so the reducer can remove it from state.
 */
export const removeNotification = createAsyncThunk(
  'notifications/delete',
  async (id: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const orgId = state.organization.activeOrg?.id;
      if (!orgId) return rejectWithValue('No active organization');

      await api.delete(`/organizations/${orgId}/notifications/${id}`);
      return id;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message || 'Failed to delete notification',
      );
    }
  },
);

// ─────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
  } as NotificationState,

  reducers: {
    /**
     * addNotification — called by use-socket.ts when server emits notification:new.
     * Prepends the new notification and syncs the badge count.
     * data shape: { notification: Notification, unreadCount: number }
     */
    addNotification(
      state,
      action: PayloadAction<{
        notification?: Notification;
        unreadCount: number;
      }>,
    ) {
      const { notification, unreadCount } = action.payload;

      if (notification) {
        // Remove duplicate if exists then prepend
        state.notifications = [
          notification,
          ...state.notifications.filter((n) => n.id !== notification.id),
        ];
      }

      state.unreadCount = unreadCount;
    },

    /**
     * clearNotifications — called on logout to wipe state.
     */
    clearNotifications(state) {
      state.notifications = [];
      state.unreadCount = 0;
    },
  },

  extraReducers: (builder) => {

    // FETCH ALL
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.notifications = action.payload.notifications || [];
        state.unreadCount = action.payload.unreadCount ?? 0;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // MARK ONE READ
    builder.addCase(markNotificationRead.fulfilled, (state, action) => {
      const { notification, unreadCount } = action.payload;
      const idx = state.notifications.findIndex((n) => n.id === notification?.id);
      if (idx !== -1) state.notifications[idx].isRead = true;
      state.unreadCount = unreadCount ?? state.unreadCount;
    });

    // MARK ALL READ
    builder.addCase(markAllNotificationsRead.fulfilled, (state, action) => {
      state.notifications.forEach((n) => { n.isRead = true; });
      state.unreadCount = action.payload?.unreadCount ?? 0;
    });

    // DELETE
    builder.addCase(removeNotification.fulfilled, (state, action) => {
      // action.payload is the deleted notification id
      state.notifications = state.notifications.filter(
        (n) => n.id !== action.payload,
      );
    });
  },
});

export const { addNotification, clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;