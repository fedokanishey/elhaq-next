import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";
    const excludeId = searchParams.get("excludeId")?.trim();
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 10;

    if (query.length < 2) {
      return NextResponse.json({ beneficiaries: [] });
    }

    await dbConnect();

    const regex = new RegExp(escapeRegex(query), "i");
    const filter: Record<string, unknown> = {
      $or: [{ name: regex }, { nationalId: { $regex: query } }],
    };

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const beneficiaries = await Beneficiary.find(filter)
      .select("name nationalId phone whatsapp")
      .limit(limit)
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      beneficiaries: beneficiaries.map((beneficiary) => ({
        _id: beneficiary._id,
        name: beneficiary.name,
        nationalId: beneficiary.nationalId,
        phone: beneficiary.phone,
        whatsapp: beneficiary.whatsapp,
      })),
    });
  } catch (error) {
    console.error("Error searching beneficiaries:", error);
    return NextResponse.json({ error: "Failed to search beneficiaries" }, { status: 500 });
  }
}
