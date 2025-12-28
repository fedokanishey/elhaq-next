import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import Loan from "@/lib/models/Loan";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    
    // Find beneficiaries that have loanDetails
    const beneficiaries = await Beneficiary.find({ 
      loanDetails: { $exists: true, $ne: null } 
    });
    
    let cleanedCount = 0;
    const details = [];

    for (const b of beneficiaries) {
      if (!b.loanDetails?.loanId) continue;
      
      // Check if the referenced loan exists and is NOT active (deletedAt should be null)
      const loan = await Loan.findOne({ 
        _id: b.loanDetails.loanId, 
        deletedAt: null 
      });
      
      if (!loan) {
        // Loan not found or is soft-deleted -> Remove from Beneficiary
        await Beneficiary.updateOne(
          { _id: b._id }, 
          { $unset: { loanDetails: "" } }
        );
        cleanedCount++;
        details.push(`Removed loan info from beneficiary: ${b.name}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      cleanedCount, 
      details 
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
