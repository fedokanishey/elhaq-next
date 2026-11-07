import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkReceipt, ZkDonor } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { getNextSerial, logZkAudit, getZkSettings } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    // If requesting next serial number
    if (searchParams.get("nextNo") === "true") {
      const nextNo = await getNextSerial(ZkReceipt);
      return NextResponse.json({ ok: true, data: { nextNo } });
    }

    const q = searchParams.get("q")?.trim() || "";
    const season = searchParams.get("season") || "";
    const item = searchParams.get("item") || "";
    const donorId = searchParams.get("donorId") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const query: any = { deletedAt: null };

    if (season && season !== "all") query.season = season;
    if (item) query.item = item;
    if (donorId) query.donor_id = donorId;

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
        { donor_name: { $regex: q, $options: "i" } },
        { item_name: { $regex: q, $options: "i" } },
        { notes: { $regex: q, $options: "i" } },
      ];
    }

    const total = await ZkReceipt.countDocuments(query);
    const receipts = await ZkReceipt.find(query)
      .sort({ date: -1, no: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      data: receipts,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل جلب الاستلامات" } },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.canStore) {
      return NextResponse.json(
        { ok: false, error: { message: "غير مصرح لك بتسجيل استلامات" } },
        { status: 403 }
      );
    }

    await dbConnect();
    const body = await req.json();

    if (!body.donor_id) {
      return NextResponse.json({ ok: false, error: { message: "يجب اختيار المتبرع" } }, { status: 400 });
    }

    const donor = await ZkDonor.findById(body.donor_id);
    if (!donor || donor.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المتبرع غير موجود" } }, { status: 404 });
    }

    // Idempotency
    if (body.clientId) {
      const existing = await ZkReceipt.findOne({ clientId: body.clientId, deletedAt: null });
      if (existing) {
        return NextResponse.json({ ok: true, data: existing, message: "تم الاسترجاع (طلب مكرر)" });
      }
    }

    const settings = await getZkSettings();
    const season = body.season || settings.season;
    const item = body.item || "barley";

    let storeLabel = "—";
    if (item === "barley") storeLabel = "مخزن الشعير";
    else if (item === "rice") storeLabel = "مخزن الأرز";

    const nextNo = await getNextSerial(ZkReceipt);

    const receipt = await ZkReceipt.create({
      no: nextNo,
      donor_id: donor._id,
      donor_name: donor.name,
      date: body.date ? new Date(body.date) : new Date(),
      season,
      item,
      item_name: body.item_name?.trim() || "",
      bags: Number(body.bags) || 0,
      bag_kg: Number(body.bag_kg) || 0,
      quantity: Number(body.quantity) || 0,
      unit: body.unit || (item === "cash" ? "جنيه" : "كجم"),
      amount: Number(body.amount) || 0,
      purpose: body.purpose || "شراء أرز",
      payment_method: body.payment_method || "نقدًا",
      store_label: body.store_label || storeLabel,
      notes: body.notes?.trim() || "",
      clientId: body.clientId || "",
      createdBy: auth.userId,
      createdByName: auth.name,
      version: 1,
    });

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "إضافة",
      entity: "استلام",
      entity_id: String(receipt._id),
      before: null,
      after: receipt.toObject(),
      notes: `تسجيل إيصال استلام رقم ${receipt.no} من المتبرع ${donor.name} (${receipt.item}: ${receipt.quantity} ${receipt.unit})`,
    });

    return NextResponse.json({ ok: true, data: receipt });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل تسجيل الاستلام" } },
      { status: 500 }
    );
  }
}

