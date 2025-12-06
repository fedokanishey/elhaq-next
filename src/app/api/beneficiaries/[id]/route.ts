import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import Initiative from "@/lib/models/Initiative";
import { NextResponse } from "next/server";
import {
  sanitizeBeneficiaryPayload,
  SanitizedRelationship,
} from "@/lib/beneficiaries/sanitizePayload";
import { syncReciprocalRelations } from "@/lib/beneficiaries/reciprocal";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const beneficiary = await Beneficiary.findById(id)
      .populate("relationships.relative", "name nationalId phone whatsapp")
      .lean();

    if (!beneficiary) {
      return NextResponse.json({ error: "Beneficiary not found" }, { status: 404 });
    }

    const initiatives = await Initiative.find({ beneficiaries: id })
      .sort({ date: -1 })
      .select("name status date totalAmount")
      .lean();

    return NextResponse.json({ beneficiary, initiatives });
  } catch (error) {
    console.error("Error fetching beneficiary:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const rawBody = await req.json();
    const payload = sanitizeBeneficiaryPayload(rawBody);
    const { children, spouse, relationships, ...rest } = payload;
    const resolvedRelationships = await buildRelationshipReferences(
      relationships,
      id
    );

    const beneficiary = await Beneficiary.findById(id);

    if (!beneficiary) {
      return NextResponse.json({ error: "Beneficiary not found" }, { status: 404 });
    }

    // capture old relationships for syncing reciprocals
    const oldResolved = (beneficiary.relationships || []).map((r: any) => ({
      relation: r.relation,
      relativeName: r.relativeName,
      relativeNationalId: r.relativeNationalId,
      relative: r.relative ? r.relative.toString() : undefined,
    }));

    beneficiary.set(rest);
    beneficiary.set("children", children);
    beneficiary.set("spouse", spouse);
    beneficiary.set("relationships", resolvedRelationships);
    beneficiary.markModified("children");
    beneficiary.markModified("spouse");
    beneficiary.markModified("relationships");
    await beneficiary.save();

    // sync reciprocal relations on related beneficiaries
    try {
      await syncReciprocalRelations(
        beneficiary._id.toString(),
        beneficiary.name,
        beneficiary.nationalId,
        oldResolved,
        resolvedRelationships as any
      );
    } catch (e) {
      // non-fatal
      // eslint-disable-next-line no-console
      console.error("Failed to sync reciprocal relations after update:", e);
    }

    return NextResponse.json(beneficiary);
  } catch (error) {
    console.error("Error updating beneficiary:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    
    // Log the deletion attempt
    console.log("🗑️ Attempting to delete beneficiary:", id);
    
    const beneficiary = await Beneficiary.findByIdAndDelete(id);

    if (!beneficiary) {
      console.warn("⚠️ Beneficiary not found for deletion:", id);
      return NextResponse.json({ error: "Beneficiary not found" }, { status: 404 });
    }

    console.log("✅ Beneficiary deleted successfully:", {
      id: beneficiary._id,
      name: beneficiary.name,
    });

    return NextResponse.json({ message: "Beneficiary deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting beneficiary:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function buildRelationshipReferences(
  relationships: SanitizedRelationship[],
  currentId?: string
) {
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

  return relationships.map((relationship) => {
    const relativeId = relationship.relativeNationalId
      ? referenceMap.get(relationship.relativeNationalId)
      : undefined;
    const sanitizedRelativeId =
      relativeId && relativeId !== currentId ? relativeId : undefined;

    return {
      ...relationship,
      relative: sanitizedRelativeId,
    };
  });
}
