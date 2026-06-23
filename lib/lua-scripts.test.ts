import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import Redis from "ioredis";
import { ADMIT_SCRIPT, REPORT_SCRIPT } from "./lua-scripts";

const SESSION = "test-session";
const CIRCUIT = `circuit:${SESSION}:openai`;
const BUCKET = `bucket:${SESSION}:openai`;

const CAPACITY = 100;
const REFILL_RATE = 0.002;
const COOLDOWN_MS = 10_000;
const PROBE_LOCK_TTL_MS = 5_000;
const FAILURE_THRESHOLD = 3;
const ESTIMATED = 10;
const RESERVATION_TTL = 10_000;

let client: Redis;

beforeAll(() => {
  client = new Redis(process.env.REDIS_TEST_URL!);
});

afterAll(async () => {
  await client.quit();
});

beforeEach(async () => {
  await client.del(CIRCUIT, BUCKET);
});

function now() {
  return Date.now();
}

async function admit(ts: number, reservationId: string) {
  return client.eval(
    ADMIT_SCRIPT, 2, CIRCUIT, BUCKET,
    String(ts), String(COOLDOWN_MS), String(PROBE_LOCK_TTL_MS),
    String(CAPACITY), String(REFILL_RATE), String(ESTIMATED),
    reservationId, String(RESERVATION_TTL)
  ) as Promise<[number, string, number]>;
}

async function report(
  reservationId: string,
  success: boolean,
  actualTokens: number,
  isRateLimitErr: boolean,
  ts: number
) {
  return client.eval(
    REPORT_SCRIPT, 2, CIRCUIT, BUCKET,
    reservationId, success ? "1" : "0", String(actualTokens),
    isRateLimitErr ? "1" : "0", String(FAILURE_THRESHOLD), String(ts), String(CAPACITY)
  ) as Promise<[number, string]>;
}

// ─── ADMIT ────────────────────────────────────────────────────────────────────

describe("ADMIT_SCRIPT", () => {
  it("admits on fresh state (no keys)", async () => {
    const ts = now();
    const [admitted, , isProbe] = await admit(ts, "res-1");
    expect(admitted).toBe(1);
    expect(isProbe).toBe(0);
  });

  it("deducts estimated tokens from the bucket", async () => {
    const ts = now();
    await admit(ts, "res-1");
    const tokens = Number(await client.hget(BUCKET, "tokens"));
    expect(tokens).toBeCloseTo(CAPACITY - ESTIMATED, 0);
  });

  it("rejects when circuit is OPEN and cooldown has not expired", async () => {
    const ts = now();
    await client.hset(CIRCUIT, "state", "OPEN", "opened_at", String(ts));
    const [admitted, reason] = await admit(ts, "res-1");
    expect(admitted).toBe(0);
    expect(reason).toBe("BREAKER_OPEN");
  });

  it("admits as probe when OPEN and cooldown has expired", async () => {
    const ts = now();
    await client.hset(CIRCUIT, "state", "OPEN", "opened_at", String(ts - COOLDOWN_MS - 1));
    const [admitted, , isProbe] = await admit(ts, "res-1");
    expect(admitted).toBe(1);
    expect(isProbe).toBe(1);
  });

  it("rejects when OPEN cooldown expired but probe already in flight", async () => {
    const ts = now();
    await client.hset(
      CIRCUIT,
      "state", "OPEN",
      "opened_at", String(ts - COOLDOWN_MS - 1),
      "probe_in_flight", "1",
      "probe_claimed_at", String(ts)
    );
    const [admitted, reason] = await admit(ts, "res-1");
    expect(admitted).toBe(0);
    expect(reason).toBe("PROBE_IN_PROGRESS");
  });

  it("admits as probe when HALF_OPEN and no probe in flight", async () => {
    const ts = now();
    await client.hset(CIRCUIT, "state", "HALF_OPEN");
    const [admitted, , isProbe] = await admit(ts, "res-1");
    expect(admitted).toBe(1);
    expect(isProbe).toBe(1);
  });

  it("rejects when HALF_OPEN and probe already in flight", async () => {
    const ts = now();
    await client.hset(
      CIRCUIT,
      "state", "HALF_OPEN",
      "probe_in_flight", "1",
      "probe_claimed_at", String(ts)
    );
    const [admitted, reason] = await admit(ts, "res-1");
    expect(admitted).toBe(0);
    expect(reason).toBe("HALF_OPEN_WAIT");
  });

  it("allows new probe claim after probe_lock_ttl expires in HALF_OPEN", async () => {
    const ts = now();
    await client.hset(
      CIRCUIT,
      "state", "HALF_OPEN",
      "probe_in_flight", "1",
      "probe_claimed_at", String(ts - PROBE_LOCK_TTL_MS - 1)
    );
    const [admitted, , isProbe] = await admit(ts, "orphan-half-open");
    expect(admitted).toBe(1);
    expect(isProbe).toBe(1);
  });

  it("allows new probe claim after probe_lock_ttl expires in OPEN (cooldown expired)", async () => {
    const ts = now();
    await client.hset(
      CIRCUIT,
      "state", "OPEN",
      "opened_at", String(ts - COOLDOWN_MS - 1),
      "probe_in_flight", "1",
      "probe_claimed_at", String(ts - PROBE_LOCK_TTL_MS - 1)
    );
    const [admitted, , isProbe] = await admit(ts, "orphan-open");
    expect(admitted).toBe(1);
    expect(isProbe).toBe(1);
  });

  it("rejects when token bucket is insufficient", async () => {
    const ts = now();
    await client.hset(BUCKET, "tokens", "5", "last_refill", String(ts));
    const [admitted, reason] = await admit(ts, "res-1");
    expect(admitted).toBe(0);
    expect(reason).toBe("INSUFFICIENT_TOKENS");
  });
});

// ─── REPORT ───────────────────────────────────────────────────────────────────

describe("REPORT_SCRIPT", () => {
  it("returns RESERVATION_EXPIRED when no prior ADMIT", async () => {
    const [ok, status] = await report("no-such-id", true, 8, false, now());
    expect(ok).toBe(0);
    expect(status).toBe("RESERVATION_EXPIRED");
  });

  it("closes circuit and reconciles tokens on success", async () => {
    const ts = now();
    const [, resId] = await admit(ts, "res-ok");
    const [ok, status] = await report(resId, true, 8, false, ts);
    expect(ok).toBe(1);
    expect(status).toBe("OK");
    expect(await client.hget(CIRCUIT, "state")).toBe("CLOSED");
    expect(await client.hget(CIRCUIT, "failure_count")).toBe("0");
    // delta = estimated(10) - actual(8) = 2 returned to bucket
    const tokens = Number(await client.hget(BUCKET, "tokens"));
    expect(tokens).toBeCloseTo(CAPACITY - ESTIMATED + 2, 0);
  });

  it("increments failure_count below threshold", async () => {
    const ts = now();
    const [, resId] = await admit(ts, "res-f");
    await report(resId, false, 0, false, ts);
    expect(await client.hget(CIRCUIT, "failure_count")).toBe("1");
    // state field is not written for sub-threshold failures;
    // CLOSED is the Lua read-time fallback, not a persisted value.
    expect(await client.hget(CIRCUIT, "state")).not.toBe("OPEN");
  });

  it("trips circuit to OPEN when failure_count hits threshold", async () => {
    const ts = now();
    await client.hset(CIRCUIT, "failure_count", String(FAILURE_THRESHOLD - 1));
    const [, resId] = await admit(ts, "res-trip");
    await report(resId, false, 0, false, ts);
    expect(await client.hget(CIRCUIT, "state")).toBe("OPEN");
  });

  it("drains tokens to 0 on rate limit error", async () => {
    const ts = now();
    const [, resId] = await admit(ts, "res-rl");
    await report(resId, false, 0, true, ts);
    expect(await client.hget(BUCKET, "tokens")).toBe("0");
  });

  it("re-opens circuit immediately on probe failure", async () => {
    const ts = now();
    await client.hset(CIRCUIT, "state", "HALF_OPEN");
    const [, resId] = await admit(ts, "res-probe");
    await report(resId, false, 0, false, ts);
    expect(await client.hget(CIRCUIT, "state")).toBe("OPEN");
  });
});

// ─── Round trips ──────────────────────────────────────────────────────────────

describe("Round trips", () => {
  it("normal flow: ADMIT → REPORT(success) → state stays CLOSED", async () => {
    const ts = now();
    const [admitted, resId] = await admit(ts, "rt-1");
    expect(admitted).toBe(1);
    const [ok] = await report(resId, true, 8, false, ts);
    expect(ok).toBe(1);
    expect(await client.hget(CIRCUIT, "state")).toBe("CLOSED");
  });

  it("failure cascade: 3 failures trip the breaker to OPEN", async () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      const ts = now();
      const [, resId] = await admit(ts, `rt-fail-${i}`);
      await report(resId, false, 0, false, ts);
    }
    expect(await client.hget(CIRCUIT, "state")).toBe("OPEN");
  });

  it("exactly one probe granted out of 3 concurrent admits (HALF_OPEN)", async () => {
    const ts = now();
    await client.hset(CIRCUIT, "state", "HALF_OPEN");
    const results = await Promise.all([
      admit(ts, "c-1"),
      admit(ts, "c-2"),
      admit(ts, "c-3"),
    ]);
    const probes = results.filter(([, , isProbe]) => isProbe === 1);
    const waits  = results.filter(([ok, reason]) => ok === 0 && reason === "HALF_OPEN_WAIT");
    expect(probes).toHaveLength(1);
    expect(waits).toHaveLength(2);
  });

  it("probe failure with 429: immediate OPEN revert + bucket zeroed", async () => {
    const ts = now();
    await client.hset(CIRCUIT, "state", "HALF_OPEN");
    const [, resId] = await admit(ts, "rt-probe-429");
    await report(resId, false, 0, true, ts); // isRateLimitErr=true, isProbe=true
    expect(await client.hget(CIRCUIT, "state")).toBe("OPEN");
    expect(await client.hget(BUCKET, "tokens")).toBe("0");
  });

  it("recovery: probe success closes the circuit", async () => {
    const ts = now();
    // pre-set OPEN with expired cooldown
    await client.hset(CIRCUIT, "state", "OPEN", "opened_at", String(ts - COOLDOWN_MS - 1));
    const [admitted, resId, isProbe] = await admit(ts, "rt-probe");
    expect(admitted).toBe(1);
    expect(isProbe).toBe(1);
    await report(resId, true, 8, false, ts);
    expect(await client.hget(CIRCUIT, "state")).toBe("CLOSED");
  });
});
