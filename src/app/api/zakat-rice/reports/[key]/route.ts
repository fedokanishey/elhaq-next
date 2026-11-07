import { NextResponse } from "next/server";
import { getZkReportData } from "@/lib/services/zakat-rice/reports";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const auth = await getZkAuth();
    const { key } = await params;
    const { searchParams } = new URL(req.url);

    const season = searchParams.get("season") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const data = await getZkReportData(key, { season, from, to });
    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل توليد التقرير" } },
      { status: 500 }
    );
  }
}

