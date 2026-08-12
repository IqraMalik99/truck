// lib/editWindow.js
// Single source of truth for "which days are open for editing" — kept in
// sync with lib/dateRange.js by using the SAME approach: Luxon + the
// driver's own timezone, not the server's or browser's local clock.
//
// This matters because the /start route computes "today" using
// driver.timezone via Luxon — if this file used plain `new Date()` instead,
// a driver near midnight in their own timezone could see the calendar
// disagree with what the server will actually accept.
import { DateTime } from "luxon";

// today + 3 days back = 4 clickable days total (today, yesterday,
// 2 days ago, 3 days ago). Change this one number to widen/narrow the window.
export const EDITABLE_DAYS_BACK = 3;

// Accepts a JS Date, a "YYYY-MM-DD" string, or nothing (-> now), and returns
// the Luxon start-of-day for that calendar date IN the given timezone.
function startOfDayIn(dateInput, timeZone = "UTC") {
  if (dateInput instanceof Date) {
    return DateTime.fromJSDate(dateInput).setZone(timeZone).startOf("day");
  }
  if (typeof dateInput === "string") {
    return DateTime.fromISO(dateInput, { zone: timeZone }).startOf("day");
  }
  return DateTime.now().setZone(timeZone).startOf("day");
}

// Public helper: start-of-day as a plain JS Date, in the given timezone.
// Handy for initializing state (e.g. `useState(() => startOfDay(new Date()))`)
// where you don't need the full Luxon object, just a Date to compare/display.
export function startOfDay(date = new Date(), timeZone = "UTC") {
  return startOfDayIn(date, timeZone).toJSDate();
}

// "YYYY-MM-DD" for the given date, in the given timezone.
export function toDateKey(date, timeZone = "UTC") {
  return startOfDayIn(date, timeZone).toISODate();
}

// [today, yesterday, ...] going back EDITABLE_DAYS_BACK days, as JS Dates —
// all computed relative to the driver's own "today" in their timezone.
export function editableDates(timeZone = "UTC", from = new Date()) {
  const today = startOfDayIn(from, timeZone);
  return Array.from({ length: EDITABLE_DAYS_BACK + 1 }, (_, i) =>
    today.minus({ days: i }).toJSDate()
  );
}

// The check that must match what dayRangeForDriver() would accept for the
// same date + timezone. Use this on BOTH the client (grey out the calendar)
// and the server (actually reject writes) — always passing driver.timezone.
export function isDateEditable(date, timeZone = "UTC", from = new Date()) {
  const target = startOfDayIn(date, timeZone);
  const today = startOfDayIn(from, timeZone);
  const diffDays = today.diff(target, "days").days;
  return diffDays >= 0 && diffDays <= EDITABLE_DAYS_BACK;
}

export function relativeDayLabel(date, timeZone = "UTC", from = new Date()) {
  const today = startOfDayIn(from, timeZone);
  const target = startOfDayIn(date, timeZone);
  const diff = Math.round(today.diff(target, "days").days);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff} days ago`;
}