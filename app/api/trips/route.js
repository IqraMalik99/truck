import { NextResponse } from "next/server";
import { connectDB } from "../../lib/db";
import { TripSheet, DriverDailyLog } from "../../models/schema";
import { getCurrentDriver } from "../../lib/getCurrentDriver";

function todayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
}

// Builds a display string from whatever pieces a location has — some
// countries have city + state, some only have a city, some only a country.
function formatLocation(loc) {
    if (!loc) return "";
    if (loc.formatted) return loc.formatted;
    return [loc.city, loc.state].filter(Boolean).join(", ") || loc.country || "Unknown location";
}

export async function POST(request) {
    await connectDB();
    const driver = await getCurrentDriver();
    if (!driver) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const body = await request.json();
    const { dailyLogId, startLocation, truck, trailer, odometerBeginning } = body;

    if (!truck) {
        return NextResponse.json({ error: "Select a truck before saving the trip" }, { status: 400 });
    }
    if (odometerBeginning == null || Number.isNaN(Number(odometerBeginning))) {
        return NextResponse.json({ error: "Starting odometer is required" }, { status: 400 });
    }
    if (!startLocation || (!startLocation.city && !startLocation.state && !startLocation.formatted)) {
        return NextResponse.json({ error: "Starting location is required" }, { status: 400 });
    }

    // Prefer the dailyLogId sent from the client; fall back to looking up today's log
    let dailyLog = dailyLogId ? await DriverDailyLog.findById(dailyLogId) : null;
    if (!dailyLog) {
        const { start, end } = todayRange();
        dailyLog = await DriverDailyLog.findOne({
            driver: driver._id,
            date: { $gte: start, $lt: end },
        });
    }
    console.log(dailyLog);
    if (!dailyLog) {
        return NextResponse.json({ error: "Start your day before adding a trip" }, { status: 400 });
    }
    console.log("dayEnded value at check:", dailyLog.dayEnded, typeof dailyLog.dayEnded);
    if (dailyLog.dayEnded) {
        console.log("BLOCKING — day already ended");
        return NextResponse.json({ error: "Today's log is already closed" }, { status: 400 });
    }


    // ADD THIS BLOCK:
    const openTrip = await TripSheet.findOne({
        _id: { $in: dailyLog.trips },
        enddate: { $exists: false },
    });
    if (openTrip) {
        return NextResponse.json(
            { error: `End the trip to ${openTrip.destination || "its destination"} before starting another` },
            { status: 400 }
        );
    }

    const startOdometer = Number(odometerBeginning);
    const resolvedStart = { ...startLocation, formatted: formatLocation(startLocation) };

    const trip = await TripSheet.create({
        startdate: new Date(),
        startLocation: resolvedStart,
        driver: driver._id,
        truck: truck,
        trailer: trailer,
        odometerBeginning: startOdometer,
        // destination and fuel are unknown until the trip ends — set there instead
        // seed the state-by-state odometer breakdown with the trip's starting location
        states: [
            {
                location: resolvedStart,
                startOdometer,
                endOdometer: null,
            },
        ],
    });

    dailyLog.trips.push(trip._id);
    await dailyLog.save();

    return NextResponse.json(trip);
}