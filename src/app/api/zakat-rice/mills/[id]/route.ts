import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkMill, ZkExpense } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import {
  logZkAudit,
  checkStockAvailability,
  syncMillAutoExpenses,
} from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const mill = await ZkMill.findById(id).lean();
    if (!mill || mill.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "عملية التبييض غير موجودة" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: mill });
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

    const mill = await ZkMill.findById(id);
    if (!mill || mill.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "العملية غير موجودة" } }, { status: 404 });
    }

    if (body.version !== undefined && mill.version !== body.version) {
      return NextResponse.json(
        { ok: false, error: { message: "تم تعديل السجل بواسطة مستخدم آخر، يرجى تحديث الصفحة" } },
        { status: 409 }
      );
    }

    const before = mill.toObject();

    if (body.place) mill.place = body.place.trim();
    if (body.date) mill.date = new Date(body.date);
    if (body.bags !== undefined) mill.bags = Number(body.bags) || 0;
    if (body.rice_kg !== undefined) mill.rice_kg = Number(body.rice_kg) || 0;
    if (body.bran_kg !== undefined) mill.bran_kg = Number(body.bran_kg) || 0;
    if (body.waste_kg !== undefined) mill.waste_kg = Number(body.waste_kg) || 0;
    if (body.other_kg !== undefined) mill.other_kg = Number(body.other_kg) || 0;
    if (body.notes !== undefined) mill.notes = body.notes;
    if (body.season !== undefined) mill.season = body.season;

    if (Array.isArray(body.allocs)) {
      let inKg = 0;
      const cleanAllocs: any[] = [];
      for (const a of body.allocs) {
        const kg = Number(a.kg) || 0;
        if (kg > 0 && a.donor_id) {
          inKg += kg;
          cleanAllocs.push({
            donor_id: a.donor_id,
            donor_name: a.donor_name || "متبرع",
            kg,
          });
        }
      }
      mill.allocs = cleanAllocs as any;
      mill.in_kg = inKg;
    }

    if (body.costs) {
      mill.costs = {
        millCost: Number(body.costs.millCost) || 0,
        loadCost: Number(body.costs.loadCost) || 0,
        transportCost: Number(body.costs.transportCost) || 0,
        unloadCost: Number(body.costs.unloadCost) || 0,
        labor: Number(body.costs.labor) || 0,
        extra: Number(body.costs.extra) || 0,
      };
    }

    mill.version = (mill.version || 1) + 1;
    mill.updatedBy = auth.userId;
    mill.updatedByName = auth.name;

    await mill.save();

    // Re-sync expenses
    await syncMillAutoExpenses(mill, { id: auth.userId, name: auth.name });

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "تعديل",
      entity: "تبييض",
      entity_id: String(mill._id),
      before,
      after: mill.toObject(),
      notes: `تعديل عملية التبييض رقم ${mill.no}`,
    });

    return NextResponse.json({ ok: true, data: mill });
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
    const mill = await ZkMill.findById(id);
    if (!mill || mill.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "العملية غير موجودة" } }, { status: 404 });
    }

    // Check if removing this mill's produced rice would make Rice stock negative
    const stockCheck = await checkStockAvailability("rice", mill.rice_kg, mill.season);
    if (!stockCheck.available) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: `لا يمكن حذف عملية التبييض هذه لأن الأرز الناتج منها (${mill.rice_kg} كجم) تم توزيعه بالفعل على المستفيدين، وحذفها سيجعل رصيد الأرز سالبًا.`,
          },
        },
        { status: 400 }
      );
    }

    const before = mill.toObject();
    mill.deletedAt = new Date();
    mill.deletedBy = auth.userId;
    mill.deletedByName = auth.name;
    await mill.save();

    // Remove or soft-delete linked auto expenses
    await syncMillAutoExpenses(mill, { id: auth.userId, name: auth.name }, true);

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "حذف",
      entity: "تبييض",
      entity_id: String(mill._id),
      before,
      after: mill.toObject(),
      notes: `حذف عملية تبييض رقم ${mill.no} وحذف مصروفاتها التشغيلية التلقائية`,
    });

    return NextResponse.json({ ok: true, message: "تم حذف عملية التبييض بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

