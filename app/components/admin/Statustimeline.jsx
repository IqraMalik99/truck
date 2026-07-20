"use client";

const STATUS_ROWS = [
  { value: "off_duty", label: "Off Duty", color: "#94A3B8" },
  { value: "sleeper_berth", label: "Sleeper Berth", color: "#8B5CF6" },
  { value: "driving", label: "Driving", color: "#F97316" },
  { value: "on_duty", label: "On Duty (Not Driving)", color: "#22C55E" },
];

function toHourDecimal(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

// Returns one or two {leftPct, widthPct} segments — splits a block that
// crosses midnight into two pieces so it still draws correctly on a 0-24 grid.
function segmentsFor(from, to) {
  const start = toHourDecimal(from);
  let end = toHourDecimal(to);
  if (end <= start) {
    return [
      { left: start, width: 24 - start },
      { left: 0, width: end },
    ];
  }
  return [{ left: start, width: end - start }];
}

export default function StatusTimeline({ statusChanges = [] }) {
  const hours = Array.from({ length: 24 }, (_, i) => i + 1); // labeled 1 → 24

  return (
    <div className="w-full">
      {/* hour ruler */}
      <div className="flex pl-36 mb-1">
        {hours.map((h) => (
          <div
            key={h}
            className="flex-1 text-center text-[10px] font-mono text-slate-400"
          >
            {h}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {STATUS_ROWS.map((row) => {
          const entries = statusChanges.filter((s) => s.status === row.value);
          const isPrimary = row.value === "driving";
          return (
            <div key={row.value} className="flex items-center">
              <div
                className={`w-36 pr-3 text-xs shrink-0 ${
                  isPrimary ? "font-semibold text-[#C2410C]" : "text-slate-500"
                }`}
              >
                {row.label}
              </div>
              <div className="relative flex-1 h-6 bg-slate-50 rounded-md overflow-hidden ring-1 ring-slate-200">
                {/* gridlines every hour */}
                <div className="absolute inset-0 flex">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="flex-1 border-r border-slate-200/70 last:border-r-0"
                    />
                  ))}
                </div>
                {entries.map((entry, i) =>
                  segmentsFor(entry.from, entry.to).map((seg, j) => (
                    <div
                      key={`${i}-${j}`}
                      title={`${entry.from} – ${entry.to}${entry.purpose ? ` · ${entry.purpose}` : ""}`}
                      className="absolute top-0.5 bottom-0.5 rounded-sm"
                      style={{
                        left: `${(seg.left / 24) * 100}%`,
                        width: `${(seg.width / 24) * 100}%`,
                        backgroundColor: row.color,
                        opacity: isPrimary ? 1 : 0.85,
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}