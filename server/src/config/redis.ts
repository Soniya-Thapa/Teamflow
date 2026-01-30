import Redis from 'ioredis';
import logger from '@/utils/logger';
import { envConfig } from './env.config';

/**
 * Redis Client Configuration
 * Supports both local development and cloud deployment
 */

let redis: Redis;

// Cloud platforms provide REDIS_URL
if (envConfig.redisUrl) {
  logger.info('🔌 Connecting to Redis using REDIS_URL');
  redis = new Redis(envConfig.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });
} else {
  // Local development
  logger.info('🔌 Connecting to Redis using local configuration');
  redis = new Redis({
    host: envConfig.redisHost,
    port: parseInt(envConfig.redisPort),
    password: envConfig.redisPassword || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });
}

redis.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('❌ Redis connection error:', error);
});

redis.on('close', () => {
  logger.warn('⚠️  Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('🔄 Redis reconnecting...');
});

export default redis;