import { NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/db";
import { Trailer, TripSheet } from "../../../../../models/schema";

export async function PATCH(request, { params }) {
  await connectDB();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const trailerNumber = typeof body.trailerNumber === "string" ? body.trailerNumber.trim() : "";

  if (!trailerNumber) {
    return NextResponse.json({ error: "Trailer number is required" }, { status: 400 });
  }

  const existing = await Trailer.findOne({
    trailerNumber,
    _id: { $ne: id },
  });
  if (existing) {
    return NextResponse.json({ error: "That trailer number is already in use" }, { status: 409 });
  }

  const trailer = await Trailer.findByIdAndUpdate(
    id,
    { trailerNumber },
    { new: true, runValidators: true }
  );

  if (!trailer) {
    return NextResponse.json({ error: "Trailer not found" }, { status: 404 });
  }

  return NextResponse.json({ trailer });
}

export async function DELETE(request, { params }) {
  await connectDB();
  const { id } =  await params;

  // Never delete a trailer that's attached to an open trip — that would
  // orphan a live TripSheet mid-run. Same "in use" definition as the list route.
  const openTrip = await TripSheet.findOne({
    trailer: id,
    odometerEnding: { $in: [null, undefined] },
    enddate: { $in: [null, undefined] },
  });

  if (openTrip) {
    return NextResponse.json(
      { error: "This trailer is currently in use on an open trip and can't be deleted." },
      { status: 409 }
    );
  }

  const trailer = await Trailer.findByIdAndDelete(id);
  if (!trailer) {
    return NextResponse.json({ error: "Trailer not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}