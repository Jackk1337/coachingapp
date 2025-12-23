import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { validateRateLimitEnv } from './env-validation';

// Validate rate limiting environment variables (only on server-side)
if (typeof window === 'undefined') {
  try {
    validateRateLimitEnv();
  } catch (error) {
    // In development, log the error but don't crash
    if (process.env.NODE_ENV === 'development') {
      console.warn('Rate limiting environment validation warning:', error instanceof Error ? error.message : String(error));
    }
  }
}

// Initialize Redis client if environment variables are available
// If not available, rate limiting will be disabled (for development)
let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"), // 10 requests per hour per user
    analytics: true,
  });
} else {
  console.warn('Rate limiting disabled: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not configured');
}

export { ratelimit };

