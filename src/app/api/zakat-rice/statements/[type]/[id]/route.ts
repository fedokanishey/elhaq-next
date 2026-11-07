import { NextResponse } from "next/server";
import {
  getDonorStatement,
  getBeneficiaryStatement,
  getStoreStatement,
} from "@/lib/services/zakat-rice/ledger";
import { ZkMill } from "@/lib/models/zakat-rice";
import dbConnect from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const { type, id } = await params;
    const { searchParams } = new URL(req.url);
    const season = searchParams.get("season") || undefined;

    if (type === "donor") {
      const data = await getDonorStatement(id, season);
      return NextResponse.json({ ok: true, data });
    }

    if (type === "beneficiary") {
      const data = await getBeneficiaryStatement(id, season);
      return NextResponse.json({ ok: true, data });
    }

    if (type === "store") {
      const store = id === "rice" ? "rice" : "barley";
      const data = await getStoreStatement(store, season);
      return NextResponse.json({ ok: true, data });
    }

    if (type === "mill") {
      await dbConnect();
      const mill = await ZkMill.findById(id).lean();
      if (!mill) {
        return NextResponse.json({ ok: false, error: { message: "عملية التبييض غير موجودة" } }, { status: 404 });
      }
      return NextResponse.json({ ok: true, data: mill });
    }

    return NextResponse.json({ ok: false, error: { message: `نوع كشف غير صالح: ${type}` } }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

