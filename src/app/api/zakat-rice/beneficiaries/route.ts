import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { ZkBeneficiary } from "@/lib/models/zakat-rice";
import Beneficiary from "@/lib/models/Beneficiary";
import { getZkAuth } from "@/lib/services/zakat-rice/auth";
import { logZkAudit } from "@/lib/services/zakat-rice/ledger";
import { normalizeArabicText } from "@/lib/services/zakat-rice/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = searchParams.get("limit");
    const allParam = searchParams.get("all") === "true";
    const limit = limitParam !== null ? parseInt(limitParam, 10) : 0;

    // Build query for main Beneficiary collection
    const mainQuery: any = {
      status: { $ne: "cancelled" },
    };

    // Build query for ZkBeneficiary collection
    const zkQuery: any = { deletedAt: null };

    if (q) {
      const norm = normalizeArabicText(q);
      const regex = { $regex: q, $options: "i" };

      // Also clean barcode prefixes (e.g. DHZ00045, *DHZ00045*)
      let cleanCode = q.toLowerCase().replace(/[*]/g, "").trim();
      if (cleanCode.startsWith("dhz")) {
        cleanCode = cleanCode.replace(/^dhz0*/, "");
      }
      const numOnly = cleanCode.replace(/\D+/g, "");

      const orConditions: any[] = [
        { name: { $regex: norm, $options: "i" } },
        { phone: regex },
        { address: regex },
        { internalId: regex },
        { nationalId: regex },
      ];

      if (numOnly && numOnly !== q) {
        orConditions.push({ internalId: numOnly });
        orConditions.push({ internalId: { $regex: `^0*${numOnly}$` } });
      }

      mainQuery.$or = orConditions;

      zkQuery.$or = [
        { nameNormalized: { $regex: norm, $options: "i" } },
        { phone: regex },
        { area: regex },
        { extra: regex },
      ];
    }

    // Fetch from main Beneficiary collection with numeric collation ordering
    const mainBeneficiaries = await Beneficiary.find(mainQuery)
      .collation({ locale: "en_US", numericOrdering: true })
      .sort({ internalId: 1, name: 1 })
      .select("_id name phone address familyMembers internalId nationalId notes category")
      .lean();

    // Map main beneficiaries to the ZkBeneficiary structure
    const mappedMain = mainBeneficiaries.map((b: any) => ({
      _id: b._id,
      name: b.name,
      nameNormalized: normalizeArabicText(b.name || ""),
      phone: b.phone || "",
      area: b.address || "",
      family_size: b.familyMembers || 1,
      internalId: b.internalId || "",
      nationalId: b.nationalId || "",
      extra: b.internalId ? `كود: ${b.internalId}` : (b.nationalId || ""),
      notes: b.notes || "",
      category: b.category || "C",
      source: "main",
    }));

    // Fetch any custom ZkBeneficiary records that may exist
    const zkBeneficiaries = await ZkBeneficiary.find(zkQuery)
      .sort({ name: 1 })
      .lean();

    // Merge without duplicates by ID or normalized name
    const existingIds = new Set(mappedMain.map((b) => String(b._id)));
    const existingNames = new Set(mappedMain.map((b) => b.nameNormalized));

    const extraZk = zkBeneficiaries
      .filter((zb: any) => !existingIds.has(String(zb._id)) && !existingNames.has(zb.nameNormalized))
      .map((zb: any) => ({
        ...zb,
        source: "warehouse",
      }));

    const combined = [...mappedMain, ...extraZk];

    // Natural numeric sorting: 1, 2, 3... 10... 100... 1000 instead of string order
    const extractNumericCode = (item: any): number | null => {
      const idStr = item.internalId || item.extra || "";
      const match = String(idStr).match(/\d+/);
      if (match) {
        const val = parseInt(match[0], 10);
        if (!isNaN(val) && val > 0) return val;
      }
      return null;
    };

    combined.sort((a: any, b: any) => {
      const codeA = extractNumericCode(a);
      const codeB = extractNumericCode(b);

      if (codeA !== null && codeB !== null) {
        if (codeA !== codeB) return codeA - codeB;
      } else if (codeA !== null) {
        return -1;
      } else if (codeB !== null) {
        return 1;
      }

      return (a.name || "").localeCompare(b.name || "", "ar");
    });

    const total = combined.length;

    // If limit <= 0 or all=true, return all beneficiaries without pagination
    const isUnpaginated = allParam || limit <= 0;
    const paginated = isUnpaginated ? combined : combined.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      ok: true,
      data: paginated,
      pagination: {
        total,
        page: isUnpaginated ? 1 : page,
        limit: isUnpaginated ? total : limit,
        pages: isUnpaginated ? 1 : Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error("Error fetching zakat-rice beneficiaries:", error);
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل جلب المستفيدين" } },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getZkAuth();
    if (!auth.canDistribute) {
      return NextResponse.json(
        { ok: false, error: { message: "غير مصرح لك بإضافة مستفيدين" } },
        { status: 403 }
      );
    }

    await dbConnect();
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ ok: false, error: { message: "اسم المستفيد إلزامي" } }, { status: 400 });
    }

    const norm = normalizeArabicText(body.name);

    if (body.clientId) {
      const existing = await ZkBeneficiary.findOne({ clientId: body.clientId, deletedAt: null });
      if (existing) {
        return NextResponse.json({ ok: true, data: existing, message: "تم الاسترجاع (طلب مكرر)" });
      }
    }

    // Check duplicate in main Beneficiary or ZkBeneficiary
    let duplicateWarning = "";
    const existingMain = await Beneficiary.findOne({
      name: { $regex: norm, $options: "i" },
      status: { $ne: "cancelled" },
    });
    const duplicateZk = await ZkBeneficiary.findOne({
      deletedAt: null,
      $or: [{ nameNormalized: norm }, ...(body.phone ? [{ phone: body.phone.trim() }] : [])],
    });

    if (existingMain || duplicateZk) {
      duplicateWarning = `تنبيه: يوجد مستفيد مسجل مسبقًا بالاسم أو الهاتف (${existingMain?.name || duplicateZk?.name})`;
    }

    const beneficiary = await ZkBeneficiary.create({
      name: body.name.trim(),
      nameNormalized: norm,
      phone: body.phone?.trim() || "",
      area: body.area?.trim() || "",
      family_size: Number(body.family_size) || 1,
      extra: body.extra?.trim() || "",
      notes: body.notes?.trim() || "",
      clientId: body.clientId || "",
      createdBy: auth.userId,
      createdByName: auth.name,
      version: 1,
    });

    await logZkAudit({
      user: { id: auth.userId, name: auth.name },
      action: "إضافة",
      entity: "مستفيد",
      entity_id: String(beneficiary._id),
      before: null,
      after: beneficiary.toObject(),
      notes: `إضافة مستفيد جديد: ${beneficiary.name}`,
    });

    return NextResponse.json({
      ok: true,
      data: beneficiary,
      warning: duplicateWarning || undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: { message: error.message || "فشل إضافة المستفيد" } },
      { status: 500 }
    );
  }
}
