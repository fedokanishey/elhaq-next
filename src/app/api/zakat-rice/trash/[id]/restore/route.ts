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
import { logZkAudit } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getZkAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, error: { message: "الاستعادة متاحة للمدير فقط" } }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity"); // "متبرع" | "استلام" | "تبييض" | "مصروف" | "مستفيد" | "توزيع" | "تسوية"

    let model: any = null;
    if (entity === "متبرع") model = ZkDonor;
    else if (entity === "استلام") model = ZkReceipt;
    else if (entity === "تبييض") model = ZkMill;
    else if (entity === "مصروف") model = ZkExpense;
    else if (entity === "مستفيد") model = ZkBeneficiary;
    else if (entity === "توزيع") model = ZkDistribution;
    else if (entity === "تسوية") model = ZkAdjustment;

    let doc = model ? await model.findById(id) : null;

    // If entity was not provided, search across models
    if (!doc) {
      const models = [ZkDonor, ZkReceipt, ZkMill, ZkExpense, ZkBeneficiary, ZkDistribution, ZkAdjustment];
      for (const m of models) {
        const found = await (m as any).findById(id);
        if (found) {
          doc = found;
          break;
        }
      }
    }

    if (!doc || !doc.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "السجل المطلوب غير موجود في سلة المحذوفات" } }, { status: 404 });
    }

    const before = doc.toObject();
    doc.deletedAt = null;
    doc.deletedBy = null;
    doc.deletedByName = null;
    await doc.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "استعادة",
      entity: (entity || "سجل") as any,
      entity_id: String(doc._id),
      before,
      after: doc.toObject(),
      notes: `استعادة سجل محذوف من سلة المحذوفات`,
    });

    return NextResponse.json({ ok: true, message: "تمت استعادة السجل بنجاح وإعادته للأرصدة النشطة" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}
