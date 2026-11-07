import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkExpense } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit, getZkSettings } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const season = searchParams.get("season") || "";
    const type = searchParams.get("type") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const query: any = { deletedAt: null };
    if (season && season !== "all") query.season = season;
    if (type) query.type = type;

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
        { type: { $regex: q, $options: "i" } },
        { party: { $regex: q, $options: "i" } },
        { car_driver: { $regex: q, $options: "i" } },
        { ref_text: { $regex: q, $options: "i" } },
        { notes: { $regex: q, $options: "i" } },
      ];
    }

    const total = await ZkExpense.countDocuments(query);
    const expenses = await ZkExpense.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      data: expenses,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل جلب المصروفات" } },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.canAccount) {
      return NextResponse.json(
        { ok: false, error: { message: "غير مصرح لك بتسجيل مصروفات" } },
        { status: 403 }
      );
    }

    await dbConnect();
    const body = await req.json();

    if (!body.type || !body.type.trim()) {
      return NextResponse.json({ ok: false, error: { message: "نوع المصروف إلزامي" } }, { status: 400 });
    }
    const amount = Number(body.amount);
    if (isNaN(amount) || amount < 0) {
      return NextResponse.json({ ok: false, error: { message: "المبلغ غير صالح" } }, { status: 400 });
    }

    if (body.clientId) {
      const existing = await ZkExpense.findOne({ clientId: body.clientId, deletedAt: null });
      if (existing) {
        return NextResponse.json({ ok: true, data: existing, message: "تم الاسترجاع (طلب مكرر)" });
      }
    }

    const settings = await getZkSettings();
    const season = body.season || settings.season;

    const expense = await ZkExpense.create({
      date: body.date ? new Date(body.date) : new Date(),
      type: body.type.trim(),
      amount,
      qty: Number(body.qty) || 1,
      unit: body.unit || "شيكارة",
      party: body.party?.trim() || "",
      car_driver: body.car_driver?.trim() || "",
      payment_method: body.payment_method || "نقدًا",
      ref_text: body.ref_text?.trim() || "",
      auto: false,
      season,
      notes: body.notes?.trim() || "",
      clientId: body.clientId || "",
      createdBy: auth.userId,
      createdByName: auth.name,
      version: 1,
    });

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "إضافة",
      entity: "مصروف",
      entity_id: String(expense._id),
      before: null,
      after: expense.toObject(),
      notes: `تسجيل مصروف يدوي: ${expense.type} بمبلغ ${expense.amount} ج.م للجهة: ${expense.party}`,
    });

    return NextResponse.json({ ok: true, data: expense });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل تسجيل المصروف" } },
      { status: 500 }
    );
  }
}

