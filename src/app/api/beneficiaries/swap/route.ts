import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentId, targetNationalId } = await req.json();

    if (!currentId || !targetNationalId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await dbConnect();

    // 1. Find Current Beneficiary
    const currentBeneficiary = await Beneficiary.findById(currentId);
    if (!currentBeneficiary) {
      return NextResponse.json(
        { error: "Current beneficiary not found" },
        { status: 404 }
      );
    }

    const currentNationalId = currentBeneficiary.nationalId;

    // 2. Find Target Beneficiary
    const targetBeneficiary = await Beneficiary.findOne({
      nationalId: targetNationalId,
    });

    if (!targetBeneficiary) {
      return NextResponse.json(
        { error: "Target beneficiary with this ID not found" },
        { status: 404 }
      );
    }

    if (currentBeneficiary._id.toString() === targetBeneficiary._id.toString()) {
       return NextResponse.json(
        { error: "Cannot swap with self" },
        { status: 400 }
      );
    }

    // 3. Perform Swap safely using a temp placeholder
    // We use a random temp ID to avoid collision
    const tempId = `TEMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Session would be better for transactions but assuming standalone for simplicity/environment constraints
    // A -> Temp
    currentBeneficiary.nationalId = tempId;
    await currentBeneficiary.save();

    // B -> A
    targetBeneficiary.nationalId = currentNationalId;
    await targetBeneficiary.save();

    // Temp (A) -> B
    currentBeneficiary.nationalId = targetNationalId;
    await currentBeneficiary.save();

    return NextResponse.json({
      success: true,
      message: "Swapped successfully",
      newNationalId: targetNationalId,
      swappedWithName: targetBeneficiary.name
    });
  } catch (error) {
    console.error("Swap error:", error);
    // If it fails mid-way, manual intervention might be needed, but this simple swap reduces risk slightly.
    // In a real prod env, MongoDB Transactions are a must here.
    return NextResponse.json(
      { error: "Failed to swap IDs" },
      { status: 500 }
    );
  }
}
