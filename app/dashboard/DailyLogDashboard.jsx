"use client";

import { useEffect, useMemo, useState } from "react";
import StatusTimeline from "../components/admin/Statustimeline";
import SearchableSelect from "../components/Searchableselect";

/*
  Expected API contract (build these routes when ready):

  GET    /api/daily-log/today   -> { log: DriverDailyLog | null, trips: TripSheet[] }
  POST   /api/daily-log/start   -> { log }   body: {}
  POST   /api/trips             -> TripSheet body: { dailyLogId, startLocation, truck, trailer, odometerBeginning }
  POST   /api/trips/:id/states  -> TripSheet body: { odometerAtStateLine, nextLocation }
  PATCH  /api/trips/:id/end     -> TripSheet body: { endLocation, odometerEnding, fuel }
  POST   /api/daily-log/status  -> { entry } body: { dailyLogId, status, from, to, purpose }
  POST   /api/daily-log/end     -> { log }   body: { dailyLogId }
  GET    /api/trucks            -> Truck[]
  GET    /api/trailers          -> Trailer[]

  Location shape used everywhere below (works whether the region has a
  "state"/province or not — some countries only have a city):
    { city, state, country, formatted }

  Note: destination has been dropped — endLocation is now the record of
  where the trip actually ended. Trailer is required, same as truck: the
  backend (/api/trips) should reject a missing trailer just like it already
  rejects a missing truck.
*/

const STATUS_OPTIONS = [
  { value: "off_duty", label: "Off Duty", color: "#94A3B8" },
  { value: "sleeper_berth", label: "Sleeper Berth", color: "#8B5CF6" },
  { value: "driving", label: "Driving", color: "#DC2626" },
  { value: "on_duty", label: "On Duty (Not Driving)", color: "#22C55E" },
];

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
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

// Turns whatever pieces we have into the one display string the UI/DB uses.
// Some countries only have a city, some have city+state, some just a country.
function formatLocation({ city, state, country } = {}) {
  return [city, state].filter(Boolean).join(", ") || country || "";
}

// Reverse-geocodes the driver's current position into a full location object.
// Uses OpenStreetMap's Nominatim (no API key needed, works worldwide — not
// just the US). Swap for Google Geocoding / Mapbox later if you need higher
// rate limits or accuracy guarantees.
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
          // not every country's response has all of these — take whatever exists
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

// Reads the backend's actual { error: "..." } message so the UI can show
// what the API really said instead of a generic fallback string.
async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

export default function DailyLogDashboard() {
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
  useEffect(() => {
    fetchToday();
    fetchFleet();
  }, []);

  async function fetchToday() {
    setLoading(true);
    try {
      const res = await fetch("/api/daily-log/today");
      if (res.ok) {
        const data = await res.json();
        if (data?.log) {
          setDailyLog(data.log);
          setTrips(data.trips || data.log.trips || []);
          setStatusChanges(data.log.statusChanges || []);
        }
      }
    } catch {
      // backend not built yet — fine, dashboard just shows "Start Your Day"
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
      const res = await fetch("/api/daily-log/start", { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Couldn't start the day. Check your connection and try again."));
      const data = await res.json();
      setDailyLog(data.log);
      setTrips([]);
      setStatusChanges([]);
    } catch (err) {
      setError(err.message || "Couldn't start the day. Check your connection and try again.");
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

  // Records that the truck crossed into a new state/province mid-trip. The
  // single odometer reading sent here closes the previous states[] entry AND
  // opens the next one — the driver never types the same number twice.
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
      setError(`End the trip to ${openTrip.endLocation?.formatted || "its destination"} before ending the day.`);
      return;
    }
    const openState = trips
      .flatMap((t) => t.states || [])
      .find((s) => s.endOdometer == null);
    if (openState) {
      setError(`Close out the state entry for ${openState.location?.formatted || "an open state"} before ending the day.`);
      return;
    }
    setEndingDay(true);
    try {
      const res = await fetch("/api/daily-log/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLogId: dailyLog?._id, statusChanges }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't end the day. Try again."));
      const data = await res.json();
      setDailyLog(data.log);
    } catch (err) {
      setError(err.message || "Couldn't end the day. Try again.");
    } finally {
      setEndingDay(false);
    }
  }

  async function reopenDay() {
  setError("");
  setReopeningDay(true);
  try {
    const res = await fetch("/api/daily-log/re-open", { method: "POST" });
    if (!res.ok) throw new Error(await readError(res, "Couldn't reopen the day. Try again."));
    const data = await res.json();
    setDailyLog(data.log);
    setTrips(data.trips || data.log.trips || []);
  } catch (err) {
    setError(err.message || "Couldn't reopen the day. Try again.");
  } finally {
    setReopeningDay(false);
  }
}

  // Streams the PDF report back from the server and saves it as a file —
  // only meaningful once the day is closed, since that's when totals are final.
  async function downloadReport() {
    if (!dailyLog?._id) return;
    setError("");
    setDownloadingReport(true);
    try {
      const res = await fetch(`/api/daily-log/report`);
      if (!res.ok) throw new Error(await readError(res, "Couldn't generate the report. Try again."));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date(dailyLog.date || Date.now()).toISOString().slice(0, 10);
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

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-sm text-slate-500 font-mono">Loading today's log…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Not started yet */}
      {!dailyLog && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-4">
          <p className="text-slate-500 text-sm">You haven't started today's log yet.</p>
          <button
            onClick={startDay}
            disabled={startingDay}
            className="bg-[#DC2626] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {startingDay ? "Starting…" : "Start Your Day"}
          </button>
        </div>
      )}

      {dailyLog && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Trips today" value={trips.length} />
            <SummaryCard label="Total miles" value={totals.miles.toLocaleString()} />
            <SummaryCard label="Fuel logged" value={`${totals.fuel} gal`} />
            <SummaryCard label="Driving time" value={fmtHours(totals.byStatus.driving)} highlight />
          </div>

          {/* Trips */}
          <section className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold">Trips today</h2>
              {!dayEnded && (
                <button
                  onClick={() => setShowTripForm((v) => !v)}
                  className="text-sm font-medium text-white bg-[#DC2626] hover:bg-[#B91C1C] px-4 py-2 rounded-lg transition"
                >
                  + Add Another Trip
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
                <p className="px-5 py-6 text-sm text-slate-400">No trips logged yet today.</p>
              )}
              {trips.map((trip) => (
                <TripRow
                  key={trip._id}
                  trip={trip}
                  onEnd={endTrip}
                  onAddState={addTripState}
                  dayEnded={dayEnded}
                />
              ))}
            </div>
          </section>

          {/* Status / schedule */}
          <section className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold">Duty status</h2>
                <p className="text-xs text-slate-400">
                  Optional during the day — add driving, sleeper, rest, or on-duty blocks whenever you like.
                </p>
              </div>
              {!dayEnded && (
                <button
                  onClick={() => setShowStatusForm((v) => !v)}
                  className="text-sm font-medium text-[#B91C1C] border border-[#DC2626]/50 hover:border-[#DC2626] px-4 py-2 rounded-lg transition"
                >
                  + Add Status
                </button>
              )}
            </div>

            {showStatusForm && (
              <StatusForm onCancel={() => setShowStatusForm(false)} onSubmit={addStatus} />
            )}

            <div className="px-5 py-5 overflow-x-auto">
              <StatusTimeline statusChanges={statusChanges} />
            </div>

            {statusChanges.length > 0 && (
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {statusChanges.map((s, i) => {
                  const opt = STATUS_OPTIONS.find((o) => o.value === s.status);
                  return (
                    <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: opt?.color }}
                        />
                        <span className="font-medium">{opt?.label}</span>
                        <span className="font-mono text-slate-500">
                          {s.from} – {s.to}
                        </span>
                        {s.purpose && <span className="text-slate-400">· {s.purpose}</span>}
                      </div>
                      {!dayEnded && (
                        <button
                          onClick={() => removeStatus(i)}
                          className="text-slate-400 hover:text-red-500 text-xs"
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

          {/* End day */}
          {!dayEnded && (
            <div className="flex justify-end">
              <button
                onClick={endDay}
                disabled={endingDay}
                className="bg-[#1B2430] text-white font-semibold px-6 py-3 rounded-lg hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {endingDay ? "Ending…" : "End Day"}
              </button>
            </div>
          )}
        {dayEnded && (
  <div className="bg-slate-100 border border-slate-200 rounded-lg px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
    <div className="flex items-center gap-3">
      <CheckCircleIcon className="w-6 h-6 text-emerald-500 shrink-0" />
      <p className="text-sm text-slate-600">
        Today's log is closed. Miles, fuel, and duty hours are locked in.
      </p>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          if (window.confirm("Reopen today's log? You'll be able to edit trips and statuses again.")) {
            reopenDay();
          }
        }}
        disabled={reopeningDay}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition"
      >
        {reopeningDay ? <SpinnerIcon className="w-4 h-4" /> : null}
        {reopeningDay ? "Reopening…" : "Reopen Day"}
      </button>
      <button
        onClick={downloadReport}
        disabled={downloadingReport}
        className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition"
      >
        {downloadingReport ? <SpinnerIcon className="w-4 h-4" /> : <ReportIcon className="w-4 h-4" />}
        {downloadingReport ? "Generating…" : "Download PDF Report"}
      </button>
    </div>
  </div>
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
      <p className={`text-lg font-semibold mt-0.5 ${highlight ? "text-[#B91C1C]" : ""}`}>{value}</p>
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

// Reusable city/state (or just city, or just country) location inputs with a
// proper "use my current location" button — icon + label, clear pressed/
// disabled states instead of a bare underlined link.
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
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B91C1C] bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed rounded-full px-3 py-1.5 transition"
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

function TripRow({ trip, onEnd, onAddState, dayEnded }) {
  const [ending, setEnding] = useState(false);
  const [addingState, setAddingState] = useState(false);
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

  async function submitEnd(e) {
    e.preventDefault();
    // matches the backend's own check: endLocation needs at least one of city/state
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
      // onEnd only resolves without throwing when the API actually accepted it —
      // only close the form on real success, so validation errors leave it open to fix
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
    <div className="px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">
            {trip.endLocation?.formatted || (isOpen ? "Trip in progress" : "Trip completed")}
          </p>
          <p className="text-xs text-slate-400 font-mono">
            {trip.startLocation?.formatted} → {trip.endLocation?.formatted || "in progress"} · odo{" "}
            {trip.odometerBeginning}
            {trip.odometerEnding ? ` – ${trip.odometerEnding}` : ""}
            {trip.totalMiles ? ` · ${trip.totalMiles} mi` : ""}
          </p>
        </div>
        {isOpen && !dayEnded && (
          <button
            onClick={() => setEnding((v) => !v)}
            className="text-sm font-medium text-[#B91C1C] border border-[#DC2626]/50 hover:border-[#DC2626] px-4 py-2 rounded-lg transition"
          >
            End Trip
          </button>
        )}
        {!isOpen && <span className="text-xs font-mono text-emerald-600">Completed</span>}
      </div>

      {/* Per-trip state-by-state odometer breakdown */}
      {states.length > 0 && (
        <div className="mt-3 space-y-1">
          {states.map((s, i) => (
            <p key={i} className="text-xs font-mono text-slate-500">
              {s.location?.formatted}: {s.startOdometer} – {s.endOdometer ?? "…"}
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
          <Field label="Fuel added (gal, optional)">
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
            <p className="sm:col-span-3 text-xs text-red-600 -mt-2">{endLocationError}</p>
          )}
          <div className="sm:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEnding(false)}
              disabled={savingEnd}
              className="px-5 py-2 rounded-lg text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEnd}
              className="bg-[#DC2626] text-white font-semibold px-5 py-2 rounded-lg hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {savingEnd ? "Saving…" : "Save & End Trip"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Single-odometer state crossing form. The one number entered here becomes
// BOTH the endOdometer of the state being left and the startOdometer of the
// state being entered — the driver never has to type the same reading twice.
function StateForm({ onCancel, onSubmit, saving }) {
  const [odometer, setOdometer] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");

  function submit(e) {
    e.preventDefault();
    onSubmit({
      odometerAtStateLine: Number(odometer),
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
      <LocationFields
        city={city}
        state={stateName}
        onChangeCity={setCity}
        onChangeState={setStateName}
        autoFetch
      />
      <div className="sm:col-span-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-slate-500 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="bg-[#DC2626] text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed"
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
        // destination and fuel are captured on End Trip instead
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="px-5 py-5 border-b border-slate-100 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-3 gap-4"
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
        {trailerError && <p className="text-xs text-red-600 mt-1">{trailerError}</p>}
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
      <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2 rounded-lg text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="bg-[#DC2626] text-white font-semibold px-5 py-2 rounded-lg hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed"
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
      className="px-5 py-5 border-b border-slate-100 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-4 gap-4"
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
      <div className="sm:col-span-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2 rounded-lg text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="bg-[#DC2626] text-white font-semibold px-5 py-2 rounded-lg hover:bg-[#B91C1C] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Add Status"}
        </button>
      </div>
    </form>
  );
}