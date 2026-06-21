import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default redis;

export const KEY_TTL_SECONDS = 3600;

export const DEMO_PARAMS = {
  cooldownMs: 10_000,
  probeLockTtlMs: 5_000,
  capacity: 100,
  refillRate: 0.002,
  failureThreshold: 3,
  estimatedTokens: 10,
  reservationTtlMs: 10_000,
} as const;
