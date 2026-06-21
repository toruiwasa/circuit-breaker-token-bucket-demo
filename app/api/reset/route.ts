import { NextResponse } from "next/server";
import redis from "@/lib/redis";
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

  await redis.del(circuitKey(sessionId), bucketKey(sessionId));

  return NextResponse.json({ ok: true });
}
