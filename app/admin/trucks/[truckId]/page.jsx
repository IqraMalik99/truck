"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const cardShadow = "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)";

function PeriodButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!!active}
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "#374151",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 7,
        padding: "6px 12px",
        cursor: active ? "default" : "pointer",
        opacity: active ? 0.6 : 1,
      }}
    >
      {active ? "Generating…" : label}
    </button>
  );
}

export default function TruckDetailPage() {
  const { truckId } = useParams();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [downloading, setDownloading] = useState(null); // key like "quarter-Q1" | "month-01" | "year-FullYear"

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/trucks/${truckId}/monthly-overview?year=${year}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || "Couldn't load truck history.");
    } finally {
      setLoading(false);
    }
  }, [truckId, year]);

  useEffect(() => {
    load();
    setSelectedMonth(null);
  }, [load]);

  async function downloadPdf({ period, month, quarter, half, suffix }) {
    const key = `${period}-${suffix}`;
    setDownloading(key);
    try {
      const qs = new URLSearchParams({ year: String(year), period });
      if (month) qs.set("month", String(month));
      if (quarter) qs.set("quarter", String(quarter));
      if (half) qs.set("half", String(half));

      const res = await fetch(`/api/dashboard/trucks/${truckId}/report?${qs.toString()}`);
      if (!res.ok) throw new Error("Couldn't generate report");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `truck-${data.truck.unitNumber}-${year}-${suffix}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't generate the PDF. Try again.");
    } finally {
      setDownloading(null);
    }
  }

  const selected = data?.months?.find((m) => m.month === selectedMonth);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 18, borderBottom: "1px solid #e9ecf0", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: "#111827", margin: 0 }}>
            {data ? `Unit ${data.truck.unitNumber}` : "Truck"}
          </h1>
          <p style={{ fontSize: 12.5, color: "#6b7280", margin: "4px 0 0" }}>Monthly miles, drivers, and states covered.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setYear((y) => y - 1)} style={{ border: "1px solid #e5e7eb", background: "white", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827", minWidth: 48, textAlign: "center" }}>{year}</span>
          <button onClick={() => setYear((y) => y + 1)} style={{ border: "1px solid #e5e7eb", background: "white", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>›</button>
        </div>
      </div>

      {/* Quarter / half / year report buttons for the currently selected year */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {[1, 2, 3, 4].map((q) => (
          <PeriodButton
            key={`q${q}`}
            label={`Q${q}`}
            active={downloading === `quarter-Q${q}`}
            onClick={() => downloadPdf({ period: "quarter", quarter: q, suffix: `Q${q}` })}
          />
        ))}
        {[1, 2].map((h) => (
          <PeriodButton
            key={`h${h}`}
            label={`H${h}`}
            active={downloading === `half-H${h}`}
            onClick={() => downloadPdf({ period: "half", half: h, suffix: `H${h}` })}
          />
        ))}
        <PeriodButton
          label="Full year"
          active={downloading === "year-FullYear"}
          onClick={() => downloadPdf({ period: "year", suffix: "FullYear" })}
        />
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {loading || !data
          ? Array.from({ length: 12 }).map((_, i) => <div key={i} style={{ height: 150, borderRadius: 12, background: "#f3f4f6" }} />)
          : data.months.map((m) => {
              const isSelected = selectedMonth === m.month;
              const hasActivity = m.tripsCount > 0;
              return (
                <div
                  key={m.month}
                  onClick={() => setSelectedMonth(isSelected ? null : m.month)}
                  style={{
                    background: "white",
                    border: isSelected ? "2px solid #2563eb" : "1px solid #edf0f3",
                    borderRadius: 12,
                    padding: 16,
                    boxShadow: cardShadow,
                    cursor: "pointer",
                    opacity: hasActivity ? 1 : 0.55,
                  }}
                >
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>{MONTH_NAMES[m.month - 1]}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11.5, color: "#374151" }}>
                    <span>{m.tripsCount} trip{m.tripsCount === 1 ? "" : "s"}</span>
                    <span>{m.milesTotal.toLocaleString()} mi</span>
                    <span>{m.fuelTotal} gal fuel</span>
                    <span>{m.daysUsed} day{m.daysUsed === 1 ? "" : "s"} used</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: "8px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.drivers.length ? m.drivers.join(", ") : "No drivers"}
                  </p>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.states.length ? m.states.join(", ") : "No states logged"}
                  </p>
                </div>
              );
            })}
      </div>

      {selected && (
        <div style={{ marginTop: 20, background: "white", border: "1px solid #edf0f3", borderRadius: 12, boxShadow: cardShadow, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #edf0f3" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>
              {MONTH_NAMES[selected.month - 1]} {year} — trip detail
            </h2>
            <button
              onClick={() => downloadPdf({ period: "month", month: selected.month, suffix: String(selected.month).padStart(2, "0") })}
              disabled={downloading === `month-${String(selected.month).padStart(2, "0")}`}
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "white",
                background: "#dc2626",
                border: "none",
                borderRadius: 7,
                padding: "7px 14px",
                cursor: downloading === `month-${String(selected.month).padStart(2, "0")}` ? "default" : "pointer",
                opacity: downloading === `month-${String(selected.month).padStart(2, "0")}` ? 0.7 : 1,
              }}
            >
              {downloading === `month-${String(selected.month).padStart(2, "0")}` ? "Generating…" : "Download PDF"}
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ textAlign: "left", padding: "8px 18px", color: "#6b7280", fontWeight: 600 }}>Date</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "#6b7280", fontWeight: 600 }}>Driver</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "#6b7280", fontWeight: 600 }}>Route</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "#6b7280", fontWeight: 600 }}>Miles</th>
                  <th style={{ textAlign: "right", padding: "8px 18px", color: "#6b7280", fontWeight: 600 }}>Fuel</th>
                </tr>
              </thead>
              <tbody>
                {selected.trips.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "16px 18px", color: "#9ca3af" }}>No trips logged this month.</td>
                  </tr>
                )}
                {selected.trips.map((t, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 18px", color: "#111827", fontWeight: 600 }}>
                      {new Date(t.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#374151" }}>{t.driver}</td>
                    <td style={{ padding: "8px 12px", color: "#374151" }}>{t.route}</td>
                    <td style={{ padding: "8px 12px", color: "#374151", textAlign: "right" }}>{t.miles ? `${t.miles} mi` : "—"}</td>
                    <td style={{ padding: "8px 18px", color: "#374151", textAlign: "right" }}>{t.fuel ? `${t.fuel} gal` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}