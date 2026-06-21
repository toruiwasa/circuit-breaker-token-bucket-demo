import { NextResponse } from "next/server";
import redis, { DEMO_PARAMS, KEY_TTL_SECONDS } from "@/lib/redis";
import { ADMIT_SCRIPT } from "@/lib/lua-scripts";
import { validateSessionId, circuitKey, bucketKey } from "@/lib/session";
import { rateLimiter, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId } = body ?? {};

  if (!validateSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const { success: allowed } = await rateLimiter.limit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const now = Date.now();
  const reservationId = `${sessionId}-${crypto.randomUUID()}`;
  const ck = circuitKey(sessionId);
  const bk = bucketKey(sessionId);

  const result = (await redis.eval(
    ADMIT_SCRIPT,
    [ck, bk],
    [
      now,
      DEMO_PARAMS.cooldownMs,
      DEMO_PARAMS.probeLockTtlMs,
      DEMO_PARAMS.capacity,
      DEMO_PARAMS.refillRate,
      DEMO_PARAMS.estimatedTokens,
      reservationId,
      DEMO_PARAMS.reservationTtlMs,
    ]
  )) as [number, string, number];

  await Promise.all([
    redis.expire(ck, KEY_TTL_SECONDS),
    redis.expire(bk, KEY_TTL_SECONDS),
  ]);

  const admitted = result[0] === 1;
  return NextResponse.json({
    admitted,
    reason: admitted ? "OK" : result[1],
    reservationId: admitted ? result[1] : null,
    isProbe: result[2] === 1,
  });
}
