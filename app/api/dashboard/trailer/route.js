import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import { Trailer, TripSheet } from "../../../models/schema";

export async function GET(request) {
  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = 10;
  const skip = (page - 1) * limit;

  const [trailers, total] = await Promise.all([
    Trailer.find().sort({ trailerNumber: 1 }).skip(skip).limit(limit),
    Trailer.countDocuments(),
  ]);

  const trailerIds = trailers.map((t) => t._id);

  // "in use" = an open trip on that trailer right now (no ending odometer / no enddate)
  const openTrips = await TripSheet.find({
    trailer: { $in: trailerIds },
    odometerEnding: { $in: [null, undefined] },
    enddate: { $in: [null, undefined] },
  }).select("trailer");

  const inUseSet = new Set(openTrips.map((t) => t.trailer?.toString()).filter(Boolean));

  const results = trailers.map((t) => ({
    _id: t._id,
    trailerNumber: t.trailerNumber,
    status: inUseSet.has(t._id.toString()) ? "in_use" : "available",
  }));

  return NextResponse.json({
    trailers: results,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}