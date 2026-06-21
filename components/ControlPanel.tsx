"use client";
import { Tooltip } from "radix-ui";

type StepVariant = "success" | "failure" | "warn";

const STEP_BADGE_STYLES: Record<StepVariant, string> = {
  success: "bg-teal-500/20 text-teal-400 border border-teal-500/30",
  failure: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  warn: "bg-amber-400/20 text-amber-400 border border-amber-400/30",
};

interface ButtonDef {
  step?: number;
  stepVariant?: StepVariant;
  label: string;
  sublabel: string;
  tooltip: string;
  onClick: () => void;
  disabled: boolean;
}

function ActionButton({ step, stepVariant = "success", label, sublabel, tooltip, onClick, disabled }: ButtonDef) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          className="w-full cursor-pointer rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3 text-left transition enabled:hover:bg-zinc-700 enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onClick}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            {step != null && (
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${STEP_BADGE_STYLES[stepVariant]}`}>
                Step {step}
              </span>
            )}
            <span className="text-sm font-semibold text-white">{label}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{sublabel}</p>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="z-50 max-w-[260px] rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-xs leading-relaxed text-zinc-300 shadow-xl"
          side="right"
          sideOffset={8}
        >
          {tooltip}
          <Tooltip.Arrow className="fill-zinc-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

interface Props {
  busy: boolean;
  hasHistory: boolean;
  hint: string | null;
  onSendRequest: () => void;
  onSimulateFailures: () => void;
  onFireConcurrent: () => void;
  onReset: () => void;
}

export default function ControlPanel({
  busy,
  hasHistory,
  hint,
  onSendRequest,
  onSimulateFailures,
  onFireConcurrent,
  onReset,
}: Props) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Scenarios
        </h2>

        {hint && (
          <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300">
            {hint}
          </div>
        )}

        <div className="space-y-2">
          <ActionButton
            step={1}
            stepVariant="success"
            label="Send Request"
            sublabel="ADMIT → mock LLM call (success) → REPORT"
            tooltip="Runs the happy path. ADMIT reserves tokens from the bucket, the mock LLM call succeeds, and REPORT reconciles the actual vs. estimated tokens. Watch the gauge dip then partially recover."
            onClick={onSendRequest}
            disabled={busy}
          />
          <ActionButton
            step={2}
            stepVariant="failure"
            label="Simulate Failure ×3"
            sublabel="3 consecutive failures → breaker trips to OPEN"
            tooltip="Sends 3 failures back-to-back. After the 3rd, the failure counter hits the threshold and the circuit breaker trips to OPEN — all subsequent requests are rejected instantly without reaching the LLM."
            onClick={onSimulateFailures}
            disabled={busy}
          />
          <ActionButton
            step={3}
            stepVariant="warn"
            label="Fire 3 Concurrent Requests"
            sublabel="3 parallel ADMITs — in HALF-OPEN, only 1 gets probe lock"
            tooltip="Best run right after the 10 s cooldown expires. All 3 ADMITs land simultaneously. Because the breaker is HALF-OPEN, only one request claims the probe lock (isProbe=true). The other two are rejected immediately with HALF_OPEN_WAIT."
            onClick={onFireConcurrent}
            disabled={busy}
          />
          <ActionButton
            label="Reset"
            sublabel="Clear your session's Redis keys and start fresh"
            tooltip="Deletes the circuit and bucket keys tied to your session ID. Other readers' state is completely unaffected — each tab has its own isolated keys."
            onClick={onReset}
            disabled={busy || !hasHistory}
          />
        </div>

        <p className="mt-4 text-[10px] leading-relaxed text-zinc-600">
          Demo values — not production defaults: cooldown 10 s · probe lock 5 s ·
          capacity 100 tokens · failure threshold 3
        </p>
      </div>
    </Tooltip.Provider>
  );
}
