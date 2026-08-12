import { NextResponse } from "next/server";
import {connectDB} from "../../../lib/db";
import { DriverDailyLog } from "../../../models/schema";
import { getCurrentDriver } from "../../../lib/getCurrentDriver";
import { todayRangeForDriver } from "../../../lib/dateRange";


export async function GET() {
  await connectDB();
  const driver = await getCurrentDriver();
  if (!driver) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { start, end } = todayRangeForDriver(driver.timezone);

  const log = await DriverDailyLog.findOne({
    driver: driver._id,
    date: { $gte: start, $lt: end },
  }).populate({ path: "trips", options: { sort: { startdate: 1 } } });

  if (!log) {
    return NextResponse.json({ log: null, trips: [] });
  }

  return NextResponse.json({ log, trips: log.trips });
}