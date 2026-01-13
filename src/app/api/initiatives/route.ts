import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Initiative from "@/lib/models/Initiative";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    
    // Get branchId from query params (for SuperAdmin branch filtering)
    const { searchParams } = new URL(request.url);
    const branchIdOverride = searchParams.get("branchId");
    
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);
    
    const initiatives = await Initiative.find(branchFilter)
      .sort({ date: -1 })
      .populate("branch", "name code");
    return NextResponse.json({ 
      initiatives,
      branch: authResult.branchName,
      isSuperAdmin: authResult.isSuperAdmin,
    });
  } catch (error) {
    console.error("Error fetching initiatives:", error);
    return NextResponse.json(
      { error: "Failed to fetch initiatives" },
      { status: 500 }
    );
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

    // For SuperAdmin: use the branch from request body if provided
    // If SuperAdmin and no branch provided, copy to ALL branches
    // For other users: always use their assigned branch
    
    if (authResult.isSuperAdmin && !body.branch) {
      // SuperAdmin selected "All Branches" - copy to each branch
      const Branch = (await import("@/lib/models/Branch")).default;
      const allBranches = await Branch.find({ isActive: true }).lean();
      
      if (allBranches.length === 0) {
        return NextResponse.json({ error: "لا توجد فروع نشطة" }, { status: 400 });
      }
      
      const createdInitiatives = [];
      
      for (const branch of allBranches) {
        const initiative = new Initiative({
          ...body,
          beneficiaries: Array.isArray(body.beneficiaries) ? body.beneficiaries : [],
          images: Array.isArray(body.images) ? body.images : [],
          branch: branch._id,
          branchName: branch.name,
        });
        await initiative.save();
        createdInitiatives.push(initiative);
      }
      
      console.log(`✅ Created ${createdInitiatives.length} initiatives for all branches`);
      return NextResponse.json({ 
        message: `تم إضافة المبادرة لـ ${createdInitiatives.length} فرع`,
        count: createdInitiatives.length,
        initiative: createdInitiatives[0] 
      }, { status: 201 });
    }
    
    // Single branch
    const targetBranch = authResult.isSuperAdmin ? body.branch : authResult.branch;
    const targetBranchName = authResult.isSuperAdmin ? body.branchName : authResult.branchName;

    const initiative = new Initiative({
      ...body,
      beneficiaries: Array.isArray(body.beneficiaries)
        ? body.beneficiaries
        : [],
      images: Array.isArray(body.images) ? body.images : [],
      branch: targetBranch,
      branchName: targetBranchName,
    });
    await initiative.save();

    return NextResponse.json(initiative, { status: 201 });
  } catch (error) {
    console.error("Error creating initiative:", error);
    return NextResponse.json(
      { error: "Failed to create initiative" },
      { status: 500 }
    );
  }
}
