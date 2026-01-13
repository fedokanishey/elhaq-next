import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";

// Set a specific user as superadmin by email
export async function GET() {
  const targetEmail = "kanishey@gmail.com";
  
  try {
    const client = await clerkClient();
    
    // Find user in Clerk by email
    const clerkUsers = await client.users.getUserList({
      emailAddress: [targetEmail],
    });
    
    if (clerkUsers.data.length === 0) {
      return NextResponse.json({ 
        error: `User with email ${targetEmail} not found in Clerk` 
      }, { status: 404 });
    }
    
    const clerkUser = clerkUsers.data[0];
    
    // Update Clerk metadata
    await client.users.updateUserMetadata(clerkUser.id, {
      publicMetadata: {
        role: "superadmin",
      },
    });
    
    // Also update MongoDB
    await dbConnect();
    await User.findOneAndUpdate(
      { email: targetEmail },
      { 
        role: "superadmin",
        clerkId: clerkUser.id,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ 
      success: true, 
      message: `User ${targetEmail} is now a superadmin! Please sign out and sign in again.`,
      clerkId: clerkUser.id,
    });
  } catch (error) {
    console.error("Error setting superadmin:", error);
    return NextResponse.json({ error: "Failed to set superadmin", details: String(error) }, { status: 500 });
  }
}
