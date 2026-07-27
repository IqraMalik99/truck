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
  const { odometerAtStateLine, fuel, nextLocation } = await request.json();

  const trip = await TripSheet.findById(id);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (String(trip.driver) !== String(driver._id)) {
    return NextResponse.json({ error: "This isn't your trip" }, { status: 403 });
  }
  if (trip.odometerEnding != null || trip.enddate) {
    return NextResponse.json({ error: "This trip has already ended" }, { status: 400 });
  }
  if (!nextLocation || (!nextLocation.city && !nextLocation.state && !nextLocation.formatted)) {
    return NextResponse.json({ error: "Next location is required" }, { status: 400 });
  }

  const crossingOdometer = Number(odometerAtStateLine);
  if (odometerAtStateLine == null || Number.isNaN(crossingOdometer)) {
    return NextResponse.json({ error: "Odometer at state line is required" }, { status: 400 });
  }

  trip.states = trip.states || [];

  if (trip.states.length === 0) {
    // First crossing of the trip — the state the driver started in was never
    // recorded as its own entry, so back-fill it now from the trip's own data.
    if (crossingOdometer < trip.odometerBeginning) {
      return NextResponse.json(
        { error: "Odometer at state line must be greater than the trip's starting odometer" },
        { status: 400 }
      );
    }
    trip.states.push({
      location: trip.startLocation,
      startOdometer: trip.odometerBeginning,
      fuel: fuel != null && fuel !== "" ? Number(fuel) : undefined,
      endOdometer: crossingOdometer,
    });
  } else {
    const last = trip.states[trip.states.length - 1];
    if (last.endOdometer != null) {
      return NextResponse.json({ error: "Previous state entry is already closed" }, { status: 400 });
    }
    if (crossingOdometer < last.startOdometer) {
      return NextResponse.json(
        { error: "Odometer at state line must be greater than the current state's starting odometer" },
        { status: 400 }
      );
    }
    // fuel entered here was added before crossing — it belongs to the state being closed
    last.fuel = fuel != null && fuel !== "" ? Number(fuel) : undefined;
    last.endOdometer = crossingOdometer;
  }

  // open the new state — no fuel yet; that gets set on the *next* crossing, or at End Trip
  trip.states.push({
    location: { ...nextLocation, formatted: formatLocation(nextLocation) },
    startOdometer: crossingOdometer,
    fuel: undefined,
    endOdometer: undefined,
  });

  // keep the running trip total in sync with the state breakdown
  trip.fuel = trip.states.reduce((sum, s) => sum + (s.fuel || 0), 0);

  await trip.save();
  return NextResponse.json(trip);
}