import { getServerSession } from "next-auth";
import {connectDB} from "./db";
import { Driver } from "../models/schema";
import { authOptions } from "../api/auth/[...nextauth]/route";


export async function getCurrentDriver() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  await connectDB();
  const driver = await Driver.findOne({ email: session.user.email });
  return driver;
}