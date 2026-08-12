import { NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/db";
import { Truck, TripSheet } from "../../../../../models/schema";

export async function PATCH(request, { params }) {
  await connectDB();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const unitNumber = typeof body.unitNumber === "string" ? body.unitNumber.trim() : "";
  const hasOdometer = body.currentOdometer !== undefined && body.currentOdometer !== "";
  const currentOdometer = hasOdometer ? Number(body.currentOdometer) : undefined;

  if (!unitNumber) {
    return NextResponse.json({ error: "Unit number is required" }, { status: 400 });
  }
  if (hasOdometer && (!Number.isFinite(currentOdometer) || currentOdometer < 0)) {
    return NextResponse.json({ error: "Odometer must be a valid, non-negative number" }, { status: 400 });
  }

  const existing = await Truck.findOne({
    unitNumber,
    _id: { $ne: id },
  });
  if (existing) {
    return NextResponse.json({ error: "That unit number is already in use" }, { status: 409 });
  }

  const update = { unitNumber };
  if (hasOdometer) update.currentOdometer = currentOdometer;

  const truck = await Truck.findByIdAndUpdate(id, update, { new: true, runValidators: true });

  if (!truck) {
    return NextResponse.json({ error: "Truck not found" }, { status: 404 });
  }

  return NextResponse.json({ truck });
}

export async function DELETE(request, { params }) {
  await connectDB();
  const { id } = await params;

  // Never delete a truck that's attached to an open trip — that would
  // orphan a live TripSheet mid-run. Same "in use" definition as the list route.
  const openTrip = await TripSheet.findOne({
    truck: id,
    odometerEnding: { $in: [null, undefined] },
    enddate: { $in: [null, undefined] },
  });

  if (openTrip) {
    return NextResponse.json(
      { error: "This truck is currently in use on an open trip and can't be deleted." },
      { status: 409 }
    );
  }

  const truck = await Truck.findByIdAndDelete(id);
  if (!truck) {
    return NextResponse.json({ error: "Truck not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}