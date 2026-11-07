import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkBeneficiary } from "@/lib/models/zakat-rice";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit } from "@/lib/services/zakat-rice/ledger";
import { normalizeArabicText } from "@/lib/services/zakat-rice/utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.canDistribute) {
      return NextResponse.json(
        { ok: false, error: { message: "غير مصرح لك باستيراد المستفيدين" } },
        { status: 403 }
      );
    }

    await dbConnect();
    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "true";

    const body = await req.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: { message: "لم يتم تقديم أي صفوف للاستيراد" } }, { status: 400 });
    }

    // Load existing normalized names and phones
    const existing = await ZkBeneficiary.find({ deletedAt: null }, { nameNormalized: 1, phone: 1 }).lean();
    const existingNameSet = new Set(existing.map((e) => e.nameNormalized));
    const existingPhoneSet = new Set(existing.filter((e) => e.phone).map((e) => e.phone));

    const processedRows: any[] = [];
    const toInsert: any[] = [];
    let validCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rawName = String(r.name || "").trim();
      const phone = String(r.phone || "").trim();
      const area = String(r.area || "").trim();
      const familySize = parseInt(String(r.family_size || "1"), 10) || 1;
      const extra = String(r.extra || "").trim();
      const notes = String(r.notes || "").trim();

      if (!rawName) {
        invalidCount++;
        processedRows.push({ row: i + 1, name: "فارغ", status: "invalid", reason: "الاسم فارغ" });
        continue;
      }

      const norm = normalizeArabicText(rawName);

      const isDup = existingNameSet.has(norm) || (phone && existingPhoneSet.has(phone));
      if (isDup) {
        duplicateCount++;
        processedRows.push({ row: i + 1, name: rawName, phone, area, status: "duplicate", reason: "مكرر في قاعدة البيانات" });
        continue;
      }

      // Add to set to prevent in-file duplicates
      existingNameSet.add(norm);
      if (phone) existingPhoneSet.add(phone);

      validCount++;
      processedRows.push({ row: i + 1, name: rawName, phone, area, family_size: familySize, status: "valid" });

      toInsert.push({
        name: rawName,
        nameNormalized: norm,
        phone,
        area,
        family_size: familySize,
        extra,
        notes,
        createdBy: auth.userId,
        createdByName: auth.name,
        version: 1,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        summary: {
          totalRows: rows.length,
          validCount,
          duplicateCount,
          invalidCount,
        },
        preview: processedRows.slice(0, 30),
      });
    }

    // Actual insert
    let inserted = [];
    if (toInsert.length > 0) {
      inserted = await ZkBeneficiary.insertMany(toInsert);

      await logZkAudit({
        user: { id: auth.userId, name: auth.name },
        action: "استيراد",
        entity: "مستفيد",
        entity_id: "batch",
        before: null,
        after: { count: inserted.length },
        notes: `استيراد Excel مجمع لـ (${inserted.length}) مستفيد جديد، وتخطي (${duplicateCount}) مكرر.`,
      });
    }

    return NextResponse.json({
      ok: true,
      dryRun: false,
      summary: {
        totalRows: rows.length,
        importedCount: inserted.length,
        duplicateCount,
        invalidCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل معالجة استيراد المستفيدين" } },
      { status: 500 }
    );
  }
}

