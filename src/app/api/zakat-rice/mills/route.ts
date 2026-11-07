import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkMill, ZkDonor } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import {
  getNextSerial,
  logZkAudit,
  getZkSettings,
  checkStockAvailability,
  syncMillAutoExpenses,
} from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    if (searchParams.get("nextNo") === "true") {
      const nextNo = await getNextSerial(ZkMill);
      return NextResponse.json({ ok: true, data: { nextNo } });
    }

    const q = searchParams.get("q")?.trim() || "";
    const season = searchParams.get("season") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const query: any = { deletedAt: null };
    if (season && season !== "all") query.season = season;

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
        { place: { $regex: q, $options: "i" } },
        { "allocs.donor_name": { $regex: q, $options: "i" } },
        { notes: { $regex: q, $options: "i" } },
      ];
    }

    const total = await ZkMill.countDocuments(query);
    const mills = await ZkMill.find(query)
      .sort({ date: -1, no: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      data: mills,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل جلب عمليات التبييض" } },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.canStore) {
      return NextResponse.json(
        { ok: false, error: { message: "غير مصرح لك بتسجيل عمليات تبييض" } },
        { status: 403 }
      );
    }

    await dbConnect();
    const body = await req.json();

    if (!body.place || !body.place.trim()) {
      return NextResponse.json({ ok: false, error: { message: "اسم المضرب إلزامي" } }, { status: 400 });
    }

    // Idempotency
    if (body.clientId) {
      const existing = await ZkMill.findOne({ clientId: body.clientId, deletedAt: null });
      if (existing) {
        return NextResponse.json({ ok: true, data: existing, message: "تم الاسترجاع (طلب مكرر)" });
      }
    }

    const settings = await getZkSettings();
    const season = body.season || settings.season;

    // Calculate in_kg from allocations
    const allocs = Array.isArray(body.allocs) ? body.allocs : [];
    let in_kg = 0;
    const cleanAllocs: any[] = [];

    for (const item of allocs) {
      const kg = Number(item.kg) || 0;
      if (kg > 0) {
        in_kg += kg;
        cleanAllocs.push({
          donor_id: item.donor_id && item.donor_id !== "general" ? item.donor_id : null,
          donor_name: item.donor_name || "مخزون الشعير العام بالمخزن",
          kg,
        });
      }
    }

    if (in_kg <= 0 && Number(body.in_kg) > 0) {
      in_kg = Number(body.in_kg);
    }

    if (in_kg <= 0) {
      return NextResponse.json(
        { ok: false, error: { message: "يجب تحديد كمية الشعير الداخل للتبييض وتوزيعها على المتبرعين" } },
        { status: 400 }
      );
    }

    // Stock check against Barley inventory
    const stockCheck = await checkStockAvailability("barley", in_kg, season);
    if (!stockCheck.available && !body.override) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message: `رصيد الشعير المتاح (${stockCheck.currentBalance} كجم) أقل من الكمية المطلوبة للتبييض (${in_kg} كجم).`,
            availableBalance: stockCheck.currentBalance,
            requiresOverride: true,
          },
        },
        { status: 409 }
      );
    }

    if (!stockCheck.available && body.override && !auth.isAdmin) {
      return NextResponse.json(
        { ok: false, error: { message: "تجاوز رصيد الشعير مسموح للمدير فقط" } },
        { status: 403 }
      );
    }

    const nextNo = await getNextSerial(ZkMill);

    const mill = await ZkMill.create({
      no: nextNo,
      date: body.date ? new Date(body.date) : new Date(),
      place: body.place.trim(),
      bags: Number(body.bags) || 0,
      in_kg,
      rice_kg: Number(body.rice_kg) || 0,
      bran_kg: Number(body.bran_kg) || 0,
      waste_kg: Number(body.waste_kg) || 0,
      other_kg: Number(body.other_kg) || 0,
      season,
      notes: body.notes?.trim() || "",
      allocs: cleanAllocs,
      costs: {
        millCost: Number(body.costs?.millCost) || 0,
        loadCost: Number(body.costs?.loadCost) || 0,
        transportCost: Number(body.costs?.transportCost) || 0,
        unloadCost: Number(body.costs?.unloadCost) || 0,
        labor: Number(body.costs?.labor) || 0,
        extra: Number(body.costs?.extra) || 0,
      },
      clientId: body.clientId || "",
      createdBy: auth.userId,
      createdByName: auth.name,
      version: 1,
    });

    // Auto synchronize mill operational costs to zk_expenses
    await syncMillAutoExpenses(mill, { id: auth.userId, name: auth.name });

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "إضافة",
      entity: "تبييض",
      entity_id: String(mill._id),
      before: null,
      after: mill.toObject(),
      override: Boolean(body.override && !stockCheck.available),
      notes: `تسجيل عملية تبييض رقم ${mill.no} بمضرب ${mill.place} (دخل: ${mill.in_kg}كجم شعير، خرج: ${mill.rice_kg}كجم أرز)`,
    });

    return NextResponse.json({ ok: true, data: mill });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل تسجيل عملية التبييض" } },
      { status: 500 }
    );
  }
}

