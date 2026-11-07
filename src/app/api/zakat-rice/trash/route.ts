import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import {
  ZkDonor,
  ZkReceipt,
  ZkMill,
  ZkExpense,
  ZkBeneficiary,
  ZkDistribution,
  ZkAdjustment,
} from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getZkAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, error: { message: "سلة المحذوفات متاحة للمدير فقط" } }, { status: 403 });
    }

    await dbConnect();
    const isDeleted = { deletedAt: { $ne: null } };

    const [donors, receipts, mills, expenses, beneficiaries, distributions, adjustments] = await Promise.all([
      ZkDonor.find(isDeleted).lean(),
      ZkReceipt.find(isDeleted).lean(),
      ZkMill.find(isDeleted).lean(),
      ZkExpense.find(isDeleted).lean(),
      ZkBeneficiary.find(isDeleted).lean(),
      ZkDistribution.find(isDeleted).lean(),
      ZkAdjustment.find(isDeleted).lean(),
    ]);

    const items: any[] = [];

    donors.forEach((d) => items.push({ id: d._id, entity: "متبرع", title: d.name, details: d.phone, deletedAt: d.deletedAt, deletedByName: d.deletedByName }));
    receipts.forEach((r) => items.push({ id: r._id, entity: "استلام", title: `إيصال ${r.no} (${r.donor_name})`, details: `${r.quantity} ${r.unit}`, deletedAt: r.deletedAt, deletedByName: r.deletedByName }));
    mills.forEach((m) => items.push({ id: m._id, entity: "تبييض", title: `تبييض ${m.no} (${m.place})`, details: `دخل ${m.in_kg}كجم -> خرج ${m.rice_kg}كجم أرز`, deletedAt: m.deletedAt, deletedByName: m.deletedByName }));
    expenses.forEach((e) => items.push({ id: e._id, entity: "مصروف", title: `مصروف ${e.type}`, details: `${e.amount} ج.م`, deletedAt: e.deletedAt, deletedByName: e.deletedByName }));
    beneficiaries.forEach((b) => items.push({ id: b._id, entity: "مستفيد", title: b.name, details: b.phone || b.area, deletedAt: b.deletedAt, deletedByName: b.deletedByName }));
    distributions.forEach((d) => items.push({ id: d._id, entity: "توزيع", title: `توزيع ${d.no} (${d.beneficiary_name})`, details: `${d.quantity_kg} كجم`, deletedAt: d.deletedAt, deletedByName: d.deletedByName }));
    adjustments.forEach((a) => items.push({ id: a._id, entity: "تسوية", title: `تسوية ${a.store}`, details: `${a.kg} كجم (${a.reason})`, deletedAt: a.deletedAt, deletedByName: a.deletedByName }));

    items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    return NextResponse.json({ ok: true, data: items });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

