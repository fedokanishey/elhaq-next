import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Initiative from "@/lib/models/Initiative";
import Beneficiary from "@/lib/models/Beneficiary";
import User from "@/lib/models/User";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";
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

    // Calculate remaining balance (total received - total spent)
    const incomeTransactions = await TreasuryTransaction.find({ type: 'income' });
    const expenseTransactions = await TreasuryTransaction.find({ type: 'expense' });
    
    console.log(`[Reports API] Income Transactions Found: ${incomeTransactions.length}`);
    console.log(`[Reports API] Expense Transactions Found: ${expenseTransactions.length}`);
    
    const totalReceived = incomeTransactions.reduce((sum: number, transaction: any) => sum + (transaction.amount || 0), 0);
    const totalExpenses = expenseTransactions.reduce((sum: number, transaction: any) => sum + (transaction.amount || 0), 0);
    
    console.log(`[Reports API] Total Received: ${totalReceived}, Total Expenses: ${totalExpenses}`);
    
    // If no treasury data exists, use 0 (will need to add treasury entries in admin panel)
    const remainingBalance = totalReceived - totalExpenses;

    // Calculate initiatives by status
    const initiativesByStatus = {
      planned: initiatives.filter(i => i.status === 'planned').length,
      active: initiatives.filter(i => i.status === 'active').length,
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
        remainingBalance
      }
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
