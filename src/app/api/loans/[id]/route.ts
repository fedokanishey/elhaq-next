import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Loan from "@/lib/models/Loan";
import { NextResponse } from "next/server";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    // Check for admin role if strictly needed.
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await dbConnect();

    const loan = await Loan.findById(id);
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Soft delete
    loan.deletedAt = new Date();
    await loan.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting loan:", error);
    return NextResponse.json(
      { error: "Failed to delete loan" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    await dbConnect();

    const loan = await Loan.findOne({ _id: id, deletedAt: null });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Update allowed fields
    if (body.beneficiaryName) loan.beneficiaryName = body.beneficiaryName;
    if (body.phone) loan.phone = body.phone;
    if (body.nationalId) loan.nationalId = body.nationalId;
    if (body.notes) loan.notes = body.notes;
    // Updating amount might be risky if repayments exist, but let's allow basic edits
    // Only allow amount edit if no repayments or handle carefully. For now, simple update.
    if (body.amount) loan.amount = body.amount; 
    
    // Recalculate status just in case amount changed
    if (loan.amountPaid >= loan.amount) {
      loan.status = "completed";
    } else {
      loan.status = "active";
    }

    await loan.save();

    return NextResponse.json(loan);
  } catch (error) {
    console.error("Error updating loan:", error);
    return NextResponse.json(
      { error: "Failed to update loan" },
      { status: 500 }
    );
  }
}
