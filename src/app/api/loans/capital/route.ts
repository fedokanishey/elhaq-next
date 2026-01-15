import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import LoanCapital from "@/lib/models/LoanCapital";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    
    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    const capitals = await LoanCapital.find(branchFilter).sort({ date: -1 }).lean();

    return NextResponse.json({ capitals, branch: authResult.branchName });
  } catch (error) {
    console.error("Error fetching capital history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { amount, source, notes } = body;

    if (!amount || !source) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Determine target branch
    const targetBranch = authResult.isSuperAdmin ? body.branch : authResult.branch;
    const targetBranchName = authResult.isSuperAdmin ? body.branchName : authResult.branchName;

    // For SuperAdmin: require explicit branch selection
    if (authResult.isSuperAdmin && !targetBranch) {
      return NextResponse.json({ 
        error: "يجب اختيار الفرع قبل إضافة رأس المال" 
      }, { status: 400 });
    }

    const capital = await LoanCapital.create({
      amount,
      source,
      notes,
      recordedBy: userId,
      branch: targetBranch,
      branchName: targetBranchName,
    });

    return NextResponse.json(capital, { status: 201 });
  } catch (error) {
    console.error("Error adding loan capital:", error);
    return NextResponse.json(
      { error: "Failed to add capital" },
      { status: 500 }
    );
  }
}
