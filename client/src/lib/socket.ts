/**
 * @file socket.ts
 * @description Socket.io client singleton.
 *
 * WHY withCredentials: true?
 * Tokens live in httpOnly cookies. withCredentials tells the browser
 * to include those cookies in the WebSocket handshake automatically.
 * No manual token attachment — same pattern as your Axios instance.
 *
 * WHY SINGLETON?
 * One socket connection per browser tab is correct.
 * Multiple connections would cause duplicate events and waste RAM.
 *
 * WHY autoConnect: false?
 * We connect manually only after confirming the user is authenticated.
 * This prevents wasted connections on public pages.
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// ─────────────────────────────────────────
// CONNECTION MANAGEMENT
// ─────────────────────────────────────────

/**
 * Returns the socket singleton. Creates it if it does not exist yet.
 * Does NOT connect — call connectSocket() separately.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,      // Browser sends httpOnly cookies automatically
      autoConnect: false,         // We control when to connect
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message);
    });
  }

  return socket;
}

/** Connect to socket server. Call after user is confirmed authenticated. */
export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
}

/** Disconnect and destroy socket. Call on logout. */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ─────────────────────────────────────────
// ROOM HELPERS
// ─────────────────────────────────────────

/** Subscribe to org-wide events: presence, task updates, notifications */
export function joinOrg(orgId: string) {
  getSocket().emit('join:org', orgId);
}

export function leaveOrg(orgId: string) {
  getSocket().emit('leave:org', orgId);
}

/** Subscribe to project room for real-time kanban drag updates */
export function joinProject(projectId: string) {
  getSocket().emit('join:project', projectId);
}

export function leaveProject(projectId: string) {
  getSocket().emit('leave:project', projectId);
}

/** Subscribe to task room for comments + typing indicators */
export function joinTask(taskId: string) {
  getSocket().emit('join:task', taskId);
}

export function leaveTask(taskId: string) {
  getSocket().emit('leave:task', taskId);
}

// ─────────────────────────────────────────
// TYPING INDICATORS
// ─────────────────────────────────────────

export function emitTypingStart(taskId: string) {
  getSocket().emit('typing:start', { taskId });
}

export function emitTypingStop(taskId: string) {
  getSocket().emit('typing:stop', { taskId });
}