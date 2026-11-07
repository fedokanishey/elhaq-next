import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkAudit } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, error: { message: "سجل المراجعة متاح للمدير فقط" } }, { status: 403 });
    }

    await dbConnect();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "";
    const entity = searchParams.get("entity") || "";
    const q = searchParams.get("q")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const query: any = {};
    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (q) {
      query.$or = [
        { user_name: { $regex: q, $options: "i" } },
        { entity_id: { $regex: q, $options: "i" } },
        { notes: { $regex: q, $options: "i" } },
      ];
    }

    const total = await ZkAudit.countDocuments(query);
    const logs = await ZkAudit.find(query)
      .sort({ ts: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      data: logs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
  }
}

