import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Donor from "@/lib/models/Donor";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const { id } = await params;
    if (!isValidObjectId(id)) return NextResponse.json({ error: "Invalid donor id" }, { status: 400 });

    const donor = await Donor.findById(id).lean();
    if (!donor) return NextResponse.json({ error: "Donor not found" }, { status: 404 });

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    const namePattern = (donor.name || "").trim();
    if (!namePattern) return NextResponse.json({ modified: 0 });
    const regex = new RegExp(escapeRegex(namePattern).replace(/\s+/g, "\\s+"), "i");

    const result = await TreasuryTransaction.updateMany(
      { donorId: { $exists: false }, donorNameSnapshot: { $regex: regex } },
      { $set: { donorId: donor._id } }
    );

    // Mongoose/Mongo return shapes changed across versions — guard access with safe checks
    const modified = (result as any)?.modifiedCount ?? (result as any)?.nModified ?? 0;
    return NextResponse.json({ modified });
  } catch (error) {
    console.error("Error relinking donations:", error);
    return NextResponse.json({ error: "Failed to relink donations" }, { status: 500 });
  }
}
