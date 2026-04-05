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

export const store = configureStore({
  reducer: {
    auth: authReducer,
    organization: organizationReducer,
  },
});

// TypeScript types for the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;