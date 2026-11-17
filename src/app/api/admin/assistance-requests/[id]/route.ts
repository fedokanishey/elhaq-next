import { NextResponse } from "next/server";
import { isValidObjectId, type Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import AssistanceRequest, {
  type IAssistanceRequest,
} from "@/lib/models/AssistanceRequest";
import AssistanceAuditLog from "@/lib/models/AssistanceAuditLog";
import User from "@/lib/models/User";
import { decryptNationalId } from "@/lib/assistance/crypto";
import { loadAssistanceHistoryForRequest } from "@/lib/assistance/history";
import {
  loadSanitizedFamilyContext,
  requireAdminForRequestDocument,
  requireReadAccessForRequestDocument,
  writeAssistanceAuditEvent,
} from "@/lib/assistance/admin-queries";
import { applyStatusTransition } from "@/lib/assistance/workflow";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/assistance/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LeanAssistanceRequest = Omit<IAssistanceRequest, keyof Document> & {
  _id: Types.ObjectId;
};

interface LeanReviewer {
  clerkId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
}

export async function GET(
  _request: Request,
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
    ).lean()) as unknown as LeanAssistanceRequest | null;
    if (!doc) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    const authCheck = await requireReadAccessForRequestDocument(doc.branch);
    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    // Decrypt applicant National ID in server memory strictly for accurate individual vs. family history matching.
    // Never serialize plaintext back in this response payload.
    let decryptedNationalIdForHistory: string | null = null;
    try {
      decryptedNationalIdForHistory = decryptNationalId(doc.nationalIdEncrypted);
    } catch {
      decryptedNationalIdForHistory = null;
    }

    const reviewerFilter = doc.branch
      ? { $or: [{ branch: doc.branch }, { role: "superadmin" }] }
      : {};

    const [familyContext, assistanceHistory, auditLogs, reviewers] =
      await Promise.all([
        loadSanitizedFamilyContext(doc.beneficiary),
        loadAssistanceHistoryForRequest({
          relationshipType: doc.relationshipType,
          applicantNationalId: decryptedNationalIdForHistory,
          applicantBlindIndex: doc.nationalIdBlindIndex,
          currentRequestId: doc._id.toString(),
          primaryBeneficiaryId: doc.beneficiary ? doc.beneficiary.toString() : null,
        }),
        AssistanceAuditLog.find({ requestId: doc._id })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean(),
        User.find({
          ...reviewerFilter,
          role: { $in: ["admin", "superadmin"] },
        })
          .select("clerkId firstName lastName email role")
          .lean(),
      ]);

    // Explicitly strip encrypted/blind-index fields before sending to admin UI
    const {
      nationalIdEncrypted: _omitEncrypted,
      nationalIdBlindIndex: _omitBlindIndex,
      ...safeRequest
    } = doc;
    void _omitEncrypted;
    void _omitBlindIndex;

    const typedReviewers = reviewers as unknown as LeanReviewer[];

    const res = NextResponse.json({
      request: {
        ...safeRequest,
        branch: doc.branch ? doc.branch.toString() : null,
      },
      familyContext,
      assistanceHistory,
      auditLogs,
      reviewers: typedReviewers.map((u) => ({
        clerkId: u.clerkId,
        name:
          `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
          u.email ||
          "مسؤول",
        role: u.role,
      })),
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    console.error("Error loading assistance request detail:", error);
    return NextResponse.json(
      { error: "تعذر تحميل تفاصيل طلب المساعدة" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    ).lean()) as unknown as LeanAssistanceRequest | null;
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

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "صيغة التحديث غير صالحة" },
        { status: 400 }
      );
    }

    const expectedVersion =
      typeof body.expectedVersion === "number" ? body.expectedVersion : undefined;
    const currentVersion = typeof doc.version === "number" ? doc.version : 1;

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

    const setUpdates: Record<string, unknown> = {};
    const pushUpdates: Record<string, unknown> = {};
    const auditEvents: Array<{
      action: "status_changed" | "note_added" | "reviewer_assigned";
      details?: Record<string, unknown>;
    }> = [];

    // 1. Optional status change
    if (typeof body.status === "string" && body.status !== doc.status) {
      if (!REQUEST_STATUSES.includes(body.status as RequestStatus)) {
        return NextResponse.json(
          { error: "حالة الطلب المطلوبة غير صالحة" },
          { status: 400 }
        );
      }

      const statusNote =
        typeof body.statusNote === "string" ? body.statusNote.trim() : undefined;

      const transition = applyStatusTransition(
        {
          status: doc.status,
          statusPriority: doc.statusPriority || 1,
          version: currentVersion,
          statusHistory: Array.isArray(doc.statusHistory) ? doc.statusHistory : [],
        },
        {
          newStatus: body.status as RequestStatus,
          actorId,
          actorName,
          note: statusNote,
          expectedVersion,
          now,
        }
      );

      if (!transition.ok) {
        return NextResponse.json(
          { error: transition.error },
          { status: transition.status }
        );
      }

      setUpdates.status = transition.nextStatus;
      setUpdates.statusPriority = transition.nextStatusPriority;
      setUpdates.reviewedBy = actorId;
      setUpdates.reviewedByName = actorName;
      setUpdates.reviewedAt = now;
      pushUpdates.statusHistory = transition.historyEntry;

      auditEvents.push({
        action: "status_changed",
        details: {
          previousStatus: doc.status,
          newStatus: transition.nextStatus,
          note: statusNote || undefined,
        },
      });
    }

    // 2. Optional reviewer assignment change
    if ("assignedReviewerId" in body) {
      const nextReviewerId =
        typeof body.assignedReviewerId === "string" &&
        body.assignedReviewerId.trim()
          ? body.assignedReviewerId.trim()
          : null;
      const nextReviewerName =
        nextReviewerId && typeof body.assignedReviewerName === "string"
          ? body.assignedReviewerName.trim() || null
          : null;

      if (nextReviewerId !== (doc.assignedReviewerId || null)) {
        setUpdates.assignedReviewerId = nextReviewerId;
        setUpdates.assignedReviewerName = nextReviewerName;
        auditEvents.push({
          action: "reviewer_assigned",
          details: {
            previousReviewerName: doc.assignedReviewerName || null,
            newReviewerName: nextReviewerName,
          },
        });
      }
    }

    // 3. Optional internal note creation
    if (typeof body.newNote === "string" && body.newNote.trim()) {
      const content = body.newNote.trim();
      if (content.length > 2000) {
        return NextResponse.json(
          { error: "الملاحظة الداخلية طويلة جداً (الحد الأقصى 2000 حرف)" },
          { status: 400 }
        );
      }
      pushUpdates.adminNotes = {
        content,
        authorId: actorId,
        authorName: actorName,
        createdAt: now,
      };
      auditEvents.push({
        action: "note_added",
        details: {
          noteLength: content.length,
        },
      });
    }

    if (
      Object.keys(setUpdates).length === 0 &&
      Object.keys(pushUpdates).length === 0
    ) {
      return NextResponse.json(
        { error: "لم يتم إرسال أي تغييرات صالحة للتحديث" },
        { status: 400 }
      );
    }

    const updateQuery: Record<string, unknown> = {
      $inc: { version: 1 },
    };
    if (Object.keys(setUpdates).length > 0) {
      updateQuery.$set = setUpdates;
    }
    if (Object.keys(pushUpdates).length > 0) {
      updateQuery.$push = pushUpdates;
    }

    const updated = await AssistanceRequest.findOneAndUpdate(
      { _id: id, version: currentVersion },
      updateQuery,
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

    await Promise.all(
      auditEvents.map((ev) =>
        writeAssistanceAuditEvent({
          requestId: id,
          action: ev.action,
          actorId,
          actorName,
          branch: doc.branch,
          details: ev.details,
        })
      )
    );

    const res = NextResponse.json({ request: updated });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    console.error("Error updating assistance request:", error);
    return NextResponse.json(
      { error: "تعذر تحديث طلب المساعدة" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
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
    ).lean()) as unknown as LeanAssistanceRequest | null;
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

    await Promise.all([
      AssistanceRequest.deleteOne({ _id: id }),
      AssistanceAuditLog.deleteMany({ requestId: id }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "تم حذف طلب المساعدة نهائياً",
    });
  } catch (error) {
    console.error("Error deleting assistance request:", error);
    return NextResponse.json(
      { error: "تعذر حذف طلب المساعدة" },
      { status: 500 }
    );
  }
}
