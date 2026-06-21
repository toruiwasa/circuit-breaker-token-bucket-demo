const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateSessionId(id: unknown): id is string {
  return typeof id === "string" && UUID_V4.test(id);
}

export function circuitKey(sessionId: string): string {
  return `circuit:${sessionId}:openai`;
}

export function bucketKey(sessionId: string): string {
  return `bucket:${sessionId}:openai`;
}
