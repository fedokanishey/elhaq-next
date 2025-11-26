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

    // Check MongoDB for role first (Source of Truth)
    const dbUser = await User.findOne({ clerkId: userId });
    let role = dbUser?.role;

    // Fallback to Clerk metadata
    if (role !== 'admin') {
        role = (sessionClaims?.metadata as { role?: string })?.role;
    }

    // Sync user to MongoDB if not exists
    let clerkUser = null;
    
    // Try to find user by Clerk ID or Email to avoid duplicates
    const userEmail = (sessionClaims?.email as string) || (await currentUser())?.emailAddresses[0]?.emailAddress;
    
    // We need to fetch currentUser if we don't have the email from session
    if (!userEmail) {
        clerkUser = await currentUser();
    }

    const emailToSearch = userEmail || clerkUser?.emailAddresses[0]?.emailAddress;
    
    console.log(`[API] Syncing user: ${userId}, Email: ${emailToSearch}`);

    // Use findOneAndUpdate with upsert to handle race conditions and duplicates safely
    if (emailToSearch) {
        clerkUser = clerkUser || await currentUser();
        if (clerkUser) {
             await User.findOneAndUpdate(
                { $or: [{ clerkId: userId }, { email: emailToSearch }] },
                {
                    clerkId: userId,
                    email: emailToSearch,
                    firstName: clerkUser.firstName,
                    lastName: clerkUser.lastName,
                    profileImageUrl: clerkUser.imageUrl,
                    // Only set role if it's not already set in DB (to avoid overwriting admin role)
                    $setOnInsert: { 
                        role: role || clerkUser.publicMetadata?.role || 'user' 
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }
    }

    // Fallback: fetch from Clerk if not in session and not in DB
    if (!role) {
        if (!clerkUser) clerkUser = await currentUser();
        role = clerkUser?.publicMetadata?.role as string;
    }

    console.log("User Role in API:", role);
    console.log("DB Name:", (await dbConnect()).connection.name);
    
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
