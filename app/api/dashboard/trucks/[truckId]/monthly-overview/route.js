import { NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/db";
import { TripSheet, Truck } from "../../../../../models/schema";

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
  const { truckId } = await params;
  console.log("enter");

  const truck = await Truck.findById(truckId);
  if (!truck) {
    return NextResponse.json({ error: "Truck not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || new Date().getFullYear(), 10);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const trips = await TripSheet.find({
    truck: truckId,
    startdate: { $gte: yearStart, $lt: yearEnd },
  })
    .populate({ path: "driver", select: "name" })
    .sort({ startdate: 1 });

  const months = Array.from({ length: 12 }, () => ({
    tripsCount: 0,
    milesTotal: 0,
    fuelTotal: 0,
    daysUsed: new Set(),
    drivers: new Set(),
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
    states.forEach((s) => bucket.states.add(s));

    bucket.trips.push({
      date: trip.startdate,
      driver: trip.driver?.name || "Unknown",
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
    states: Array.from(b.states),
    trips: b.trips,
  }));

  return NextResponse.json({
    truck: { _id: truck._id, unitNumber: truck.unitNumber },
    year,
    months: result,
  });
}