import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkDonor, ZkReceipt } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit } from "@/lib/services/zakat-rice/ledger";
import { normalizeArabicText } from "@/lib/services/zakat-rice/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const donor = await ZkDonor.findById(id).lean();
    if (!donor || donor.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المتبرع غير موجود" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: donor });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getZkAuth();
    if (!auth.canStore) {
      return NextResponse.json({ ok: false, error: { message: "غير مصرح لك بالتعديل" } }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const donor = await ZkDonor.findById(id);
    if (!donor || donor.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المتبرع غير موجود" } }, { status: 404 });
    }

    // Optimistic lock check
    if (body.version !== undefined && donor.version !== body.version) {
      return NextResponse.json(
        { ok: false, error: { message: "تم تعديل هذا السجل بواسطة مستخدم آخر، يرجى تحديث الصفحة" } },
        { status: 409 }
      );
    }

    const before = donor.toObject();

    if (body.name) {
      donor.name = body.name.trim();
      donor.nameNormalized = normalizeArabicText(body.name);
    }
    if (body.phone !== undefined) donor.phone = body.phone.trim();
    if (body.land_description !== undefined) donor.land_description = body.land_description.trim();
    if (body.notes !== undefined) donor.notes = body.notes.trim();
    if (body.season !== undefined) donor.season = body.season;

    donor.version = (donor.version || 1) + 1;
    donor.updatedBy = auth.userId;
    donor.updatedByName = auth.name;

    await donor.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "تعديل",
      entity: "متبرع",
      entity_id: String(donor._id),
      before,
      after: donor.toObject(),
      notes: `تعديل بيانات المتبرع: ${donor.name}`,
    });

    return NextResponse.json({ ok: true, data: donor });
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
    const donor = await ZkDonor.findById(id);
    if (!donor || donor.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المتبرع غير موجود" } }, { status: 404 });
    }

    // Check if donor has active receipts
    const receiptsCount = await ZkReceipt.countDocuments({ donor_id: donor._id, deletedAt: null });
    if (receiptsCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: `لا يمكن حذف المتبرع لوجود (${receiptsCount}) عمليات استلام مسجلة باسمه. احذف عمليات الاستلام أولاً.`,
          },
        },
        { status: 400 }
      );
    }

    const before = donor.toObject();
    donor.deletedAt = new Date();
    donor.deletedBy = auth.userId;
    donor.deletedByName = auth.name;
    await donor.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "حذف",
      entity: "متبرع",
      entity_id: String(donor._id),
      before,
      after: donor.toObject(),
      notes: `حذف المتبرع (حذف ناعم): ${donor.name}`,
    });

    return NextResponse.json({ ok: true, message: "تم حذف المتبرع بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

