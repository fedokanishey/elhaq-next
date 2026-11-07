import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkDonor, ZkReceipt } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit } from "@/lib/services/zakat-rice/ledger";
import { normalizeArabicText } from "@/lib/services/zakat-rice/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const season = searchParams.get("season") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const query: any = { deletedAt: null };

    if (season && season !== "all") {
      query.season = season;
    }

    if (q) {
      const norm = normalizeArabicText(q);
      query.$or = [
        { nameNormalized: { $regex: norm, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { land_description: { $regex: q, $options: "i" } },
      ];
    }

    const total = await ZkDonor.countDocuments(query);
    const donors = await ZkDonor.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      data: donors,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل جلب قائمة المتبرعين" } },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.canStore) {
      return NextResponse.json(
        { ok: false, error: { message: "غير مصرح لك بإضافة متبرعين" } },
        { status: 403 }
      );
    }

    await dbConnect();
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { ok: false, error: { message: "اسم المتبرع إلزامي" } },
        { status: 400 }
      );
    }

    // Idempotency check with clientId
    if (body.clientId) {
      const existing = await ZkDonor.findOne({ clientId: body.clientId, deletedAt: null });
      if (existing) {
        return NextResponse.json({ ok: true, data: existing, message: "تم الاسترجاع (طلب مكرر)" });
      }
    }

    const norm = normalizeArabicText(body.name);

    // Duplicate warning check
    let duplicateWarning = "";
    const duplicate = await ZkDonor.findOne({
      deletedAt: null,
      $or: [{ nameNormalized: norm }, ...(body.phone ? [{ phone: body.phone.trim() }] : [])],
    });
    if (duplicate) {
      duplicateWarning = `تنبيه: يوجد متبرع مسجل مسبقًا باسم مشابه أو نفس الهاتف (${duplicate.name})`;
    }

    const donor = await ZkDonor.create({
      name: body.name.trim(),
      nameNormalized: norm,
      phone: body.phone?.trim() || "",
      land_description: body.land_description?.trim() || "",
      season: body.season || "2026",
      notes: body.notes?.trim() || "",
      clientId: body.clientId || "",
      createdBy: auth.userId,
      createdByName: auth.name,
      version: 1,
    });

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "إضافة",
      entity: "متبرع",
      entity_id: String(donor._id),
      before: null,
      after: donor.toObject(),
      notes: `إضافة متبرع جديد: ${donor.name}`,
    });

    return NextResponse.json({
      ok: true,
      data: donor,
      warning: duplicateWarning || undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل إضافة المتبرع" } },
      { status: 500 }
    );
  }
}

