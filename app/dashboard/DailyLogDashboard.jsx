"use client";

import { useEffect, useMemo, useState } from "react";
import StatusTimeline from "../components/admin/Statustimeline";
import SearchableSelect from "../components/Searchableselect";
import DateNavigator from "../components/admin/DateNavigator";
import { isDateEditable, relativeDayLabel, startOfDay, toDateKey } from "../lib/editWindow";

/*
  Expected API contract (build these routes when ready):

  GET    /api/daily-log/day?date=YYYY-MM-DD  -> { log: DriverDailyLog | null, trips: TripSheet[] }
  POST   /api/daily-log/start   -> { log }   body: { date }
  POST   /api/trips             -> TripSheet body: { dailyLogId, startLocation, truck, trailer, odometerBeginning }
  DELETE /api/trips/:id         -> { success: true }   // driver can delete a trip while the day is still editable
  POST   /api/trips/:id/states  -> TripSheet body: { odometerAtStateLine, fuel, nextLocation }
  PATCH  /api/trips/:id/end     -> TripSheet body: { endLocation, odometerEnding, fuel }
  POST   /api/daily-log/status  -> { entry } body: { dailyLogId, status, from, to, purpose }
  POST   /api/daily-log/end     -> { log }   body: { dailyLogId }
  GET    /api/trucks            -> Truck[]
  GET    /api/trailers          -> Trailer[]

  IMPORTANT: the frontend only greys out non-editable dates for UX — the API
  must independently re-check the date against the same window (see
  lib/editWindow.js -> isDateEditable) on every write route (start, trips,
  delete-trip, states, end-trip, status, end-day) and reject with 403 if the
  log's date has fallen outside it. Never trust the client for this.

  Location shape used everywhere below (works whether the region has a
  "state"/province or not — some countries only have a city):
    { city, state, country, formatted }

  Fuel model (backend rolls this up — frontend just displays it):
    - Each entry in trip.states[] gets a `fuel` value once it is CLOSED —
      either because the driver crossed into the next state (fuel typed on
      that crossing form belongs to the state being left), or because the
      trip ended while that state was still open (fuel typed on End Trip
      belongs to that last state).
    - trip.fuel is always the sum of every state's fuel — the backend keeps
      it in sync on every state-crossing and on End Trip.
    - Because of this, totals.fuel below must NOT add trip.fuel and the
      per-state fuel together — trip.fuel already IS that sum.

  Color scale used across this file:
    #DC2626 (red-600)  — primary / normal actions
    #B91C1C (red-700)  — hover state
    #7F1D1D (red-900)  — darkest red, reserved for critical/irreversible actions
                          (End Day, Save & End Trip, End Trip)
*/

const STATUS_OPTIONS = [
  { value: "off_duty", label: "Off Duty", color: "#94A3B8" },
  { value: "sleeper", label: "Sleeper", color: "#8B5CF6" },
  { value: "driving", label: "Driving", color: "#DC2626" },
  { value: "on_duty", label: "On Duty (Not Driving)", color: "#22C55E" },
];

function dateLabel(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function minutesBetween(from, to) {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let diff = th * 60 + tm - (fh * 60 + fm);
  if (diff < 0) diff += 1440; // crosses midnight
  return diff;
}

function fmtHours(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function formatLocation({ city, state, country } = {}) {
  return [city, state].filter(Boolean).join(", ") || country || "";
}

async function fetchCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (!res.ok) throw new Error("Reverse geocoding failed");
          const data = await res.json();
          const addr = data.address || {};
          const city =
            addr.city || addr.town || addr.village || addr.county || addr.municipality || "";
          const state = addr.state || addr.region || addr.province || "";
          const country = addr.country || "";
          resolve({ city, state, country, formatted: formatLocation({ city, state, country }) });
        } catch (err) {
          reject(err);
        }
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

export default function DailyLogDashboard() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [dailyLog, setDailyLog] = useState(null);
  const [trips, setTrips] = useState([]);
  const [statusChanges, setStatusChanges] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [error, setError] = useState("");
  const [showTripForm, setShowTripForm] = useState(false);
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [startingDay, setStartingDay] = useState(false);
  const [endingDay, setEndingDay] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reopeningDay, setReopeningDay] = useState(false);

  const [timeZone, setTimeZone] = useState("UTC");

  const isToday = toDateKey(selectedDate, timeZone) === toDateKey(new Date(), timeZone);
  const editable = isDateEditable(selectedDate, timeZone);

  useEffect(() => {
    fetchFleet();
    fetchTimeZone();
  }, []);

  useEffect(() => {
    setError("");
    setShowTripForm(false);
    setShowStatusForm(false);
    fetchLogForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  async function fetchTimeZone() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setTimeZone(data.timezone || "UTC");
      }
    } catch {
      // stay on "UTC" fallback until it loads / if it fails
    }
  }

  async function fetchLogForDate(date) {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-log/day?date=${toDateKey(date, timeZone)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.log) {
          setDailyLog(data.log);
          setTrips(data.trips || data.log.trips || []);
          setStatusChanges(data.log.statusChanges || []);
        } else {
          setDailyLog(null);
          setTrips([]);
          setStatusChanges([]);
        }
      } else {
        setDailyLog(null);
        setTrips([]);
        setStatusChanges([]);
      }
    } catch {
      setDailyLog(null);
      setTrips([]);
      setStatusChanges([]);
    }
    setLoading(false);
  }

  async function fetchFleet() {
    try {
      const [tRes, trRes] = await Promise.all([fetch("/api/trucks"), fetch("/api/trailers")]);
      if (tRes.ok) setTrucks(await tRes.json());
      if (trRes.ok) setTrailers(await trRes.json());
    } catch {
      // ignore until API exists
    }
  }

  async function startDay() {
    setError("");
    setStartingDay(true);
    try {
      const res = await fetch("/api/daily-log/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: toDateKey(selectedDate, timeZone) }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't start this day. Check your connection and try again."));
      const data = await res.json();
      setDailyLog(data.log);
      setTrips([]);
      setStatusChanges([]);
    } catch (err) {
      setError(err.message || "Couldn't start this day. Check your connection and try again.");
    } finally {
      setStartingDay(false);
    }
  }

  async function createTrip(payload) {
    setError("");
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, dailyLogId: dailyLog?._id }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't save the trip. Nothing was lost — try again."));
      const trip = await res.json();
      setTrips((prev) => [...prev, trip]);
      setShowTripForm(false);
    } catch (err) {
      setError(err.message || "Couldn't save the trip. Nothing was lost — try again.");
    }
  }

  async function endTrip(tripId, payload) {
    setError("");
    const res = await fetch(`/api/trips/${tripId}/end`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const message = await readError(res, "Couldn't end the trip. Try again.");
      setError(message);
      throw new Error(message);
    }
    const updated = await res.json();
    setTrips((prev) => prev.map((t) => (t._id === tripId ? updated : t)));
  }

  // Deletes a trip entirely — the server re-checks ownership and the edit
  // window before actually removing it, same as every other write route.
  async function deleteTrip(tripId) {
    setError("");
    const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
    if (!res.ok) {
      const message = await readError(res, "Couldn't delete the trip. Try again.");
      setError(message);
      throw new Error(message);
    }
    setTrips((prev) => prev.filter((t) => t._id !== tripId));
  }

  async function addTripState(tripId, payload) {
    setError("");
    const res = await fetch(`/api/trips/${tripId}/states`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const message = await readError(res, "Couldn't log the state change. Try again.");
      setError(message);
      throw new Error(message);
    }
    const updated = await res.json();
    setTrips((prev) => prev.map((t) => (t._id === tripId ? updated : t)));
  }

  async function addStatus(entry) {
    setError("");
    const res = await fetch("/api/daily-log/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyLogId: dailyLog?._id, ...entry }),
    });
    if (!res.ok) {
      const message = await readError(res, "Couldn't save the status. Try again.");
      setError(message);
      throw new Error(message);
    }
    setStatusChanges((prev) => [...prev, entry]);
    setShowStatusForm(false);
  }

  function removeStatus(index) {
    setStatusChanges((prev) => prev.filter((_, i) => i !== index));
  }

  async function endDay() {
    setError("");
    const openTrip = trips.find((t) => !t.enddate && !t.odometerEnding);
    if (openTrip) {
      setError(`End the trip to ${openTrip.endLocation?.formatted || "its destination"} before ending this day.`);
      return;
    }
    const openState = trips
      .flatMap((t) => t.states || [])
      .find((s) => s.endOdometer == null);
    if (openState) {
      setError(`Close out the state entry for ${openState.location?.formatted || "an open state"} before ending this day.`);
      return;
    }
    setEndingDay(true);
    try {
      const res = await fetch("/api/daily-log/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLogId: dailyLog?._id, statusChanges }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't end this day. Try again."));
      const data = await res.json();
      setDailyLog(data.log);
    } catch (err) {
      setError(err.message || "Couldn't end this day. Try again.");
    } finally {
      setEndingDay(false);
    }
  }

  async function reopenDay() {
    setError("");
    setReopeningDay(true);
    try {
      const res = await fetch("/api/daily-log/re-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLogId: dailyLog?._id }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't reopen this day. Try again."));
      const data = await res.json();
      setDailyLog(data.log);
      setTrips(data.trips || data.log.trips || []);
    } catch (err) {
      setError(err.message || "Couldn't reopen this day. Try again.");
    } finally {
      setReopeningDay(false);
    }
  }

  async function downloadReport() {
    if (!dailyLog?._id) return;
    setError("");
    setDownloadingReport(true);
    try {
      const res = await fetch(`/api/daily-log/report?dailyLogId=${dailyLog._id}`);
      if (!res.ok) throw new Error(await readError(res, "Couldn't generate the report. Try again."));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = toDateKey(new Date(dailyLog.date || selectedDate), timeZone);
      a.href = url;
      a.download = `daily-log-${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Couldn't generate the report. Try again.");
    } finally {
      setDownloadingReport(false);
    }
  }

  const totals = useMemo(() => {
    const miles = trips.reduce((sum, t) => sum + (t.totalMiles || 0), 0);
    const fuel = trips.reduce((sum, t) => sum + (t.fuel || 0), 0);
    const byStatus = { off_duty: 0, sleeper_berth: 0, driving: 0, on_duty: 0 };
    statusChanges.forEach((s) => {
      byStatus[s.status] = (byStatus[s.status] || 0) + minutesBetween(s.from, s.to);
    });
    return { miles, fuel, byStatus };
  }, [trips, statusChanges]);

  const dayEnded = !!dailyLog?.dayEnded;
  const canEdit = editable && !dayEnded;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{dateLabel(selectedDate)}</h1>
          {!isToday && (
            <p className="text-xs text-slate-400">
              Viewing a past day{editable ? " — still open for edits" : " — read-only, outside the edit window"}.
            </p>
          )}
        </div>
        <DateNavigator selectedDate={selectedDate} onSelect={setSelectedDate} timeZone={timeZone} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-[#7F1D1D] text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <p className="text-sm text-slate-500 font-mono">Loading log…</p>
        </div>
      ) : (
        <>
          {!dailyLog && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-10 text-center space-y-4">
              <p className="text-slate-500 text-sm">
                {isToday
                  ? "You haven't started today's log yet."
                  : editable
                  ? "No log was started for this day yet."
                  : "No log exists for this day, and it's outside the window where a new one can be started."}
              </p>
              {editable && (
                <button
                  onClick={startDay}
                  disabled={startingDay}
                  className="w-full sm:w-auto bg-[#DC2626] text-white font-semibold px-6 py-3 rounded-full hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {startingDay ? "Starting…" : isToday ? "Start Your Day" : "Start This Day's Log"}
                </button>
              )}
            </div>
          )}

          {dailyLog && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard label="Trips" value={trips.length} />
                <SummaryCard label="Total miles" value={totals.miles.toLocaleString()} />
                <SummaryCard label="Fuel logged" value={`${totals.fuel} gal`} />
                <SummaryCard label="Driving time" value={fmtHours(totals.byStatus.driving)} highlight />
              </div>

              <section className="bg-white rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
                  <h2 className="font-semibold">Trips</h2>
                  {canEdit && (
                    <button
                      onClick={() => setShowTripForm((v) => !v)}
                      className="w-full sm:w-auto text-sm font-medium text-white bg-[#DC2626] hover:bg-[#B91C1C] px-4 py-2 rounded-full transition"
                    >
                      {trips.length === 0 ? "+ Add a Trip" : "+ Add Another Trip"}
                    </button>
                  )}
                </div>

                {showTripForm && (
                  <TripForm
                    trucks={trucks}
                    trailers={trailers}
                    onCancel={() => setShowTripForm(false)}
                    onSubmit={createTrip}
                  />
                )}

                <div className="divide-y divide-slate-100">
                  {trips.length === 0 && !showTripForm && (
                    <p className="px-4 sm:px-5 py-6 text-sm text-slate-400">No trips logged for this day.</p>
                  )}
                  {trips.map((trip) => (
                    <TripRow
                      key={trip._id}
                      trip={trip}
                      onEnd={endTrip}
                      onAddState={addTripState}
                      onDelete={deleteTrip}
                      dayEnded={!canEdit}
                    />
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
                  <div>
                    <h2 className="font-semibold">Duty status</h2>
                    <p className="text-xs text-slate-400">
                      Optional during the day — add driving, sleeper, rest, or on-duty blocks whenever you like.
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setShowStatusForm((v) => !v)}
                      className="w-full sm:w-auto text-sm font-medium text-[#B91C1C] border border-[#DC2626]/50 hover:border-[#DC2626] hover:bg-red-50 px-4 py-2 rounded-full transition"
                    >
                      + Add Status
                    </button>
                  )}
                </div>

                {showStatusForm && (
                  <StatusForm onCancel={() => setShowStatusForm(false)} onSubmit={addStatus} />
                )}

                <div className="px-4 sm:px-5 py-5 overflow-x-auto bg-white">
                  <div className="min-w-[560px] sm:min-w-0">
                    <StatusTimeline statusChanges={statusChanges} />
                  </div>
                </div>

                {statusChanges.length > 0 && (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {statusChanges.map((s, i) => {
                      const opt = STATUS_OPTIONS.find((o) => o.value === s.status);
                      return (
                        <div
                          key={i}
                          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 sm:px-5 py-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: opt?.color }}
                            />
                            <span className="font-medium whitespace-nowrap">{opt?.label}</span>
                            <span className="font-mono text-slate-500 whitespace-nowrap">
                              {s.from} – {s.to}
                            </span>
                            {s.purpose && (
                              <span className="text-slate-400 truncate max-w-[180px] sm:max-w-none">
                                · {s.purpose}
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => removeStatus(i)}
                              className="text-slate-400 hover:text-[#7F1D1D] text-xs shrink-0"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {canEdit && (
                <div className="flex justify-end">
                  <button
                    onClick={endDay}
                    disabled={endingDay}
                    className="w-full sm:w-auto bg-[#7F1D1D] text-white font-semibold px-6 py-3 rounded-full hover:bg-[#5c1515] disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    {endingDay ? "Ending…" : "End Day"}
                  </button>
                </div>
              )}

              {dayEnded && (
                <div className="bg-white border border-slate-200 rounded-lg px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
                    <p className="text-sm text-slate-600">
                      This log is closed. Miles, fuel, and duty hours are locked in.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {editable && (
                      <button
                        onClick={() => {
                          if (window.confirm("Reopen this log? You'll be able to edit trips and statuses again.")) {
                            reopenDay();
                          }
                        }}
                        disabled={reopeningDay}
                        className="inline-flex items-center justify-center gap-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 rounded-full transition"
                      >
                        {reopeningDay ? <SpinnerIcon className="w-4 h-4" /> : null}
                        {reopeningDay ? "Reopening…" : "Reopen Day"}
                      </button>
                    )}
                    <button
                      onClick={downloadReport}
                      disabled={downloadingReport}
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 rounded-full transition"
                    >
                      {downloadingReport ? <SpinnerIcon className="w-4 h-4" /> : <ReportIcon className="w-4 h-4" />}
                      {downloadingReport ? "Generating…" : "Download PDF Report"}
                    </button>
                  </div>
                </div>
              )}

              {!editable && !dayEnded && (
                <p className="text-xs text-slate-400 text-right">
                  This day is outside the edit window, so trips and statuses are read-only.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, highlight = false }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${highlight ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
        }`}
    >
      <p className="text-xs text-slate-400 font-mono uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${highlight ? "text-[#7F1D1D]" : ""}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function PinIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SpinnerIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} animate-spin`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckCircleIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

function ReportIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h1" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function LocationFields({ city, state, onChangeCity, onChangeState, autoFetch = false }) {
  const [locating, setLocating] = useState(false);
  const [triedAuto, setTriedAuto] = useState(false);

  async function useMyLocation() {
    setLocating(true);
    try {
      const loc = await fetchCurrentLocation();
      if (loc.city) onChangeCity(loc.city);
      if (loc.state) onChangeState(loc.state);
    } catch {
      // ignore — driver can type it manually
    }
    setLocating(false);
  }

  useEffect(() => {
    if (autoFetch && !triedAuto) {
      setTriedAuto(true);
      useMyLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, triedAuto]);

  return (
    <>
      <div className="sm:col-span-3">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[#B91C1C] bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed rounded-full px-3 py-1.5 transition"
        >
          {locating ? <SpinnerIcon className="w-3.5 h-3.5" /> : <PinIcon className="w-3.5 h-3.5" />}
          {locating ? "Locating…" : "Use my current location"}
        </button>
      </div>
      <Field label="City">
        <input
          value={city}
          onChange={(e) => onChangeCity(e.target.value)}
          placeholder="e.g. Austin"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <Field label="State / Province (if applicable)">
        <input
          value={state}
          onChange={(e) => onChangeState(e.target.value)}
          placeholder="e.g. TX, Punjab — leave blank if not applicable"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </Field>
    </>
  );
}

function TripRow({ trip, onEnd, onAddState, onDelete, dayEnded }) {
  const [ending, setEnding] = useState(false);
  const [addingState, setAddingState] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [odometerEnding, setOdometerEnding] = useState("");
  const [fuel, setFuel] = useState("");
  const [endCity, setEndCity] = useState("");
  const [endStateName, setEndStateName] = useState("");
  const [savingEnd, setSavingEnd] = useState(false);
  const [savingState, setSavingState] = useState(false);
  const [endLocationError, setEndLocationError] = useState("");
  const isOpen = !trip.enddate && !trip.odometerEnding;
  const states = trip.states || [];
  const hasOpenState = states.length > 0 && states[states.length - 1].endOdometer == null;

  async function handleDelete() {
    if (!window.confirm("Delete this trip? This can't be undone.")) return;
    setDeleting(true);
    try {
      await onDelete(trip._id);
      // row unmounts on success once the parent filters it out — no need to reset here
    } catch {
      // error already shown in the page-level banner; keep the row so the driver can retry
      setDeleting(false);
    }
  }

  async function submitEnd(e) {
    e.preventDefault();
    if (!endCity && !endStateName) {
      setEndLocationError("Enter (or fetch) the ending location before saving");
      return;
    }
    setEndLocationError("");
    setSavingEnd(true);
    try {
      await onEnd(trip._id, {
        odometerEnding: Number(odometerEnding),
        fuel: fuel ? Number(fuel) : undefined,
        endLocation: {
          city: endCity,
          state: endStateName,
          formatted: formatLocation({ city: endCity, state: endStateName }),
        },
      });
      setEnding(false);
    } catch {
      // error is already shown in the page-level banner by onEnd; keep the form open
    } finally {
      setSavingEnd(false);
    }
  }

  async function submitState(payload) {
    setSavingState(true);
    try {
      await onAddState(trip._id, payload);
      setAddingState(false);
    } catch {
      // error is already shown in the page-level banner; keep the form open to retry
    } finally {
      setSavingState(false);
    }
  }

  return (
    <div className="px-4 sm:px-5 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">
            {trip.endLocation?.formatted || (isOpen ? "Trip in progress" : "Trip completed")}
          </p>
          <p className="text-xs text-slate-400 font-mono break-words">
            {trip.startLocation?.formatted} → {trip.endLocation?.formatted || "in progress"} · odo{" "}
            {trip.odometerBeginning}
            {trip.odometerEnding ? ` – ${trip.odometerEnding}` : ""}
            {trip.totalMiles ? ` · ${trip.totalMiles} mi` : ""}
            {trip.fuel ? ` · ${trip.fuel} gal total` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isOpen && !dayEnded && (
            <button
              onClick={() => setEnding((v) => !v)}
              className="text-sm font-medium text-white bg-[#7F1D1D] hover:bg-[#5c1515] px-4 py-2 rounded-full transition"
            >
              End Trip
            </button>
          )}
          {!isOpen && <span className="text-xs font-mono text-emerald-600">Completed</span>}
          {!dayEnded && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete trip"
              title="Delete trip"
              className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-[#7F1D1D] hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {deleting ? <SpinnerIcon className="w-4 h-4" /> : <TrashIcon className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {states.length > 0 && (
        <div className="mt-3 space-y-1">
          {states.map((s, i) => (
            <p key={i} className="text-xs font-mono text-slate-500 break-words">
              {s.location?.formatted}: {s.startOdometer} – {s.endOdometer ?? "…"}
              {s.fuel ? ` · ${s.fuel} gal` : ""}
            </p>
          ))}
        </div>
      )}

      {isOpen && !dayEnded && (
        <button
          onClick={() => setAddingState((v) => !v)}
          className="text-xs text-[#B91C1C] underline mt-2"
        >
          + Crossed into new state
        </button>
      )}

      {addingState && (
        <StateForm
          onCancel={() => setAddingState(false)}
          onSubmit={submitState}
          saving={savingState}
          leavingLocationLabel={
            states.length > 0
              ? states[states.length - 1].location?.formatted
              : trip.startLocation?.formatted
          }
        />
      )}

      {ending && (
        <form onSubmit={submitEnd} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {hasOpenState && (
            <p className="sm:col-span-3 text-xs text-amber-600">
              Note: {states[states.length - 1].location?.formatted} doesn't have an ending odometer
              yet — ending the trip will close it out using the value below.
            </p>
          )}
          <Field label="Ending odometer">
            <input
              type="number"
              required
              value={odometerEnding}
              onChange={(e) => setOdometerEnding(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </Field>
          <Field label={hasOpenState ? `Fuel added in ${states[states.length - 1].location?.formatted || "this state"} (gal)` : "Fuel added (gal)"}>
            <input
              type="number"
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </Field>
          <LocationFields
            city={endCity}
            state={endStateName}
            onChangeCity={setEndCity}
            onChangeState={setEndStateName}
            autoFetch
          />
          {endLocationError && (
            <p className="sm:col-span-3 text-xs text-[#7F1D1D] -mt-2">{endLocationError}</p>
          )}
          <div className="sm:col-span-3 flex flex-col sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => setEnding(false)}
              disabled={savingEnd}
              className="w-full sm:w-auto px-5 py-2 rounded-full text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEnd}
              className="w-full sm:w-auto bg-[#7F1D1D] text-white font-semibold px-5 py-2 rounded-full hover:bg-[#5c1515] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingEnd ? "Saving…" : "Save & End Trip"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function StateForm({ onCancel, onSubmit, saving, leavingLocationLabel }) {
  const [odometer, setOdometer] = useState("");
  const [fuel, setFuel] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");

  function submit(e) {
    e.preventDefault();
    onSubmit({
      odometerAtStateLine: Number(odometer),
      fuel: fuel ? Number(fuel) : undefined,
      nextLocation: {
        city,
        state: stateName,
        formatted: formatLocation({ city, state: stateName }),
      },
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/60 border border-slate-100 rounded-lg p-4"
    >
      <Field label="Odometer at state line">
        <input
          type="number"
          required
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <Field label={leavingLocationLabel ? `Fuel added in ${leavingLocationLabel} (gal)` : "Fuel added before crossing (gal)"}>
        <input
          type="number"
          value={fuel}
          onChange={(e) => setFuel(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <LocationFields
        city={city}
        state={stateName}
        onChangeCity={setCity}
        onChangeState={setStateName}
        autoFetch
      />
      <div className="sm:col-span-3 flex flex-col sm:flex-row justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="w-full sm:w-auto px-4 py-2 rounded-full text-slate-500 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto bg-[#DC2626] text-white font-semibold px-4 py-2 rounded-full text-sm hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function TripForm({ trucks, trailers, onCancel, onSubmit }) {
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [truck, setTruck] = useState("");
  const [trailer, setTrailer] = useState("");
  const [odometerBeginning, setOdometerBeginning] = useState("");
  const [saving, setSaving] = useState(false);
  const [trailerError, setTrailerError] = useState("");

  const truckOptions = trucks.map((t) => ({ value: t._id, label: `Unit ${t.unitNumber}` }));
  const trailerOptions = trailers.map((t) => ({ value: t._id, label: `Trailer ${t.trailerNumber}` }));

  async function submit(e) {
    e.preventDefault();
    if (!trailer) {
      setTrailerError("Select a trailer before saving the trip");
      return;
    }
    setTrailerError("");
    setSaving(true);
    try {
      await onSubmit({
        startLocation: {
          city,
          state: stateName,
          formatted: formatLocation({ city, state: stateName }),
        },
        truck: truck || undefined,
        trailer,
        odometerBeginning: Number(odometerBeginning),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="px-4 sm:px-5 py-5 border-b border-slate-100 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      <LocationFields
        city={city}
        state={stateName}
        onChangeCity={setCity}
        onChangeState={setStateName}
        autoFetch
      />
      <Field label="Truck">
        <SearchableSelect
          value={truck}
          onChange={setTruck}
          options={truckOptions}
          placeholder="Select truck"
        />
      </Field>
      <Field label="Trailer">
        <SearchableSelect
          value={trailer}
          onChange={(v) => {
            setTrailer(v);
            if (v) setTrailerError("");
          }}
          options={trailerOptions}
          placeholder="Select trailer"
        />
        {trailerError && <p className="text-xs text-[#7F1D1D] mt-1">{trailerError}</p>}
      </Field>
      <Field label="Starting odometer">
        <input
          type="number"
          required
          value={odometerBeginning}
          onChange={(e) => setOdometerBeginning(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <div className="sm:col-span-3 flex flex-col sm:flex-row justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="w-full sm:w-auto px-5 py-2 rounded-full text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto bg-[#DC2626] text-white font-semibold px-5 py-2 rounded-full hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Trip"}
        </button>
      </div>
    </form>
  );
}

function StatusForm({ onCancel, onSubmit }) {
  const [status, setStatus] = useState("driving");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ status, from, to, purpose });
      setFrom("");
      setTo("");
      setPurpose("");
    } catch {
      // error is already shown in the page-level banner; keep the entered values so the driver can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="px-4 sm:px-5 py-5 border-b border-slate-100 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <Field label="Status">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="From">
        <input
          type="time"
          required
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <Field label="To">
        <input
          type="time"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Purpose (optional)">
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g. fuel stop, mandatory rest"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <div className="sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="w-full sm:w-auto px-5 py-2 rounded-full text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto bg-[#DC2626] text-white font-semibold px-5 py-2 rounded-full hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Add Status"}
        </button>
      </div>
    </form>
  );
}