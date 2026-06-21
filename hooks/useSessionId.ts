"use client";
import { useRef } from "react";

export function useSessionId(): string {
  const sessionId = useRef<string>(null);
  if (sessionId.current === null) {
    sessionId.current = crypto.randomUUID();
  }
  return sessionId.current;
}
