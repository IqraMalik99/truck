import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import { Truck, TripSheet } from "../../../models/schema";

export async function GET(request) {
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = 10;
  const skip = (page - 1) * limit;

  const [trucks, total] = await Promise.all([
    Truck.find().sort({ unitNumber: 1 }).skip(skip).limit(limit),
    Truck.countDocuments(),
  ]);

  const truckIds = trucks.map((t) => t._id);

  // "in use" = an open trip on that truck right now (no ending odometer / no enddate)
  const openTrips = await TripSheet.find({
    truck: { $in: truckIds },
    odometerEnding: { $in: [null, undefined] },
    enddate: { $in: [null, undefined] },
  }).select("truck");

  const inUseSet = new Set(openTrips.map((t) => t.truck.toString()));

  const results = trucks.map((t) => ({
    _id: t._id,
    unitNumber: t.unitNumber,
    currentOdometer: t.currentOdometer,
    status: inUseSet.has(t._id.toString()) ? "in_use" : "available",
  }));

  return NextResponse.json({
    trucks: results,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}


export async function POST(request) {
  await connectDB();
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

  const existing = await Truck.findOne({ unitNumber });
  if (existing) {
    return NextResponse.json({ error: "That unit number is already in use" }, { status: 409 });
  }

  const truck = await Truck.create({ unitNumber, ...(hasOdometer ? { currentOdometer } : {}) });
  return NextResponse.json({ truck }, { status: 201 });
}