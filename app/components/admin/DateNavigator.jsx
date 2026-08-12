"use client";

import { useState } from "react";
import {
  editableDates,
  isDateEditable,
  toDateKey,
  relativeDayLabel,
  startOfDay,
} from "../../lib/editWindow";

/*
  Usage:
    const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
    <DateNavigator selectedDate={selectedDate} onSelect={setSelectedDate} timeZone={driverTimeZone} />

  Shows quick buttons for every editable day (today + the last few days),
  plus a small calendar icon that opens a full month grid where only those
  same days are clickable — everything else is greyed out and disabled.

  IMPORTANT: timeZone must be the driver's real IANA timezone (e.g.
  "Asia/Karachi"), matching what the server uses in isDateEditable() on the
  write routes. If it's left at the "UTC" default, the quick-buttons/calendar
  here can disagree with what the server actually accepts near midnight in
  the driver's timezone.
*/
export default function DateNavigator({ selectedDate, onSelect, timeZone = "UTC" }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const quickDates = editableDates(timeZone); // [today, yesterday, ...] in the driver's timezone

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        {quickDates.map((d) => {
          const active = toDateKey(d, timeZone) === toDateKey(selectedDate, timeZone);
          return (
            <button
              key={toDateKey(d, timeZone)}
              type="button"
              onClick={() => onSelect(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                active
                  ? "bg-[#DC2626] text-white border-[#DC2626]"
                  : "bg-white text-slate-700 border-slate-300 hover:border-[#DC2626]"
              }`}
            >
              {relativeDayLabel(d, timeZone)}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowCalendar((v) => !v)}
          aria-label="Pick a date from the calendar"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-slate-500 hover:border-[#DC2626] hover:text-[#B91C1C] transition"
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>

      {showCalendar && (
        <div className="absolute z-30 mt-2">
          <MonthCalendar
            selectedDate={selectedDate}
            timeZone={timeZone}
            onSelect={(d) => {
              onSelect(d);
              setShowCalendar(false);
            }}
            onClose={() => setShowCalendar(false)}
          />
        </div>
      )}
    </div>
  );
}

function MonthCalendar({ selectedDate, timeZone = "UTC", onSelect, onClose }) {
  // viewMonth is just a calendar-shape anchor (which month grid to draw) —
  // built/moved in UTC so it never depends on the browser's local clock.
  const [viewMonth, setViewMonth] = useState(() => {
    const d = startOfDay(selectedDate, timeZone);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  });

  const year = viewMonth.getUTCFullYear();
  const month = viewMonth.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    // Build each day as a "YYYY-MM-DD" string and run it through
    // startOfDay(..., timeZone) so every cell is anchored to the SAME
    // timezone the server checks against — not the browser's local clock
    // (which is what `new Date(year, month, day)` would have used).
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(startOfDay(dateStr, timeZone));
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 w-72 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth(new Date(Date.UTC(year, month - 1, 1)))}
          className="text-slate-400 hover:text-slate-700 px-2"
        >
          ‹
        </button>
        <p className="text-sm font-semibold">
          {viewMonth.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth(new Date(Date.UTC(year, month + 1, 1)))}
          className="text-slate-400 hover:text-slate-700 px-2"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const editable = isDateEditable(d, timeZone);
          const active = toDateKey(d, timeZone) === toDateKey(selectedDate, timeZone);
          return (
            <button
              key={i}
              type="button"
              disabled={!editable}
              onClick={() => onSelect(d)}
              className={`aspect-square rounded-md text-xs flex items-center justify-center transition ${
                active
                  ? "bg-[#DC2626] text-white font-semibold"
                  : editable
                  ? "text-[#B91C1C] hover:bg-red-50 font-medium"
                  : "text-slate-300 cursor-not-allowed"
              }`}
            >
              {d.getUTCDate()}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-slate-400">
          Only today and the last few days can be opened.
        </p>
        <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>
    </div>
  );
}

function CalendarIcon({ className = "w-4 h-4" }) {
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
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}