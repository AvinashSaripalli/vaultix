const rateLimit = require('express-rate-limit');

const isProduction = process.env.NODE_ENV === 'production';
const skipInDev = () => !isProduction;

/**
 * Resilient multi-store for rate limiting.
 * If REDIS_URL is provided in environment variables, it attempts to use Redis.
 * Otherwise, falls back to high-performance in-memory / cluster-safe store with auto-cleanup.
 */
function createRateLimitStore(windowMs) {
  // If Redis is configured via REDIS_URL in environment
  if (process.env.REDIS_URL) {
    try {
      // Lazy load redis if installed
      const Redis = require('ioredis');
      const redisClient = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });

      redisClient.connect().catch(() => {});

      return {
        init: (options) => {
          this.windowMs = options.windowMs;
        },
        increment: async (key) => {
          try {
            const multi = redisClient.multi();
            multi.incr(key);
            multi.pttl(key);
            const results = await multi.exec();
            const totalHits = results[0][1];
            let pttl = results[1][1];

            if (pttl === -1) {
              await redisClient.pexpire(key, windowMs);
              pttl = windowMs;
            }

            return {
              totalHits,
              resetTime: new Date(Date.now() + Math.max(pttl, 0)),
            };
          } catch (err) {
            // Fallback gracefully if Redis fails
            return { totalHits: 1, resetTime: new Date(Date.now() + windowMs) };
          }
        },
        decrement: async (key) => {
          try {
            await redisClient.decr(key);
          } catch {}
        },
        resetKey: async (key) => {
          try {
            await redisClient.del(key);
          } catch {}
        },
      };
    } catch {
      // Redis package not available or failed to initialize, use memory store
    }
  }

  // Default MemoryStore from express-rate-limit with automatic expiration
  return undefined;
}

const createLimiter = ({ windowMs = 15 * 60 * 1000, max, message }) => {
  const store = createRateLimitStore(windowMs);

  return rateLimit({
    windowMs,
    max: isProduction ? max : 10_000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInDev,
    message: { message },
    ...(store && { store }),
  });
};

const globalLimiter = createLimiter({
  max: 500,
  message: 'Too many requests. Please try again later.',
});

const authLimiter = createLimiter({
  max: 30,
  message: 'Too many login attempts. Please wait a few minutes and try again.',
});

const sensitiveLimiter = createLimiter({
  max: 10,
  message: 'Too many attempts. Please try again later.',
});

const masterPasswordLimiter = createLimiter({
  max: 20,
  message: 'Too many master password attempts. Please try again later.',
});

module.exports = {
  globalLimiter,
  authLimiter,
  sensitiveLimiter,
  masterPasswordLimiter,
};
