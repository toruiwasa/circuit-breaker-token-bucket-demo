import type { BreakerState } from "@/lib/types";

export function deriveHint(
  state: BreakerState,
  remainingSec: number,
  hasHistory: boolean
): string | null {
  if (state === "CLOSED" && !hasHistory) {
    return "Step 1 is a good starting point — it shows the normal happy-path flow.";
  }
  if (state === "OPEN" && remainingSec > 0) {
    return `Breaker is OPEN. Step 3 will be ready in ${remainingSec}s — the cooldown must expire first.`;
  }
  if (state === "OPEN" && remainingSec === 0) {
    return "Cooldown expired. Try Step 3 now to see probe single-flight in action.";
  }
  if (state === "HALF_OPEN") {
    return "Breaker is HALF-OPEN. Step 1 will close it on success; Step 2 will re-open it on failure.";
  }
  if (state === "CLOSED" && hasHistory) {
    return "Breaker recovered. Try Step 2 to trip it again, or Reset to start over.";
  }
  return null;
}
