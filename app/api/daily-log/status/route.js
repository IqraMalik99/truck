import { NextResponse } from "next/server";
import {connectDB} from "../../../lib/db";
import { DriverDailyLog } from "../../../models/schema";
import { getCurrentDriver } from "../../../lib/getCurrentDriver";

const VALID_STATUSES = ["off_duty", "sleeper", "driving", "on_duty"];

export async function POST(request) {
  await connectDB();
  const driver = await getCurrentDriver();
  if (!driver) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { dailyLogId, status, from, to, purpose } = await request.json();
  console.log(to,"from");
  if (!dailyLogId) {
    return NextResponse.json({ error: "dailyLogId is required" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (!from || !to) {
    return NextResponse.json({ error: "From and to times are required" }, { status: 400 });
  }

  const log = await DriverDailyLog.findById(dailyLogId);
  if (!log) {
    return NextResponse.json({ error: "Daily log not found" }, { status: 404 });
  }
  if (log.dayEnded) {
    return NextResponse.json({ error: "Today's log is already closed" }, { status: 400 });
  }

  log.statusChanges.push({ status, from, to, purpose });
  await log.save();

  return NextResponse.json({ entry: log.statusChanges[log.statusChanges.length - 1] });
}