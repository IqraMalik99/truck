import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db";
import { TripSheet, Truck } from "../../../../models/schema";
import { getCurrentDriver } from "../../../../lib/getCurrentDriver";

function formatLocation(loc) {
  if (!loc) return "";
  if (loc.formatted) return loc.formatted;
  return [loc.city, loc.state].filter(Boolean).join(", ") || loc.country || "Unknown location";
}

export async function PATCH(request, { params }) {
  await connectDB();
  const driver = await getCurrentDriver();
  if (!driver) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const { odometerEnding, endLocation,fuel } = await request.json();

  const trip = await TripSheet.findById(id);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (String(trip.driver) !== String(driver._id)) {
    return NextResponse.json({ error: "This isn't your trip" }, { status: 403 });
  }
  if (odometerEnding == null || Number(odometerEnding) < trip.odometerBeginning) {
    return NextResponse.json(
      { error: "Ending odometer must be greater than the starting odometer" },
      { status: 400 }
    );
  }
  if (!endLocation || (!endLocation.city && !endLocation.state && !endLocation.formatted)) {
    return NextResponse.json({ error: "Ending location is required" }, { status: 400 });
  }

const endOdometer = Number(odometerEnding);

  if (trip.states && trip.states.length > 0) {
    const last = trip.states[trip.states.length - 1];
    if (endOdometer < last.startOdometer) {
      return NextResponse.json(
        { error: "Ending odometer must be greater than the current state's starting odometer" },
        { status: 400 }
      );
    }
    last.endOdometer = endOdometer;
    // fuel entered on End Trip covers the final state the truck was sitting in
    last.fuel = fuel != null && fuel !== "" ? Number(fuel) : last.fuel;
  }

  trip.odometerEnding = endOdometer;
  trip.endLocation = { ...endLocation, formatted: formatLocation(endLocation) };
  trip.enddate = new Date();
  trip.totalMiles = trip.odometerEnding - trip.odometerBeginning;

  // trip.fuel is always the sum of every state's fuel. If the trip never
  // crossed a state line, there's no states[] to sum, so the End Trip fuel
  // field is the whole story.
  if (trip.states && trip.states.length > 0) {
    trip.fuel = trip.states.reduce((sum, s) => sum + (s.fuel || 0), 0);
  } else {
    trip.fuel = fuel != null && fuel !== "" ? Number(fuel) : undefined;
  }

  await trip.save();

  // keep the truck's current odometer in sync
  await Truck.findByIdAndUpdate(trip.truck, { currentOdometer: trip.odometerEnding });

  return NextResponse.json(trip);
}