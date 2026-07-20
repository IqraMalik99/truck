import { NextResponse } from "next/server";
import { connectDB } from "../../lib/db";
import { Driver, Truck, Trailer, TripSheet } from "../../models/schema";


const TZ = process.env.APP_TIMEZONE || "Asia/Karachi";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function monthRange(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

const ACTIVE_TRIP_FILTER = {
  $or: [{ odometerEnding: null }, { odometerEnding: { $exists: false } }],
};

export async function GET() {
  await connectDB();

  const now = new Date();
  const { start: todayStart, end: todayEnd } = todayRange();
  const { start: monthStart, end: monthEnd } = monthRange(now);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const [
    totalDrivers,
    totalTrucks,
    totalTrailers,
    activeTrips,
    todayMilesAgg,
    monthlyAgg,
  ] = await Promise.all([
    Driver.countDocuments(),
    Truck.countDocuments(),
    Trailer.countDocuments(),
    TripSheet.find(ACTIVE_TRIP_FILTER).select("truck trailer").lean(),
    TripSheet.aggregate([
      { $match: { startdate: { $gte: todayStart, $lt: todayEnd } } },
      { $group: { _id: null, miles: { $sum: { $ifNull: ["$totalMiles", 0] } } } },
    ]),
    TripSheet.aggregate([
      { $match: { startdate: { $gte: monthStart, $lt: monthEnd } } },
      {
        $group: {
          _id: { $dayOfMonth: { date: "$startdate", timezone: TZ } },
          miles: { $sum: { $ifNull: ["$totalMiles", 0] } },
        },
      },
    ]),
  ]);

  const activeTruckIds = new Set(activeTrips.map((t) => String(t.truck)).filter(Boolean));
  const activeTrailerIds = new Set(activeTrips.map((t) => String(t.trailer)).filter(Boolean));

  const idleTrucks = Math.max(0, totalTrucks - activeTruckIds.size);
  const idleTrailers = Math.max(0, totalTrailers - activeTrailerIds.size);

  const totalMilesToday = todayMilesAgg[0]?.miles || 0;

  const milesByDay = new Map(monthlyAgg.map((d) => [d._id, d.miles]));
  const monthlyMiles = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    // Build the date string directly from the local Y/M/D — no toISOString()
    // round-trip, which silently shifts the date back a day whenever the
    // server's local timezone is ahead of UTC.
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      day,
      date: dateStr,
      miles: milesByDay.get(day) || 0,
      isToday: date.toDateString() === now.toDateString(),
    };
  });

  return NextResponse.json({
    totals: {
      drivers: totalDrivers,
      trucks: totalTrucks,
      trailers: totalTrailers,
    },
    totalMilesToday,
    idleTrucks,
    idleTrailers,
    monthlyMiles,
    month: {
      label: now.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    },
    generatedAt: new Date().toISOString(),
  });
}