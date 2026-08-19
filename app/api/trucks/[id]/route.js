import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "../../auth/[...nextauth]/route";
import { connectDB } from "../../../lib/db";
import { Truck } from "../../../models/schema";

// GET /api/trucks/:id
// Returns a single truck, primarily so the New Trip form can auto-fetch its
// currentOdometer the instant a truck is selected (see TripForm.handleTruckChange).
export async function GET(request, { params }) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } =  await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid truck id" }, { status: 400 });
    }

    const truck = await Truck.findById(id);
    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    return NextResponse.json({ truck });
  } catch (err) {
    console.error("GET /api/trucks/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch truck" }, { status: 500 });
  }
}

// PATCH /api/trucks/:id
// Lets you update a truck's stored odometer directly (e.g. after a trip ends,
// or a manual correction) — optional, but handy to have alongside GET.
export async function PATCH(request, { params }) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid truck id" }, { status: 400 });
    }

    const { currentOdometer, unitNumber } = await request.json();
    const update = {};
    if (currentOdometer != null) update.currentOdometer = Number(currentOdometer);
    if (unitNumber) update.unitNumber = unitNumber;

    const truck = await Truck.findByIdAndUpdate(id, update, { new: true });
    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    return NextResponse.json({ truck });
  } catch (err) {
    console.error("PATCH /api/trucks/[id] error:", err);
    return NextResponse.json({ error: "Failed to update truck" }, { status: 500 });
  }
}