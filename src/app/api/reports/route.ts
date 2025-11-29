import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Initiative from "@/lib/models/Initiative";
import Beneficiary from "@/lib/models/Beneficiary";
import User from "@/lib/models/User";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Check MongoDB for role first (Source of Truth)
    const dbUser = await User.findOne({ clerkId: userId });
    let isAdmin = dbUser?.role === 'admin';

    // Fallback to Clerk metadata if not admin in DB (e.g. first login)
    if (!isAdmin) {
        const role = (sessionClaims?.metadata as { role?: string })?.role;
        if (role === 'admin') isAdmin = true;
    }

    if (!isAdmin) {
         // Double check with currentUser() as last resort
         const clerkUser = await currentUser();
         if (clerkUser?.publicMetadata?.role === 'admin') isAdmin = true;
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Sync admin user if not exists (Robust Logic)
    const userEmail = (sessionClaims?.email as string) || (await currentUser())?.emailAddresses[0]?.emailAddress;
    let clerkUser = null;

    if (userEmail) {
        if (!clerkUser) clerkUser = await currentUser();
        if (clerkUser) {
          await User.findOneAndUpdate(
            { $or: [{ clerkId: userId }, { email: userEmail }] },
            {
              $set: {
                clerkId: userId,
                email: userEmail,
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                profileImageUrl: clerkUser.imageUrl,
              },
              $setOnInsert: { role: 'admin' }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
    }

    const initiatives = await Initiative.find({});
    const beneficiaries = await Beneficiary.find({});
    const usersCount = await User.countDocuments({});

    console.log(`[Reports API] Initiatives Found: ${initiatives.length}`);
    console.log(`[Reports API] Beneficiaries Found: ${beneficiaries.length}`);
    console.log(`[Reports API] Users Found: ${usersCount}`);

    const totalInitiatives = initiatives.length;
    const totalBeneficiaries = beneficiaries.length;
    
    // Calculate total amount spent on initiatives
    const totalAmountSpent = initiatives.reduce((sum, init) => sum + (init.totalAmount || 0), 0);

    // Calculate active cases (beneficiaries in active initiatives)
    const activeInitiatives = initiatives.filter(i => i.status === 'active');
    const activeBeneficiaryIds = new Set<string>();
    activeInitiatives.forEach(init => {
      if (init.beneficiaries && Array.isArray(init.beneficiaries)) {
        init.beneficiaries.forEach((bId: string) => activeBeneficiaryIds.add(bId.toString()));
      }
    });
    const activeCases = activeBeneficiaryIds.size;

    // Calculate initiatives by status
    const initiativesByStatus = {
      planned: initiatives.filter(i => i.status === 'planned').length,
      active: activeInitiatives.length,
      completed: initiatives.filter(i => i.status === 'completed').length,
      cancelled: initiatives.filter(i => i.status === 'cancelled').length,
    };

    return NextResponse.json({
      stats: {
        totalInitiatives,
        totalBeneficiaries,
        totalAmountSpent,
        initiativesByStatus,
        totalUsers: usersCount,
        activeCases
      }
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
