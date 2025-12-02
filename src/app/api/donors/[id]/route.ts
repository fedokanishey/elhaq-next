import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Donor from "@/lib/models/Donor";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid donor id" }, { status: 400 });
    }

    const donor = await Donor.findById(id).lean();
    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

    // Try a flexible match: by donorId OR case-insensitive regex on donorNameSnapshot.
    // Use an escaped, space-tolerant regex to match older records where names
    // might differ by spacing or case.
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const namePattern = (donor.name || "").trim();
    const regex = namePattern
      ? new RegExp(escapeRegex(namePattern).replace(/\s+/g, "\\s+"), "i")
      : null;

    const query: any = { $or: [{ donorId: donor._id }] };
    if (regex) {
      query.$or.push({ donorNameSnapshot: { $regex: regex } });
    }

    const donations = await TreasuryTransaction.find(query)
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ donor, donations });
  } catch (error) {
    console.error("Error fetching donor details:", error);
    return NextResponse.json({ error: "Failed to fetch donor details" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid donor id" }, { status: 400 });
    }

    const donor = await Donor.findById(id);
    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    // Delete all transactions associated with this donor
    await TreasuryTransaction.deleteMany({ donorId: donor._id });

    // Delete the donor
    await Donor.findByIdAndDelete(id);

    return NextResponse.json(
      { message: "Donor deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting donor:", error);
    return NextResponse.json(
      { error: "Failed to delete donor" },
      { status: 500 }
    );
  }
}
