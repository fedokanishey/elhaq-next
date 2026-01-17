import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Loan from "@/lib/models/Loan";
import Beneficiary from "@/lib/models/Beneficiary";

// Fix loan status: Update beneficiaries with completed loans to show correct status
export async function GET() {
  try {
    await dbConnect();
    
    // Find all loans
    const loans = await Loan.find({ deletedAt: null }).lean();
    
    let updated = 0;
    const results: any[] = [];
    
    for (const loan of loans) {
      const remainingAmount = Math.max(0, loan.amount - (loan.amountPaid || 0));
      const isCompleted = loan.amountPaid >= loan.amount;
      const newStatus = isCompleted ? "completed" : loan.status;
      
      // Try to find beneficiary by nationalId first, then by name
      let beneficiary = null;
      
      if (loan.nationalId) {
        beneficiary = await Beneficiary.findOne({ 
          nationalId: loan.nationalId, 
          branch: loan.branch 
        });
      }
      
      // If not found by nationalId, try by name and branch
      if (!beneficiary && loan.beneficiaryName) {
        beneficiary = await Beneficiary.findOne({ 
          name: loan.beneficiaryName, 
          branch: loan.branch 
        });
      }
      
      if (beneficiary) {
        await Beneficiary.findByIdAndUpdate(beneficiary._id, {
          $set: {
            "loanDetails.loanId": loan._id,
            "loanDetails.amount": loan.amount,
            "loanDetails.remainingAmount": remainingAmount,
            "loanDetails.startDate": loan.startDate,
            "loanDetails.status": newStatus,
          }
        });
        
        updated++;
        results.push({
          name: beneficiary.name,
          beneficiaryNationalId: beneficiary.nationalId,
          loanNationalId: loan.nationalId,
          loanAmount: loan.amount,
          amountPaid: loan.amountPaid || 0,
          remainingAmount,
          status: newStatus,
        });
      } else {
        results.push({
          loanBeneficiaryName: loan.beneficiaryName,
          loanNationalId: loan.nationalId,
          error: "Beneficiary not found",
          loanAmount: loan.amount,
          amountPaid: loan.amountPaid || 0,
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `تم تحديث ${updated} مستفيد`,
      totalLoans: loans.length,
      updated,
      results,
    });
  } catch (error) {
    console.error("Error fixing loan status:", error);
    return NextResponse.json({ error: "Failed to fix loan status", details: String(error) }, { status: 500 });
  }
}
