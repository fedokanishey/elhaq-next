import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkAdjustment } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getZkAuth();
    if (!auth.canDelete) {
      return NextResponse.json({ ok: false, error: { message: "صلاحية الحذف للمدير فقط" } }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const adjustment = await ZkAdjustment.findById(id);
    if (!adjustment || adjustment.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "التسوية غير موجودة" } }, { status: 404 });
    }

    const before = adjustment.toObject();
    adjustment.deletedAt = new Date();
    adjustment.deletedBy = auth.userId;
    adjustment.deletedByName = auth.name;
    await adjustment.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "حذف",
      entity: "تسوية",
      entity_id: String(adjustment._id),
      before,
      after: adjustment.toObject(),
      notes: `إلغاء وحذف تسوية جردية لمخزن ${adjustment.store} بمقدار ${adjustment.kg} كجم`,
    });

    return NextResponse.json({ ok: true, message: "تم حذف التسوية بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

