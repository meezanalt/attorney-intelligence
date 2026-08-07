import { Redis } from '@upstash/redis';
import { getChatRateLimitModel } from './chat-db';
import { hashClientIp } from './ip-hash';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the current minute bucket resets. */
  retryAfterSeconds: number;
  /**
   * false when both Redis and MongoDB were unavailable — the request was allowed
   * without rate limiting (intentional fail-open to preserve search availability).
   */
  enforced: boolean;
}

const BUCKET_TTL_SECONDS = 90;
const DEFAULT_LIMIT_RPM = 20;

function getLimitRpm(): number {
  const parsed = Number.parseInt(process.env.CHAT_RATE_LIMIT_RPM ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT_RPM;
}

function minuteBucket(now = Date.now()): number {
  return Math.floor(now / 60_000);
}

function secondsUntilNextBucket(now = Date.now()): number {
  const elapsed = now % 60_000;
  return Math.max(1, Math.ceil((60_000 - elapsed) / 1000));
}

function buildRateLimitKey(ipHash: string, bucket: number): string {
  return `chat:rl:${ipHash}:${bucket}`;
}

function isUpstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  if (!isUpstashConfigured()) {
    redisClient = null;
    return redisClient;
  }
  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return redisClient;
}

function failOpenResult(limit: number, retryAfterSeconds: number): RateLimitResult {
  return {
    allowed: true,
    remaining: limit,
    limit,
    retryAfterSeconds,
    enforced: false,
  };
}

async function checkUpstash(
  key: string,
  limit: number,
  retryAfterSeconds: number
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Upstash Redis is not configured');
  }

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, BUCKET_TTL_SECONDS);
  }

  const allowed = count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    limit,
    retryAfterSeconds,
    enforced: true,
  };
}

async function checkMongo(
  key: string,
  limit: number,
  retryAfterSeconds: number
): Promise<RateLimitResult> {
  const ChatRateLimitModel = await getChatRateLimitModel();

  const doc = await ChatRateLimitModel.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, new: true }
  );

  const count = doc?.count ?? 1;
  const allowed = count <= limit;

  return {
    allowed,
    remaining: Math.max(0, limit - count),
    limit,
    retryAfterSeconds,
    enforced: true,
  };
}

/**
 * Fixed-window rate limiter keyed by hashed IP + minute bucket.
 *
 * Store priority: Upstash Redis (primary) → MongoDB (fallback).
 *
 * Failure policy (intentional fail-open): if both stores error on the same request,
 * the request is allowed through with `enforced: false`. Search availability is
 * preferred over blocking users when the rate-limit infrastructure is down.
 * A warning is logged so ops can detect the gap.
 */
export async function checkChatRateLimit(ip: string): Promise<RateLimitResult> {
  const limit = getLimitRpm();
  const bucket = minuteBucket();
  const retryAfterSeconds = secondsUntilNextBucket();
  const key = buildRateLimitKey(hashClientIp(ip), bucket);

  if (isUpstashConfigured()) {
    try {
      return await checkUpstash(key, limit, retryAfterSeconds);
    } catch (err) {
      console.error('[chat/rate-limiter] Upstash error, falling back to MongoDB:', err);
    }
  }

  try {
    return await checkMongo(key, limit, retryAfterSeconds);
  } catch (err) {
    console.error(
      '[chat/rate-limiter] MongoDB fallback failed — failing open (request allowed, rate limit not enforced):',
      err
    );
    return failOpenResult(limit, retryAfterSeconds);
  }
}
