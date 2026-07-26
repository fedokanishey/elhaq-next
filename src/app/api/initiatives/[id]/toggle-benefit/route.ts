import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Initiative from "@/lib/models/Initiative";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

export async function POST(
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
      return NextResponse.json({ error: "Invalid initiative id" }, { status: 400 });
    }

    const { beneficiaryId, received } = await req.json();

    if (!isValidObjectId(beneficiaryId)) {
      return NextResponse.json({ error: "Invalid beneficiary id" }, { status: 400 });
    }

    const initiative = await Initiative.findById(id);
    if (!initiative) {
      return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
    }

    // Update beneficiariesReceived list
    const updateQuery = received
      ? { $addToSet: { beneficiariesReceived: beneficiaryId } }
      : { $pull: { beneficiariesReceived: beneficiaryId } };

    const updatedInitiative = await Initiative.findByIdAndUpdate(
      id,
      updateQuery,
      { new: true }
    );

    return NextResponse.json({
      success: true,
      received,
      beneficiariesReceivedCount: updatedInitiative?.beneficiariesReceived?.length || 0,
    });
  } catch (error) {
    console.error("Error toggling beneficiary benefit status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
