import { NextResponse } from "next/server";
import {connectDB} from "../../../lib/db";
import { DriverDailyLog } from "../../../models/schema";
import { getCurrentDriver } from "../../../lib/getCurrentDriver";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function GET() {
  await connectDB();
  const driver = await getCurrentDriver();
  if (!driver) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { start, end } = todayRange();

  const log = await DriverDailyLog.findOne({
    driver: driver._id,
    date: { $gte: start, $lt: end },
  }).populate({ path: "trips", options: { sort: { startdate: 1 } } });

  if (!log) {
    return NextResponse.json({ log: null, trips: [] });
  }

  return NextResponse.json({ log, trips: log.trips });
}