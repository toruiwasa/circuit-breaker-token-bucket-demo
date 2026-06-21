import { NextResponse } from "next/server";
import { DEMO_PARAMS } from "@/lib/redis";

type Outcome = "success" | "failure" | "rate_limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const outcome: Outcome = body?.outcome ?? "success";
  const estimated: number = body?.estimatedTokens ?? DEMO_PARAMS.estimatedTokens;

  let latencyMs: number;
  let success: boolean;
  let actualTokens: number;
  let isRateLimitError: boolean;

  switch (outcome) {
    case "success":
      latencyMs = 300 + Math.random() * 500;
      success = true;
      actualTokens = Math.round(estimated * (0.7 + Math.random() * 0.4));
      isRateLimitError = false;
      break;
    case "failure":
      latencyMs = 100 + Math.random() * 200;
      success = false;
      actualTokens = 0;
      isRateLimitError = false;
      break;
    case "rate_limit":
      latencyMs = 30 + Math.random() * 40;
      success = false;
      actualTokens = 0;
      isRateLimitError = true;
      break;
    default:
      return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }

  await new Promise((resolve) => setTimeout(resolve, latencyMs));

  return NextResponse.json({ success, actualTokens, isRateLimitError, latencyMs: Math.round(latencyMs) });
}
