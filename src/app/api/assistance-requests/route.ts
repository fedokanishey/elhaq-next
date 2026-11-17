import { NextResponse } from "next/server";
import { isValidObjectId, type Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Branch from "@/lib/models/Branch";
import User from "@/lib/models/User";
import AssistanceRequest from "@/lib/models/AssistanceRequest";
import {
  ASSISTANCE_CATEGORIES,
  ASSISTANCE_CATEGORY_LABELS,
  type AssistanceCategory,
  type RequestStatus,
} from "@/lib/assistance/types";
import {
  ValidationError,
  validateAssistanceSubmission,
} from "@/lib/assistance/validation";
import {
  computeNationalIdBlindIndex,
  encryptNationalId,
  maskNationalId,
} from "@/lib/assistance/crypto";
import { verifyApplicantAgainstDatabase } from "@/lib/assistance/verification";
import {
  requireAssistanceRegularUser,
  sanitizePublicSubmissionResponse,
} from "@/lib/assistance/auth";
import {
  checkDuplicateSubmissionWindow,
  computeStatusPriority,
} from "@/lib/assistance/workflow";

export const dynamic = "force-dynamic";

const MIN_RESPONSE_MS = 250;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;

const ipSubmissions = new Map<string, number[]>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipSubmissions.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    ipSubmissions.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  ipSubmissions.set(ip, timestamps);

  // Opportunistic cleanup so memory stays bounded
  if (ipSubmissions.size > 500) {
    for (const [key, list] of ipSubmissions.entries()) {
      const fresh = list.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (fresh.length === 0) ipSubmissions.delete(key);
    }
  }
  return false;
}

async function padResponseTiming(startTimeMs: number) {
  const elapsed = Date.now() - startTimeMs;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
  }
}

/**
 * Regular-user-only metadata endpoint for the assistance request questionnaire (`role === "user"`).
 * Never returns any submitted assistance requests or verification data.
 */
export async function GET() {
  const userCheck = await requireAssistanceRegularUser();
  if (!userCheck.ok) {
    return NextResponse.json(
      { error: userCheck.error },
      { status: userCheck.status }
    );
  }

  try {
    await dbConnect();
    const branches = (await Branch.find({ isActive: true })
      .sort({ name: 1 })
      .select("_id name code")
      .lean()) as unknown as Array<{ _id: Types.ObjectId; name: string; code: string }>;

    const profileBranchIdStr = userCheck.authResult.branch
      ? userCheck.authResult.branch.toString()
      : null;
    const matchedProfileBranch = profileBranchIdStr
      ? branches.find((b) => b._id.toString() === profileBranchIdStr) || null
      : null;

    return NextResponse.json({
      branches: branches.map((b) => ({
        _id: b._id.toString(),
        name: b.name,
        code: b.code,
      })),
      userBranchId: matchedProfileBranch
        ? matchedProfileBranch._id.toString()
        : null,
      userBranchName: matchedProfileBranch ? matchedProfileBranch.name : null,
      categories: ASSISTANCE_CATEGORIES.map((value) => ({
        value,
        label: ASSISTANCE_CATEGORY_LABELS[value],
      })),
    });
  } catch (error) {
    console.error("Failed to load assistance questionnaire metadata:", error);
    return NextResponse.json(
      { error: "تعذر تحميل بيانات النموذج حالياً" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const userCheck = await requireAssistanceRegularUser();
    if (!userCheck.ok) {
      await padResponseTiming(startTime);
      return NextResponse.json(
        { error: userCheck.error },
        { status: userCheck.status }
      );
    }

    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      await padResponseTiming(startTime);
      return NextResponse.json(
        { error: "تم إرسال عدة طلبات خلال وقت قصير، يرجى المحاولة لاحقاً" },
        { status: 429 }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      await padResponseTiming(startTime);
      return NextResponse.json(
        { error: "صيغة البيانات المرسلة غير صالحة" },
        { status: 400 }
      );
    }

    const valid = validateAssistanceSubmission(rawBody);

    await dbConnect();

    // Resolve target branch strictly BEFORE duplicate/verification checks so each branch stays isolated
    const requestedBranchId =
      valid.branchId ||
      (userCheck.authResult.branch ? userCheck.authResult.branch.toString() : null);

    if (!requestedBranchId || !isValidObjectId(requestedBranchId)) {
      await padResponseTiming(startTime);
      return NextResponse.json(
        {
          error:
            "يرجى تحديد الفرع التابع له أولاً من الملف الشخصي أو من النموذج",
          field: "branchId",
        },
        { status: 400 }
      );
    }

    const selectedBranch = (await Branch.findOne({
      _id: requestedBranchId,
      isActive: true,
    })
      .select("_id name code")
      .lean()) as { _id: Types.ObjectId; name: string; code: string } | null;

    if (!selectedBranch) {
      await padResponseTiming(startTime);
      return NextResponse.json(
        { error: "الفرع المحدد غير متاح حالياً", field: "branchId" },
        { status: 400 }
      );
    }

    const branchId = selectedBranch._id.toString();
    const branchName = selectedBranch.name;
    const isZarqaBranch =
      selectedBranch.code === "ZARQA" || selectedBranch.name === "الزرقا";

    // Persist chosen branch to user's profile when unset or explicitly changed
    if (
      userCheck.authResult.userId &&
      (!userCheck.authResult.branch ||
        userCheck.authResult.branch.toString() !== branchId)
    ) {
      await User.updateOne(
        { clerkId: userCheck.authResult.userId },
        { $set: { branch: selectedBranch._id, branchName } }
      );
    }

    const nationalIdEncrypted = encryptNationalId(valid.nationalId);
    const nationalIdBlindIndex = computeNationalIdBlindIndex(valid.nationalId);
    const nationalIdMasked = maskNationalId(valid.nationalId);

    // Check recent requests with same blind index for idempotency & open-request warning
    const recentSameApplicant = (await AssistanceRequest.find({
      nationalIdBlindIndex,
      $or: [
        { createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } },
        { status: { $in: ["new", "under_review"] } },
      ],
    })
      .select("_id assistanceCategory description status createdAt")
      .lean()) as unknown as Array<{
      _id: Types.ObjectId;
      assistanceCategory: AssistanceCategory | string;
      description: string;
      status: RequestStatus;
      createdAt: Date;
    }>;

    const dupCheck = checkDuplicateSubmissionWindow(
      recentSameApplicant,
      {
        assistanceCategory: valid.assistanceCategory,
        description: valid.description,
      }
    );

    if (dupCheck.isIdempotentDuplicate) {
      await padResponseTiming(startTime);
      return NextResponse.json(sanitizePublicSubmissionResponse(new Date()), {
        status: 201,
      });
    }

    // Run server-side beneficiary verification scoped strictly to the target branch
    const verification = await verifyApplicantAgainstDatabase(valid.nationalId, {
      branchId,
      isZarqaBranch,
    });
    const warnings = [...verification.warnings];
    if (
      dupCheck.hasOpenOtherRequest &&
      !warnings.includes("duplicate_open_request")
    ) {
      warnings.push("duplicate_open_request");
    }

    const submittedByClerkId = userCheck.authResult.userId;

    const now = new Date();
    const initialStatus = "new" as const;

    const created = await AssistanceRequest.create({
      fullName: valid.fullName,
      nationalIdEncrypted,
      nationalIdBlindIndex,
      nationalIdMasked,
      phone: valid.phone,
      whatsapp: valid.whatsapp,
      address: valid.address,
      familyMembersCount: valid.familyMembersCount,
      maritalStatus: valid.maritalStatus,
      monthlyIncome: valid.monthlyIncome,
      assistanceCategory: valid.assistanceCategory,
      description: valid.description,
      attachments: valid.attachments,
      submittedByClerkId,

      verificationStatus: verification.verificationStatus,
      relationshipType: verification.relationshipType,
      beneficiary: verification.beneficiaryId,
      beneficiarySnapshot: verification.beneficiarySnapshot,
      matchedPerson: verification.matchedPerson,
      verificationWarnings: warnings,
      candidateMatches: verification.candidateMatches,
      verifiedAt: now,

      status: initialStatus,
      statusPriority: computeStatusPriority(initialStatus),
      statusHistory: [
        {
          previousStatus: null,
          newStatus: initialStatus,
          changedBy: submittedByClerkId || "public",
          changedByName: "تقديم إلكتروني",
          changedAt: now,
        },
      ],
      branch: branchId,
      branchName,
      version: 1,
    });

    await padResponseTiming(startTime);
    return NextResponse.json(
      sanitizePublicSubmissionResponse(created.createdAt || now),
      { status: 201 }
    );
  } catch (error) {
    await padResponseTiming(startTime);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 400 }
      );
    }

    console.error("Failed to submit assistance request (no PII logged)");
    return NextResponse.json(
      { error: "حدث خطأ غير متوقع أثناء إرسال الطلب، يرجى المحاولة مرة أخرى" },
      { status: 500 }
    );
  }
}
