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