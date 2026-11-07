import { NextResponse } from "next/server";
import { calculateStock } from "@/lib/services/zakat-rice/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const season = searchParams.get("season") || undefined;
    const stock = await calculateStock(season);
    return NextResponse.json({ ok: true, data: stock });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "حدث خطأ أثناء جلب الأرصدة" } },
      { status: 500 }
    );
  }
}

