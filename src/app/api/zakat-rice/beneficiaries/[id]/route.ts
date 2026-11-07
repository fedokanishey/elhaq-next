import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkBeneficiary, ZkDistribution } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit } from "@/lib/services/zakat-rice/ledger";
import { normalizeArabicText } from "@/lib/services/zakat-rice/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const beneficiary = await ZkBeneficiary.findById(id).lean();
    if (!beneficiary || beneficiary.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المستفيد غير موجود" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: beneficiary });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getZkAuth();
    if (!auth.canDistribute) {
      return NextResponse.json({ ok: false, error: { message: "غير مصرح لك بالتعديل" } }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const beneficiary = await ZkBeneficiary.findById(id);
    if (!beneficiary || beneficiary.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المستفيد غير موجود" } }, { status: 404 });
    }

    if (body.version !== undefined && beneficiary.version !== body.version) {
      return NextResponse.json(
        { ok: false, error: { message: "تم تعديل السجل بواسطة مستخدم آخر" } },
        { status: 409 }
      );
    }

    const before = beneficiary.toObject();

    if (body.name) {
      beneficiary.name = body.name.trim();
      beneficiary.nameNormalized = normalizeArabicText(body.name);
    }
    if (body.phone !== undefined) beneficiary.phone = body.phone.trim();
    if (body.area !== undefined) beneficiary.area = body.area.trim();
    if (body.family_size !== undefined) beneficiary.family_size = Number(body.family_size) || 1;
    if (body.extra !== undefined) beneficiary.extra = body.extra.trim();
    if (body.notes !== undefined) beneficiary.notes = body.notes.trim();

    beneficiary.version = (beneficiary.version || 1) + 1;
    beneficiary.updatedBy = auth.userId;
    beneficiary.updatedByName = auth.name;

    await beneficiary.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "تعديل",
      entity: "مستفيد",
      entity_id: String(beneficiary._id),
      before,
      after: beneficiary.toObject(),
      notes: `تعديل بيانات المستفيد: ${beneficiary.name}`,
    });

    return NextResponse.json({ ok: true, data: beneficiary });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getZkAuth();
    if (!auth.canDelete) {
      return NextResponse.json({ ok: false, error: { message: "صلاحية الحذف للمدير فقط" } }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const beneficiary = await ZkBeneficiary.findById(id);
    if (!beneficiary || beneficiary.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المستفيد غير موجود" } }, { status: 404 });
    }

    const distCount = await ZkDistribution.countDocuments({ beneficiary_id: beneficiary._id, deletedAt: null });
    if (distCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: `لا يمكن حذف المستفيد لوجود (${distCount}) عمليات توزيع مسجلة باسمه.`,
          },
        },
        { status: 400 }
      );
    }

    const before = beneficiary.toObject();
    beneficiary.deletedAt = new Date();
    beneficiary.deletedBy = auth.userId;
    beneficiary.deletedByName = auth.name;
    await beneficiary.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "حذف",
      entity: "مستفيد",
      entity_id: String(beneficiary._id),
      before,
      after: beneficiary.toObject(),
      notes: `حذف المستفيد: ${beneficiary.name}`,
    });

    return NextResponse.json({ ok: true, message: "تم حذف المستفيد بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

