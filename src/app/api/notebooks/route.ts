import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Notebook from "@/lib/models/Notebook";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  try {
    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    
    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);
    
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 200;

    const notebooks = await Notebook.find(branchFilter)
      .sort({ lastUsedDate: -1, name: 1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ notebooks, branch: authResult.branchName });
  } catch (error) {
    console.error("Error fetching notebooks:", error);
    return NextResponse.json({ error: "Failed to fetch notebooks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const body = await req.json();
    const { name, notes, branch: overrideBranch, branchName: overrideBranchName } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "اسم الدفتر مطلوب" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const normalizedName = trimmedName.toLowerCase();

    // Determine target branch
    const targetBranch = authResult.isSuperAdmin && overrideBranch ? overrideBranch : authResult.branch;
    const targetBranchName = authResult.isSuperAdmin && overrideBranchName ? overrideBranchName : authResult.branchName;

    // Check if notebook already exists in this branch
    const existingNotebook = await Notebook.findOne({ 
      nameNormalized: normalizedName,
      branch: targetBranch 
    });

    if (existingNotebook) {
      return NextResponse.json({ error: "هذا الدفتر موجود بالفعل" }, { status: 400 });
    }

    const notebook = await Notebook.create({
      name: trimmedName,
      nameNormalized: normalizedName,
      notes: notes?.trim() || undefined,
      branch: targetBranch,
      branchName: targetBranchName,
    });

    return NextResponse.json(notebook, { status: 201 });
  } catch (error) {
    console.error("Error creating notebook:", error);
    return NextResponse.json({ error: "فشل إنشاء الدفتر" }, { status: 500 });
  }
}

// Update notebook (for editing name, notes)
export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const body = await req.json();
    const { _id, name, notes } = body;

    if (!_id) {
      return NextResponse.json({ error: "معرف الدفتر مطلوب" }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "اسم الدفتر مطلوب" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const normalizedName = trimmedName.toLowerCase();

    // Check if another notebook with the same name exists
    const existingNotebook = await Notebook.findOne({ 
      nameNormalized: normalizedName,
      _id: { $ne: _id },
      branch: authResult.branch 
    });

    if (existingNotebook) {
      return NextResponse.json({ error: "هذا الاسم مستخدم لدفتر آخر" }, { status: 400 });
    }

    const notebook = await Notebook.findByIdAndUpdate(
      _id,
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
      { notebookId: _id },
      { notebookNameSnapshot: trimmedName }
    );

    return NextResponse.json(notebook);
  } catch (error) {
    console.error("Error updating notebook:", error);
    return NextResponse.json({ error: "فشل تحديث الدفتر" }, { status: 500 });
  }
}
