import { auth, currentUser } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Sync user to MongoDB if not exists
    let clerkUser = null;
    const existingUser = await User.findOne({ clerkId: userId });
    
    if (!existingUser) {
      clerkUser = await currentUser();
      if (clerkUser) {
        await User.create({
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          profileImageUrl: clerkUser.imageUrl,
          role: sessionClaims?.metadata?.role || clerkUser.publicMetadata?.role || 'user',
        });
      }
    }

    // Check if admin
    let role = sessionClaims?.metadata?.role as string | undefined;
    
    // Fallback: fetch from Clerk if not in session
    if (!role) {
        if (!clerkUser) clerkUser = await currentUser();
        role = clerkUser?.publicMetadata?.role as string;
    }

    console.log("User Role in API:", role);
    
    if (role === "admin") {
      const users = await User.find({});
      console.log("Admin fetching users. Found:", users.length);
      return NextResponse.json({ users });
    } else {
      console.log("Non-admin fetching own profile");
      // If not admin, return only own profile
      const user = await User.findOne({ clerkId: userId });
      return NextResponse.json({ user });
    }
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
