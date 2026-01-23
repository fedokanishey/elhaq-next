import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Default list that should appear for ALL branches
const DEFAULT_LISTS = ["الكشف العام"];

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Get authenticated user with branch info
    const authResult = await getAuthenticatedUser();
    
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const trimmedQuery = query.trim();
    
    // Get branchId from query params (for SuperAdmin branch filtering)
    const branchIdOverride = searchParams.get("branchId");
    
    // Build branch filter - uses override if SuperAdmin selected a branch
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    // Build the combined filter: branch + optional search query
    const buildFilter = (field: string, useSearch: boolean) => {
      const filter: Record<string, unknown> = { ...branchFilter };
      if (useSearch && trimmedQuery.length >= 2) {
        filter[field] = { $regex: trimmedQuery, $options: "i" };
      }
      return filter;
    };

    const useSearch = trimmedQuery.length >= 2;

    // Get distinct list names from the NEW listNames array field (filtered by branch)
    const listNamesFromArray = await Beneficiary.distinct("listNames", buildFilter("listNames", useSearch));

    // Also get from the deprecated listName field for backward compatibility
    const listNamesFromLegacy = await Beneficiary.distinct("listName", buildFilter("listName", useSearch));

    // Combine branch-specific lists with default lists
    const branchLists = [...new Set([...listNamesFromArray, ...listNamesFromLegacy])];
    
    // Add default lists (they should always appear for all branches)
    const allNames = [...new Set([...DEFAULT_LISTS, ...branchLists])];
    
    // Filter by search term if provided
    let filtered = allNames.filter((name): name is string => Boolean(name));
    
    if (trimmedQuery.length > 0) {
      const searchFiltered = filtered.filter(name => name.includes(trimmedQuery));
      // If search matches something, show only matches; otherwise show all
      if (searchFiltered.length > 0) {
        filtered = searchFiltered;
      }
    }
    
    // Sort alphabetically in Arabic
    filtered.sort((a, b) => a.localeCompare(b, "ar"));

    return NextResponse.json({ listNames: filtered });
  } catch (error) {
    console.error("Error fetching list names:", error);
    return NextResponse.json(
      { error: "Failed to fetch list names" },
      { status: 500 }
    );
  }
}
