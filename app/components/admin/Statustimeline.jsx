"use client";

import { useMemo } from "react";

const STATUS_OPTIONS = [
  { value: "off_duty", label: "Off Duty", color: "#94A3B8" },
  { value: "sleeper_berth", label: "Sleeper Berth", color: "#8B5CF6" },
  { value: "driving", label: "Driving", color: "#DC2626" },
  { value: "on_duty", label: "On Duty (Not Driving)", color: "#22C55E" },
];

function toMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function StatusTimeline({ statusChanges = [] }) {
  const segments = useMemo(() => {
    return statusChanges
      .map((s) => {
        const start = toMinutes(s.from);
        let end = toMinutes(s.to);
        if (end <= start) end += 1440;
        const opt = STATUS_OPTIONS.find((o) => o.value === s.status);
        return {
          ...s,
          startPct: (start / 1440) * 100,
          widthPct: ((end - start) / 1440) * 100,
          color: opt?.color || "#CBD5E1",
          label: opt?.label || s.status,
        };
      })
      .sort((a, b) => a.startPct - b.startPct);
  }, [statusChanges]);

  const hourMarks = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="w-full bg-white">
      {/* Bar */}
      <div className="relative h-8 rounded-md bg-slate-100 overflow-hidden">
        {segments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            No status entries yet
          </div>
        )}
        {segments.map((seg, i) => (
          <div
            key={i}
            title={`${seg.label} · ${seg.from}–${seg.to}${seg.purpose ? ` · ${seg.purpose}` : ""}`}
            className="absolute top-0 h-full"
            style={{
              left: `${seg.startPct}%`,
              width: `${Math.max(seg.widthPct, 0.5)}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>

      {/* Hour ruler — one grid cell per hour, evenly spaced */}
      <div className="grid grid-cols-24 mt-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
        {hourMarks.map((h) => (
          <span key={h} className="text-center text-[10px] text-slate-400 font-mono leading-4">
            {h % 3 === 0 ? h : ""}
          </span>
        ))}
      </div>

      {/* Legend — wraps cleanly, never overlaps */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {STATUS_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: opt.color }}
            />
            <span className="whitespace-nowrap">{opt.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}