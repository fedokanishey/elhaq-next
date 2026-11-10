import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import MarriageCase from "@/lib/models/MarriageCase";
import { NextResponse } from "next/server";
import {
  sanitizeBeneficiaryPayload,
  SanitizedRelationship,
} from "@/lib/beneficiaries/sanitizePayload";
import { addReciprocalRelationsForNew } from "@/lib/beneficiaries/reciprocal";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";
import { createActivityNotification, getActorName } from "@/lib/notifications";
import {
  getCachedBeneficiaries,
  setCachedBeneficiaries,
  invalidateBeneficiariesCache,
} from "@/lib/cache/beneficiariesCache";

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

    // Check server in-memory cache
    const cacheKey = JSON.stringify({
      userBranch: authResult.branch?.toString() || "all",
      override: branchIdOverride || "none",
      isSuperAdmin: authResult.isSuperAdmin,
    });

    const cachedData = getCachedBeneficiaries(cacheKey);
    if (cachedData) {
      const cachedResponse = NextResponse.json(cachedData);
      cachedResponse.headers.set("X-Cache", "HIT");
      return cachedResponse;
    }

    // Get all beneficiaries filtered by branch (lean query without heavy relationship population)
    const beneficiaries = await Beneficiary.find(branchFilter)
      .sort({ internalId: 1 })
      .populate("branch", "name code")
      .lean();

    // Ensure all beneficiaries have a category field (default to 'C' if not set)
    const beneficiariesWithCategory = beneficiaries.map((b: any) => ({
      ...b,
      category: b.category || 'C',
    }));

    const total = await Beneficiary.countDocuments(branchFilter);

    const responseData = {
      beneficiaries: beneficiariesWithCategory,
      total,
      page: 1,
      pages: 1,
      branch: authResult.branchName,
      isSuperAdmin: authResult.isSuperAdmin,
    };

    setCachedBeneficiaries(cacheKey, responseData);

    const response = NextResponse.json(responseData);
    response.headers.set("X-Cache", "MISS");
    return response;
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

        await createActivityNotification({
          authResult,
          actionType: "beneficiary_created",
          message: `تم إضافة مستفيد جديد: ${beneficiary.name}`,
          entityId: beneficiary._id.toString(),
          metadata: {
            beneficiaryName: beneficiary.name,
            internalId: beneficiary.internalId,
            nationalId: beneficiary.nationalId,
          },
          branch: branch._id,
          branchName: branch.name,
        });
        
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

    await createActivityNotification({
      authResult,
      actionType: "beneficiary_created",
      message: `تم إضافة مستفيد جديد: ${beneficiary.name}`,
      entityId: beneficiary._id.toString(),
      metadata: {
        beneficiaryName: beneficiary.name,
        internalId: beneficiary.internalId,
        nationalId: beneficiary.nationalId,
      },
      branch: targetBranch,
      branchName: targetBranchName,
    });

    console.log("✅ Beneficiary saved successfully:", {
      id: beneficiary._id,
      name: beneficiary.name,
      nationalId: beneficiary.nationalId,
    });

    // If beneficiary accepts marriage assistance, auto-create a pending marriage case
    if (beneficiary.acceptsMarriage) {
      try {
        const existingCase = await MarriageCase.findOne({ beneficiary: beneficiary._id });
        if (!existingCase) {
          let personName = "مقبل على الزواج (قيد استكمال البيانات)";
          let relationship: any = "daughter";

          if (beneficiary.children && beneficiary.children.length > 0) {
            const singleChild =
              beneficiary.children.find((c: any) => c.maritalStatus === "single") ||
              beneficiary.children[0];
            if (singleChild?.name) {
              personName = singleChild.name;
              relationship = singleChild.gender === "female" ? "daughter" : "son";
            }
          }

          await MarriageCase.create({
            beneficiary: beneficiary._id,
            beneficiaryName: beneficiary.name,
            beneficiaryNationalId: beneficiary.nationalId,
            beneficiaryPhone: beneficiary.phone,
            beneficiaryAddress: beneficiary.address,
            personName,
            relationship,
            status: "pending",
            itemsProvided: [],
            cashAssistance: 0,
            totalCost: 0,
            certificateImage: beneficiary.marriageCertificateImage || "",
            notes: beneficiary.marriageDetails || "تم تسجيل رغبة مساعدة الزواج من استمارة المستفيد",
            branch: targetBranch,
            branchName: targetBranchName,
            createdBy: getActorName(authResult),
          });
        }
      } catch (marriageErr) {
        console.error("Failed to auto-create MarriageCase from beneficiary create:", marriageErr);
      }
    }

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

    // Invalidate server cache when a new beneficiary is created
    invalidateBeneficiariesCache();

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
