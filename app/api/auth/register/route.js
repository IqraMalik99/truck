import { connectDB } from "../../../lib/db";
import { Driver } from "../../../models/schema"
import bcrypt from "bcryptjs";

export async function POST(req) {
  await connectDB();

  const { name, email, password, phone, licenseNumber, carrierName=""} = await req.json();

  const existingDriver = await Driver.findOne({ email });
  if (existingDriver) {
    return Response.json({ message: "Driver already exists" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const driver = await Driver.create({
    name,
    email,
    password: hashedPassword,
    phone,
    licenseNumber,
    carrierName
  });

  return Response.json({ message: "Driver created", driver }, { status: 201 });
}