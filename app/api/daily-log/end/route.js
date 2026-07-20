import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import { DriverDailyLog } from "../../../models/schema";
import { getCurrentDriver } from "../../../lib/getCurrentDriver";

// "14:30" -> minutes since midnight, handles the odd shift that crosses midnight
function minutesBetween(from, to) {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let diff = th * 60 + tm - (fh * 60 + fm);
  if (diff < 0) diff += 1440;
  return diff;
}

export async function POST(request) {
  try {
    console.log("[end-day] connecting to DB...");
    await connectDB();

    const driver = await getCurrentDriver();
    if (!driver) {
      console.warn("[end-day] rejected: no signed-in driver");
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    console.log(`[end-day] driver: ${driver._id?.toString?.() || driver}`);

    const { dailyLogId, statusChanges } = await request.json();
    console.log(`[end-day] request body: dailyLogId=${dailyLogId}, statusChanges count=${Array.isArray(statusChanges) ? statusChanges.length : "n/a"}`);

    if (!dailyLogId) {
      console.warn("[end-day] rejected: missing dailyLogId");
      return NextResponse.json({ error: "dailyLogId is required" }, { status: 400 });
    }

    const log = await DriverDailyLog.findById(dailyLogId).populate("trips");
    if (!log) {
      console.warn(`[end-day] rejected: no log found for id ${dailyLogId}`);
      return NextResponse.json({ error: "Daily log not found" }, { status: 404 });
    }
    console.log(`[end-day] loaded log ${log._id.toString()} with ${log.trips.length} trip(s)`);

    if (log.dayEnded) {
      console.log(`[end-day] log ${log._id.toString()} already ended, skipping`);
      return NextResponse.json({ log }); // already closed, nothing to do
    }

    const openTrip = log.trips.find((t) => !t.enddate);
    if (openTrip) {
      console.warn(`[end-day] rejected: open trip ${openTrip._id?.toString?.() || openTrip} to "${openTrip.destination || "unknown destination"}"`);
      return NextResponse.json(
        { error: `End the trip to ${openTrip.destination || "its destination"} before ending the day` },
        { status: 400 }
      );
    }

    if (Array.isArray(statusChanges)) {
      log.statusChanges = statusChanges;
      console.log(`[end-day] applied ${statusChanges.length} status change(s) from request`);
    } else {
      console.log(`[end-day] no statusChanges in request, using existing ${log.statusChanges.length} entry(ies)`);
    }

    log.totalMilesToday = log.trips.reduce((sum, t) => sum + (t.totalMiles || 0), 0);
    log.totalfuel = log.trips.reduce((sum, t) => sum + (t.fuel || 0), 0);
    console.log(`[end-day] totals: miles=${log.totalMilesToday}, fuel=${log.totalfuel}`);

    const minutesByStatus = { off_duty: 0, sleeper_berth: 0, driving: 0, on_duty: 0 };
    log.statusChanges.forEach((s) => {
      if (!(s.status in minutesByStatus)) {
        console.warn(`[end-day] unrecognized status "${s.status}" in statusChanges entry (from=${s.from}, to=${s.to}) — check enum values`);
      }
      minutesByStatus[s.status] = (minutesByStatus[s.status] || 0) + minutesBetween(s.from, s.to);
    });
    console.log("[end-day] minutesByStatus:", minutesByStatus);

    log.totalHours = {
      offDuty: minutesByStatus.off_duty / 60,
      sleeperBerth: minutesByStatus.sleeper_berth / 60,
      driving: minutesByStatus.driving / 60,
      onDuty: minutesByStatus.on_duty / 60,
    };
    console.log("[end-day] totalHours:", log.totalHours);

    // NOTE: this was previously set to `false`, which meant the day never
    // actually closed. This route is "end the day", so it must be `true`.
    log.dayEnded = true;
    log.endedAt = new Date();

    console.log(`[end-day] saving log ${log._id.toString()}...`);
    await log.save();
    console.log(`[end-day] save succeeded for log ${log._id.toString()}`);

    const newLog = await DriverDailyLog.findById(dailyLogId);
    console.log(`[end-day] closed log ${newLog._id.toString()} at ${newLog.dayEnded}`);

    return NextResponse.json({ log: newLog });
  } catch (err) {
    // Mongoose validation errors -> 400 with field-level detail
    if (err.name === "ValidationError") {
      const details = Object.fromEntries(
        Object.entries(err.errors).map(([field, e]) => [field, e.message])
      );
      console.error("[end-day] VALIDATION FAILED:", details);
      return NextResponse.json(
        { error: "Validation failed", details },
        { status: 400 }
      );
    }

    // Invalid ObjectId, JSON parse errors, etc.
    if (err.name === "CastError") {
      console.error(`[end-day] CAST ERROR on field "${err.path}" with value "${err.value}":`, err.message);
      return NextResponse.json({ error: "Invalid dailyLogId" }, { status: 400 });
    }

    console.error("[end-day] UNEXPECTED ERROR:", err.name, "-", err.message);
    console.error(err.stack);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}