import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import { DriverDailyLog, TripSheet } from "../../../models/schema";
import { getCurrentDriver } from "../../../lib/getCurrentDriver";
import { isDateEditable } from "../../../lib/editWindow";

export async function DELETE(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    console.log("[trips:DELETE] incoming request for trip id:", id);

    const driver = await getCurrentDriver();
    if (!driver) {
      console.warn("[trips:DELETE] no driver session — rejecting 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[trips:DELETE] driver:", driver._id.toString(), "timezone:", driver.timezone);

    const trip = await TripSheet.findById(id);
    if (!trip) {
      console.warn("[trips:DELETE] no trip found for id:", id);
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
    console.log("[trips:DELETE] found trip:", trip._id.toString());

    // TripSheet has no back-reference to its DriverDailyLog, so find the
    // log that has this trip id inside its `trips` array instead — also
    // confirms ownership in the same query.
    const log = await DriverDailyLog.findOne({ trips: id, driver: driver._id });
    if (!log) {
      console.warn(
        "[trips:DELETE] no log found containing this trip for this driver —",
        "tripId:", id,
        "driverId:", driver._id.toString()
      );
      return NextResponse.json({ error: "Not authorized to delete this trip" }, { status: 403 });
    }
    console.log("[trips:DELETE] log found:", log._id.toString(), "date:", log.date, "dayEnded:", log.dayEnded);

    const editable = isDateEditable(log.date, driver.timezone);
    console.log("[trips:DELETE] isDateEditable result:", editable);

    if (!editable || log.dayEnded) {
      console.warn("[trips:DELETE] rejecting — editable:", editable, "dayEnded:", log.dayEnded);
      return NextResponse.json(
        { error: "This day is locked, so this trip can't be deleted." },
        { status: 403 }
      );
    }

    await TripSheet.findByIdAndDelete(id);
    const pullResult = await DriverDailyLog.updateOne({ _id: log._id }, { $pull: { trips: id } });
    console.log(
      "[trips:DELETE] deleted trip and pulled from log.trips — matched:",
      pullResult.matchedCount, "modified:", pullResult.modifiedCount
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[trips:DELETE] unhandled error:", err);
    return NextResponse.json({ error: "Something went wrong deleting the trip." }, { status: 500 });
  }
}