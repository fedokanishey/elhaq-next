import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildArabicRegex = (text: string) => {
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return new RegExp("", "i");

  const wordPatterns = rawWords.map((w) => {
    let p = escapeRegex(w)
      .replace(/[اأإآ]/g, "[اأإآ]")
      .replace(/[ةه]/g, "[ةه]")
      .replace(/[يى]/g, "[يى]");

    // Allow optional spaces after common compound prefixes e.g. "ابو" / "عبد"
    p = p.replace(/\[اأإآ\]بو/g, "[اأإآ]بو\\s*");
    p = p.replace(/عبد/g, "عبد\\s*");

    return p;
  });

  return new RegExp(wordPatterns.join(".*"), "i");
};

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const excludeId = searchParams.get("excludeId")?.trim();
    const branchIdOverride = searchParams.get("branchId");
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 25;

    await dbConnect();
    
    // Get authenticated user for branch filtering
    const authResult = await getAuthenticatedUser();
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    let filter: Record<string, unknown> = { ...branchFilter };

    if (query) {
      const regex = buildArabicRegex(query);
      filter = {
        ...branchFilter,
        $or: [
          { name: regex },
          { nationalId: { $regex: escapeRegex(query), $options: "i" } },
          { phone: { $regex: escapeRegex(query), $options: "i" } },
          { internalId: { $regex: escapeRegex(query), $options: "i" } },
        ],
      };
    }

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const beneficiaries = await Beneficiary.find(filter)
      .select("name nationalId phone whatsapp address internalId children")
      .limit(limit)
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      beneficiaries: beneficiaries.map((b: any) => ({
        _id: b._id,
        name: b.name,
        nationalId: b.nationalId,
        phone: b.phone,
        whatsapp: b.whatsapp,
        address: b.address,
        internalId: b.internalId,
        children: (b.children || []).map((c: any) => ({
          _id: c._id,
          name: c.name,
          gender: c.gender,
          maritalStatus: c.maritalStatus,
        })),
      })),
    });
  } catch (error) {
    console.error("Error searching beneficiaries:", error);
    return NextResponse.json({ error: "Failed to search beneficiaries" }, { status: 500 });
  }
}
