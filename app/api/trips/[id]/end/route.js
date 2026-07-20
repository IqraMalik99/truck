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
  }

  trip.odometerEnding = endOdometer;
  trip.endLocation = { ...endLocation, formatted: formatLocation(endLocation) };
  trip.fuel = fuel != null && fuel !== "" ? Number(fuel) : undefined;
  trip.enddate = new Date();
  trip.totalMiles = trip.odometerEnding - trip.odometerBeginning;
  await trip.save();

  // keep the truck's current odometer in sync
  await Truck.findByIdAndUpdate(trip.truck, { currentOdometer: trip.odometerEnding });

  return NextResponse.json(trip);
}