import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkDistribution, ZkBeneficiary } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit, checkStockAvailability } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const distribution = await ZkDistribution.findById(id).lean();
    if (!distribution || distribution.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "إذن التوزيع غير موجود" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: distribution });
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

    const distribution = await ZkDistribution.findById(id);
    if (!distribution || distribution.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "إذن التوزيع غير موجود" } }, { status: 404 });
    }

    if (body.version !== undefined && distribution.version !== body.version) {
      return NextResponse.json(
        { ok: false, error: { message: "تم تعديل السجل بواسطة مستخدم آخر، يرجى تحديث الصفحة" } },
        { status: 409 }
      );
    }

    const before = distribution.toObject();

    if (body.beneficiary_id && body.beneficiary_id !== String(distribution.beneficiary_id)) {
      const ben = await ZkBeneficiary.findById(body.beneficiary_id);
      if (ben) {
        distribution.beneficiary_id = ben._id;
        distribution.beneficiary_name = ben.name;
      }
    }

    if (body.date) distribution.date = new Date(body.date);
    if (body.place !== undefined) distribution.place = body.place.trim();
    if (body.notes !== undefined) distribution.notes = body.notes.trim();
    if (body.season !== undefined) distribution.season = body.season;

    if (body.unit !== undefined) distribution.unit = body.unit;
    if (body.entered_qty !== undefined) distribution.entered_qty = Number(body.entered_qty);
    if (body.bags !== undefined) distribution.bags = Number(body.bags);
    if (body.bag_kg !== undefined) distribution.bag_kg = Number(body.bag_kg);

    // Calculate new quantity_kg
    let newQtyKg = distribution.quantity_kg;
    if (body.quantity_kg !== undefined) {
      newQtyKg = Number(body.quantity_kg);
    } else if (distribution.unit === "شيكارة") {
      newQtyKg = (distribution.bags || 1) * (distribution.bag_kg || 25);
    } else if (distribution.entered_qty) {
      newQtyKg = distribution.entered_qty;
    }

    // Check stock if quantity increased
    if (newQtyKg > distribution.quantity_kg) {
      const stockCheck = await checkStockAvailability(
        "rice",
        newQtyKg,
        distribution.season,
        { id: String(distribution._id), oldKg: distribution.quantity_kg }
      );
      if (!stockCheck.available && !body.override) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              message: `الرصيد المتاح لا يكفي لزيادة الكمية إلى (${newQtyKg} كجم).`,
              availableBalance: stockCheck.currentBalance,
            },
          },
          { status: 409 }
        );
      }
      if (!stockCheck.available && body.override && !auth.isAdmin) {
        return NextResponse.json({ ok: false, error: { message: "تجاوز الرصيد مسموح للمدير فقط" } }, { status: 403 });
      }
      distribution.override = Boolean(!stockCheck.available && body.override);
    }

    distribution.quantity_kg = newQtyKg;
    distribution.version = (distribution.version || 1) + 1;
    distribution.updatedBy = auth.userId;
    distribution.updatedByName = auth.name;

    await distribution.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "تعديل",
      entity: "توزيع",
      entity_id: String(distribution._id),
      before,
      after: distribution.toObject(),
      override: distribution.override,
      notes: `تعديل إذن توزيع رقم ${distribution.no}`,
    });

    return NextResponse.json({ ok: true, data: distribution });
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
    const distribution = await ZkDistribution.findById(id);
    if (!distribution || distribution.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "السجل غير موجود" } }, { status: 404 });
    }

    const before = distribution.toObject();
    distribution.deletedAt = new Date();
    distribution.deletedBy = auth.userId;
    distribution.deletedByName = auth.name;
    await distribution.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "حذف",
      entity: "توزيع",
      entity_id: String(distribution._id),
      before,
      after: distribution.toObject(),
      notes: `حذف إذن توزيع رقم ${distribution.no} للمستفيد ${distribution.beneficiary_name} (${distribution.quantity_kg} كجم أرز)`,
    });

    return NextResponse.json({ ok: true, message: "تم حذف إذن التوزيع بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

