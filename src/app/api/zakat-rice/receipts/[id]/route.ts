import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkReceipt, ZkDonor } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const receipt = await ZkReceipt.findById(id).lean();
    if (!receipt || receipt.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "سجل الاستلام غير موجود" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: receipt });
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

    const receipt = await ZkReceipt.findById(id);
    if (!receipt || receipt.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "سجل الاستلام غير موجود" } }, { status: 404 });
    }

    // Optimistic locking
    if (body.version !== undefined && receipt.version !== body.version) {
      return NextResponse.json(
        { ok: false, error: { message: "السجل تغير من مستخدم آخر، يرجى تحديث الصفحة" } },
        { status: 409 }
      );
    }

    const before = receipt.toObject();

    if (body.operation_type !== undefined) receipt.operation_type = body.operation_type;

    if (body.donor_id !== undefined) {
      if (body.donor_id) {
        const donor = await ZkDonor.findById(body.donor_id);
        if (donor) {
          receipt.donor_id = donor._id;
          receipt.donor_name = donor.name;
        }
      } else {
        receipt.donor_id = null;
      }
    }
    if (body.donor_name !== undefined) receipt.donor_name = body.donor_name;
    if (body.date) receipt.date = new Date(body.date);
    if (body.item) receipt.item = body.item;
    if (body.item_name !== undefined) receipt.item_name = body.item_name;
    if (body.bags !== undefined) receipt.bags = Number(body.bags) || 0;
    if (body.bag_kg !== undefined) receipt.bag_kg = Number(body.bag_kg) || 0;
    if (body.quantity !== undefined) receipt.quantity = Number(body.quantity) || 0;
    if (body.unit !== undefined) receipt.unit = body.unit;
    if (body.amount !== undefined) receipt.amount = Number(body.amount) || 0;
    if (body.purpose !== undefined) receipt.purpose = body.purpose;
    if (body.payment_method !== undefined) receipt.payment_method = body.payment_method;
    if (body.store_label !== undefined) receipt.store_label = body.store_label;
    if (body.notes !== undefined) receipt.notes = body.notes;
    if (body.season !== undefined) receipt.season = body.season;

    receipt.version = (receipt.version || 1) + 1;
    receipt.updatedBy = auth.userId;
    receipt.updatedByName = auth.name;

    await receipt.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "تعديل",
      entity: "استلام",
      entity_id: String(receipt._id),
      before,
      after: receipt.toObject(),
      notes: `تعديل استلام رقم ${receipt.no}`,
    });

    return NextResponse.json({ ok: true, data: receipt });
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
    const receipt = await ZkReceipt.findById(id);
    if (!receipt || receipt.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "السجل غير موجود" } }, { status: 404 });
    }

    const before = receipt.toObject();
    receipt.deletedAt = new Date();
    receipt.deletedBy = auth.userId;
    receipt.deletedByName = auth.name;
    await receipt.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "حذف",
      entity: "استلام",
      entity_id: String(receipt._id),
      before,
      after: receipt.toObject(),
      notes: `حذف استلام رقم ${receipt.no} للمتبرع ${receipt.donor_name}`,
    });

    return NextResponse.json({ ok: true, message: "تم حذف الاستلام بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

