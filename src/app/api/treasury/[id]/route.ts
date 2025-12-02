import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import Donor from "@/lib/models/Donor";
import { isValidObjectId } from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid transaction ID" }, { status: 400 });
    }

    await dbConnect();

    // Find the transaction to get its details before deleting
    const transaction = await TreasuryTransaction.findById(id);
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // If it's an income transaction, reverse the donor's totals
    if (transaction.type === "income" && transaction.donorId) {
      await Donor.findByIdAndUpdate(transaction.donorId, {
        $inc: {
          totalDonated: -transaction.amount,
          donationsCount: -1,
        },
      });
    }

    // Delete the transaction
    await TreasuryTransaction.findByIdAndDelete(id);

    return NextResponse.json(
      { message: "Transaction deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting treasury transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
