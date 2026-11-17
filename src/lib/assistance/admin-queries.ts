import { isValidObjectId, Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import AssistanceRequest from "@/lib/models/AssistanceRequest";
import Branch from "@/lib/models/Branch";
import User from "@/lib/models/User";
import Beneficiary from "@/lib/models/Beneficiary";
import AssistanceAuditLog from "@/lib/models/AssistanceAuditLog";
import type { AuthResult } from "@/lib/auth-helpers";
import {
  requireAssistanceAdmin,
  requireAssistanceReadAccess,
  sanitizeAuditDetails,
} from "./auth";
import { maskNationalId } from "./crypto";
import {
  buildAdminRequestsFilterQuery,
  type AdminRequestFilters,
} from "./workflow";

interface LeanReviewerRow {
  clerkId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
}

interface LeanChildRow {
  _id?: Types.ObjectId | string;
  name?: string;
  gender?: string;
  maritalStatus?: string;
  educationStage?: string;
  nationalId?: string;
  idNumber?: string;
  spouse?: {
    name?: string;
    nationalId?: string;
  };
}

interface LeanFamilyBenRow {
  _id: Types.ObjectId | string;
  internalId?: string;
  name: string;
  nationalId?: string;
  phone?: string;
  maritalStatus?: string;
  status?: string;
  category?: string;
  familyMembers?: number;
  housingType?: string;
  receivesMonthlyAllowance?: boolean;
  monthlyAllowanceAmount?: number;
  branchName?: string;
  spouse?: {
    name?: string;
    nationalId?: string;
    phone?: string;
  };
  children?: LeanChildRow[];
  relationships?: unknown[];
}

export async function isDefaultZarqaBranchAdmin(
  authResult: AuthResult
): Promise<boolean> {
  if (!authResult.branch) return false;
  const userBranchDoc = (await Branch.findById(authResult.branch)
    .select("code name")
    .lean()) as { code?: string; name?: string } | null;

  return (
    userBranchDoc?.code === "ZARQA" || userBranchDoc?.name === "الزرقا"
  );
}

/**
 * Shared read guard for single-request routes (`admin` of same branch, `member` of same branch, or `superadmin`).
 * Ensures unassigned (`branch: null`) requests are only visible to SuperAdmin or the default ZARQA branch.
 */
export async function requireReadAccessForRequestDocument(
  resourceBranch?: Types.ObjectId | string | null
) {
  const authCheck = await requireAssistanceReadAccess({
    resourceBranchId: resourceBranch,
  });
  if (!authCheck.ok) {
    return authCheck;
  }

  if (!resourceBranch && !authCheck.authResult.isSuperAdmin) {
    const canSeeUnassigned = await isDefaultZarqaBranchAdmin(
      authCheck.authResult
    );
    if (!canSeeUnassigned) {
      return {
        ok: false as const,
        status: 403 as const,
        error: "ممنوع الوصول لبيانات فرع آخر",
      };
    }
  }

  return authCheck;
}

/**
 * Shared mutation guard for single-request admin routes: enforces role (`admin` or `superadmin`), branch ownership,
 * and ensures unassigned (`branch: null`) requests are only modifiable by SuperAdmin
 * or the default ZARQA branch administrator (matching list filtering).
 */
export async function requireAdminForRequestDocument(
  resourceBranch?: Types.ObjectId | string | null
) {
  const authCheck = await requireAssistanceAdmin({
    resourceBranchId: resourceBranch,
  });
  if (!authCheck.ok) {
    return authCheck;
  }

  if (!resourceBranch && !authCheck.authResult.isSuperAdmin) {
    const canSeeUnassigned = await isDefaultZarqaBranchAdmin(
      authCheck.authResult
    );
    if (!canSeeUnassigned) {
      return {
        ok: false as const,
        status: 403 as const,
        error: "ممنوع الوصول لبيانات فرع آخر",
      };
    }
  }

  return authCheck;
}

export async function buildAssistanceBranchFilter(
  authResult: AuthResult,
  branchIdOverride?: string | null
): Promise<Record<string, unknown>> {
  if (authResult.isSuperAdmin) {
    if (branchIdOverride && isValidObjectId(branchIdOverride)) {
      return { branch: new Types.ObjectId(branchIdOverride) };
    }
    return {};
  }

  if (!authResult.branch) {
    return { _id: { $exists: false } };
  }

  if (await isDefaultZarqaBranchAdmin(authResult)) {
    return {
      $or: [{ branch: authResult.branch }, { branch: null }],
    };
  }

  return { branch: authResult.branch };
}

export async function executeAdminAssistanceListQuery(params: {
  authResult: AuthResult;
  branchIdOverride?: string | null;
  filters: AdminRequestFilters;
  page?: number;
  limit?: number;
}) {
  await dbConnect();

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
  const skip = (page - 1) * limit;

  const branchFilter = await buildAssistanceBranchFilter(
    params.authResult,
    params.branchIdOverride
  );
  const query = buildAdminRequestsFilterQuery(params.filters, branchFilter);

  const reviewerBranchFilter = params.authResult.isSuperAdmin
    ? params.branchIdOverride && isValidObjectId(params.branchIdOverride)
      ? {
          $or: [
            { branch: new Types.ObjectId(params.branchIdOverride) },
            { role: "superadmin" },
          ],
        }
      : {}
    : params.authResult.branch
    ? { $or: [{ branch: params.authResult.branch }, { role: "superadmin" }] }
    : {};

  const [
    items,
    filteredTotal,
    newCount,
    underReviewCount,
    manualReviewCount,
    branchTotal,
    reviewers,
  ] = await Promise.all([
    AssistanceRequest.find(query)
      .select("-nationalIdEncrypted -nationalIdBlindIndex -adminNotes")
      .sort({ statusPriority: 1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AssistanceRequest.countDocuments(query),
    AssistanceRequest.countDocuments({
      ...(Object.keys(branchFilter).length ? branchFilter : {}),
      status: "new",
    }),
    AssistanceRequest.countDocuments({
      ...(Object.keys(branchFilter).length ? branchFilter : {}),
      status: "under_review",
    }),
    AssistanceRequest.countDocuments({
      ...(Object.keys(branchFilter).length ? branchFilter : {}),
      verificationStatus: "manual_review",
    }),
    AssistanceRequest.countDocuments(branchFilter),
    User.find({
      ...reviewerBranchFilter,
      role: { $in: ["admin", "superadmin"] },
    })
      .select("clerkId firstName lastName email role")
      .lean(),
  ]);

  const typedReviewers = reviewers as unknown as LeanReviewerRow[];

  return {
    requests: items,
    pagination: {
      page,
      limit,
      total: filteredTotal,
      totalPages: Math.max(1, Math.ceil(filteredTotal / limit)),
    },
    stats: {
      newCount,
      underReviewCount,
      manualReviewCount,
      totalCount: branchTotal,
    },
    reviewers: typedReviewers.map((u) => ({
      clerkId: u.clerkId,
      name:
        `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
        u.email ||
        "مسؤول",
      role: u.role,
    })),
  };
}

export async function loadSanitizedFamilyContext(beneficiaryId?: unknown) {
  if (!beneficiaryId) return null;

  const ben = (await Beneficiary.findById(beneficiaryId)
    .select(
      "_id internalId name nationalId phone maritalStatus status category familyMembers housingType receivesMonthlyAllowance monthlyAllowanceAmount branchName spouse children relationships"
    )
    .lean()) as unknown as LeanFamilyBenRow | null;

  if (!ben) return null;

  return {
    _id: ben._id.toString(),
    internalId: ben.internalId || undefined,
    name: ben.name,
    nationalIdMasked: maskNationalId(ben.nationalId),
    phone: ben.phone,
    maritalStatus: ben.maritalStatus,
    status: ben.status || "active",
    category: ben.category || "C",
    familyMembers: ben.familyMembers || 1,
    housingType: ben.housingType,
    receivesMonthlyAllowance: Boolean(ben.receivesMonthlyAllowance),
    monthlyAllowanceAmount: ben.monthlyAllowanceAmount,
    branchName: ben.branchName,
    spouse: ben.spouse
      ? {
          name: ben.spouse.name || "غير مسجل",
          nationalIdMasked: maskNationalId(ben.spouse.nationalId),
          hasNationalId: Boolean(ben.spouse.nationalId),
          phone: ben.spouse.phone,
        }
      : null,
    children: Array.isArray(ben.children)
      ? ben.children.map((c, idx) => ({
          subId: c._id ? c._id.toString() : String(idx),
          name: c.name || "",
          gender: c.gender,
          maritalStatus: c.maritalStatus,
          educationStage: c.educationStage,
          nationalIdMasked: maskNationalId(c.nationalId || c.idNumber),
          hasNationalId: Boolean(c.nationalId || c.idNumber),
          spouse: c.spouse
            ? {
                name: c.spouse.name,
                nationalIdMasked: maskNationalId(c.spouse.nationalId),
                hasNationalId: Boolean(c.spouse.nationalId),
              }
            : null,
        }))
      : [],
    relationshipsCount: Array.isArray(ben.relationships)
      ? ben.relationships.length
      : 0,
  };
}

export async function writeAssistanceAuditEvent(params: {
  requestId: string | Types.ObjectId;
  action:
    | "status_changed"
    | "note_added"
    | "national_id_revealed"
    | "manual_verification_resolved"
    | "verification_rerun"
    | "reviewer_assigned";
  actorId: string;
  actorName: string;
  branch?: Types.ObjectId | string | null;
  details?: Record<string, unknown>;
}) {
  return AssistanceAuditLog.create({
    requestId: params.requestId,
    action: params.action,
    actorId: params.actorId,
    actorName: params.actorName,
    branch: params.branch || null,
    details: sanitizeAuditDetails(params.details),
  });
}
