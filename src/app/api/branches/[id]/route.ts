import dbConnect from "@/lib/mongodb";
import Branch from "@/lib/models/Branch";
import User from "@/lib/models/User";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

// GET: Get branch details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;

    const branch = await Branch.findById(id);
    
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // Non-superadmin can only see their own branch
    if (!authResult.isSuperAdmin && 
        authResult.branch?.toString() !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get user count for this branch
    const userCount = await User.countDocuments({ branch: id });

    return NextResponse.json({ 
      branch,
      userCount 
    });
  } catch (error) {
    console.error("Error fetching branch:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT: Update branch (SuperAdmin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!authResult.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden - SuperAdmin only" }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const { name, code, address, phone, isActive } = await req.json();

    // Check if another branch with same name/code exists
    const existingBranch = await Branch.findOne({
      _id: { $ne: id },
      $or: [
        { code: code?.toUpperCase() },
        { name }
      ]
    });

    if (existingBranch) {
      return NextResponse.json({ 
        error: "فرع آخر بنفس الاسم أو الكود موجود بالفعل" 
      }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (code) updateData.code = code.toUpperCase();
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    const branch = await Branch.findByIdAndUpdate(id, updateData, { new: true });

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // Update branchName in all related users if name changed
    if (name) {
      await User.updateMany(
        { branch: id },
        { branchName: name }
      );
    }

    return NextResponse.json({ branch });
  } catch (error) {
    console.error("Error updating branch:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: Delete branch (SuperAdmin only, only if empty)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!authResult.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden - SuperAdmin only" }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;

    // Check if branch has any users
    const userCount = await User.countDocuments({ branch: id });
    
    if (userCount > 0) {
      return NextResponse.json({ 
        error: `لا يمكن حذف الفرع - يوجد ${userCount} مستخدم تابع لهذا الفرع` 
      }, { status: 400 });
    }

    const branch = await Branch.findByIdAndDelete(id);

    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      message: "تم حذف الفرع بنجاح" 
    });
  } catch (error) {
    console.error("Error deleting branch:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
