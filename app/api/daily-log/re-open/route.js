
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { connectDB } from "../../../lib/db";
import { DriverDailyLog , Driver } from "../../../models/schema";
export async function POST() {
  await connectDB();

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const driver = await Driver.findOne({ email: session.user.email });
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const log = await DriverDailyLog.findOne({
    driver: driver._id,
    date: { $gte: startOfToday, $lt: startOfTomorrow },
  });

  if (!log) {
    return NextResponse.json({ error: "No log found for today" }, { status: 404 });
  }
  if (!log.dayEnded) {
    return NextResponse.json({ error: "Today's log isn't closed" }, { status: 400 });
  }

  log.dayEnded = false;
  await log.save();

  const populated = await DriverDailyLog.findById(log._id).populate({ path: "trips" });
  return NextResponse.json({ log: populated });
}