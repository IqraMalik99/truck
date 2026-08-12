import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { connectDB } from "../../../../../lib/db";
import { DriverDailyLog } from "../../../../../models/schema";

const STATUS_KEYS = ["off_duty", "sleeper_berth", "driving", "on_duty"];

function minutesBetween(from, to) {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let diff = th * 60 + tm - (fh * 60 + fm);
  if (diff < 0) diff += 1440;
  return diff;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export async function GET(request, { params }) {
  try {
    await connectDB();



    const { driverId } = await params;
    if (!driverId) {
      return NextResponse.json({ error: "Missing driverId" }, { status: 400 });
    }

    // ---- Add role/ownership checks here if needed, e.g.: ----
    // if (session.user.role !== "admin" && session.user.id !== driverId) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year"), 10);
    const month = parseInt(searchParams.get("month"), 10); // expected 1-12

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid or missing year/month query params" },
        { status: 400 }
      );
    }

    // Month range as [startDate, endDate) in UTC, since `date` is stored as a Date.
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    const logs = await DriverDailyLog.find({
      driver: driverId,
      date: { $gte: startDate, $lt: endDate },
    })
      .populate({
        path: "trips",
        // NOTE: TripSheet has no `destination`/`startState`/`endState` fields —
        // location is stored as `startLocation` / `endLocation` (LocationSchema
        // objects with .city/.state/.country/.formatted). Selecting the old,
        // nonexistent field names silently returned undefined, which is why
        // the monthly view always showed "Untitled destination".
        select:
          "startLocation endLocation totalMiles fuel odometerBeginning odometerEnding startdate enddate truck trailer",
        populate: [
          { path: "truck", select: "unitNumber currentOdometer" },
          { path: "trailer", select: "trailerNumber" },
        ],
      })
      .sort({ date: 1 })
      .lean();

    // ---- Build month summary server-side so the frontend doesn't have to guess ----
    let totalMiles = 0;
    let totalFuel = 0;
    const hours = { off_duty: 0, sleeper_berth: 0, driving: 0, on_duty: 0 };

    for (const log of logs) {
      for (const trip of log.trips || []) {
        totalMiles += trip.totalMiles || 0;
        totalFuel += trip.fuel || 0;
      }
      for (const s of log.statusChanges || []) {
        if (STATUS_KEYS.includes(s.status)) {
          hours[s.status] += minutesBetween(s.from, s.to);
        }
      }
    }

    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const totalDaysInMonth = daysInMonth(year, month);
    const asOfDay = isCurrentMonth ? now.getDate() : totalDaysInMonth;
    const isComplete = !isCurrentMonth || asOfDay >= totalDaysInMonth;

    const fmtHrs = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

    let summaryText;
    if (logs.length === 0) {
      summaryText = isCurrentMonth
        ? `No days logged yet this month (through day ${asOfDay} of ${totalDaysInMonth}).`
        : `No days logged for this month.`;
    } else if (isComplete) {
      summaryText = `Month complete — ${logs.length} day(s) logged, ${totalMiles.toLocaleString()} mi, ${totalFuel} gal fuel, ${fmtHrs(
        hours.driving
      )} driving.`;
    } else {
      summaryText = `Month in progress — through day ${asOfDay} of ${totalDaysInMonth}, ${logs.length} day(s) logged so far totaling ${totalMiles.toLocaleString()} mi, ${totalFuel} gal fuel, and ${fmtHrs(
        hours.driving
      )} driving. Totals will keep growing as the month continues.`;
    }

    const summary = {
      daysLogged: logs.length,
      totalMiles,
      totalFuel,
      hours: {
        offDuty: hours.off_duty,
        sleeperBerth: hours.sleeper_berth,
        driving: hours.driving,
        onDuty: hours.on_duty,
      },
      isCurrentMonth,
      isComplete,
      asOfDay,
      totalDaysInMonth,
      summaryText,
    };

    return NextResponse.json({ logs, summary });
  } catch (err) {
    console.error("GET /api/daily-log/[driverId]/month error:", err);
    return NextResponse.json(
      { error: "Failed to fetch monthly logs" },
      { status: 500 }
    );
  }
}