import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkAdjustment } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit, getZkSettings, calculateStock } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const season = searchParams.get("season") || "";
    const store = searchParams.get("store") || "";

    const query: any = { deletedAt: null };
    if (season && season !== "all") query.season = season;
    if (store) query.store = store;

    const adjustments = await ZkAdjustment.find(query).sort({ date: -1 }).lean();
    return NextResponse.json({ ok: true, data: adjustments });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.canStore) {
      return NextResponse.json({ ok: false, error: { message: "غير مصرح لك بإجراء تسويات جردية" } }, { status: 403 });
    }

    await dbConnect();
    const body = await req.json();

    const store = body.store === "rice" ? "rice" : "barley";
    const kg = Number(body.kg);
    if (!kg || isNaN(kg) || kg === 0) {
      return NextResponse.json({ ok: false, error: { message: "قيمة التسوية بالكيلو مطلوبة ولا يمكن أن تساوي صفرًا" } }, { status: 400 });
    }

    if (!body.reason || !body.reason.trim()) {
      return NextResponse.json({ ok: false, error: { message: "سبب التسوية إلزامي لتسجيل العملية" } }, { status: 400 });
    }

    const settings = await getZkSettings();
    const season = body.season || settings.season;

    // Check if negative adjustment makes stock negative
    if (kg < 0) {
      const stock = await calculateStock(season);
      const currentBal = store === "barley" ? stock.barley.balance : stock.rice.balance;
      if (currentBal + kg < 0 && !auth.isAdmin) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              message: `لا يمكن تطبيق تسوية خصم تجعل رصيد ${store === "barley" ? "الشعير" : "الأرز"} سالبًا. الرصيد الحالي: ${currentBal} كجم.`,
            },
          },
          { status: 400 }
        );
      }
    }

    const adjustment = await ZkAdjustment.create({
      store,
      date: body.date ? new Date(body.date) : new Date(),
      kg,
      reason: body.reason.trim(),
      season,
      notes: body.notes?.trim() || "",
      clientId: body.clientId || "",
      createdBy: auth.userId,
      createdByName: auth.name,
      version: 1,
    });

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "تسوية",
      entity: "تسوية",
      entity_id: String(adjustment._id),
      before: null,
      after: adjustment.toObject(),
      notes: `تسوية ${adjustment.kg > 0 ? "إضافة" : "خصم"} لمخزن ${adjustment.store === "barley" ? "الشعير" : "الأرز"} بمقدار ${Math.abs(adjustment.kg)} كجم. السبب: ${adjustment.reason}`,
    });

    return NextResponse.json({ ok: true, data: adjustment });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

