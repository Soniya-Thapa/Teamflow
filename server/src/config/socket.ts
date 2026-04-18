/**
 * @file socket.ts
 * @description Socket.io server configuration.
 *
 * HOW WEBSOCKETS WORK VS HTTP:
 * HTTP:  Client asks → Server answers → Connection closes
 * WebSocket: Connection stays open → Either side can send anytime
 *
 * USE CASES:
 * - Push new notification to user instantly (no polling)
 * - Show who is online in the org
 * - Update Kanban board when teammate moves a task
 *
 * AUTH FLOW:
 * Client connects → sends access_token cookie
 * Server verifies token → attaches userId to socket
 * Socket joins rooms: user:{userId} and org:{orgId}
 *
 * WHY COOKIES NOT handshake.auth.token?
 * Your backend sets tokens as httpOnly cookies (auth.controller.ts).
 * The browser sends these automatically on WebSocket handshake too
 * when withCredentials: true is set on the client side.
 * This keeps auth consistent with your HTTP middleware approach.
 *
 * ROOMS:
 *   user:{userId}       → personal notifications only
 *   org:{orgId}         → org-wide events (task updates, presence)
 *   project:{projectId} → kanban real-time updates
 *   task:{taskId}       → task comments + typing indicators
 *
 * EVENT NAMING: resource:action
 *   notification:new, task:updated, presence:join, typing:start
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwtUtil from '@/utils/jwt.util';
import prisma from '@/config/database';
import logger from '@/utils/logger';
import { envConfig } from './env.config';

// Extend Socket to carry authenticated user info
interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: { id: string; firstName: string; lastName: string };
}

let io: SocketIOServer | null = null;

// ─────────────────────────────────────────
// INITIALIZE — called once in server.ts
// ─────────────────────────────────────────

export function initializeSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: envConfig.corsOrigin,
      credentials: true, // Required — browser needs this to send cookies
    },
    transports: ['websocket', 'polling'],
  });

  // ─────────────────────────────────────────
  // AUTH MIDDLEWARE
  // Reads access_token from the httpOnly cookie header
  // Same verification logic as auth.middleware.ts
  // ─────────────────────────────────────────

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || '';

      // Parse "key=value; key=value" cookie string into an object
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [key, ...val] = c.trim().split('=');
          return [key.trim(), val.join('=')];
        }),
      );

      const token = cookies['access_token'];

      if (!token) {
        logger.warn('Socket rejected — no access_token cookie');
        return next(new Error('Authentication required'));
      }

      const payload = jwtUtil.verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, firstName: true, lastName: true },
      });

      if (!user) return next(new Error('User not found'));

      socket.userId = user.id;
      socket.user = user;

      logger.info('Socket authenticated', {
        socketId: socket.id,
        userId: user.id,
      });

      next();
    } catch (error) {
      logger.error('Socket auth failed', { error });
      next(new Error('Invalid or expired token'));
    }
  });

  // ─────────────────────────────────────────
  // CONNECTION HANDLER
  // ─────────────────────────────────────────

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('Socket connected', {
      socketId: socket.id,
      userId: socket.userId,
    });

    // Auto-join personal room on connect
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // ── ORG ROOM ──────────────────────────
    // Verify membership before allowing org room join

    socket.on('join:org', async (orgId: string) => {
      const member = await prisma.organizationMember.findFirst({
        where: {
          userId: socket.userId,
          organizationId: orgId,
          status: 'ACTIVE',
        },
      });

      if (!member) {
        logger.warn('Socket join:org rejected', {
          userId: socket.userId,
          orgId,
        });
        return;
      }

      socket.join(`org:${orgId}`);

      // Tell others in the org this user is now online
      socket.to(`org:${orgId}`).emit('presence:join', {
        userId: socket.userId,
        user: socket.user,
        timestamp: new Date().toISOString(),
      });

      logger.debug('Socket joined org room', {
        userId: socket.userId,
        orgId,
      });
    });

    socket.on('leave:org', (orgId: string) => {
      socket.leave(`org:${orgId}`);
      socket.to(`org:${orgId}`).emit('presence:leave', {
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    });

    // ── PROJECT ROOM ──────────────────────

    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
    });

    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    // ── TASK ROOM ─────────────────────────

    socket.on('join:task', (taskId: string) => {
      socket.join(`task:${taskId}`);
    });

    socket.on('leave:task', (taskId: string) => {
      socket.leave(`task:${taskId}`);
    });

    // ── TYPING INDICATORS ─────────────────
    // "Soniya is typing..." in task comment section

    socket.on('typing:start', (data: { taskId: string }) => {
      socket.to(`task:${data.taskId}`).emit('typing:start', {
        userId: socket.userId,
        user: socket.user,
      });
    });

    socket.on('typing:stop', (data: { taskId: string }) => {
      socket.to(`task:${data.taskId}`).emit('typing:stop', {
        userId: socket.userId,
      });
    });

    // ── DISCONNECT ────────────────────────

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', {
        socketId: socket.id,
        userId: socket.userId,
      });

      // Notify all org rooms this user left
      socket.rooms.forEach((room) => {
        if (room.startsWith('org:')) {
          socket.to(room).emit('presence:leave', {
            userId: socket.userId,
            timestamp: new Date().toISOString(),
          });
        }
      });
    });
  });

  logger.info('Socket.io initialized');
  return io;
}

// ─────────────────────────────────────────
// EMIT HELPERS
// Called by services to push real-time events
// These are safe to call even if io is not yet initialized
// ─────────────────────────────────────────

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

/** Push event to ONE user (personal notifications) */
export function emitToUser(userId: string, event: string, data: any) {
  try { getIO().to(`user:${userId}`).emit(event, data); } catch {}
}

/** Push event to ALL active members of an org */
export function emitToOrg(orgId: string, event: string, data: any) {
  try { getIO().to(`org:${orgId}`).emit(event, data); } catch {}
}

/** Push event to users subscribed to a project (kanban) */
export function emitToProject(projectId: string, event: string, data: any) {
  try { getIO().to(`project:${projectId}`).emit(event, data); } catch {}
}

/** Push event to users watching a specific task */
export function emitToTask(taskId: string, event: string, data: any) {
  try { getIO().to(`task:${taskId}`).emit(event, data); } catch {}
}