import { describe, it, expect } from "vitest";
import { validateSessionId, circuitKey, bucketKey } from "./session";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("validateSessionId", () => {
  it("accepts a valid UUID v4", () => {
    expect(validateSessionId("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("accepts uppercase UUID v4", () => {
    expect(validateSessionId("F47AC10B-58CC-4372-A567-0E02B2C3D479")).toBe(true);
  });

  it("accepts variant bits 8, 9, a, b in position 19", () => {
    expect(validateSessionId("f47ac10b-58cc-4372-8567-0e02b2c3d479")).toBe(true);
    expect(validateSessionId("f47ac10b-58cc-4372-9567-0e02b2c3d479")).toBe(true);
    expect(validateSessionId("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
    expect(validateSessionId("f47ac10b-58cc-4372-b567-0e02b2c3d479")).toBe(true);
  });

  it("rejects wrong version digit (v3)", () => {
    expect(validateSessionId("f47ac10b-58cc-3372-a567-0e02b2c3d479")).toBe(false);
  });

  it("rejects wrong version digit (v5)", () => {
    expect(validateSessionId("f47ac10b-58cc-5372-a567-0e02b2c3d479")).toBe(false);
  });

  it("rejects invalid variant bit (c)", () => {
    expect(validateSessionId("f47ac10b-58cc-4372-c567-0e02b2c3d479")).toBe(false);
  });

  it("rejects missing segment", () => {
    expect(validateSessionId("f47ac10b-58cc-4372-a567")).toBe(false);
  });

  it("rejects extra segment", () => {
    expect(validateSessionId("f47ac10b-58cc-4372-a567-0e02b2c3d479-extra")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateSessionId("")).toBe(false);
  });

  it("rejects string with colon (key injection attempt)", () => {
    expect(validateSessionId("f47ac10b-58cc-4372-a567-0e02b2c3d479:evil")).toBe(false);
  });

  it("rejects newline injection", () => {
    expect(validateSessionId("f47ac10b-58cc-4372-a567-0e02b2c3d479\n")).toBe(false);
  });

  it("rejects number", () => {
    expect(validateSessionId(12345)).toBe(false);
  });

  it("rejects null", () => {
    expect(validateSessionId(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(validateSessionId(undefined)).toBe(false);
  });

  it("rejects object", () => {
    expect(validateSessionId({ id: VALID_UUID })).toBe(false);
  });

  it("rejects array", () => {
    expect(validateSessionId([VALID_UUID])).toBe(false);
  });
});

describe("circuitKey", () => {
  it("returns the expected key format", () => {
    expect(circuitKey(VALID_UUID)).toBe(`circuit:${VALID_UUID}:openai`);
  });
});

describe("bucketKey", () => {
  it("returns the expected key format", () => {
    expect(bucketKey(VALID_UUID)).toBe(`bucket:${VALID_UUID}:openai`);
  });
});
