"use client";
import { motion } from "framer-motion";

interface Props {
  tokens: number;
  capacity: number;
}

export default function TokenGauge({ tokens, capacity }: Props) {
  const pct = capacity > 0 ? Math.max(0, Math.min(1, tokens / capacity)) : 0;

  const color =
    pct > 0.5
      ? "bg-teal-500"
      : pct > 0.2
      ? "bg-amber-400"
      : "bg-orange-500";

  const glowColor =
    pct > 0.5
      ? "shadow-teal-500/40"
      : pct > 0.2
      ? "shadow-amber-400/40"
      : "shadow-orange-500/40";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Token Bucket
        </h2>
        <span className="font-mono text-sm text-zinc-300">
          {Math.round(tokens * 10) / 10}
          <span className="text-zinc-500"> / {capacity}</span>
        </span>
      </div>

      <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className={`h-full rounded-full ${color} shadow-md ${glowColor}`}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <p className="mt-2 text-right text-[10px] text-zinc-500">
        refill rate: 2 tokens/s · capacity: {capacity}
      </p>
    </div>
  );
}
