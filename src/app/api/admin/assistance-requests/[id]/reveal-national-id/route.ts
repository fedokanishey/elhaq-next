import { NextResponse } from "next/server";
import { isValidObjectId, type Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import AssistanceRequest, {
  type IAssistanceRequest,
} from "@/lib/models/AssistanceRequest";
import Beneficiary from "@/lib/models/Beneficiary";
import { decryptNationalId } from "@/lib/assistance/crypto";
import {
  requireReadAccessForRequestDocument,
  writeAssistanceAuditEvent,
} from "@/lib/assistance/admin-queries";

export const dynamic = "force-dynamic";

type RevealTarget = "applicant" | "matched_person" | "primary_beneficiary";

interface LeanBeneficiaryReveal {
  nationalId?: string;
  spouse?: {
    nationalId?: string;
  };
  children?: Array<{
    _id?: Types.ObjectId | string;
    nationalId?: string;
    idNumber?: string;
    spouse?: {
      nationalId?: string;
    };
  }>;
  relationships?: Array<{
    relativeNationalId?: string;
  }>;
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

    const authCheck = await requireReadAccessForRequestDocument(doc.branch);
    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      target?: string;
    };
    const target = (body.target || "applicant") as RevealTarget;
    if (
      target !== "applicant" &&
      target !== "matched_person" &&
      target !== "primary_beneficiary"
    ) {
      return NextResponse.json(
        { error: "الهدف المطلوب غير صالح" },
        { status: 400 }
      );
    }

    let revealedNationalId: string | null = null;

    if (target === "applicant") {
      revealedNationalId = decryptNationalId(doc.nationalIdEncrypted);
    } else {
      if (!doc.beneficiary) {
        return NextResponse.json(
          { error: "لا يوجد مستفيد مرتبط لعرض رقمه القومي" },
          { status: 404 }
        );
      }

      const ben = (await Beneficiary.findById(doc.beneficiary)
        .select("nationalId spouse children relationships")
        .lean()) as unknown as LeanBeneficiaryReveal | null;
      if (!ben) {
        return NextResponse.json(
          { error: "ملف المستفيد المرتبط غير موجود" },
          { status: 404 }
        );
      }

      if (target === "primary_beneficiary") {
        revealedNationalId = ben.nationalId || null;
      } else if (target === "matched_person") {
        const mp = doc.matchedPerson;
        if (!mp) {
          revealedNationalId = decryptNationalId(doc.nationalIdEncrypted);
        } else if (mp.personType === "primary") {
          revealedNationalId = ben.nationalId || null;
        } else if (mp.personType === "spouse") {
          revealedNationalId = ben.spouse?.nationalId || null;
        } else if (mp.personType === "child" && Array.isArray(ben.children)) {
          const childMatch =
            ben.children.find(
              (c, idx) =>
                c._id?.toString() === mp.subId || String(idx) === mp.subId
            ) || null;
          revealedNationalId =
            childMatch?.nationalId || childMatch?.idNumber || null;
        } else if (
          mp.personType === "child_spouse" &&
          Array.isArray(ben.children)
        ) {
          const childMatch =
            ben.children.find(
              (c, idx) =>
                c._id?.toString() === mp.subId || String(idx) === mp.subId
            ) || null;
          revealedNationalId = childMatch?.spouse?.nationalId || null;
        } else if (
          mp.personType === "relative" &&
          Array.isArray(ben.relationships)
        ) {
          const relIdx = Number(mp.subId);
          revealedNationalId =
            !Number.isNaN(relIdx) && ben.relationships[relIdx]
              ? ben.relationships[relIdx].relativeNationalId || null
              : null;
        }
      }
    }

    if (!revealedNationalId) {
      return NextResponse.json(
        { error: "الرقم القومي غير مسجل لهذا الشخص" },
        { status: 404 }
      );
    }

    // Security audit log: NEVER write plaintext National ID into audit details
    await writeAssistanceAuditEvent({
      requestId: doc._id,
      action: "national_id_revealed",
      actorId: authCheck.authResult.userId || "unknown",
      actorName: authCheck.actorName,
      branch: doc.branch,
      details: { target },
    });

    const res = NextResponse.json({ nationalId: revealedNationalId });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch {
    console.error("Error revealing National ID (no PII logged)");
    return NextResponse.json(
      { error: "تعذر كشف الرقم القومي" },
      { status: 500 }
    );
  }
}
