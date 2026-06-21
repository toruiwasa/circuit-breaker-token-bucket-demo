import { NextResponse } from "next/server";
import redis, { DEMO_PARAMS, KEY_TTL_SECONDS } from "@/lib/redis";
import { REPORT_SCRIPT } from "@/lib/lua-scripts";
import { validateSessionId, circuitKey, bucketKey } from "@/lib/session";
import { rateLimiter, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId, reservationId, success, actualTokens, isRateLimitError } =
    body ?? {};

  if (!validateSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }
  if (typeof reservationId !== "string" || reservationId.length === 0) {
    return NextResponse.json({ error: "Invalid reservationId" }, { status: 400 });
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
  const ck = circuitKey(sessionId);
  const bk = bucketKey(sessionId);

  const result = (await redis.eval(REPORT_SCRIPT, [ck, bk], [
    reservationId,
    success ? "1" : "0",
    actualTokens ?? 0,
    isRateLimitError ? "1" : "0",
    DEMO_PARAMS.failureThreshold,
    now,
    DEMO_PARAMS.capacity,
  ])) as [number, string];

  await Promise.all([
    redis.expire(ck, KEY_TTL_SECONDS),
    redis.expire(bk, KEY_TTL_SECONDS),
  ]);

  return NextResponse.json({ ok: result[0] === 1, status: result[1] });
}
