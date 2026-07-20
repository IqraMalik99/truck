import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db";
import { TripSheet } from "../../../../models/schema";
import { getCurrentDriver } from "../../../../lib/getCurrentDriver";

function formatLocation(loc) {
  if (!loc) return "";
  if (loc.formatted) return loc.formatted;
  return [loc.city, loc.state].filter(Boolean).join(", ") || loc.country || "Unknown location";
}

export async function POST(request, { params }) {
  await connectDB();
  const driver = await getCurrentDriver();
  if (!driver) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  // odometerAtStateLine is BOTH the endOdometer of the state being left and
  // the startOdometer of the state being entered — the driver only enters it once.
  const { odometerAtStateLine, nextLocation } = await request.json();

  if (!nextLocation || (!nextLocation.city && !nextLocation.state && !nextLocation.formatted)) {
    return NextResponse.json({ error: "Select the new location" }, { status: 400 });
  }
  if (odometerAtStateLine == null || Number.isNaN(Number(odometerAtStateLine))) {
    return NextResponse.json({ error: "Odometer at the state line is required" }, { status: 400 });
  }

  const trip = await TripSheet.findById(id);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (String(trip.driver) !== String(driver._id)) {
    return NextResponse.json({ error: "This isn't your trip" }, { status: 403 });
  }
  if (trip.enddate || trip.odometerEnding) {
    return NextResponse.json({ error: "This trip is already ended" }, { status: 400 });
  }

  const crossingOdometer = Number(odometerAtStateLine);

  if (!trip.states || trip.states.length === 0) {
    // shouldn't normally happen since /api/trips seeds the first entry, but guard anyway
    trip.states = [
      {
        location: trip.startLocation,
        startOdometer: trip.odometerBeginning,
        endOdometer: null,
      },
    ];
  }

  const last = trip.states[trip.states.length - 1];
  if (crossingOdometer < last.startOdometer) {
    return NextResponse.json(
      { error: "Odometer must be greater than the current state's starting odometer" },
      { status: 400 }
    );
  }

  // close the state being left — its endOdometer is this same crossing reading
  last.endOdometer = crossingOdometer;

  // open the new state — its startOdometer is that exact same reading
  trip.states.push({
    location: { ...nextLocation, formatted: formatLocation(nextLocation) },
    startOdometer: crossingOdometer,
    endOdometer: null,
  });

  await trip.save();

  return NextResponse.json(trip);
}