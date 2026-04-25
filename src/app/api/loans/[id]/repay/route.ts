import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Loan from "@/lib/models/Loan";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { createActivityNotification } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { amount, date, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    await dbConnect();
    const authResult = await getAuthenticatedUser();

    const loan = await Loan.findOne({ _id: id, deletedAt: null });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Add repayment
    loan.repayments.push({
      amount,
      date: date || new Date(),
      notes,
      recordedBy: userId,
    });

    // Update total amountPaid
    loan.amountPaid = (loan.amountPaid || 0) + Number(amount);
    
    // Calculate remaining amount
    const remainingAmount = Math.max(0, loan.amount - loan.amountPaid);

    // Update beneficiary's loanDetails with remaining amount
    if (loan.nationalId) {
      const updateData: Record<string, any> = {
        "loanDetails.remainingAmount": remainingAmount,
      };
      
      // Update status if fully paid
      if (loan.amountPaid >= loan.amount) {
        loan.status = "completed";
        updateData["loanDetails.status"] = "completed";
      }
      
      await Beneficiary.findOneAndUpdate(
        { nationalId: loan.nationalId, branch: loan.branch },
        { $set: updateData }
      );
    } else if (loan.amountPaid >= loan.amount) {
      // No nationalId but still mark loan as completed
      loan.status = "completed";
    }

    await loan.save();

    await createActivityNotification({
      authResult,
      actionType: "loan_repayment_created",
      message: `تم تسجيل سداد قرض بقيمة ${Number(amount).toLocaleString("ar-EG")} ج.م للمستفيد ${loan.beneficiaryName}`,
      entityId: loan._id.toString(),
      metadata: {
        beneficiaryName: loan.beneficiaryName,
        amount,
        remainingAmount,
      },
      branch: loan.branch,
      branchName: loan.branchName || null,
    });

    return NextResponse.json(loan);
  } catch (error) {
    console.error("Error processing repayment:", error);
    return NextResponse.json(
      { error: "Failed to process repayment" },
      { status: 500 }
    );
  }
}
