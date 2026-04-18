
import http from 'http';
import app from './app';
import logger from '@/utils/logger';
import prisma from '@/config/database';
import redis from '@/config/redis';
import { envConfig } from './config/env.config';
import { setupPrismaTenantMiddleware } from './middleware/tenant.middleware';
import { initializeSocket } from './config/socket';

//Setup Prisma tenant middleware
setupPrismaTenantMiddleware();

const PORT = envConfig.portNumber;

// Create HTTP server wrapping Express app
const httpServer = http.createServer(app);

// Initialize Socket.io on the same HTTP server
initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${envConfig.nodeEnv}`);
  logger.info(`API: http://localhost:${PORT}${envConfig.apiPrefix}`);
  logger.info(`WebSocket: ws://localhost:${PORT}`);
});

// const server = app.listen(PORT, () => {
//   logger.info(`🚀 TeamFlow API is running on port ${PORT}`);
//   logger.info(`📝 Environment: ${envConfig.nodeEnv}`);
//   logger.info(`🔗 API: http://localhost:${PORT}${envConfig.apiPrefix}`);
//   logger.info(`💚 Health: http://localhost:${PORT}/health`);
// });

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  httpServer.close(async () => {
    logger.info('🔴 HTTP server closed');

    try {
      // Close database connection
      await prisma.$disconnect();
      logger.info('📦 Database connection closed');

      // Close Redis connection
      await redis.quit();
      logger.info('📦 Redis connection closed');

      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('⚠️  Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', reason);
  throw reason;
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

export default httpServer;

