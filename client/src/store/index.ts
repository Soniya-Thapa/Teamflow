/**
 * @file store/index.ts
 * @description Redux store configuration.
 *
 * WHAT IS THE STORE?
 * The store is the single source of truth for all app state.
 * All components read from here and dispatch actions to update it.
 */

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/auth.slice';
import organizationReducer from './slices/organization.slice';
import notificationReducer from './slices/notification.slice';
import searchReducer from './slices/search.slice';


export const store = configureStore({
  reducer: {
    auth: authReducer,
    organization: organizationReducer,
    notifications: notificationReducer,
    search: searchReducer,
  },
});

// TypeScript types for the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;