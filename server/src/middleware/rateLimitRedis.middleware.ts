/**
 * @file rateLimitRedis.middleware.ts
 * @description Redis-backed sliding window rate limiter.
 *
 * WHY REDIS INSTEAD OF MEMORY?
 * The existing rateLimit.middleware.ts uses express-rate-limit with memory store.
 * Memory store resets on server restart and doesn't work with multiple server instances.
 * Redis store persists across restarts and is shared between all server instances.
 *
 * SLIDING WINDOW ALGORITHM:
 * For each request: count how many requests this IP made in the last N seconds.
 * If count >= limit → reject with 429.
 * Implementation: store a sorted set in Redis with timestamps as scores.
 * Each request adds current timestamp. Expire old entries (> window) on each check.
 *
 * PER-PLAN LIMITS:
 *   FREE        → 100 requests per minute
 *   PRO         → 500 requests per minute
 *   ENTERPRISE  → 2000 requests per minute (effectively unlimited for most use cases)
 *
 * HEADERS RETURNED:
 *   X-RateLimit-Limit     → max requests allowed
 *   X-RateLimit-Remaining → requests remaining in current window
 *   X-RateLimit-Reset     → Unix timestamp when window resets
 *   Retry-After           → seconds to wait (only on 429 response)
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { envConfig } from '@/config/env.config';
import logger from '@/utils/logger';

// ─────────────────────────────────────────
// REDIS CLIENT
// ─────────────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: envConfig.redisHost,
      port: Number(envConfig.redisPort),
      password: envConfig.redisPassword || undefined,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      logger.error('Redis rate limiter error', { err: err.message });
    });
  }
  return redis;
}

// ─────────────────────────────────────────
// PLAN LIMITS
// ─────────────────────────────────────────

const PLAN_LIMITS: Record<string, number> = {
  FREE: 100,
  PRO: 500,
  ENTERPRISE: 2000,
};

// Window size in seconds
const WINDOW_SECONDS = 60;

// ─────────────────────────────────────────
// MIDDLEWARE FACTORY
// ─────────────────────────────────────────

/**
 * Create a rate limiter middleware.
 *
 * @param defaultLimit - Fallback limit when no org context available
 */
export function createRateLimiter(defaultLimit = 100) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const client = getRedis();
      const now = Date.now();
      const windowStart = now - WINDOW_SECONDS * 1000;

      // Use org plan limit if available, fall back to default
      let limit = defaultLimit;
      if (req.organizationId) {
        const org = await import('@/config/database').then((m) =>
          m.default.organization.findUnique({
            where: { id: req.organizationId },
            select: { plan: true },
          }),
        );
        if (org?.plan) {
          limit = PLAN_LIMITS[org.plan] ?? defaultLimit;
        }
      }

      // Key by IP + route for fine-grained limiting
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const key = `rate:${ip}:${req.path.split('/')[1]}`;

      // Sliding window: remove old entries, add current, count
      const pipeline = client.pipeline();
      pipeline.zremrangebyscore(key, '-inf', windowStart); // remove expired
      pipeline.zadd(key, now, `${now}-${Math.random()}`);  // add current request
      pipeline.zcard(key);                                   // count in window
      pipeline.expire(key, WINDOW_SECONDS);                  // auto-cleanup

      const results = await pipeline.exec();
      const count = (results?.[2]?.[1] as number) || 0;

      const remaining = Math.max(0, limit - count);
      const resetAt = Math.ceil((now + WINDOW_SECONDS * 1000) / 1000);

      // Set standard rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetAt);

      if (count > limit) {
        const retryAfter = Math.ceil(
          (windowStart + WINDOW_SECONDS * 1000 - now) / 1000,
        );

        res.setHeader('Retry-After', retryAfter);

        logger.warn('Rate limit exceeded', { ip, key, count, limit });

        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please slow down.',
          code: 'RATE_LIMIT_EXCEEDED',
          data: {
            limit,
            current: count,
            retryAfter,
            upgradeMessage:
              'Upgrade your plan for higher rate limits.',
          },
        });
      }

      next();
    } catch (error) {
      // If Redis is down, fail open — don't block requests
      logger.error('Rate limiter error — failing open', { error });
      next();
    }
  };
}

/** Standard API rate limiter (plan-based) */
export const apiRateLimit = createRateLimiter(100);

/** Strict auth rate limiter (prevents brute force) */
export const strictRateLimit = createRateLimiter(20);