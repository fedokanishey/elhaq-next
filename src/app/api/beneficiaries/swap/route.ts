import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentId, targetInternalId, targetNationalId } = await req.json();
    const targetIdInput = targetInternalId || targetNationalId;

    if (!currentId || !targetIdInput) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await dbConnect();
    
    // Get authenticated user for branch filtering
    const authResult = await getAuthenticatedUser();

    // 1. Find Current Beneficiary
    const currentBeneficiary = await Beneficiary.findById(currentId);
    if (!currentBeneficiary) {
      return NextResponse.json(
        { error: "Current beneficiary not found" },
        { status: 404 }
      );
    }

    const currentInternalId = currentBeneficiary.internalId;
    const currentBranch = currentBeneficiary.branch;

    // 2. Find Target Beneficiary - MUST be in the same branch
    const targetBeneficiary = await Beneficiary.findOne({
      internalId: targetIdInput,
      branch: currentBranch, // Same branch only
    });

    if (!targetBeneficiary) {
      return NextResponse.json(
        { error: "لم يتم العثور على مستفيد بهذا الرقم في نفس الفرع" },
        { status: 404 }
      );
    }

    if (currentBeneficiary._id.toString() === targetBeneficiary._id.toString()) {
        return NextResponse.json(
        { error: "لا يمكن التبديل مع نفس المستفيد" },
        { status: 400 }
      );
    }

    // 3. Perform Swap safely using a temp placeholder
    // We use a random temp ID to avoid collision
    const tempId = `TEMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // === SWAP BENEFICIARY INTERNAL IDs ===
    // A -> Temp
    currentBeneficiary.internalId = tempId;
    await currentBeneficiary.save();

    // B -> A
    targetBeneficiary.internalId = currentInternalId;
    await targetBeneficiary.save();

    // Temp (A) -> B
    currentBeneficiary.internalId = targetIdInput;
    await currentBeneficiary.save();

    return NextResponse.json({
      success: true,
      message: "تم التبديل بنجاح",
      newInternalId: targetIdInput,
      swappedWithName: targetBeneficiary.name
    });
  } catch (error) {
    console.error("Swap error:", error);
    return NextResponse.json(
      { error: "فشل في تبديل الأرقام" },
      { status: 500 }
    );
  }
}
