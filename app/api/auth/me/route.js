import { NextResponse } from "next/server";
import { getCurrentDriver } from "../../../lib/getCurrentDriver";

export async function GET() {
  const driver = await getCurrentDriver();
  if (!driver) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json({ timezone: driver.timezone || "UTC" });
}