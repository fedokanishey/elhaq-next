import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: "admin",
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "User role updated to 'admin'. Please sign out and sign in again to see changes." 
    });
  } catch (error) {
    console.error("Error updating user metadata:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
