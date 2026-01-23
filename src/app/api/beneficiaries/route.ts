import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";
import {
  sanitizeBeneficiaryPayload,
  SanitizedRelationship,
} from "@/lib/beneficiaries/sanitizePayload";
import { addReciprocalRelationsForNew } from "@/lib/beneficiaries/reciprocal";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    
    // Get branchId from query params (for SuperAdmin branch filtering)
    const { searchParams } = new URL(request.url);
    const branchIdOverride = searchParams.get("branchId");
    
    // Build branch filter based on user role and optional override
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    // Get all beneficiaries filtered by branch
    const beneficiaries = await Beneficiary.find(branchFilter)
      .sort({ createdAt: -1 })
      .populate("relationships.relative", "name nationalId phone whatsapp")
      .populate("branch", "name code")
      .lean();

    // Ensure all beneficiaries have a category field (default to 'C' if not set)
    const beneficiariesWithCategory = beneficiaries.map((b: any) => ({
      ...b,
      category: b.category || 'C',
    }));

    const total = await Beneficiary.countDocuments(branchFilter);

    return NextResponse.json({
      beneficiaries: beneficiariesWithCategory,
      total,
      page: 1,
      pages: 1,
      branch: authResult.branchName,
      isSuperAdmin: authResult.isSuperAdmin,
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
    
    const authResult = await getAuthenticatedUser();
    
    // Check if user is authorized to create beneficiaries
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawBody = await req.json();
    
    console.log("🔍 API received rawBody.listNames:", rawBody.listNames);
    
    const payload = sanitizeBeneficiaryPayload(rawBody);
    
    console.log("🔍 API sanitized payload.listNames:", payload.listNames);
    
    const { relationships, ...rest } = payload;
    const resolvedRelationships = await buildRelationshipReferences(relationships);

    // For SuperAdmin: use the branch from request body if provided
    // If SuperAdmin and no branch provided, copy to ALL branches
    // For other users: always use their assigned branch
    
    if (authResult.isSuperAdmin && !rawBody.branch) {
      // SuperAdmin selected "All Branches" - copy to each branch
      const Branch = (await import("@/lib/models/Branch")).default;
      const allBranches = await Branch.find({ isActive: true }).lean();
      
      if (allBranches.length === 0) {
        return NextResponse.json({ error: "لا توجد فروع نشطة" }, { status: 400 });
      }
      
      // Check for existing nationalId in any branch first
      const existingInBranches = await Beneficiary.find({
        nationalId: rest.nationalId,
        branch: { $in: allBranches.map(b => b._id) },
      }).populate("branch", "name").lean();
      
      if (existingInBranches.length > 0) {
        const branchNames = existingInBranches.map((b: any) => b.branch?.name || "غير معروف").join(", ");
        return NextResponse.json(
          { error: `رقم المستفيد "${rest.nationalId}" موجود بالفعل في: ${branchNames}` },
          { status: 400 }
        );
      }
      
      const createdBeneficiaries = [];
      
      for (const branch of allBranches) {
        const beneficiary = new Beneficiary({
          clerkId: userId,
          ...rest,
          relationships: resolvedRelationships,
          branch: branch._id,
          branchName: branch.name,
        });
        await beneficiary.save();
        createdBeneficiaries.push(beneficiary);
        
        // Create reciprocal relations
        try {
          await addReciprocalRelationsForNew(
            beneficiary._id.toString(),
            beneficiary.name,
            beneficiary.nationalId,
            resolvedRelationships as any
          );
        } catch (e) {
          console.error("❌ Failed to add reciprocal relations:", e);
        }
      }
      
      console.log(`✅ Created ${createdBeneficiaries.length} beneficiaries for all branches`);
      return NextResponse.json({ 
        message: `تم إضافة المستفيد لـ ${createdBeneficiaries.length} فرع`,
        count: createdBeneficiaries.length,
        beneficiary: createdBeneficiaries[0] 
      }, { status: 201 });
    }
    
    // Single branch (either SuperAdmin selected a branch, or regular admin/member)
    const targetBranch = authResult.isSuperAdmin ? rawBody.branch : authResult.branch;
    const targetBranchName = authResult.isSuperAdmin ? rawBody.branchName : authResult.branchName;

    // Check if nationalId already exists in the target branch
    const existingBeneficiary = await Beneficiary.findOne({
      nationalId: rest.nationalId,
      branch: targetBranch,
    });
    
    if (existingBeneficiary) {
      return NextResponse.json(
        { error: `رقم المستفيد "${rest.nationalId}" موجود بالفعل في هذا الفرع` },
        { status: 400 }
      );
    }

    console.log("📝 Creating beneficiary:", {
      name: rest.name,
      nationalId: rest.nationalId,
      phone: rest.phone,
      acceptsMarriage: rest.acceptsMarriage,
      marriageDetails: rest.marriageDetails,
      marriageCertificateImage: rest.marriageCertificateImage,
      hasMarriageCertImg: !!rest.marriageCertificateImage,
      relationshipsCount: resolvedRelationships.length,
      branch: targetBranchName,
    });

    const beneficiary = new Beneficiary({
      clerkId: userId,
      ...rest,
      relationships: resolvedRelationships,
      // Assign to target branch
      branch: targetBranch,
      branchName: targetBranchName,
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
    
    // Check if it's a duplicate nationalId error (MongoDB E11000)
    if (error instanceof Error && error.message.includes("E11000")) {
      // Try to extract the duplicate key value
      const match = error.message.match(/dup key: \{ ([^}]+) \}/);
      const keyInfo = match ? match[1] : "";
      
      // Check if old unique index on nationalId only (not compound with branch)
      if (error.message.includes("nationalId_1") && !error.message.includes("branch")) {
        return NextResponse.json(
          { error: "يوجد index قديم في قاعدة البيانات. يرجى تشغيل /api/debug/fix-indexes لإصلاح المشكلة." },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: `رقم المستفيد موجود بالفعل في هذا الفرع` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create beneficiary" },
      { status: 500 }
    );
  }
}
