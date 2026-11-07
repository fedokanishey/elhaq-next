import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkDistribution, ZkBeneficiary } from "@/lib/models/zakat-rice";
import Beneficiary from "@/lib/models/Beneficiary";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import {
  getNextSerial,
  logZkAudit,
  getZkSettings,
  checkStockAvailability,
} from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    if (searchParams.get("nextNo") === "true") {
      const nextNo = await getNextSerial(ZkDistribution);
      return NextResponse.json({ ok: true, data: { nextNo } });
    }

    const q = searchParams.get("q")?.trim() || "";
    const season = searchParams.get("season") || "";
    const beneficiaryId = searchParams.get("beneficiaryId") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const query: any = { deletedAt: null };
    if (season && season !== "all") query.season = season;
    if (beneficiaryId) query.beneficiary_id = beneficiaryId;

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (q) {
      query.$or = [
        { no: { $regex: q, $options: "i" } },
        { beneficiary_name: { $regex: q, $options: "i" } },
        { place: { $regex: q, $options: "i" } },
        { notes: { $regex: q, $options: "i" } },
      ];
    }

    const total = await ZkDistribution.countDocuments(query);
    const distributions = await ZkDistribution.find(query)
      .sort({ date: -1, no: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      data: distributions,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل جلب التوزيعات" } },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.canDistribute) {
      return NextResponse.json(
        { ok: false, error: { message: "غير مصرح لك بتسجيل توزيعات" } },
        { status: 403 }
      );
    }

    await dbConnect();
    const body = await req.json();

    if (!body.beneficiary_id) {
      return NextResponse.json({ ok: false, error: { message: "يجب تحديد المستفيد" } }, { status: 400 });
    }

    let beneficiary = await ZkBeneficiary.findById(body.beneficiary_id);
    if (!beneficiary) {
      const mainB = await Beneficiary.findById(body.beneficiary_id).lean();
      if (mainB) {
        beneficiary = {
          _id: mainB._id,
          name: mainB.name,
          phone: mainB.phone,
          area: mainB.address,
          family_size: mainB.familyMembers || 1,
        } as any;
      }
    }

    if (!beneficiary || (beneficiary as any).deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المستفيد غير موجود" } }, { status: 404 });
    }

    // Idempotency
    if (body.clientId) {
      const existing = await ZkDistribution.findOne({ clientId: body.clientId, deletedAt: null });
      if (existing) {
        return NextResponse.json({ ok: true, data: existing, message: "تم الاسترجاع (طلب مكرر)" });
      }
    }

    const settings = await getZkSettings();
    const season = body.season || settings.season;
    const unit = body.unit === "شيكارة" ? "شيكارة" : "كجم";

    const enteredQty = Number(body.entered_qty) || 0;
    const bags = unit === "شيكارة" ? (Number(body.bags) || Number(body.entered_qty) || 1) : 0;
    const bagKg = unit === "شيكارة" ? (Number(body.bag_kg) || 25) : 0;

    const quantityKg = unit === "شيكارة" ? bags * bagKg : enteredQty;

    if (quantityKg <= 0) {
      return NextResponse.json({ ok: false, error: { message: "الكمية الموزعة يجب أن تكون أكبر من صفر" } }, { status: 400 });
    }

    // Check stock availability in Rice store
    const stockCheck = await checkStockAvailability("rice", quantityKg, season);
    if (!stockCheck.available && !body.override) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: `الرصيد المتاح في مخزن الأرز (${stockCheck.currentBalance} كجم) فقط، غير كافٍ لصرف (${quantityKg} كجم).`,
            availableBalance: stockCheck.currentBalance,
            requiresOverride: true,
          },
        },
        { status: 409 }
      );
    }

    if (!stockCheck.available && body.override && !auth.isAdmin) {
      return NextResponse.json(
        { ok: false, error: { message: "تجاوز رصيد الأرز عند الصرف مسموح للمدير فقط" } },
        { status: 403 }
      );
    }

    // Check for duplicate distribution to same beneficiary on same day (warning only)
    const todayStart = new Date(body.date || Date.now());
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const sameDayDist = await ZkDistribution.findOne({
      beneficiary_id: beneficiary._id,
      date: { $gte: todayStart, $lte: todayEnd },
      deletedAt: null,
    });

    let sameDayWarning = "";
    if (sameDayDist) {
      sameDayWarning = `تنبيه: هذا المستفيد صُرف له أرز بالفعل اليوم (${sameDayDist.quantity_kg} كجم في إذن ${sameDayDist.no})`;
    }

    const nextNo = await getNextSerial(ZkDistribution);

    const distribution = await ZkDistribution.create({
      no: nextNo,
      date: body.date ? new Date(body.date) : new Date(),
      beneficiary_id: beneficiary._id,
      beneficiary_name: beneficiary.name,
      place: body.place?.trim() || "",
      season,
      unit,
      entered_qty: enteredQty,
      bags,
      bag_kg: bagKg,
      quantity_kg: quantityKg,
      override: Boolean(!stockCheck.available && body.override),
      notes: body.notes?.trim() || "",
      clientId: body.clientId || "",
      createdBy: auth.userId,
      createdByName: auth.name,
      version: 1,
    });

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "إضافة",
      entity: "توزيع",
      entity_id: String(distribution._id),
      before: null,
      after: distribution.toObject(),
      override: distribution.override,
      notes: `صرف أرز إذن رقم ${distribution.no} للمستفيد ${beneficiary.name} بمقدار ${distribution.quantity_kg} كجم (المتبقي بالمخزن: ${stockCheck.remainingAfter} كجم)`,
    });

    return NextResponse.json({
      ok: true,
      data: distribution,
      remainingStock: stockCheck.remainingAfter,
      warning: sameDayWarning || undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل تسجيل التوزيع" } },
      { status: 500 }
    );
  }
}

