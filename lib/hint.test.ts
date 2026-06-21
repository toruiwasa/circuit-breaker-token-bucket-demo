import { describe, it, expect } from "vitest";
import { deriveHint } from "./hint";

describe("deriveHint", () => {
  describe("CLOSED state, no history", () => {
    it("returns Step 1 guidance", () => {
      const hint = deriveHint("CLOSED", 0, false);
      expect(hint).toContain("Step 1");
    });
  });

  describe("OPEN state, cooldown running", () => {
    it("includes the remaining seconds in the message", () => {
      const hint = deriveHint("OPEN", 7, false);
      expect(hint).toContain("7s");
    });

    it("mentions Step 3", () => {
      const hint = deriveHint("OPEN", 7, false);
      expect(hint).toContain("Step 3");
    });

    it("works at 1 second remaining", () => {
      const hint = deriveHint("OPEN", 1, false);
      expect(hint).toContain("1s");
    });
  });

  describe("OPEN state, cooldown expired", () => {
    it("tells the user cooldown expired", () => {
      const hint = deriveHint("OPEN", 0, false);
      expect(hint).toMatch(/cooldown expired/i);
    });

    it("mentions Step 3", () => {
      const hint = deriveHint("OPEN", 0, false);
      expect(hint).toContain("Step 3");
    });
  });

  describe("HALF_OPEN state", () => {
    it("mentions HALF-OPEN", () => {
      const hint = deriveHint("HALF_OPEN", 0, false);
      expect(hint).toMatch(/half.open/i);
    });

    it("mentions both Step 1 and Step 2", () => {
      const hint = deriveHint("HALF_OPEN", 0, false);
      expect(hint).toContain("Step 1");
      expect(hint).toContain("Step 2");
    });
  });

  describe("CLOSED state, has history", () => {
    it("mentions recovery", () => {
      const hint = deriveHint("CLOSED", 0, true);
      expect(hint).toMatch(/recovered/i);
    });

    it("differs from the no-history hint", () => {
      const withHistory = deriveHint("CLOSED", 0, true);
      const withoutHistory = deriveHint("CLOSED", 0, false);
      expect(withHistory).not.toBe(withoutHistory);
    });
  });

  describe("return type", () => {
    it("always returns a string or null", () => {
      const states = ["CLOSED", "OPEN", "HALF_OPEN"] as const;
      for (const state of states) {
        for (const remainingSec of [0, 5]) {
          for (const hasHistory of [false, true]) {
            const result = deriveHint(state, remainingSec, hasHistory);
            expect(result === null || typeof result === "string").toBe(true);
          }
        }
      }
    });
  });
});
