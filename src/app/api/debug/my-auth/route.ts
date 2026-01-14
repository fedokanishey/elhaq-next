import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { getAuthenticatedUser, getBranchFilter } from "@/lib/auth-helpers";
import TreasuryTransaction from "@/lib/models/TreasuryTransaction";

export async function GET() {
  try {
    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    const branchFilter = getBranchFilter(authResult);
    
    // Count treasury transactions with the branch filter
    const treasuryCount = await TreasuryTransaction.countDocuments(branchFilter);
    
    // Get sample treasury transactions
    const sampleTransactions = await TreasuryTransaction.find(branchFilter)
      .limit(5)
      .select('type amount description branch branchName')
      .lean();
    
    return NextResponse.json({
      authResult: {
        userId: authResult.userId,
        role: authResult.role,
        branch: authResult.branch?.toString() || null,
        branchName: authResult.branchName,
        isSuperAdmin: authResult.isSuperAdmin,
        isAdmin: authResult.isAdmin,
        isMember: authResult.isMember,
        isAuthorized: authResult.isAuthorized,
      },
      branchFilter,
      treasuryCount,
      sampleTransactions: sampleTransactions.map(t => ({
        ...t,
        branch: t.branch?.toString(),
      })),
    });
  } catch (error) {
    console.error("Error in my-auth debug:", error);
    return NextResponse.json({ error: "Failed to check auth", details: String(error) }, { status: 500 });
  }
}
