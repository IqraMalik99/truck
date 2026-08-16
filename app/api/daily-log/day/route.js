import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import { DriverDailyLog, TripSheet } from "../../../models/schema";
import { getCurrentDriver } from "../../../lib/getCurrentDriver";
import { isDateEditable } from "../../../lib/editWindow";
import { dayRangeForDriver } from "../../../lib/dateRange";

export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const driver = await getCurrentDriver();
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let start, end;
  try {
    ({ start, end } = dayRangeForDriver(driver.timezone, dateParam));
  } catch (err) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  // All-time trip count for this driver — independent of the selected day,
  // used for a "Total Trips" summary card alongside the day's trip count.
  const totalTrips = await TripSheet.countDocuments({ driver: driver._id });

  const log = await DriverDailyLog.findOne({
    driver: driver._id,
    date: { $gte: start, $lt: end },
  }).lean();

  if (!log) {
    // No log yet for that day — tell the client whether starting one is even allowed
    return NextResponse.json({
      log: null,
      trips: [],
      editable: isDateEditable(dateParam, driver.timezone),
      totalTrips,
    });
  }

  const trips = await TripSheet.find({ _id: { $in: log.trips } }).lean();

  return NextResponse.json({
    log,
    trips,
    editable: isDateEditable(dateParam, driver.timezone),
    totalTrips,
  });
}