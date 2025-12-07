import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";
import {
  sanitizeBeneficiaryPayload,
  SanitizedRelationship,
} from "@/lib/beneficiaries/sanitizePayload";
import { addReciprocalRelationsForNew } from "@/lib/beneficiaries/reciprocal";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    await dbConnect();

    // Get all beneficiaries without artificial limit
    const beneficiaries = await Beneficiary.find()
      .sort({ createdAt: -1 })
      .populate("relationships.relative", "name nationalId phone whatsapp")
      .lean();

    const total = await Beneficiary.countDocuments();

    return NextResponse.json({
      beneficiaries,
      total,
      page: 1,
      pages: 1,
    });
  } catch (error) {
    console.error("Error fetching beneficiaries:", error);
    return NextResponse.json(
      { error: "Failed to fetch beneficiaries" },
      { status: 500 }
    );
  }
}

const buildRelationshipReferences = async (
  relationships: SanitizedRelationship[]
) => {
  if (!relationships?.length) {
    return [];
  }

  const lookupNationalIds = relationships
    .map((rel) => rel.relativeNationalId)
    .filter((value): value is string => Boolean(value));

  const references = lookupNationalIds.length
    ? await Beneficiary.find({ nationalId: { $in: lookupNationalIds } })
        .select("_id nationalId")
        .lean()
    : [];

  const referenceMap = new Map<string, string>(
    references.map((record) => [record.nationalId, record._id.toString()])
  );

  return relationships.map((relationship) => ({
    ...relationship,
    relative:
      relationship.relativeNationalId
        ? referenceMap.get(relationship.relativeNationalId)
        : undefined,
  }));
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const rawBody = await req.json();
    const payload = sanitizeBeneficiaryPayload(rawBody);
    const { relationships, ...rest } = payload;
    const resolvedRelationships = await buildRelationshipReferences(relationships);

    console.log("📝 Creating beneficiary:", {
      name: rest.name,
      nationalId: rest.nationalId,
      phone: rest.phone,
      acceptsMarriage: rest.acceptsMarriage,
      marriageDetails: rest.marriageDetails,
      marriageCertificateImage: rest.marriageCertificateImage,
      hasMarriageCertImage: !!rest.marriageCertificateImage,
      relationshipsCount: resolvedRelationships.length
    });

    const beneficiary = new Beneficiary({
      clerkId: userId,
      ...rest,
      relationships: resolvedRelationships,
    });

    await beneficiary.save();

    console.log("✅ Beneficiary saved successfully:", {
      id: beneficiary._id,
      name: beneficiary.name,
      nationalId: beneficiary.nationalId,
    });

    // Create reciprocal relations on referenced beneficiaries
    try {
      await addReciprocalRelationsForNew(
        beneficiary._id.toString(),
        beneficiary.name,
        beneficiary.nationalId,
        resolvedRelationships as any
      );
    } catch (e) {
      console.error("❌ Failed to add reciprocal relations after create:", e);
    }

    return NextResponse.json(beneficiary, { status: 201 });
  } catch (error) {
    console.error("❌ Error creating beneficiary:", error);
    
    // Check if it's a duplicate nationalId error
    if (error instanceof Error && error.message.includes("E11000")) {
      return NextResponse.json(
        { error: "رقم المستفيد موجود بالفعل" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create beneficiary" },
      { status: 500 }
    );
  }
}
