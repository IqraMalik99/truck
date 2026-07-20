import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { connectDB } from "../../lib/db";
import { Truck, TripSheet } from "../../models/schema";

// GET /api/trucks
// Returns all trucks EXCEPT ones currently tied up on someone else's trip:
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
    }).select("truck");

    const busyTruckIds = busyTrips.map((t) => t.truck).filter(Boolean);

    const trucks = await Truck.find({ _id: { $nin: busyTruckIds } }).sort({ unitNumber: 1 });

    return NextResponse.json(trucks);
  } catch (err) {
    console.error("GET /api/trucks error:", err);
    return NextResponse.json({ error: "Failed to fetch trucks" }, { status: 500 });
  }
}
export async function POST(request) {
  await connectDB();
  const { unitNumber, currentOdometer } = await request.json();
 
  if (!unitNumber) {
    return NextResponse.json({ error: "unitNumber is required" }, { status: 400 });
  }
 
  const existing = await Truck.findOne({ unitNumber });
  if (existing) {
    return NextResponse.json({ error: `Unit ${unitNumber} already exists` }, { status: 409 });
  }
 
  const truck = await Truck.create({
    unitNumber,
    currentOdometer: currentOdometer != null ? Number(currentOdometer) : undefined,
  });
 
  return NextResponse.json(truck, { status: 201 });
}