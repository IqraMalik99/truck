// lib/dateRange.js
import { DateTime } from "luxon";

// Returns the UTC start/end instants for a given calendar date, computed in
// the driver's OWN timezone — e.g. if timeZone is "Asia/Karachi" and dateStr
// is "2026-08-10", start/end bracket midnight-to-midnight in Karachi, not UTC
// and not the server's local time.
//
// dateStr is optional — omit it (or pass nothing) to get "today" for that
// driver, same as the original todayRangeForDriver behavior.
export function dayRangeForDriver(timeZone = "UTC", dateStr) {
  const base = dateStr
    ? DateTime.fromISO(dateStr, { zone: timeZone })
    : DateTime.now().setZone(timeZone);

  if (!base.isValid) {
    throw new Error(`Invalid date "${dateStr}" for timezone "${timeZone}"`);
  }

  const start = base.startOf("day").toUTC().toJSDate();
  const end = base.plus({ days: 1 }).startOf("day").toUTC().toJSDate();
  return { start, end };
}

// Kept so any existing call sites (like your /start route) don't break.
export function todayRangeForDriver(timeZone = "UTC") {
  return dayRangeForDriver(timeZone);
}