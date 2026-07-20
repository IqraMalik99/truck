"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import StatusTimeline from "./Statustimeline";

/*
  API contract — GET /api/dashboard/drivers/[driverId]/month?year=YYYY&month=MM

  -> {
       logs: DriverDailyLog[],   // each populated with full trip info (incl. truck/trailer)
       summary: {
         daysLogged, totalMiles, totalFuel,
         hours: { offDuty, sleeperBerth, driving, onDuty },  // minutes
         isCurrentMonth, isComplete, asOfDay, totalDaysInMonth,
         summaryText
       }
     }

  PDF reports (admin panel — driverId comes from the URL, not session):
    GET /api/dashboard/drivers/[driverId]/month/report?year=YYYY&month=MM   -> brief monthly summary PDF
    GET /api/dashboard/drivers/[driverId]/report?date=YYYY-MM-DD            -> full daily PDF (day must be closed)
*/

const STATUS_OPTIONS = [
  { value: "off_duty", label: "Off Duty", color: "#94A3B8" },
  { value: "sleeper_berth", label: "Sleeper Berth", color: "#8B5CF6" },
  { value: "driving", label: "Driving", color: "#2563EB" },
  { value: "on_duty", label: "On Duty (Not Driving)", color: "#22C55E" },
];

function minutesBetween(from, to) {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let diff = th * 60 + tm - (fh * 60 + fm);
  if (diff < 0) diff += 1440;
  return diff;
}

function fmtHours(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// Full per-day totals: miles, fuel, and minutes broken out by every duty status.
function dayTotals(log) {
  const trips = log.trips || [];
  const statusChanges = log.statusChanges || [];
  const miles = trips.reduce((sum, t) => sum + (t.totalMiles || 0), 0);
  const fuel = trips.reduce((sum, t) => sum + (t.fuel || 0), 0);
  const hours = { off_duty: 0, sleeper_berth: 0, driving: 0, on_duty: 0 };
  statusChanges.forEach((s) => {
    if (hours[s.status] !== undefined) {
      hours[s.status] += minutesBetween(s.from, s.to);
    }
  });
  return { miles, fuel, hours };
}

function monthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// Fetches a PDF from the given URL and triggers a browser download.
// Returns an error message on failure, or null on success.
async function downloadPdf(url, filename) {
  const res = await fetch(url);
  if (!res.ok) {
    let message = "Couldn't generate that report.";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore — use default message
    }
    return message;
  }
  const blob = await res.blob();
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  return null;
}

export default function MonthlyLogDashboard({ driverId }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [downloadingMonth, setDownloadingMonth] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (!driverId) return;
    fetchMonth(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, year, month]);

  async function fetchMonth(y, m) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard/drivers/${driverId}/month?year=${y}&month=${m}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs || []);
      setSummary(data.summary || null);
    } catch {
      setLogs([]);
      setSummary(null);
      setError("Couldn't load this driver's logs for this month.");
    }
    setLoading(false);
  }

  function changeMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    setSelectedDate(null);
  }

  async function handleDownloadMonthlyReport() {
    setDownloadError("");
    setDownloadingMonth(true);
    const filename = `driver-monthly-log-${year}-${String(month).padStart(2, "0")}.pdf`;
    const err = await downloadPdf(
      `/api/dashboard/drivers/${driverId}/month/report?year=${year}&month=${month}`,
      filename
    );
    if (err) setDownloadError(err);
    setDownloadingMonth(false);
  }

  const logsByDay = useMemo(() => {
    const map = {};
    logs.forEach((log) => {
      const d = new Date(log.date || log.createdAt).getDate();
      map[d] = log;
    });
    return map;
  }, [logs]);

  // Fallback totals, computed locally in case the API hasn't been updated with `summary` yet.
  const localMonthTotals = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        const t = dayTotals(log);
        acc.miles += t.miles;
        acc.fuel += t.fuel;
        acc.driving += t.hours.driving;
        acc.days += 1;
        return acc;
      },
      { miles: 0, fuel: 0, driving: 0, days: 0 }
    );
  }, [logs]);

  const totalDays = daysInMonth(year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const isToday = (day) =>
    day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();

  const selectedLog = selectedDate ? logsByDay[selectedDate] : null;

  if (!driverId) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-3">
        No driver selected.
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {downloadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {downloadError}
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => changeMonth(-1)}
          className="text-sm font-medium text-blue-600 border border-blue-200 hover:border-blue-400 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
        >
          ← Prev
        </button>
        <h2 className="font-semibold text-base sm:text-lg text-slate-800">{monthLabel(year, month)}</h2>
        <button
          onClick={() => changeMonth(1)}
          className="text-sm font-medium text-blue-600 border border-blue-200 hover:border-blue-400 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
        >
          Next →
        </button>
      </div>

      {/* Month summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <SummaryCard label="Days logged" value={summary?.daysLogged ?? localMonthTotals.days} />
        <SummaryCard
          label="Total miles"
          value={(summary?.totalMiles ?? localMonthTotals.miles).toLocaleString()}
        />
        <SummaryCard label="Fuel logged" value={`${summary?.totalFuel ?? localMonthTotals.fuel} gal`} />
        <SummaryCard
          label="Driving time"
          value={fmtHours(summary?.hours?.driving ?? localMonthTotals.driving)}
          highlight
        />
      </div>

      {/* In-progress / complete month note + monthly report download */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        {summary?.summaryText && (
          <div
            className={`flex-1 text-sm rounded-lg px-4 py-2.5 border ${
              summary.isComplete
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            {summary.summaryText}
          </div>
        )}
        <button
          onClick={handleDownloadMonthlyReport}
          disabled={downloadingMonth || loading}
          className="shrink-0 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg transition"
        >
          {downloadingMonth ? "Preparing…" : "Download Monthly Report"}
        </button>
      </div>

      {/* Compact calendar */}
      <section className="bg-white rounded-xl border border-slate-200 p-4">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Loading month…</p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-slate-400 mb-1.5">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={`${d}-${i}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((day, i) => {
                if (!day) return <div key={`blank-${i}`} />;
                const log = logsByDay[day];
                return (
                  <button
                    key={day}
                    onClick={() => log && setSelectedDate(day)}
                    disabled={!log}
                    className={`relative rounded-md border aspect-square flex flex-col items-center justify-center transition ${
                      log
                        ? "bg-blue-50 border-blue-200 hover:border-blue-400"
                        : "bg-slate-50 border-slate-100 text-slate-300 cursor-default"
                    } ${isToday(day) ? "ring-1 ring-blue-500" : ""}`}
                  >
                    <span className={`text-xs ${log ? "text-blue-700 font-medium" : "text-slate-400"}`}>
                      {day}
                    </span>
                    {log && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Full-page-style modal for the selected date */}
      {selectedLog && (
        <DayDetailModal
          driverId={driverId}
          log={selectedLog}
          dateObj={new Date(year, month - 1, selectedDate)}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

function DayDetailModal({ driverId, log, dateObj, onClose }) {
  const totals = dayTotals(log);
  const dayEnded = !!log.dayEnded;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const chartData = STATUS_OPTIONS.map((opt) => ({
    name: opt.label,
    minutes: totals.hours[opt.value],
    color: opt.color,
  })).filter((d) => d.minutes > 0);

  async function handleDownloadDailyReport() {
    setDownloadError("");
    setDownloading(true);
    const isoDate = dateObj.toISOString().slice(0, 10);
    const filename = `driver-daily-log-${isoDate}.pdf`;
    const err = await downloadPdf(
      `/api/dashboard/drivers/${driverId}/report?date=${isoDate}`,
      filename
    );
    if (err) setDownloadError(err);
    setDownloading(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-xl min-h-full sm:min-h-0 sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-semibold text-base sm:text-lg text-slate-800">
              {dateObj.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {dayEnded ? "Day closed — totals locked in." : "Day still open."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadDailyReport}
              disabled={!dayEnded || downloading}
              title={dayEnded ? "Download PDF" : "Close out the day before downloading a report"}
              className="text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition"
            >
              {downloading ? "Preparing…" : "Download Daily Report"}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm px-2 py-1">
              Close ✕
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
            {downloadError}
          </div>
        )}

        {/* Summary cards */}
        <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <SummaryCard label="Trips" value={(log.trips || []).length} />
          <SummaryCard label="Total miles" value={totals.miles.toLocaleString()} />
          <SummaryCard label="Fuel logged" value={`${totals.fuel} gal`} />
          <SummaryCard label="Driving time" value={fmtHours(totals.hours.driving)} highlight />
          <SummaryCard label="On duty (not driving)" value={fmtHours(totals.hours.on_duty)} />
          <SummaryCard label="Off duty" value={fmtHours(totals.hours.off_duty)} />
          <SummaryCard label="Sleeper berth" value={fmtHours(totals.hours.sleeper_berth)} />
        </div>

        {/* Status breakdown graph */}
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
            Status breakdown
          </p>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-400">No status data logged this day.</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="minutes"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmtHours(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Trips */}
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Trips</p>
          {(log.trips || []).length === 0 && (
            <p className="text-sm text-slate-400">No trips logged this day.</p>
          )}
          <div className="divide-y divide-slate-100">
            {(log.trips || []).map((trip) => (
              <div key={trip._id} className="py-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-700">{trip.destination || "Untitled destination"}</p>
                  {!trip.enddate && !trip.odometerEnding && (
                    <span className="text-xs text-blue-600">In progress</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {trip.startState} → {trip.endState || "in progress"}
                  {trip.totalMiles ? ` · ${trip.totalMiles} mi` : ""}
                </p>
                <p className="text-xs text-slate-400">
                  odo {trip.odometerBeginning ?? "—"}
                  {trip.odometerEnding ? ` – ${trip.odometerEnding}` : ""}
                  {trip.fuel ? ` · ${trip.fuel} gal fuel` : ""}
                </p>
                {(trip.truck?.unitNumber || trip.trailer?.trailerNumber) && (
                  <p className="text-xs text-slate-400">
                    {trip.truck?.unitNumber ? `Unit ${trip.truck.unitNumber}` : ""}
                    {trip.truck?.unitNumber && trip.trailer?.trailerNumber ? " · " : ""}
                    {trip.trailer?.trailerNumber ? `Trailer ${trip.trailer.trailerNumber}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Duty status — list + timeline */}
        <div className="px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Duty status</p>
          {(log.statusChanges || []).length === 0 ? (
            <p className="text-sm text-slate-400">No status changes logged this day.</p>
          ) : (
            <div className="divide-y divide-slate-100 mb-4">
              {(log.statusChanges || []).map((s, i) => {
                const opt = STATUS_OPTIONS.find((o) => o.value === s.status);
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt?.color }} />
                    <span className="font-medium text-slate-700">{opt?.label || s.status}</span>
                    <span className="text-slate-500">
                      {s.from} – {s.to}
                    </span>
                    {s.purpose && <span className="text-slate-400">· {s.purpose}</span>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="overflow-x-auto">
            <StatusTimeline statusChanges={log.statusChanges || []} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight = false }) {
  return (
    <div
      className={`rounded-lg border px-3.5 py-2.5 ${
        highlight ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200"
      }`}
    >
      <p className="text-[10.5px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-base sm:text-lg font-semibold mt-0.5 ${highlight ? "text-blue-700" : "text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}