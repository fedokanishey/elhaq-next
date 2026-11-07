import { NextResponse } from "next/server";
import { getSeasonSummary } from "@/lib/services/zakat-rice/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const season = searchParams.get("season") || undefined;
    const summary = await getSeasonSummary(season);
    return NextResponse.json({ ok: true, data: summary });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل توليد التقرير الختامي للموسم" } },
      { status: 500 }
    );
  }
}

