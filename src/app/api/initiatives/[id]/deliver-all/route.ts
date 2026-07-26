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

    const initiative = await Initiative.findById(id);
    if (!initiative) {
      return NextResponse.json({ error: "المبادرة غير موجودة" }, { status: 404 });
    }

    // Set beneficiariesReceived to contain all beneficiaries in the initiative
    const updatedInitiative = await Initiative.findByIdAndUpdate(
      id,
      { $set: { beneficiariesReceived: initiative.beneficiaries } },
      { new: true }
    );

    return NextResponse.json({
      success: true,
      beneficiariesReceivedCount: updatedInitiative?.beneficiariesReceived?.length || 0,
    });
  } catch (error) {
    console.error("Error delivering all benefits:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
