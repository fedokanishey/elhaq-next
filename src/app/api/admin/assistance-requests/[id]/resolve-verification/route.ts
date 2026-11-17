import { NextResponse } from "next/server";
import { isValidObjectId, type Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import AssistanceRequest, {
  type IAssistanceRequest,
} from "@/lib/models/AssistanceRequest";
import Beneficiary from "@/lib/models/Beneficiary";
import Branch from "@/lib/models/Branch";
import { decryptNationalId } from "@/lib/assistance/crypto";
import { verifyApplicantAgainstDatabase } from "@/lib/assistance/verification";
import {
  requireAdminForRequestDocument,
  writeAssistanceAuditEvent,
} from "@/lib/assistance/admin-queries";
import {
  APPLICANT_RELATIONSHIP_TYPES,
  type ApplicantRelationshipType,
  type MatchedPersonInfo,
  VERIFICATION_STATUSES,
  type VerificationStatus,
  type VerificationWarningCode,
} from "@/lib/assistance/types";

export const dynamic = "force-dynamic";

interface LeanChosenBeneficiary {
  _id: Types.ObjectId;
  name: string;
  internalId?: string;
  status?: string;
  branch?: Types.ObjectId | null;
  branchName?: string;
}

function inferMatchedPersonType(
  relationshipType: ApplicantRelationshipType
): MatchedPersonInfo["personType"] {
  switch (relationshipType) {
    case "primary_beneficiary":
      return "primary";
    case "beneficiary_spouse":
      return "spouse";
    case "beneficiary_child":
      return "child";
    default:
      return "relative";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "معرف الطلب غير صالح" }, { status: 400 });
  }

  try {
    await dbConnect();

    const doc = (await AssistanceRequest.findById(
      id
    ).lean()) as unknown as IAssistanceRequest & { _id: Types.ObjectId } | null;
    if (!doc) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    const authCheck = await requireAdminForRequestDocument(doc.branch);
    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const currentVersion = typeof doc.version === "number" ? doc.version : 1;
    const expectedVersion =
      typeof body.expectedVersion === "number" ? body.expectedVersion : undefined;

    if (
      typeof expectedVersion === "number" &&
      expectedVersion !== currentVersion
    ) {
      return NextResponse.json(
        { error: "تم تعديل هذا الطلب بواسطة مسؤول آخر، يرجى تحديث الصفحة" },
        { status: 409 }
      );
    }

    const actorId = authCheck.authResult.userId || "unknown";
    const actorName = authCheck.actorName;
    const now = new Date();
    const mode = body.mode === "manual" ? "manual" : "rerun";

    if (mode === "rerun") {
      const applicantNationalId = decryptNationalId(doc.nationalIdEncrypted);
      let branchScope: { branchId?: string | null; isZarqaBranch?: boolean } | undefined;
      if (doc.branch) {
        const branchDoc = (await Branch.findById(doc.branch)
          .select("code name")
          .lean()) as { code?: string; name?: string } | null;
        branchScope = {
          branchId: doc.branch.toString(),
          isZarqaBranch:
            branchDoc?.code === "ZARQA" || branchDoc?.name === "الزرقا",
        };
      }
      const evaluation = await verifyApplicantAgainstDatabase(
        applicantNationalId,
        branchScope
      );

      const hasOtherOpenRequest =
        (await AssistanceRequest.countDocuments({
          _id: { $ne: doc._id },
          nationalIdBlindIndex: doc.nationalIdBlindIndex,
          status: { $in: ["new", "under_review"] },
        })) > 0;

      const warnings = [...evaluation.warnings];
      if (hasOtherOpenRequest && !warnings.includes("duplicate_open_request")) {
        warnings.push("duplicate_open_request");
      }

      const updated = await AssistanceRequest.findOneAndUpdate(
        { _id: id, version: currentVersion },
        {
          $set: {
            verificationStatus: evaluation.verificationStatus,
            relationshipType: evaluation.relationshipType,
            beneficiary: evaluation.beneficiaryId,
            beneficiarySnapshot: evaluation.beneficiarySnapshot,
            matchedPerson: evaluation.matchedPerson,
            verificationWarnings: warnings,
            candidateMatches: evaluation.candidateMatches,
            verifiedAt: now,
            manualResolution: null,
          },
          $inc: { version: 1 },
        },
        { new: true }
      )
        .select("-nationalIdEncrypted -nationalIdBlindIndex")
        .lean();

      if (!updated) {
        return NextResponse.json(
          { error: "تم تعديل هذا الطلب بواسطة مسؤول آخر، يرجى تحديث الصفحة" },
          { status: 409 }
        );
      }

      await writeAssistanceAuditEvent({
        requestId: id,
        action: "verification_rerun",
        actorId,
        actorName,
        branch: doc.branch,
        details: {
          verificationStatus: evaluation.verificationStatus,
          relationshipType: evaluation.relationshipType,
          warningsCount: warnings.length,
        },
      });

      return NextResponse.json({ request: updated });
    }

    // Manual verification resolution
    const chosenVerificationStatus = body.chosenVerificationStatus as VerificationStatus;
    const chosenRelationshipType = body.chosenRelationshipType as ApplicantRelationshipType;
    const chosenBeneficiaryId =
      typeof body.chosenBeneficiaryId === "string" &&
      body.chosenBeneficiaryId.trim()
        ? body.chosenBeneficiaryId.trim()
        : null;
    const matchedPersonName =
      typeof body.matchedPersonName === "string"
        ? body.matchedPersonName.trim()
        : "";
    const decisionNote =
      typeof body.decisionNote === "string" ? body.decisionNote.trim() : "";

    if (
      !VERIFICATION_STATUSES.includes(chosenVerificationStatus) ||
      chosenVerificationStatus === "manual_review"
    ) {
      return NextResponse.json(
        { error: "نتيجة التحقق المختارة غير صالحة" },
        { status: 400 }
      );
    }

    if (!APPLICANT_RELATIONSHIP_TYPES.includes(chosenRelationshipType)) {
      return NextResponse.json(
        { error: "صلة القرابة المختارة غير صالحة" },
        { status: 400 }
      );
    }

    if (decisionNote.length < 3) {
      return NextResponse.json(
        { error: "يرجى إدخال سبب أو ملاحظة القرار اليدوي" },
        { status: 400 }
      );
    }

    let beneficiarySnapshot = null;
    let matchedPerson: MatchedPersonInfo | null = null;
    let resolvedBeneficiaryId: string | null = null;

    if (chosenVerificationStatus !== "not_matched") {
      if (!chosenBeneficiaryId || !isValidObjectId(chosenBeneficiaryId)) {
        return NextResponse.json(
          { error: "يجب تحديد ملف المستفيد الأساسي عند اختيار وجود تطابق" },
          { status: 400 }
        );
      }

      const chosenBen = (await Beneficiary.findById(chosenBeneficiaryId)
        .select("_id name internalId status branch branchName")
        .lean()) as unknown as LeanChosenBeneficiary | null;

      if (!chosenBen) {
        return NextResponse.json(
          { error: "ملف المستفيد المحدد غير موجود" },
          { status: 404 }
        );
      }

      if (
        doc.branch &&
        chosenBen.branch &&
        chosenBen.branch.toString() !== doc.branch.toString()
      ) {
        return NextResponse.json(
          { error: "لا يمكن ربط الطلب بمستفيد من فرع مختلف عن فرع الطلب" },
          { status: 400 }
        );
      }

      if (
        !authCheck.authResult.isSuperAdmin &&
        chosenBen.branch &&
        authCheck.authResult.branch &&
        chosenBen.branch.toString() !== authCheck.authResult.branch.toString()
      ) {
        return NextResponse.json(
          { error: "ممنوع ربط الطلب بمستفيد من فرع آخر" },
          { status: 403 }
        );
      }

      resolvedBeneficiaryId = chosenBen._id.toString();
      beneficiarySnapshot = {
        name: chosenBen.name,
        internalId: chosenBen.internalId,
        status: chosenBen.status,
        branchId: chosenBen.branch ? chosenBen.branch.toString() : undefined,
        branchName: chosenBen.branchName,
      };
      matchedPerson = {
        name: matchedPersonName || chosenBen.name,
        personType: inferMatchedPersonType(chosenRelationshipType),
        specificRelation: chosenRelationshipType,
      };
    }

    const clearedWarnings: VerificationWarningCode[] = Array.isArray(
      doc.verificationWarnings
    )
      ? doc.verificationWarnings.filter(
          (w: VerificationWarningCode) =>
            w !== "multiple_possible_matches" &&
            w !== "duplicate_national_id" &&
            w !== "conflicting_relationship_types" &&
            w !== "verification_source_unavailable"
        )
      : [];

    const updated = await AssistanceRequest.findOneAndUpdate(
      { _id: id, version: currentVersion },
      {
        $set: {
          verificationStatus: chosenVerificationStatus,
          relationshipType:
            chosenVerificationStatus === "not_matched"
              ? "unknown"
              : chosenRelationshipType,
          beneficiary: resolvedBeneficiaryId,
          beneficiarySnapshot,
          matchedPerson,
          verificationWarnings: clearedWarnings,
          verifiedAt: now,
          manualResolution: {
            resolvedBy: actorId,
            resolvedByName: actorName,
            resolvedAt: now,
            decisionNote,
            chosenBeneficiaryId: resolvedBeneficiaryId,
            chosenVerificationStatus,
            chosenRelationshipType:
              chosenVerificationStatus === "not_matched"
                ? "unknown"
                : chosenRelationshipType,
          },
        },
        $inc: { version: 1 },
      },
      { new: true }
    )
      .select("-nationalIdEncrypted -nationalIdBlindIndex")
      .lean();

    if (!updated) {
      return NextResponse.json(
        { error: "تم تعديل هذا الطلب بواسطة مسؤول آخر، يرجى تحديث الصفحة" },
        { status: 409 }
      );
    }

    await writeAssistanceAuditEvent({
      requestId: id,
      action: "manual_verification_resolved",
      actorId,
      actorName,
      branch: doc.branch,
      details: {
        chosenVerificationStatus,
        chosenRelationshipType,
        chosenBeneficiaryId: resolvedBeneficiaryId,
        decisionNote,
      },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error("Error resolving verification:", error);
    return NextResponse.json(
      { error: "تعذر تحديث نتيجة التحقق" },
      { status: 500 }
    );
  }
}
