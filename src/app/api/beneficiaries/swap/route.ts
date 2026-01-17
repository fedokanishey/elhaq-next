import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import Loan from "@/lib/models/Loan";
import { getAuthenticatedUser, getBranchFilter } from "@/lib/auth-helpers";

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

    const currentNationalId = currentBeneficiary.nationalId;
    const currentBranch = currentBeneficiary.branch;

    // 2. Find Target Beneficiary - MUST be in the same branch
    const targetBeneficiary = await Beneficiary.findOne({
      nationalId: targetNationalId,
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

    // Session would be better for transactions but assuming standalone for simplicity/environment constraints
    
    // === SWAP BENEFICIARY NATIONAL IDs ===
    // A -> Temp
    currentBeneficiary.nationalId = tempId;
    await currentBeneficiary.save();

    // B -> A
    targetBeneficiary.nationalId = currentNationalId;
    await targetBeneficiary.save();

    // Temp (A) -> B
    currentBeneficiary.nationalId = targetNationalId;
    await currentBeneficiary.save();

    // === UPDATE LOANS TO MATCH NEW NATIONAL IDs ===
    // The loans should stay with their original owners
    // So we need to update the nationalId in loans to match the new nationalId of the original owner
    
    // Use temp for loans to avoid conflicts
    const loanTempId = `LOAN_TEMP_${Date.now()}`;
    
    // Current beneficiary's loans (nationalId was currentNationalId) should now have targetNationalId
    // Because currentBeneficiary now has targetNationalId
    await Loan.updateMany(
      { nationalId: currentNationalId, branch: currentBranch, deletedAt: null },
      { $set: { nationalId: loanTempId } }
    );
    
    // Target beneficiary's loans (nationalId was targetNationalId) should now have currentNationalId  
    // Because targetBeneficiary now has currentNationalId
    await Loan.updateMany(
      { nationalId: targetNationalId, branch: currentBranch, deletedAt: null },
      { $set: { nationalId: currentNationalId } }
    );
    
    // Complete the swap for current beneficiary's loans
    await Loan.updateMany(
      { nationalId: loanTempId, branch: currentBranch, deletedAt: null },
      { $set: { nationalId: targetNationalId } }
    );

    // NOTE: We do NOT swap loanDetails between beneficiaries!
    // The loanDetails should stay with the original beneficiary record
    // because it represents THEIR loan, not the loan associated with a number

    return NextResponse.json({
      success: true,
      message: "تم التبديل بنجاح (بما في ذلك القروض المرتبطة)",
      newNationalId: targetNationalId,
      swappedWithName: targetBeneficiary.name
    });
  } catch (error) {
    console.error("Swap error:", error);
    // If it fails mid-way, manual intervention might be needed, but this simple swap reduces risk slightly.
    // In a real prod env, MongoDB Transactions are a must here.
    return NextResponse.json(
      { error: "فشل في تبديل الأرقام" },
      { status: 500 }
    );
  }
}
