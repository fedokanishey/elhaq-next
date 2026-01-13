import { auth, clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import Branch from "@/lib/models/Branch";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, canManageUser, getAvailableRoles } from "@/lib/auth-helpers";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const authResult = await getAuthenticatedUser();
    
    // Check if requester has permission to manage users
    if (!authResult.isSuperAdmin && !authResult.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { role, branch: branchId } = await req.json();
    const { id: targetUserId } = await params;

    // Find the target user first
    const targetUserDoc = await User.findById(targetUserId);
    if (!targetUserDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check permissions to manage this user
    if (!canManageUser(authResult, targetUserDoc.role, targetUserDoc.branch)) {
      return NextResponse.json({ 
        error: "ليس لديك صلاحية لتعديل هذا المستخدم" 
      }, { status: 403 });
    }

    // Validate role
    const availableRoles = getAvailableRoles(authResult);
    if (role && !availableRoles.includes(role)) {
      return NextResponse.json({ 
        error: `لا يمكنك تعيين هذا الدور. الأدوار المتاحة: ${availableRoles.join(', ')}` 
      }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    
    if (role) {
      updateData.role = role;
    }

    // Handle branch assignment (SuperAdmin only can change branches)
    if (branchId !== undefined) {
      if (!authResult.isSuperAdmin) {
        return NextResponse.json({ 
          error: "فقط السوبر ادمن يمكنه تغيير الفرع" 
        }, { status: 403 });
      }
      
      if (branchId) {
        const branch = await Branch.findById(branchId);
        if (!branch) {
          return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }
        updateData.branch = branch._id;
        updateData.branchName = branch.name;
      } else {
        // Remove branch (for superadmin users)
        updateData.$unset = { branch: 1, branchName: 1 };
      }
    }

    // Update MongoDB
    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      updateData,
      { new: true }
    ).populate('branch');

    // Update Clerk Metadata if role changed
    if (role && targetUserDoc.clerkId) {
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(targetUserDoc.clerkId, {
          publicMetadata: {
            role: role,
          },
        });
      } catch (clerkError) {
        console.error("Error updating Clerk metadata:", clerkError);
        // Continue even if Clerk update fails, but log it
      }
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
