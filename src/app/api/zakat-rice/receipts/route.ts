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
    const operationType = searchParams.get("operationType") || searchParams.get("type") || "";
    const donorId = searchParams.get("donorId") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const query: any = { deletedAt: null };

    if (season && season !== "all") query.season = season;
    if (item) query.item = item;
    if (operationType && operationType !== "all") query.operation_type = operationType;
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

    const operationType = body.operation_type || "donation";
    let donorId = null;
    let donorName = "";

    if (operationType === "donation") {
      if (!body.donor_id) {
        return NextResponse.json({ ok: false, error: { message: "يجب اختيار المتبرع الكريم في عملية التبرع" } }, { status: 400 });
      }
      const donor = await ZkDonor.findById(body.donor_id);
      if (!donor || donor.deletedAt) {
        return NextResponse.json({ ok: false, error: { message: "المتبرع غير موجود" } }, { status: 404 });
      }
      donorId = donor._id;
      donorName = donor.name;
    } else if (operationType === "purchase") {
      donorName = body.donor_name?.trim() || body.supplier_name?.trim() || "شراء من التبرعات النقدية";
      if (body.donor_id) donorId = body.donor_id;
      if (!Number(body.amount) || Number(body.amount) <= 0) {
        return NextResponse.json({ ok: false, error: { message: "يجب تحديد إجمالي المبلغ المدفوع للشراء (يُخصم من التبرعات النقدية)" } }, { status: 400 });
      }
      if (!Number(body.quantity) || Number(body.quantity) <= 0) {
        return NextResponse.json({ ok: false, error: { message: "يجب تحديد الكمية المشتراة بالكيلوجرام" } }, { status: 400 });
      }
    } else if (operationType === "sale") {
      donorName = body.donor_name?.trim() || body.buyer_name?.trim() || "بيع مخرجات / رجيع";
      if (body.donor_id) donorId = body.donor_id;
      if (!Number(body.amount) || Number(body.amount) <= 0) {
        return NextResponse.json({ ok: false, error: { message: "يجب تحديد المبلغ المحصل من البيع (يُضاف للتبرعات النقدية)" } }, { status: 400 });
      }
    } else {
      return NextResponse.json({ ok: false, error: { message: "نوع العملية غير صالح" } }, { status: 400 });
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
    else if (item === "bran") storeLabel = "مخزن الردة / الرجيع";

    const nextNo = await getNextSerial(ZkReceipt);

    const receipt = await ZkReceipt.create({
      no: nextNo,
      operation_type: operationType,
      donor_id: donorId,
      donor_name: donorName,
      date: body.date ? new Date(body.date) : new Date(),
      season,
      item,
      item_name: body.item_name?.trim() || (item === "bran" ? "رجيع / ردة" : ""),
      bags: Number(body.bags) || 0,
      bag_kg: Number(body.bag_kg) || 0,
      quantity: item === "cash" ? (Number(body.amount) || Number(body.quantity) || 0) : (Number(body.quantity) || 0),
      unit: body.unit || (item === "cash" ? "جنيه" : "كجم"),
      amount: Number(body.amount) || 0,
      purpose: body.purpose || (operationType === "purchase" ? "شراء محصول من أموال التبرعات" : operationType === "sale" ? "بيع رجيع ومخرجات لصالح الصندوق" : "شراء أرز"),
      payment_method: body.payment_method || "نقدًا",
      store_label: body.store_label || storeLabel,
      notes: body.notes?.trim() || "",
      clientId: body.clientId || "",
      createdBy: auth.userId,
      createdByName: auth.name,
      version: 1,
    });

    const auditNotes = operationType === "purchase"
      ? `تسجيل عملية شراء محاصيل رقم ${receipt.no} بمبلغ ${receipt.amount} ج.م من جهة (${donorName}) لحساب (${receipt.item}: ${receipt.quantity} ${receipt.unit}) - خصم من تبرعات الأرز`
      : operationType === "sale"
      ? `تسجيل عملية بيع مخرجات رقم ${receipt.no} بمبلغ ${receipt.amount} ج.م إلى (${donorName}) (${receipt.item}: ${receipt.quantity} ${receipt.unit}) - توريد لصندوق تبرعات الأرز`
      : `تسجيل إيصال استلام تبرع رقم ${receipt.no} من المتبرع ${donorName} (${receipt.item}: ${receipt.quantity} ${receipt.unit})`;

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "إضافة",
      entity: "استلام",
      entity_id: String(receipt._id),
      before: null,
      after: receipt.toObject(),
      notes: auditNotes,
    });

    return NextResponse.json({ ok: true, data: receipt });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل تسجيل الاستلام" } },
      { status: 500 }
    );
  }
}

