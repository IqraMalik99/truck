import mongoose, { Schema } from "mongoose";

const DriverSchema = new Schema({
    name: String,
    email: String,
    password: String,
    licenseNumber: String,
    phone: String,
    carrierName: String,
     role: { type: String, enum: ["driver", "admin"], default: "driver" }

}, { timestamps: true });


const TruckSchema = new Schema({
    unitNumber: { type: String, required: true, unique: true },
    currentOdometer: Number
}, { timestamps: true });


const TrailerSchema = new Schema({
    trailerNumber: { type: String, required: true, unique: true }, // "221"
}, { timestamps: true });



// ============================================
const LocationSchema = new Schema({
    city: String,
    state: String,      // state / province / region — omit if the country has none
    country: String,
    formatted: String
}, { _id: false });


// One entry per state/province/region the truck passes through during a trip.
// startOdometer of the first entry == the trip's odometerBeginning.
// Each subsequent entry's startOdometer == the previous entry's endOdometer.
// The last entry's endOdometer is set automatically to the trip's odometerEnding.
const TripStateSchema = new Schema({
    location: { type: LocationSchema, required: true },
    startOdometer: { type: Number, required: true },
    fuel: Number,
    endOdometer: Number   // null/undefined while the truck is still in this state
}, { _id: false });


const TripSheetSchema = new Schema({
    startdate: { type: Date, required: true },
    // captured via geolocation when the trip is started; editable by the driver
    startLocation: LocationSchema,

    driver: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    truck: { type: Schema.Types.ObjectId, ref: "Truck", required: true },
    trailer: { type: Schema.Types.ObjectId, ref: "Trailer" },

    odometerBeginning: { type: Number, required: true },
    fuel: Number,
    endLocation: LocationSchema,

    odometerEnding: Number,
    totalMiles: Number,
    enddate: Date,

    // state-by-state odometer breakdown for this trip
    states: [TripStateSchema]
}, { timestamps: true });


// ============================================
// DRIVER DAILY SCHEDULE (Daily Log — Image 2)
// One document per driver per day — can hold MULTIPLE trips
// ============================================
const DriverDailyLogSchema = new Schema({

    date: { type: Date, required: true },

    trips: [{ type: Schema.Types.ObjectId, ref: "TripSheet" }],
    driver: { type: Schema.Types.ObjectId, ref: "Driver", required: true }, // get by trip if all trip same driver
    totalMilesToday: Number, // get by trips
    totalfuel: Number,       // get by trips
    dayEnded: { type: Boolean, default: false }, 
    statusChanges: [{
        status: {
            type: String,
            enum: ["off_duty", "sleeper", "driving", "on_duty"]
        },
        from: String,   // "06:00 AM"
        to: String,     // "10:30 AM"
        purpose: String
    }],

    totalHours: {
        offDuty: Number,
        sleeperBerth: Number,
        driving: Number,
        onDuty: Number
    }, // calculate by status chages
  
}, { timestamps: true });

// DriverDailyLogSchema.index({ driver: 1, date: 1 }, { unique: true });



export let Driver = mongoose.models.Driver || mongoose.model("Driver", DriverSchema);
export let Truck = mongoose.models.Truck || mongoose.model("Truck", TruckSchema);
export let Trailer = mongoose.models.Trailer || mongoose.model("Trailer", TrailerSchema);
export let TripSheet = mongoose.models.TripSheet || mongoose.model("TripSheet", TripSheetSchema);
export let DriverDailyLog = mongoose.models.DriverDailyLog || mongoose.model("DriverDailyLog", DriverDailyLogSchema);