import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in .env.local");
}

// global cache
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
  };
}

export async function connectDB() {
  // already connected
  if (cached.conn) {
    return cached.conn;
    console.log("Using cached MongoDB connection");
  }

  // create connection promise once
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
    console.log("Creating new MongoDB connection");
  }
 console.log("Awaiting MongoDB connection...");
  cached.conn = await cached.promise;
    console.log("MongoDB connected");
  return cached.conn;
}