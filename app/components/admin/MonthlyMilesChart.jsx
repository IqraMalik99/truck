"use client";

import { useEffect, useMemo, useState } from "react";

const PLOT_HEIGHT = 180;
const GRID_STEPS = [1, 0.66, 0.33, 0];

export default function MonthlyMilesChart({ data, monthLabel }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const maxMiles = useMemo(() => {
    const raw = Math.max(1, ...data.map((d) => d.miles));
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = magnitude / 2 || 1;
    return Math.ceil(raw / step) * step;
  }, [data]);

  const active = hoverIndex != null ? data[hoverIndex] : null;
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  // Touch handling: tapping a bar shows the tooltip; tapping again elsewhere
  // (or after a pause) dismisses it, since there's no "mouse leave" on touch.
  const touchTimeoutRef = useState({ current: null })[0];

  const handleTouchStart = (i) => {
    if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
    setHoverIndex(i);
  };

  const handleTouchEnd = () => {
    touchTimeoutRef.current = setTimeout(() => setHoverIndex(null), 1500);
  };

  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);
    };
  }, [touchTimeoutRef]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 4 }}>
        <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{monthLabel}</span>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {active ? (
            <>
              <strong style={{ color: "#111827" }}>{active.miles.toLocaleString()} mi</strong>
              {"  ·  "}
              {formatDay(active.date)}
            </>
          ) : (
            "Hover a day for details"
          )}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {/* y-axis labels */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: PLOT_HEIGHT,
            fontSize: 9.5,
            color: "#9ca3af",
            textAlign: "right",
            width: 32,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {GRID_STEPS.map((g) => (
            <span key={g}>{Math.round(maxMiles * g).toLocaleString()}</span>
          ))}
        </div>

        {/* plot area */}
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          {/* gridlines */}
          <div style={{ position: "relative", height: PLOT_HEIGHT }}>
            {GRID_STEPS.map((g) => (
              <div
                key={g}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${(1 - g) * PLOT_HEIGHT}px`,
                  borderTop: g === 0 ? "1px solid #d1d5db" : "1px dashed #eef0f3",
                }}
              />
            ))}

            {/* bars */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {data.map((d, i) => {
                const pct = d.miles / maxMiles;
                const targetHeight = Math.max(d.miles > 0 ? 3 : 1.5, pct * PLOT_HEIGHT);
                const isHover = hoverIndex === i;

                let background = "linear-gradient(180deg, #e2e8f0, #cbd5e1)";
                if (d.isToday) background = "linear-gradient(180deg, #60a5fa, #2563eb)";
                if (isHover) background = d.isToday
                  ? "linear-gradient(180deg, #3b82f6, #1d4ed8)"
                  : "linear-gradient(180deg, #cbd5e1, #94a3b8)";

                return (
                  <div
                    key={d.date}
                    onMouseEnter={() => setHoverIndex(i)}
                    onTouchStart={() => handleTouchStart(i)}
                    onTouchEnd={handleTouchEnd}
                    style={{
                      flex: 1,
                      height: mounted ? `${targetHeight}px` : "0px",
                      background,
                      borderRadius: "3px 3px 0 0",
                      cursor: "pointer",
                      transition: `height 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(i * 6, 300)}ms, background 0.1s ease`,
                      boxShadow: isHover ? "0 2px 6px rgba(37, 99, 235, 0.25)" : "none",
                    }}
                  />
                );
              })}

              {/* tooltip, anchored above the hovered bar */}
              {active && (
                <div
                  style={{
                    position: "absolute",
                    left: `${((hoverIndex + 0.5) / data.length) * 100}%`,
                    bottom: `${Math.max(active.miles / maxMiles, 0.02) * PLOT_HEIGHT + 10}px`,
                    transform: "translateX(-50%)",
                    background: "#111827",
                    color: "white",
                    fontSize: 11,
                    padding: "6px 9px",
                    borderRadius: 6,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
                    zIndex: 2,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{active.miles.toLocaleString()} mi</div>
                  <div style={{ color: "#94a3b8", fontSize: 10 }}>{formatDay(active.date)}</div>
                </div>
              )}
            </div>
          </div>

          {/* x-axis date labels */}
          <div style={{ display: "flex", marginTop: 6 }}>
            {data.map((d, i) => (
              <div
                key={d.date}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 9.5,
                  color: d.isToday ? "#2563eb" : "#9ca3af",
                  fontWeight: d.isToday ? 700 : 400,
                }}
              >
                {i % labelEvery === 0 ? d.day : ""}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDay(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}