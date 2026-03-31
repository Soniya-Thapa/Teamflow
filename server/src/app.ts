
import express from 'express';
import type { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { errorHandler, notFoundHandler } from '@/middleware/error.middleware';
import logger from '@/utils/logger';
import { envConfig } from './config/env.config';
import '@/modules/email/email.processor';

// Import routes
import authRoutes from '@/modules/auth/auth.routes';
import organizationRoutes from '@/modules/organizations/organization.routes';
import adminRoutes from '@/modules/admin/admin.routes';
import roleRoutes from '@/modules/roles/role.routes';
import teamRoutes from '@/modules/teams/team.routes';
import {orgInvitationRouter,publicInvitationRouter} from '@/modules/invitations/invitation.routes';
import projectRoutes from '@/modules/projects/project.routes';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: envConfig.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Body parser

// express.json()
// 👉 Reads JSON data
// express.urlencoded()
// 👉 Reads form data
// Both convert → JavaScript object → req.body
// These middlewares only affect incoming request, not response.

app.use(express.json({ limit: '10mb' })); //If the request body is JSON → convert it into a JavaScript object → put it inside req.body. ❗ It only works for request (req), not response (res).

// Fix BigInt JSON serialization
// BigInt is used for maxStorage (bytes) — JavaScript's JSON.stringify
// doesn't support BigInt natively, so we convert it to string

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// HTTP request logging
if (envConfig.nodeEnv === 'development') {
// It shows: HTTP method, URL, Status code, Response time, Colored output
  app.use(morgan('dev'));
} else {
// It logs much more information: Client IP, User, Date & time, Method, URL, Status code, Response size, Referrer, User agent (browser info)
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    }),
  );organizationRoutes
}

// Health check endpoint: Simple route to confirm server is alive.
// Used by: Docker, Kubernetes, Load balancers, Cloud platforms
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'TeamFlow API is running',
    timestamp: new Date().toISOString(),
    environment: envConfig.nodeEnv,
    uptime: process.uptime(),
  });
});

// API version endpoint
const API_PREFIX = envConfig.apiPrefix;

app.get(`${API_PREFIX}`, (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Welcome to TeamFlow API',
    version: '1.0.0',
    documentation: `${req.protocol}://${req.get('host')}${API_PREFIX}/docs`,
  });
});

// Routes will be mounted here
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/organizations`, organizationRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/organizations/:id/roles`, roleRoutes);
app.use(`${API_PREFIX}/organizations/:id/teams`, teamRoutes);
app.use(`${API_PREFIX}/organizations/:id/invitations`, orgInvitationRouter);
app.use(`${API_PREFIX}/invitations`, publicInvitationRouter);
app.use(`${API_PREFIX}/organizations/:id/projects`, projectRoutes);

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Error handler - must be last
app.use(errorHandler);

export default app;