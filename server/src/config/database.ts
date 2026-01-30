import { PrismaClient } from '@prisma/client';
import logger from '@/utils/logger';
import { envConfig } from './env.config';

//Prisma Database Client
//Singleton pattern to prevent multiple instances

const prisma = new PrismaClient({
  log:
    envConfig.nodeEnv === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
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
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('📦 Database disconnected');
});

export default prisma;