import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkDistribution } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, error: { message: "أداة المعالجة متاحة للمدير فقط" } }, { status: 403 });
    }

    await dbConnect();
    const body = await req.json();

    // If query mode: return list of suspicious distributions
    if (body.action === "list") {
      // Find distributions where unit is "شيكارة" but quantity_kg is small (< 10kg, likely saved as number of bags instead of kg)
      const suspicious = await ZkDistribution.find({
        deletedAt: null,
        $or: [
          { unit: "شيكارة", quantity_kg: { $lte: 10 } },
          { unit: "شيكارة", bag_kg: 0 },
        ],
      })
        .sort({ date: -1 })
        .lean();

      return NextResponse.json({ ok: true, data: suspicious });
    }

    // Apply fix
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const bagKg = Number(body.bagKg) || 25;

    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: { message: "لم يتم تحديد أي سجلات للإصلاح" } }, { status: 400 });
    }

    const records = await ZkDistribution.find({ _id: { $in: ids }, deletedAt: null });
    const fixedList: any[] = [];

    for (const rec of records) {
      const before = rec.toObject();
      const bags = rec.bags > 0 ? rec.bags : (rec.entered_qty || 1);
      rec.bags = bags;
      rec.bag_kg = bagKg;
      rec.quantity_kg = bags * bagKg;
      rec.unit = "شيكارة";
      await rec.save();

      fixedList.push({ id: rec._id, no: rec.no, oldKg: before.quantity_kg, newKg: rec.quantity_kg });

      await logZkAudit({
        user: { id: auth.userId, name: auth.name },
        action: "تعديل",
        entity: "توزيع",
        entity_id: String(rec._id),
        before,
        after: rec.toObject(),
        notes: `إصلاح توزيع قديم مسجل بالشكاير: تحويل ${bags} شكارة × ${bagKg}كجم = ${rec.quantity_kg} كجم`,
      });
    }

    return NextResponse.json({ ok: true, data: { fixedCount: fixedList.length, fixedList } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

