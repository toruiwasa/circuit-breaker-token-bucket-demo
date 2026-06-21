"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import CircuitBreakerDisplay, {
  type BreakerState,
} from "@/components/CircuitBreakerDisplay";
import { deriveHint } from "@/lib/hint";
import TokenGauge from "@/components/TokenGauge";
import EventLog, { type LogEntry } from "@/components/EventLog";
import ControlPanel from "@/components/ControlPanel";
import { useSessionId } from "@/hooks/useSessionId";
import { Toaster, type ToastMessage } from "@/components/Toaster";

interface DemoState {
  state: BreakerState;
  tokens: number;
  capacity: number;
  failureCount: number;
  openedAt: number | null;
  cooldownMs: number;
  probeLockTtlMs: number;
  failureThreshold: number;
}

const DEFAULT_STATE: DemoState = {
  state: "CLOSED",
  tokens: 100,
  capacity: 100,
  failureCount: 0,
  openedAt: null,
  cooldownMs: 10_000,
  probeLockTtlMs: 5_000,
  failureThreshold: 3,
};

let logCounter = 0;
function mkId() {
  return `log-${++logCounter}`;
}

function useCountdown(
  state: BreakerState,
  openedAt: number | null,
  cooldownMs: number
): number {
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    if (state !== "OPEN" || openedAt === null) {
      setRemainingSec(0);
      return;
    }
    function tick() {
      const ms = cooldownMs - (Date.now() - openedAt!);
      setRemainingSec(Math.max(0, Math.ceil(ms / 1000)));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state, openedAt, cooldownMs]);

  return remainingSec;
}

export default function DemoPage() {
  const sessionId = useSessionId();
  const [demoState, setDemoState] = useState<DemoState>(DEFAULT_STATE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hasHistory, setHasHistory] = useState(false);

  function showToast(title: string, description?: string, variant: ToastMessage["variant"] = "error") {
    const id = `t-${++logCounter}`;
    setToasts((prev) => [...prev, { id, title, description, variant }]);
  }
  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const remainingSec = useCountdown(
    demoState.state,
    demoState.openedAt,
    demoState.cooldownMs
  );
  const hint = deriveHint(demoState.state, remainingSec, hasHistory);

  function addLog(badge: string, label: string, variant: LogEntry["variant"]) {
    setLogs((prev) =>
      [{ id: mkId(), ts: Date.now(), badge, label, variant }, ...prev].slice(0, 50)
    );
  }

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/state?sessionId=${encodeURIComponent(sessionId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setDemoState(data);
    } catch {
      // ignore
    }
  }, [sessionId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  async function apiPost<T>(path: string, body: object): Promise<T | null> {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error ?? `HTTP ${res.status}`;
        showToast(
          res.status === 429 ? "Rate limit reached" : "Request failed",
          msg,
          res.status === 429 ? "warn" : "error"
        );
        addLog("ERROR", msg, "error");
        return null;
      }
      return data as T;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      showToast("Network error", msg, "error");
      addLog("ERROR", msg, "error");
      return null;
    }
  }

  async function runSingleRequest(
    outcome: "success" | "failure" | "rate_limit" = "success"
  ): Promise<void> {
    const admitRes = await apiPost<{
      admitted: boolean;
      reason: string;
      reservationId: string | null;
      isProbe: boolean;
    }>("/api/admit", { sessionId });

    if (!admitRes) return;

    if (!admitRes.admitted) {
      addLog("REJECTED", `Reason: ${admitRes.reason}`, "error");
      if (admitRes.reason === "BREAKER_OPEN") {
        showToast("Circuit is OPEN", "All requests are blocked until cooldown expires", "error");
      }
      await fetchState();
      return;
    }

    const badge = admitRes.isProbe ? "PROBE" : "ADMITTED";
    const variant = admitRes.isProbe ? "probe" : "success";
    addLog(badge, `Reservation …${admitRes.reservationId?.slice(-8)}`, variant);

    const mockRes = await apiPost<{
      success: boolean;
      actualTokens: number;
      isRateLimitError: boolean;
      latencyMs: number;
    }>("/api/mock-call", { outcome, estimatedTokens: 10 });

    if (!mockRes) return;

    addLog(
      mockRes.success ? "LLM OK" : mockRes.isRateLimitError ? "429" : "LLM ERR",
      `${mockRes.latencyMs}ms · actual=${mockRes.actualTokens} tokens`,
      mockRes.success ? "success" : mockRes.isRateLimitError ? "warn" : "error"
    );

    await apiPost("/api/report", {
      sessionId,
      reservationId: admitRes.reservationId,
      success: mockRes.success,
      actualTokens: mockRes.actualTokens,
      isRateLimitError: mockRes.isRateLimitError,
    });

    await fetchState();
  }

  const handleSendRequest = useCallback(async () => {
    setBusy(true);
    setHasHistory(true);
    addLog("ACTION", "Send Request", "info");
    await runSingleRequest("success");
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleSimulateFailures = useCallback(async () => {
    setBusy(true);
    setHasHistory(true);
    addLog("ACTION", "Simulate Failure ×3", "info");
    for (let i = 0; i < 3; i++) {
      await runSingleRequest("failure");
    }
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleFireConcurrent = useCallback(async () => {
    setBusy(true);
    addLog("ACTION", "Fire 3 Concurrent Requests", "info");

    type AdmitResult = {
      admitted: boolean;
      reason: string;
      reservationId: string | null;
      isProbe: boolean;
    };

    const results = await Promise.allSettled([
      apiPost<AdmitResult>("/api/admit", { sessionId }),
      apiPost<AdmitResult>("/api/admit", { sessionId }),
      apiPost<AdmitResult>("/api/admit", { sessionId }),
    ]);

    const followUps: Promise<void>[] = [];

    results.forEach((result, i) => {
      if (result.status !== "fulfilled" || !result.value) return;
      const r = result.value;
      if (!r.admitted) {
        addLog("REJECTED", `#${i + 1} — ${r.reason}`, "error");
        if (r.reason === "BREAKER_OPEN") {
          showToast("Circuit is OPEN", "Request blocked", "error");
        }
        return;
      }
      addLog(
        r.isProbe ? "PROBE" : "ADMITTED",
        `#${i + 1} — reservation …${r.reservationId?.slice(-8)}`,
        r.isProbe ? "probe" : "success"
      );

      followUps.push(
        (async () => {
          const mockRes = await apiPost<{
            success: boolean;
            actualTokens: number;
            isRateLimitError: boolean;
            latencyMs: number;
          }>("/api/mock-call", { outcome: "success", estimatedTokens: 10 });
          if (!mockRes) return;

          addLog("LLM OK", `#${i + 1} · ${mockRes.latencyMs}ms`, "success");

          await apiPost("/api/report", {
            sessionId,
            reservationId: r.reservationId,
            success: mockRes.success,
            actualTokens: mockRes.actualTokens,
            isRateLimitError: mockRes.isRateLimitError,
          });
        })()
      );
    });

    await Promise.allSettled(followUps);
    await fetchState();
    setBusy(false);
    setHasHistory(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleReset = useCallback(async () => {
    setBusy(true);
    addLog("ACTION", "Reset session state", "info");
    await apiPost("/api/reset", { sessionId });
    setLogs([]);
    setHasHistory(false);
    await fetchState();
    addLog("RESET", "State cleared", "info");
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="pt-2 pb-1">
          <h1 className="text-lg font-bold tracking-tight text-white">
            Circuit Breaker × Token Bucket
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Interactive demo for LLM Router Architecture &mdash; each browser
            tab has its own isolated state
          </p>
        </header>

        <CircuitBreakerDisplay
          state={demoState.state}
          openedAt={demoState.openedAt}
          cooldownMs={demoState.cooldownMs}
        />

        <TokenGauge tokens={demoState.tokens} capacity={demoState.capacity} />

        <ControlPanel
          busy={busy}
          hasHistory={hasHistory}
          hint={hint}
          onSendRequest={handleSendRequest}
          onSimulateFailures={handleSimulateFailures}
          onFireConcurrent={handleFireConcurrent}
          onReset={handleReset}
        />

        <EventLog entries={logs} />

        <footer className="pb-4 text-center text-[10px] text-zinc-700">
          Session resets on page reload · No auth · Data expires after 1 h
        </footer>
      </div>
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
