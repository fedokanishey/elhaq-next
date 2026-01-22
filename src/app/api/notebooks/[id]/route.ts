import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Notebook from "@/lib/models/Notebook";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Get single notebook with transaction count
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
    }

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const notebook = await Notebook.findById(id).lean();
    
    if (!notebook) {
      return NextResponse.json({ error: "الدفتر غير موجود" }, { status: 404 });
    }

    // Get associated transactions
    const transactions = await TreasuryTransaction.find({ notebookId: id })
      .sort({ transactionDate: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({ notebook, transactions });
  } catch (error) {
    console.error("Error fetching notebook:", error);
    return NextResponse.json({ error: "Failed to fetch notebook" }, { status: 500 });
  }
}

// Delete notebook
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
      return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
    }

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const notebook = await Notebook.findById(id);
    
    if (!notebook) {
      return NextResponse.json({ error: "الدفتر غير موجود" }, { status: 404 });
    }

    // Check if there are transactions associated with this notebook
    const transactionCount = await TreasuryTransaction.countDocuments({ notebookId: id });
    
    if (transactionCount > 0) {
      // Option 1: Prevent deletion if transactions exist
      // return NextResponse.json({ 
      //   error: `لا يمكن حذف الدفتر لأنه مرتبط بـ ${transactionCount} عملية` 
      // }, { status: 400 });
      
      // Option 2: Remove notebook reference from transactions but keep transactions
      await TreasuryTransaction.updateMany(
        { notebookId: id },
        { $unset: { notebookId: 1, notebookNameSnapshot: 1 } }
      );
    }

    await Notebook.findByIdAndDelete(id);

    return NextResponse.json({ 
      success: true, 
      message: "تم حذف الدفتر بنجاح",
      transactionsUnlinked: transactionCount 
    });
  } catch (error) {
    console.error("Error deleting notebook:", error);
    return NextResponse.json({ error: "فشل حذف الدفتر" }, { status: 500 });
  }
}

// Update notebook
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
      return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
    }

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, notes } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "اسم الدفتر مطلوب" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const normalizedName = trimmedName.toLowerCase();

    // Check if another notebook with the same name exists in the same branch
    const existingNotebook = await Notebook.findOne({ 
      nameNormalized: normalizedName,
      _id: { $ne: id },
      branch: authResult.branch 
    });

    if (existingNotebook) {
      return NextResponse.json({ error: "هذا الاسم مستخدم لدفتر آخر" }, { status: 400 });
    }

    const notebook = await Notebook.findByIdAndUpdate(
      id,
      {
        name: trimmedName,
        nameNormalized: normalizedName,
        notes: notes?.trim() || undefined,
      },
      { new: true }
    );

    if (!notebook) {
      return NextResponse.json({ error: "الدفتر غير موجود" }, { status: 404 });
    }

    // Update snapshot in all transactions that use this notebook
    await TreasuryTransaction.updateMany(
      { notebookId: id },
      { notebookNameSnapshot: trimmedName }
    );

    return NextResponse.json(notebook);
  } catch (error) {
    console.error("Error updating notebook:", error);
    return NextResponse.json({ error: "فشل تحديث الدفتر" }, { status: 500 });
  }
}
