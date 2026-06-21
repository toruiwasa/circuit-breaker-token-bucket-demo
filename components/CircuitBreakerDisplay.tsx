"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip } from "radix-ui";
import type { BreakerState } from "@/lib/types";

export type { BreakerState };

interface Props {
  state: BreakerState;
  openedAt: number | null;
  cooldownMs: number;
}

const STATE_META: Record<
  BreakerState,
  { label: string; color: string; glow: string; description: string }
> = {
  CLOSED: {
    label: "CLOSED",
    color: "bg-teal-500",
    glow: "shadow-teal-500/60",
    description: "Circuit is healthy. Requests flow through normally.",
  },
  HALF_OPEN: {
    label: "HALF-OPEN",
    color: "bg-amber-400",
    glow: "shadow-amber-400/60",
    description:
      "Cooldown elapsed. One probe request is allowed through to test recovery.",
  },
  OPEN: {
    label: "OPEN",
    color: "bg-orange-500",
    glow: "shadow-orange-500/60",
    description:
      "Circuit tripped. All requests are rejected until cooldown expires.",
  },
};

const STATES: BreakerState[] = ["CLOSED", "HALF_OPEN", "OPEN"];

export default function CircuitBreakerDisplay({
  state,
  openedAt,
  cooldownMs,
}: Props) {
  const meta = STATE_META[state];
  const now = Date.now();
  const remainingMs =
    state === "OPEN" && openedAt
      ? Math.max(0, cooldownMs - (now - openedAt))
      : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Circuit Breaker
        </h2>
        {state === "OPEN" && remainingSec > 0 && (
          <span className="text-xs text-red-400">
            cooldown {remainingSec}s
          </span>
        )}
      </div>

      <Tooltip.Provider delayDuration={200}>
        <div className="flex items-center justify-between gap-2">
          {STATES.map((s, i) => {
            const m = STATE_META[s];
            const isActive = s === state;
            return (
              <Tooltip.Root key={s}>
                <Tooltip.Trigger asChild>
                  <div className="flex flex-1 flex-col items-center gap-2">
                    <motion.div
                      animate={
                        isActive
                          ? { scale: [1, 1.08, 1], opacity: 1 }
                          : { scale: 1, opacity: 0.35 }
                      }
                      transition={
                        isActive
                          ? { duration: 0.5, ease: "easeInOut" }
                          : { duration: 0.3 }
                      }
                      className={`h-10 w-10 rounded-full ${m.color} ${
                        isActive ? `shadow-lg ${m.glow}` : ""
                      } cursor-default`}
                    />
                    <span
                      className={`text-[10px] font-semibold tracking-wide ${
                        isActive ? "text-white" : "text-zinc-600"
                      }`}
                    >
                      {m.label}
                    </span>
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="z-50 max-w-[200px] rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 shadow-xl"
                    sideOffset={6}
                  >
                    {m.description}
                    <Tooltip.Arrow className="fill-zinc-800" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          }).reduce<React.ReactNode[]>((acc, node, i) => {
            if (i > 0) {
              acc.push(
                <div key={`arrow-${i}`} className="flex-shrink-0 text-zinc-600">
                  →
                </div>
              );
            }
            acc.push(node);
            return acc;
          }, [])}
        </div>
      </Tooltip.Provider>

      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className={`mt-4 rounded-lg px-3 py-2 text-center text-sm font-medium ${meta.color} bg-opacity-20 text-white`}
        >
          {STATE_META[state].description}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
