import { NextResponse } from "next/server";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { renumberEntity } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, error: { message: "إعادة الترقيم متاحة للمدير فقط" } }, { status: 403 });
    }

    const body = await req.json();
    const entityType = body.entityType; // "receipts" | "mills" | "distributions"

    if (!["receipts", "mills", "distributions"].includes(entityType)) {
      return NextResponse.json({ ok: false, error: { message: "نوع السجلات المطلوب ترقيمها غير صالح" } }, { status: 400 });
    }

    const result = await renumberEntity(entityType, { id: auth.userId, name: auth.name });
    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

