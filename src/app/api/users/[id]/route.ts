import { auth, clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import { NextResponse } from "next/server";

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

    // Check if requester is admin
    const requester = await User.findOne({ clerkId: userId });
    if (requester?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { role } = await req.json();
    const { id: targetUserId } = await params;

    if (!["admin", "user", "beneficiary", "donor"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Find the target user first to get their clerkId
    const targetUserDoc = await User.findById(targetUserId);
    if (!targetUserDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update MongoDB
    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      { role },
      { new: true }
    );

    // Update Clerk Metadata
    if (targetUserDoc.clerkId) {
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
