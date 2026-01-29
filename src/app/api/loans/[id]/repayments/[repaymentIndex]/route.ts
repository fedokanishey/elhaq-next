import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Loan from "@/lib/models/Loan";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// Delete a repayment
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string; repaymentIndex: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, repaymentIndex } = await context.params;
    const index = parseInt(repaymentIndex, 10);

    // Get the loan
    const loan = await Loan.findById(id);
    if (!loan) {
      return NextResponse.json({ error: "القرض غير موجود" }, { status: 404 });
    }

    // Validate index
    if (index < 0 || index >= loan.repayments.length) {
      return NextResponse.json({ error: "العملية غير موجودة" }, { status: 404 });
    }

    // Get the repayment to be deleted
    const repayment = loan.repayments[index];
    const repaymentAmount = repayment.amount;

    // Remove the repayment from array
    loan.repayments.splice(index, 1);
    
    // Update amountPaid
    loan.amountPaid = Math.max(0, (loan.amountPaid || 0) - repaymentAmount);

    // Update status if needed
    if (loan.amountPaid < loan.amount && loan.status === 'completed') {
      loan.status = 'active';
    }

    await loan.save();

    return NextResponse.json({ 
      success: true, 
      loan: loan.toObject() 
    });
  } catch (error) {
    console.error("Error deleting repayment:", error);
    return NextResponse.json(
      { error: "Failed to delete repayment" },
      { status: 500 }
    );
  }
}

// Update a repayment
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string; repaymentIndex: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, repaymentIndex } = await context.params;
    const index = parseInt(repaymentIndex, 10);
    const body = await req.json();
    const { amount, date, notes } = body;

    // Get the loan
    const loan = await Loan.findById(id);
    if (!loan) {
      return NextResponse.json({ error: "القرض غير موجود" }, { status: 404 });
    }

    // Validate index
    if (index < 0 || index >= loan.repayments.length) {
      return NextResponse.json({ error: "العملية غير موجودة" }, { status: 404 });
    }

    // Get old repayment amount
    const oldAmount = loan.repayments[index].amount;
    const newAmount = amount !== undefined ? Number(amount) : oldAmount;
    const amountDiff = newAmount - oldAmount;

    // Check if new total would exceed loan amount
    const newTotalPaid = (loan.amountPaid || 0) + amountDiff;
    if (newTotalPaid > loan.amount) {
      return NextResponse.json(
        { error: `المبلغ الجديد سيتجاوز مبلغ القرض (${loan.amount} ج.م)` },
        { status: 400 }
      );
    }

    // Update the repayment
    if (amount !== undefined) loan.repayments[index].amount = newAmount;
    if (date) loan.repayments[index].date = new Date(date);
    if (notes !== undefined) loan.repayments[index].notes = notes;

    // Update amountPaid
    loan.amountPaid = newTotalPaid;

    // Update status
    if (loan.amountPaid >= loan.amount) {
      loan.status = 'completed';
    } else if (loan.status === 'completed') {
      loan.status = 'active';
    }

    await loan.save();

    return NextResponse.json({ 
      success: true, 
      loan: loan.toObject() 
    });
  } catch (error) {
    console.error("Error updating repayment:", error);
    return NextResponse.json(
      { error: "Failed to update repayment" },
      { status: 500 }
    );
  }
}
