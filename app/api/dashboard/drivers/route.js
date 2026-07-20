import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import { Driver } from "../../../models/schema";



const LIST_FIELDS = "name phone licenseNumber carrierName email createdAt";

export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10));
  const search = (searchParams.get("search") || "").trim();

  const filter = search
    ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { carrierName: { $regex: search, $options: "i" } },
          { licenseNumber: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  const skip = (page - 1) * limit;

  const [drivers, total] = await Promise.all([
    Driver.find(filter)
      .select(LIST_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Driver.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({
    drivers: drivers.map((d) => ({
      id: String(d._id),
      name: d.name || "—",
      phone: d.phone || "—",
      licenseNumber: d.licenseNumber || "—",
      carrierName: d.carrierName || "—",
      email: d.email || "—",
      createdAt: d.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}