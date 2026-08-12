import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import { DriverDailyLog } from "../../../models/schema";
import { getCurrentDriver } from "../../../lib/getCurrentDriver";
import { dayRangeForDriver } from "../../../lib/dateRange";
import { isDateEditable } from "../../../lib/editWindow";

export async function POST(request) {
  await connectDB();
  const driver = await getCurrentDriver();
  if (!driver) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { date } = body; // "YYYY-MM-DD" from the client, or absent -> today

  // Re-check against the edit window server-side — never trust the
  // client's greyed-out calendar alone.
  if (date && !isDateEditable(date, driver.timezone)) {
    return NextResponse.json(
      { error: "This day is outside the window where a new log can be started." },
      { status: 403 }
    );
  }

  let start, end;
  try {
    ({ start, end } = dayRangeForDriver(driver.timezone, date));
  } catch (err) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  // Idempotent — if this day's log already exists (e.g. page refresh), just return it
  let log = await DriverDailyLog.findOne({
    driver: driver._id,
    date: { $gte: start, $lt: end },
  });

  if (!log) {
    log = await DriverDailyLog.create({
      driver: driver._id,
      date: start,
      trips: [],
      statusChanges: [],
    });
  }

  return NextResponse.json({ log });
}