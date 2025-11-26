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

    let role = (sessionClaims?.metadata as { role?: string })?.role;
    let clerkUser = null;

    if (!role) {
        clerkUser = await currentUser();
        role = clerkUser?.publicMetadata?.role as string;
    }

    if (role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Sync admin user if not exists
    const existingUser = await User.findOne({ clerkId: userId });
    if (!existingUser) {
      if (!clerkUser) clerkUser = await currentUser();
      if (clerkUser) {
        await User.create({
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          profileImageUrl: clerkUser.imageUrl,
          role: 'admin',
        });
      }
    }

    const initiatives = await Initiative.find({});
    const beneficiaries = await Beneficiary.find({});
    const usersCount = await User.countDocuments({});

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
