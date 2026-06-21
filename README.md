# Circuit Breaker × Token Bucket — Interactive Demo

An interactive iframe demo for the blog post *LLM Router Architecture: A Distributed Systems Perspective*. Readers can trigger all 5 verification scenarios live in the browser — each tab gets its own isolated Redis state.

## Overview

The demo shows two distributed-systems patterns working together:

- **Circuit Breaker** — `CLOSED → OPEN → HALF_OPEN` state machine that stops requests from reaching a failing LLM endpoint
- **Token Bucket** — rate-limiting reservoir with reserve/reconcile semantics; tokens are held on admission and corrected after the real token count is known

All logic runs as atomic Lua scripts (`ADMIT_SCRIPT` / `REPORT_SCRIPT`) executed against Upstash Redis. Credentials never reach the browser — Next.js API Routes act as the server-side proxy.

### 5 Scenarios

| # | Scenario | What you observe |
|---|---|---|
| 1 | Normal flow | Tokens drop by estimated amount, reconcile on REPORT |
| 2 | Failure cascade | 3 consecutive failures trip breaker to OPEN |
| 3 | Probe single-flight | 3 concurrent requests → exactly 1 gets probe lock, 2 rejected with `HALF_OPEN_WAIT` |
| 4 | Probe 429 failure | Rate-limit error on probe → immediate OPEN, bucket drained to 0 |
| 5 | Orphan recovery | Probe without REPORT → lock expires after `probe_lock_ttl_ms`, next request re-claims |

## Prerequisites

- **Node.js 20+** and **pnpm**
- **Upstash account** with a Redis database ([free tier](https://upstash.com) is sufficient)
- **Docker or Colima** — only needed to run the integration test suite

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local and fill in your Upstash credentials

# 3. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis REST token |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js development server |
| `pnpm build` | Production build |
| `pnpm test` | Run unit + integration tests (Docker/Colima must be running) |
| `pnpm test:watch` | Watch mode |

## Testing

Two independent layers:

**Pure function tests** (`lib/session.test.ts`, `lib/hint.test.ts`) — no Redis, no Docker required. Run anywhere.

**Lua script integration tests** (`lib/lua-scripts.test.ts`) — spin up `redis:7-alpine` via [testcontainers](https://testcontainers.com). No manual `docker run` needed; the container starts and stops automatically with `pnpm test`.

```
pnpm test

 Test Files  3 passed (3)
      Tests  49 passed (49)
```

> **macOS note:** Works with both Docker Desktop and Colima. The correct Docker socket is auto-resolved from `~/.colima/default/docker.sock` and `~/.docker/run/docker.sock`; no manual `DOCKER_HOST` configuration needed.

## Project Structure

```
app/
  api/
    admit/route.ts        # POST — run ADMIT_SCRIPT, return { admitted, reservationId, isProbe }
    report/route.ts       # POST — run REPORT_SCRIPT, reconcile tokens
    state/route.ts        # GET  — read circuit + bucket state
    reset/route.ts        # POST — delete session keys
    mock-call/route.ts    # POST — simulated LLM call with configurable outcome
  page.tsx                # Demo UI (Client Component)
lib/
  lua-scripts.ts          # ADMIT_SCRIPT / REPORT_SCRIPT (verbatim, no modifications)
  redis.ts                # Upstash Redis singleton + DEMO_PARAMS
  session.ts              # UUID v4 validation + key constructors
  hint.ts                 # deriveHint() — context-aware callout logic
  types.ts                # BreakerState type
components/
  CircuitBreakerDisplay.tsx
  TokenGauge.tsx
  EventLog.tsx
  ControlPanel.tsx
hooks/
  useSessionId.ts         # UUID generated once per page load (no localStorage)
```

## Deployment

Vercel is recommended. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in your project's environment variable settings.
