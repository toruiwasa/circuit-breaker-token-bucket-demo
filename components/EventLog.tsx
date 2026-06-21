"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "radix-ui";

export interface LogEntry {
  id: string;
  ts: number;
  label: string;
  badge: string;
  variant: "success" | "error" | "warn" | "info" | "probe";
}

interface Props {
  entries: LogEntry[];
}

const VARIANT_STYLES: Record<LogEntry["variant"], string> = {
  success: "bg-teal-500/20 text-teal-300 border border-teal-500/30",
  error: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  warn: "bg-amber-400/20 text-amber-300 border border-amber-400/30",
  info: "bg-zinc-700 text-zinc-300 border border-zinc-600",
  probe: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
};

function fmt(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

export default function EventLog({ entries }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Event Log
      </h2>
      <ScrollArea.Root className="h-56 overflow-hidden">
        <ScrollArea.Viewport className="h-full w-full">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-600">
              No events yet — press a button to start
            </p>
          ) : (
            <ul className="space-y-1.5 pr-3">
              <AnimatePresence initial={false}>
                {entries.map((e) => (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span className="mt-0.5 shrink-0 font-mono text-zinc-600">
                      {fmt(e.ts)}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${VARIANT_STYLES[e.variant]}`}
                    >
                      {e.badge}
                    </span>
                    <span className="text-zinc-300">{e.label}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          orientation="vertical"
          className="flex w-1.5 touch-none select-none p-0.5"
        >
          <ScrollArea.Thumb className="relative flex-1 rounded-full bg-zinc-700" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
