import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import { Truck } from "../../../models/schema";

// GET /api/trucks — list trucks (newest first)
export async function GET() {
  await connectDB();
  const trucks = await Truck.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({
    trucks: trucks.map((t) => ({
      id: String(t._id),
      unitNumber: t.unitNumber,
      currentOdometer: t.currentOdometer ?? null,
      createdAt: t.createdAt,
    })),
  });
}

// POST /api/trucks
// Body: { trucks: [{ unitNumber, currentOdometer }, ...] }  — one or more.
// Also accepts a single object body (no `trucks` wrapper) for convenience.
//
// Inserts are done one-by-one (not insertMany) so that one duplicate
// unitNumber doesn't fail the whole batch — each row reports its own
// success/failure back to the caller.
export async function POST(request) {
  await connectDB();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = Array.isArray(body?.trucks) ? body.trucks : [body];

  if (rows.length === 0) {
    return NextResponse.json({ error: "No trucks provided" }, { status: 400 });
  }

  const results = [];

  for (const row of rows) {
    const unitNumber = (row?.unitNumber || "").toString().trim();
    const currentOdometer =
      row?.currentOdometer === "" || row?.currentOdometer == null
        ? undefined
        : Number(row.currentOdometer);

    if (!unitNumber) {
      results.push({ unitNumber: row?.unitNumber ?? "", success: false, error: "Unit number is required" });
      continue;
    }

    try {
      const truck = await Truck.create({ unitNumber, currentOdometer });
      results.push({ unitNumber, success: true, id: String(truck._id) });
    } catch (err) {
      const message = err?.code === 11000 ? "Unit number already exists" : err.message || "Failed to create";
      results.push({ unitNumber, success: false, error: message });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return NextResponse.json(
    {
      results,
      successCount,
      failureCount: results.length - successCount,
    },
    { status: successCount > 0 ? 201 : 400 }
  );
}