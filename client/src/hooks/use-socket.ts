/**
 * @file use-socket.ts
 * @description Manages socket lifecycle tied to auth + org state.
 *
 * CALL THIS ONCE — in (dashboard)/layout.tsx only.
 * Calling it in multiple pages would register duplicate event listeners.
 *
 * LIFECYCLE:
 *   isAuthenticated true  → connectSocket()
 *   isAuthenticated false → disconnectSocket()
 *   activeOrg changes     → leave old org room, join new org room
 *
 * EVENTS HANDLED HERE (global ones):
 *   notification:new    → dispatch addNotification (badge + list update)
 *   task:status:changed → re-emit as DOM custom event (kanban board listens)
 *   presence:join/leave → logged to console (UI in Day 32)
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './redux.hooks';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  joinOrg,
  leaveOrg,
} from '@/lib/socket';
import { addNotification } from '@/store/slices/notification.slice';

export function useSocket() {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { activeOrg } = useAppSelector((state) => state.organization);
  const currentOrgRef = useRef<string | null>(null);

  // ─────────────────────────────────────────
  // CONNECT / DISCONNECT BASED ON AUTH STATE
  // ─────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      currentOrgRef.current = null;
      return;
    }

    connectSocket();
    const socket = getSocket();

    // ── NOTIFICATION EVENTS ──────────────

    socket.on('notification:new', (data) => {
      // data = { notification: {...}, unreadCount: number }
      // Dispatching updates the bell badge and prepends to the list
      dispatch(addNotification(data));
    });

    // ── TASK EVENTS ──────────────────────

    socket.on('task:status:changed', (data) => {
      // data = { taskId, status, updatedBy, timestamp }
      // Re-emit as a DOM CustomEvent so KanbanBoard components can react
      // without needing to be connected to Redux themselves
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('task:status:changed', { detail: data }),
        );
      }
    });

    // ── PRESENCE EVENTS ──────────────────

    socket.on('presence:join', (data) => {
      console.log('[Presence] Online:', data.user?.firstName);
    });

    socket.on('presence:leave', (data) => {
      console.log('[Presence] Offline:', data.userId);
    });

    return () => {
      socket.off('notification:new');
      socket.off('task:status:changed');
      socket.off('presence:join');
      socket.off('presence:leave');
    };
  }, [isAuthenticated, dispatch]);

  // ─────────────────────────────────────────
  // JOIN / LEAVE ORG ROOM WHEN ORG CHANGES
  // ─────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !activeOrg) return;

    const socket = getSocket();

    const handleConnect = () => {
      // Leave previous org room when switching organizations
      if (currentOrgRef.current && currentOrgRef.current !== activeOrg.id) {
        leaveOrg(currentOrgRef.current);
      }
      joinOrg(activeOrg.id);
      currentOrgRef.current = activeOrg.id;
    };

    if (socket.connected) {
      handleConnect();
    } else {
      // Socket not yet connected — wait for connect event
      socket.once('connect', handleConnect);
    }

    return () => {
      socket.off('connect', handleConnect);
    };
  }, [isAuthenticated, activeOrg?.id]);
}