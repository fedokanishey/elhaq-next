import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import Donor from "@/lib/models/Donor";
import Beneficiary from "@/lib/models/Beneficiary";
import Notebook from "@/lib/models/Notebook";
import { isValidObjectId } from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function PUT(
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

    const body = await req.json();
    const {
      amount,
      type,
      description,
      category,
      reference,
      transactionDate,
      donorName,
      donorId,
      notebookName,
      notebookId,
      beneficiaryIds,
    } = body;

    if (!description?.trim() || !amount || amount <= 0 || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (type === "income" && !donorName?.trim()) {
      return NextResponse.json(
        { error: "Donor name is required for income transactions" },
        { status: 400 }
      );
    }

    // Get the old transaction
    const oldTransaction = await TreasuryTransaction.findById(id);
    if (!oldTransaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Prepare beneficiary data
    let beneficiaryNamesSnapshot: string[] = [];
    if (beneficiaryIds && beneficiaryIds.length > 0) {
      const beneficiaries = await Beneficiary.find({
        _id: { $in: beneficiaryIds },
      }).select("name");
      beneficiaryNamesSnapshot = beneficiaries.map((b) => b.name);
    }

    // If type changed or donor changed, update donor stats
    if (oldTransaction.type === "income" && oldTransaction.donorId) {
      await Donor.findByIdAndUpdate(oldTransaction.donorId, {
        $inc: {
          totalDonated: -oldTransaction.amount,
          donationsCount: -1,
        },
      });
    }

    // Reverse old notebook stats if existed
    if (oldTransaction.type === "income" && oldTransaction.notebookId) {
      await Notebook.findByIdAndUpdate(oldTransaction.notebookId, {
        $inc: {
          transactionsCount: -1,
          totalAmount: -oldTransaction.amount,
        },
      });
    }

    // Update new donor if this is income
    if (type === "income" && donorId) {
      const donor = await Donor.findByIdAndUpdate(
        donorId,
        {
          $inc: {
            totalDonated: amount,
            donationsCount: 1,
          },
        },
        { new: true }
      );

      if (!donor) {
        return NextResponse.json({ error: "Donor not found" }, { status: 404 });
      }
    }

    // Update new notebook stats if this is income
    if (type === "income" && notebookId) {
      await Notebook.findByIdAndUpdate(notebookId, {
        $inc: {
          transactionsCount: 1,
          totalAmount: amount,
        },
        $set: {
          lastUsedDate: transactionDate ? new Date(transactionDate) : new Date(),
        },
      });
    }

    // Update the transaction
    const updatedTransaction = await TreasuryTransaction.findByIdAndUpdate(
      id,
      {
        amount,
        type,
        description: description.trim(),
        category: category?.trim() || "",
        reference: reference?.trim() || "",
        transactionDate,
        donorId: type === "income" ? donorId : undefined,
        donorNameSnapshot: type === "income" ? donorName : undefined,
        notebookId: type === "income" ? notebookId : undefined,
        notebookNameSnapshot: type === "income" ? notebookName : undefined,
        beneficiaryIds: type === "expense" ? beneficiaryIds : [],
        beneficiaryNamesSnapshot:
          type === "expense" ? beneficiaryNamesSnapshot : [],
      },
      { new: true }
    );

    return NextResponse.json(
      {
        message: "Transaction updated successfully",
        transaction: updatedTransaction,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating treasury transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

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

    // If it's an income transaction, reverse the notebook's totals
    if (transaction.type === "income" && transaction.notebookId) {
      await Notebook.findByIdAndUpdate(transaction.notebookId, {
        $inc: {
          transactionsCount: -1,
          totalAmount: -transaction.amount,
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
