import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { connectDB } from "../../lib/db";
import { Trailer, TripSheet } from "../../models/schema";

// GET /api/trailers
// Returns all trailers EXCEPT ones currently tied up on someone else's trip:
//   - trip.startdate falls on today
//   - trip.driver !== me
//   - trip.enddate is not set yet (still in progress)
export async function GET() {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

    const busyTrips = await TripSheet.find({
      startdate: { $gte: startOfToday, $lt: startOfTomorrow },
      driver: { $ne: session.user.id },
      enddate: null,
      trailer: { $ne: null }, // trailer is optional on a trip — only count ones actually assigned
    }).select("trailer");

    const busyTrailerIds = busyTrips.map((t) => t.trailer).filter(Boolean);

    const trailers = await Trailer.find({ _id: { $nin: busyTrailerIds } }).sort({ trailerNumber: 1 });

    return NextResponse.json(trailers);
  } catch (err) {
    console.error("GET /api/trailers error:", err);
    return NextResponse.json({ error: "Failed to fetch trailers" }, { status: 500 });
  }
}
 
export async function POST(request) {
  await connectDB();
  const { trailerNumber } = await request.json();
 
  if (!trailerNumber) {
    return NextResponse.json({ error: "trailerNumber is required" }, { status: 400 });
  }
 
  const existing = await Trailer.findOne({ trailerNumber });
  if (existing) {
    return NextResponse.json({ error: `Trailer ${trailerNumber} already exists` }, { status: 409 });
  }
 
  const trailer = await Trailer.create({ trailerNumber });
 
  return NextResponse.json(trailer, { status: 201 });
}
 