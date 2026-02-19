
import { PrismaClient } from '@prisma/client';
import logger from '@/utils/logger';
import { envConfig } from './env.config';

// DbClient is the database client
// It handles:
//  |->connecting to the database
//  |->sending queries
//  |->returning result

//Prisma Database Client
//Singleton pattern to prevent multiple instances

const prisma = new PrismaClient({
  log:
    envConfig.nodeEnv === 'development'? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'minimal',
});

// Test database connection
prisma
  .$connect()
  .then(() => {
    logger.info('✅ Database connected successfully');
  })
  .catch((error:any) => {
    logger.error('❌ Database connection failed:', error);
    process.exit(1); // exit with error code 1 (common convention)
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('📦 Database disconnected');
});

export default prisma;