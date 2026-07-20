import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import { Trailer } from "../../../models/schema";

// GET /api/trailers — list trailers (newest first)
export async function GET() {
  await connectDB();
  const trailers = await Trailer.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({
    trailers: trailers.map((t) => ({
      id: String(t._id),
      trailerNumber: t.trailerNumber,
      createdAt: t.createdAt,
    })),
  });
}

// POST /api/trailers
// Body: { trailers: [{ trailerNumber }, ...] }  — one or more.
// Also accepts a single object body (no `trailers` wrapper) for convenience.
//
// Inserted one-by-one (not insertMany) so a single duplicate trailerNumber
// doesn't fail the whole batch — each row reports its own result back.
export async function POST(request) {
  await connectDB();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = Array.isArray(body?.trailers) ? body.trailers : [body];

  if (rows.length === 0) {
    return NextResponse.json({ error: "No trailers provided" }, { status: 400 });
  }

  const results = [];

  for (const row of rows) {
    const trailerNumber = (row?.trailerNumber || "").toString().trim();

    if (!trailerNumber) {
      results.push({ trailerNumber: row?.trailerNumber ?? "", success: false, error: "Trailer number is required" });
      continue;
    }

    try {
      const trailer = await Trailer.create({ trailerNumber });
      results.push({ trailerNumber, success: true, id: String(trailer._id) });
    } catch (err) {
      const message = err?.code === 11000 ? "Trailer number already exists" : err.message || "Failed to create";
      results.push({ trailerNumber, success: false, error: message });
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