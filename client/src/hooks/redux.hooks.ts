/**
 * @file redux.hooks.ts
 * @description Typed Redux hooks.
 *
 * WHY TYPED HOOKS?
 * The default useDispatch and useSelector from react-redux
 * don't know about your store's shape.
 *
 * These typed versions give you full autocompletion.
 * Always use these instead of the default ones.
 *
 * Usage:
 *   const dispatch = useAppDispatch();
 *   const user = useAppSelector(state => state.auth.user);
 */

import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (state: RootState) => T) =>useSelector(selector);