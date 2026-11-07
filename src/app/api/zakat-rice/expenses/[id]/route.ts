import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkExpense } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const expense = await ZkExpense.findById(id).lean();
    if (!expense || expense.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المصروف غير موجود" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: expense });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getZkAuth();
    if (!auth.canAccount) {
      return NextResponse.json({ ok: false, error: { message: "غير مصرح لك بالتعديل" } }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const expense = await ZkExpense.findById(id);
    if (!expense || expense.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المصروف غير موجود" } }, { status: 404 });
    }

    if (expense.auto) {
      return NextResponse.json(
        { ok: false, error: { message: "هذا المصروف مولد تلقائيًا من عملية تبييض؛ يتم تعديله من شاشة التبييض فقط" } },
        { status: 400 }
      );
    }

    if (body.version !== undefined && expense.version !== body.version) {
      return NextResponse.json(
        { ok: false, error: { message: "تم تعديل السجل من مستخدم آخر" } },
        { status: 409 }
      );
    }

    const before = expense.toObject();

    if (body.date) expense.date = new Date(body.date);
    if (body.type) expense.type = body.type.trim();
    if (body.amount !== undefined) expense.amount = Number(body.amount);
    if (body.qty !== undefined) expense.qty = Number(body.qty);
    if (body.unit !== undefined) expense.unit = body.unit;
    if (body.party !== undefined) expense.party = body.party.trim();
    if (body.car_driver !== undefined) expense.car_driver = body.car_driver.trim();
    if (body.payment_method !== undefined) expense.payment_method = body.payment_method;
    if (body.ref_text !== undefined) expense.ref_text = body.ref_text.trim();
    if (body.notes !== undefined) expense.notes = body.notes.trim();
    if (body.season !== undefined) expense.season = body.season;

    expense.version = (expense.version || 1) + 1;
    expense.updatedBy = auth.userId;
    expense.updatedByName = auth.name;

    await expense.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "تعديل",
      entity: "مصروف",
      entity_id: String(expense._id),
      before,
      after: expense.toObject(),
      notes: `تعديل مصروف ${expense.type} بمبلغ ${expense.amount} ج.م`,
    });

    return NextResponse.json({ ok: true, data: expense });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getZkAuth();
    if (!auth.canDelete) {
      return NextResponse.json({ ok: false, error: { message: "صلاحية الحذف للمدير فقط" } }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;
    const expense = await ZkExpense.findById(id);
    if (!expense || expense.deletedAt) {
      return NextResponse.json({ ok: false, error: { message: "المصروف غير موجود" } }, { status: 404 });
    }

    if (expense.auto) {
      return NextResponse.json(
        { ok: false, error: { message: "لا يمكن حذف مصروف آلي مرتبط بتبييض من هنا، يُحذف بحذف أو تعديل عملية التبييض" } },
        { status: 400 }
      );
    }

    const before = expense.toObject();
    expense.deletedAt = new Date();
    expense.deletedBy = auth.userId;
    expense.deletedByName = auth.name;
    await expense.save();

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "حذف",
      entity: "مصروف",
      entity_id: String(expense._id),
      before,
      after: expense.toObject(),
      notes: `حذف مصروف ${expense.type} بمبلغ ${expense.amount} ج.م`,
    });

    return NextResponse.json({ ok: true, message: "تم حذف المصروف بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

