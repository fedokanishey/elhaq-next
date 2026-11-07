import { NextResponse } from "next/server";
import { getZkSettings, logZkAudit } from "@/lib/services/zakat-rice/ledger";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { ZkSettings } from "@/lib/models/zakat-rice";
import dbConnect from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getZkSettings();
    return NextResponse.json({ ok: true, data: settings });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل جلب الإعدادات" } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.isAdmin) {
      return NextResponse.json(
        { ok: false, error: { message: "غير مصرح لك بتعديل الإعدادات (صلاحية المدير فقط)" } },
        { status: 403 }
      );
    }

    await dbConnect();
    const body = await req.json();
    const oldSettings = await getZkSettings();

    const allowedFields = [
      "season",
      "opening_barley_kg",
      "opening_rice_kg",
      "min_barley_kg",
      "min_rice_kg",
      "bag_weight_presets",
      "org_name",
      "org_logo",
    ];

    const updateData: any = {};
    for (const f of allowedFields) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    const updated = await ZkSettings.findByIdAndUpdate(oldSettings._id, updateData, { new: true });

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "تعديل",
      entity: "إعدادات",
      entity_id: String(oldSettings._id),
      before: oldSettings.toObject(),
      after: updated?.toObject(),
      notes: "تحديث إعدادات نظام زكاة الأرز والمخازن",
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل حفظ الإعدادات" } },
      { status: 500 }
    );
  }
}

