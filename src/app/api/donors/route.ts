import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Donor from "@/lib/models/Donor";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  try {
    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    
    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);
    
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 200;

    const donors = await Donor.find(branchFilter)
      .sort({ totalDonated: -1, name: 1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ donors, branch: authResult.branchName });
  } catch (error) {
    console.error("Error fetching donors:", error);
    return NextResponse.json({ error: "Failed to fetch donors" }, { status: 500 });
  }
}
