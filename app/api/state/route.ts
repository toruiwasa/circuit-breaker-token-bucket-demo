import { NextResponse } from "next/server";
import redis, { DEMO_PARAMS } from "@/lib/redis";
import { validateSessionId, circuitKey, bucketKey } from "@/lib/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!validateSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }

  const ck = circuitKey(sessionId);
  const bk = bucketKey(sessionId);

  const [circuit, bucket] = await Promise.all([
    redis.hgetall(ck),
    redis.hgetall(bk),
  ]);

  const tokens =
    bucket && bucket.tokens != null
      ? Math.min(DEMO_PARAMS.capacity, parseFloat(String(bucket.tokens)))
      : DEMO_PARAMS.capacity;

  return NextResponse.json({
    state: (circuit?.state as string) ?? "CLOSED",
    tokens: Math.round(tokens * 10) / 10,
    capacity: DEMO_PARAMS.capacity,
    failureCount: parseInt(String(circuit?.failure_count ?? "0"), 10),
    openedAt: circuit?.opened_at ? parseInt(String(circuit.opened_at), 10) : null,
    cooldownMs: DEMO_PARAMS.cooldownMs,
    probeLockTtlMs: DEMO_PARAMS.probeLockTtlMs,
    failureThreshold: DEMO_PARAMS.failureThreshold,
  });
}
