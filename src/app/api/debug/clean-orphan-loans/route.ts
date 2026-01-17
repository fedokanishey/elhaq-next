import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Loan from "@/lib/models/Loan";
import Beneficiary from "@/lib/models/Beneficiary";

// Clean orphaned loanDetails: Remove loanDetails from beneficiaries that don't have actual loans
export async function GET() {
  try {
    await dbConnect();
    
    // Find all beneficiaries with loanDetails
    const beneficiariesWithLoans = await Beneficiary.find({
      "loanDetails": { $exists: true, $ne: null }
    }).lean();
    
    let cleaned = 0;
    const results: any[] = [];
    
    for (const beneficiary of beneficiariesWithLoans) {
      // Check if there's an actual loan for this beneficiary
      const hasLoan = await Loan.findOne({
        deletedAt: null,
        $or: [
          { nationalId: beneficiary.nationalId },
          { beneficiaryName: beneficiary.name, branch: beneficiary.branch }
        ]
      });
      
      if (!hasLoan) {
        // Remove loanDetails from this beneficiary
        await Beneficiary.findByIdAndUpdate(beneficiary._id, {
          $unset: { loanDetails: 1 }
        });
        
        cleaned++;
        results.push({
          name: beneficiary.name,
          nationalId: beneficiary.nationalId,
          oldLoanDetails: beneficiary.loanDetails,
          action: "removed"
        });
      } else {
        results.push({
          name: beneficiary.name,
          nationalId: beneficiary.nationalId,
          hasLoan: true,
          action: "kept"
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `تم تنظيف ${cleaned} مستفيد من بيانات قروض يتيمة`,
      totalChecked: beneficiariesWithLoans.length,
      cleaned,
      results,
    });
  } catch (error) {
    console.error("Error cleaning orphaned loans:", error);
    return NextResponse.json({ error: "Failed to clean orphaned loans", details: String(error) }, { status: 500 });
  }
}
