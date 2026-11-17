import { auth, currentUser } from "@clerk/nextjs/server";
import { isValidObjectId, type Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import Branch from "@/lib/models/Branch";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getBranchFilter } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Check MongoDB for role first (Source of Truth)
    const dbUser = await User.findOne({ clerkId: userId }).populate('branch');
    let role = dbUser?.role;

    // Fallback to Clerk metadata
    if (!role || role === 'user') {
        role = (sessionClaims?.metadata as { role?: string })?.role || role;
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
    
    // SuperAdmin can see all users
    if (role === "superadmin") {
      const users = await User.find({}).populate('branch').sort({ createdAt: -1 });
      const branches = await Branch.find({ isActive: true });
      console.log("SuperAdmin fetching all users. Found:", users.length);
      return NextResponse.json({ users, branches, role: 'superadmin' });
    }
    
    // Admin can see only members and users in their branch (not other admins)
    if (role === "admin") {
      const authResult = await getAuthenticatedUser();
      const branchFilter = getBranchFilter(authResult);
      
      // Admin can only see members and users, not other admins or superadmins
      const roleFilter = { role: { $in: ['member', 'user'] } };
      const combinedFilter = { ...branchFilter, ...roleFilter };
      
      const users = await User.find(combinedFilter).populate('branch').sort({ createdAt: -1 });
      console.log("Admin fetching branch members/users. Found:", users.length);
      return NextResponse.json({ users, role: 'admin', branch: authResult.branchName });
    } 
    
    // Non-admin: return only own profile and active branches (for self-service branch selection)
    console.log("Non-admin fetching own profile");
    const [user, branches] = await Promise.all([
      User.findOne({ clerkId: userId }).populate('branch'),
      Branch.find({ isActive: true }).sort({ name: 1 }).select('_id name code').lean(),
    ]);
    const finalRole = role || user?.role || 'user';
    return NextResponse.json({ user, role: finalRole, branches });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH: Regular users (`role === "user"`) can set or change their own assigned branch from Profile
export async function PATCH(request: Request) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult.userId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (
      authResult.role !== "user" ||
      authResult.isAdmin ||
      authResult.isSuperAdmin ||
      authResult.isMember
    ) {
      return NextResponse.json(
        {
          error:
            "تغيير الفرع متاح للمستخدم العادي فقط؛ يتم تعيين فرع الأعضاء والمسؤولين بواسطة السوبر ادمن",
        },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      branchId?: unknown;
    } | null;
    const branchId = typeof body?.branchId === "string" ? body.branchId.trim() : "";

    if (!branchId || !isValidObjectId(branchId)) {
      return NextResponse.json(
        { error: "يرجى اختيار فرع صالح" },
        { status: 400 }
      );
    }

    await dbConnect();

    const branchDoc = (await Branch.findOne({
      _id: branchId,
      isActive: true,
    })
      .select("_id name code")
      .lean()) as { _id: Types.ObjectId; name: string; code: string } | null;

    if (!branchDoc) {
      return NextResponse.json(
        { error: "الفرع المختار غير متاح" },
        { status: 404 }
      );
    }

    const updatedUser = await User.findOneAndUpdate(
      { clerkId: authResult.userId },
      {
        $set: {
          branch: branchDoc._id,
          branchName: branchDoc.name,
        },
      },
      { new: true }
    ).populate("branch");

    return NextResponse.json({
      ok: true,
      branchId: branchDoc._id.toString(),
      branchName: branchDoc.name,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user branch:", error);
    return NextResponse.json(
      { error: "تعذر تحديث الفرع حالياً" },
      { status: 500 }
    );
  }
}
