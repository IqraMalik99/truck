import { NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/db";
import { TripSheet, Trailer } from "../../../../../models/schema";

function tripStates(trip) {
  const set = new Set();
  (trip.states || []).forEach((s) => {
    if (s.location?.formatted) set.add(s.location.formatted);
  });
  if (trip.startLocation?.formatted) set.add(trip.startLocation.formatted);
  if (trip.endLocation?.formatted) set.add(trip.endLocation.formatted);
  return Array.from(set);
}

export async function GET(request, { params }) {
  await connectDB();
  const { trailerId } = await params;

  const trailer = await Trailer.findById(trailerId);
  if (!trailer) {
    return NextResponse.json({ error: "Trailer not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || new Date().getFullYear(), 10);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const trips = await TripSheet.find({
    trailer: trailerId,
    startdate: { $gte: yearStart, $lt: yearEnd },
  })
    .populate({ path: "driver", select: "name" })
    .populate({ path: "truck", select: "unitNumber" })
    .sort({ startdate: 1 });

  const months = Array.from({ length: 12 }, () => ({
    tripsCount: 0,
    milesTotal: 0,
    fuelTotal: 0,
    daysUsed: new Set(),
    drivers: new Set(),
    trucks: new Set(),
    states: new Set(),
    trips: [],
  }));

  trips.forEach((trip) => {
    const m = new Date(trip.startdate).getMonth();
    const bucket = months[m];
    const miles = trip.totalMiles || 0;
    const fuel = trip.fuel || 0;
    const states = tripStates(trip);

    bucket.tripsCount += 1;
    bucket.milesTotal += miles;
    bucket.fuelTotal += fuel;
    bucket.daysUsed.add(new Date(trip.startdate).toDateString());
    if (trip.driver?.name) bucket.drivers.add(trip.driver.name);
    if (trip.truck?.unitNumber) bucket.trucks.add(trip.truck.unitNumber);
    states.forEach((s) => bucket.states.add(s));

    bucket.trips.push({
      date: trip.startdate,
      driver: trip.driver?.name || "Unknown",
      truck: trip.truck?.unitNumber || "Unknown",
      route: `${trip.startLocation?.formatted || "?"} → ${trip.endLocation?.formatted || "in progress"}`,
      miles,
      fuel,
      states,
    });
  });

  const result = months.map((b, i) => ({
    month: i + 1,
    tripsCount: b.tripsCount,
    milesTotal: b.milesTotal,
    fuelTotal: b.fuelTotal,
    daysUsed: b.daysUsed.size,
    drivers: Array.from(b.drivers),
    trucks: Array.from(b.trucks),
    states: Array.from(b.states),
    trips: b.trips,
  }));

  return NextResponse.json({
    trailer: { _id: trailer._id, trailerNumber: trailer.trailerNumber },
    year,
    months: result,
  });
}