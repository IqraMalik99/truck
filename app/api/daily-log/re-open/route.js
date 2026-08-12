// app/api/daily-log/re-open/route.js
import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import { DriverDailyLog } from "../../../models/schema";
import { getCurrentDriver } from "../../../lib/getCurrentDriver";
import { isDateEditable } from "../../../lib/editWindow";

export async function POST(request) {
  try {
    await connectDB();

    const driver = await getCurrentDriver();
    if (!driver) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { dailyLogId } = await request.json();
    if (!dailyLogId) {
      return NextResponse.json({ error: "dailyLogId is required" }, { status: 400 });
    }

    // THE BUG: this used to look up "today's" log by date, ignoring
    // dailyLogId entirely — so reopening any day other than today either
    // found nothing or found the wrong log. Look it up by its own _id instead.
    const log = await DriverDailyLog.findById(dailyLogId);
    if (!log) {
      return NextResponse.json({ error: "Daily log not found" }, { status: 404 });
    }

    // Ownership check — without this, any signed-in driver who knew another
    // driver's dailyLogId could reopen/edit it.
    if (log.driver.toString() !== driver._id.toString()) {
      return NextResponse.json({ error: "Not authorized to edit this log" }, { status: 403 });
    }

    if (!log.dayEnded) {
      return NextResponse.json({ error: "This log isn't closed" }, { status: 400 });
    }

    // Same rule as everywhere else: only days inside the edit window
    // (today + EDITABLE_DAYS_BACK) can be reopened, in the driver's own timezone.
    if (!isDateEditable(log.date, driver.timezone)) {
      return NextResponse.json(
        { error: "This day is outside the window that can still be edited" },
        { status: 403 }
      );
    }

    log.dayEnded = false;
    await log.save();

    const populated = await DriverDailyLog.findById(log._id).populate({ path: "trips" });
    return NextResponse.json({ log: populated });
  } catch (err) {
    if (err.name === "CastError") {
      return NextResponse.json({ error: "Invalid dailyLogId" }, { status: 400 });
    }
    console.error("[re-open] UNEXPECTED ERROR:", err.name, "-", err.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}