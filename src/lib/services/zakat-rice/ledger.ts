import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import {
  ZkSettings,
  ZkDonor,
  ZkReceipt,
  ZkMill,
  ZkExpense,
  ZkBeneficiary,
  ZkDistribution,
  ZkAdjustment,
  ZkAudit,
  IZkSettings,
  IZkMill,
} from "@/lib/models/zakat-rice";
import { padSerialNo, computeFieldDiff } from "./utils";
import mongoose from "mongoose";

export interface StockSummary {
  season: string;
  barley: {
    balance: number;
    opening: number;
    received: number;
    milled: number;
    adjusted: number;
    bags: number;
    isLow: boolean;
    minAlert: number;
  };
  rice: {
    balance: number;
    opening: number;
    fromMilling: number;
    receivedDirect: number;
    distributed: number;
    adjusted: number;
    bags: number;
    isLow: boolean;
    minAlert: number;
  };
  otherItems: Array<{
    name: string;
    totalQuantity: number;
    unit: string;
    bags: number;
    count: number;
  }>;
  cash: {
    totalAmount: number;
    count: number;
  };
  expenses: {
    totalAmount: number;
    count: number;
  };
  counts: {
    donors: number;
    beneficiaries: number;
    receipts: number;
    mills: number;
    distributions: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    no?: string;
    title: string;
    subTitle: string;
    date: Date;
    amountOrQty: string;
  }>;
}

/**
 * Retrieves the global Zakat Rice settings or creates default if not initialized
 */
export async function getZkSettings(): Promise<IZkSettings> {
  await dbConnect();
  let settings = await ZkSettings.findOne();
  if (!settings) {
    settings = await ZkSettings.create({
      season: new Date().getFullYear().toString(),
      opening_barley_kg: 0,
      opening_rice_kg: 0,
      min_barley_kg: 500,
      min_rice_kg: 500,
      bag_weight_presets: [25, 50, 10, 5],
      org_name: "دعوة الحق الزرقا",
      org_logo: "/logos/شعار.png",
    });
  }
  return settings;
}

/**
 * Calculates live balances and statistics from actual non-deleted movements
 */
export async function calculateStock(seasonFilter?: string): Promise<StockSummary> {
  await dbConnect();
  const settings = await getZkSettings();
  const activeSeason = seasonFilter || settings.season;

  const seasonQuery = activeSeason && activeSeason !== "all" ? { season: activeSeason } : {};
  const notDeleted = { deletedAt: null };

  // 1. Receipts
  const receipts = await ZkReceipt.find({ ...notDeleted, ...seasonQuery }).lean();
  let barleyReceived = 0;
  let barleyBags = 0;
  let riceDirectReceived = 0;
  let riceDirectBags = 0;
  let cashTotal = 0;
  let cashCount = 0;

  const otherItemsMap: Record<string, { totalQuantity: number; unit: string; bags: number; count: number }> = {};

  receipts.forEach((r) => {
    if (r.item === "barley") {
      barleyReceived += r.quantity || 0;
      barleyBags += r.bags || 0;
    } else if (r.item === "rice") {
      riceDirectReceived += r.quantity || 0;
      riceDirectBags += r.bags || 0;
    } else if (r.item === "cash") {
      cashTotal += r.amount || r.quantity || 0;
      cashCount += 1;
    } else if (r.item === "other") {
      const name = r.item_name || "صنف غير مسمى";
      if (!otherItemsMap[name]) {
        otherItemsMap[name] = { totalQuantity: 0, unit: r.unit || "وحدة", bags: 0, count: 0 };
      }
      otherItemsMap[name].totalQuantity += r.quantity || 0;
      otherItemsMap[name].bags += r.bags || 0;
      otherItemsMap[name].count += 1;
    }
  });

  // 2. Mills (Tabyid)
  const mills = await ZkMill.find({ ...notDeleted, ...seasonQuery }).lean();
  let barleyMilled = 0;
  let riceFromMilling = 0;
  mills.forEach((m) => {
    riceFromMilling += m.rice_kg || 0;
    if (m.allocs && Array.isArray(m.allocs)) {
      m.allocs.forEach((a) => {
        barleyMilled += a.kg || 0;
      });
    } else {
      barleyMilled += m.in_kg || 0;
    }
  });

  // 3. Distributions
  const distributions = await ZkDistribution.find({ ...notDeleted, ...seasonQuery }).lean();
  let riceDistributed = 0;
  let riceDistributedBags = 0;
  distributions.forEach((d) => {
    riceDistributed += d.quantity_kg || 0;
    riceDistributedBags += d.bags || 0;
  });

  // 4. Adjustments
  const adjustments = await ZkAdjustment.find({ ...notDeleted, ...seasonQuery }).lean();
  let barleyAdjusted = 0;
  let riceAdjusted = 0;
  adjustments.forEach((adj) => {
    if (adj.store === "barley") barleyAdjusted += adj.kg || 0;
    if (adj.store === "rice") riceAdjusted += adj.kg || 0;
  });

  // 5. Expenses
  const expenses = await ZkExpense.find({ ...notDeleted, ...seasonQuery }).lean();
  let expensesTotal = 0;
  expenses.forEach((e) => {
    expensesTotal += e.amount || 0;
  });

  // Balances calculation
  const openingBarley = activeSeason === "all" ? 0 : settings.opening_barley_kg || 0;
  const openingRice = activeSeason === "all" ? 0 : settings.opening_rice_kg || 0;

  const barleyBalance = openingBarley + barleyReceived - barleyMilled + barleyAdjusted;
  const riceBalance = openingRice + riceFromMilling + riceDirectReceived - riceDistributed + riceAdjusted;

  // Counts
  const donorsCount = await ZkDonor.countDocuments({ ...notDeleted, ...seasonQuery });
  const beneficiariesCount = await ZkBeneficiary.countDocuments({ ...notDeleted });

  // Recent 10 activities across receipts, mills, distributions
  const recentReceipts = receipts.slice(-5).map((r) => ({
    id: String(r._id),
    type: "استلام",
    no: r.no,
    title: `استلام ${r.item === "barley" ? "شعير" : r.item === "rice" ? "أرز" : r.item === "cash" ? "نقدي" : r.item_name} من ${r.donor_name}`,
    subTitle: r.notes || r.store_label,
    date: r.date,
    amountOrQty: r.item === "cash" ? `${r.amount} ج.م` : `${r.quantity} ${r.unit}`,
  }));

  const recentDistributions = distributions.slice(-5).map((d) => ({
    id: String(d._id),
    type: "توزيع",
    no: d.no,
    title: `توزيع أرز إلى ${d.beneficiary_name}`,
    subTitle: d.place || "",
    date: d.date,
    amountOrQty: `${d.quantity_kg} كجم`,
  }));

  const recentMills = mills.slice(-5).map((m) => ({
    id: String(m._id),
    type: "تبييض",
    no: m.no,
    title: `عملية تبييض بمضرب ${m.place}`,
    subTitle: `دخل: ${m.in_kg} كجم شعير | خرج: ${m.rice_kg} كجم أرز`,
    date: m.date,
    amountOrQty: `${m.rice_kg} كجم أرز`,
  }));

  const allRecent = [...recentReceipts, ...recentDistributions, ...recentMills]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return {
    season: activeSeason,
    barley: {
      balance: barleyBalance,
      opening: openingBarley,
      received: barleyReceived,
      milled: barleyMilled,
      adjusted: barleyAdjusted,
      bags: barleyBags,
      isLow: barleyBalance <= (settings.min_barley_kg || 500),
      minAlert: settings.min_barley_kg || 500,
    },
    rice: {
      balance: riceBalance,
      opening: openingRice,
      fromMilling: riceFromMilling,
      receivedDirect: riceDirectReceived,
      distributed: riceDistributed,
      adjusted: riceAdjusted,
      bags: riceDirectBags - riceDistributedBags,
      isLow: riceBalance <= (settings.min_rice_kg || 500),
      minAlert: settings.min_rice_kg || 500,
    },
    otherItems: Object.entries(otherItemsMap).map(([name, data]) => ({
      name,
      ...data,
    })),
    cash: {
      totalAmount: cashTotal,
      count: cashCount,
    },
    expenses: {
      totalAmount: expensesTotal,
      count: expenses.length,
    },
    counts: {
      donors: donorsCount,
      beneficiaries: beneficiariesCount,
      receipts: receipts.length,
      mills: mills.length,
      distributions: distributions.length,
    },
    recentActivity: allRecent,
  };
}

/**
 * Sequential number generator: finds highest number and pads to 5 digits
 */
export async function getNextSerial(
  model: typeof ZkReceipt | typeof ZkMill | typeof ZkDistribution
): Promise<string> {
  await dbConnect();
  const records = await (model as any)
    .find({}, { no: 1 })
    .sort({ createdAt: -1 })
    .lean();

  let maxNo = 0;
  for (const r of records) {
    const parsed = parseInt(r.no, 10);
    if (!isNaN(parsed) && parsed > maxNo) {
      maxNo = parsed;
    }
  }
  return padSerialNo(maxNo + 1);
}

/**
 * Checks stock availability before an operation that deducts barley or rice
 */
export async function checkStockAvailability(
  store: "barley" | "rice",
  requiredKg: number,
  season?: string,
  excludeCurrentDoc?: { id: string; oldKg: number }
): Promise<{ available: boolean; currentBalance: number; remainingAfter: number }> {
  const stock = await calculateStock(season);
  let currentBalance = store === "barley" ? stock.barley.balance : stock.rice.balance;

  // If modifying an existing document, give back its previous deduction
  if (excludeCurrentDoc) {
    currentBalance += excludeCurrentDoc.oldKg;
  }

  const remainingAfter = currentBalance - requiredKg;
  return {
    available: remainingAfter >= 0,
    currentBalance,
    remainingAfter,
  };
}

/**
 * Automatic Expense synchronization for Milling operations
 */
export async function syncMillAutoExpenses(
  mill: any,
  user: { id?: string; name?: string },
  isDelete = false
) {
  await dbConnect();
  const millId = mill._id;

  if (isDelete) {
    await ZkExpense.updateMany(
      { mill_id: millId, auto: true },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: user.id || "system",
          deletedByName: user.name || "النظام",
        },
      }
    );
    return;
  }

  const costDefs: Array<{ key: string; label: string; field: keyof typeof mill.costs }> = [
    { key: "millCost", label: "تبييض", field: "millCost" },
    { key: "loadCost", label: "تحميل", field: "loadCost" },
    { key: "transportCost", label: "نقل", field: "transportCost" },
    { key: "unloadCost", label: "تنزيل", field: "unloadCost" },
    { key: "labor", label: "عمالة", field: "labor" },
    { key: "extra", label: "أخرى", field: "extra" },
  ];

  for (const def of costDefs) {
    const amount = Number(mill.costs?.[def.field] || 0);
    const autoKey = `exp_${millId}_${def.key}`;

    if (amount > 0) {
      await ZkExpense.findOneAndUpdate(
        { auto_key: autoKey },
        {
          $set: {
            date: mill.date,
            type: def.label,
            amount: amount,
            qty: mill.bags || 1,
            unit: "شيكارة",
            party: mill.place,
            ref_text: `تبييض ${mill.no}`,
            mill_id: millId,
            auto: true,
            season: mill.season,
            notes: `مصروف آلي مولَّد من عملية التبييض رقم ${mill.no}`,
            deletedAt: null,
            updatedBy: user.id || "",
            updatedByName: user.name || "",
          },
          $setOnInsert: {
            createdBy: user.id || "",
            createdByName: user.name || "",
            version: 1,
          },
        },
        { upsert: true, new: true }
      );
    } else {
      // If cost became 0, soft-delete any previously created auto expense
      await ZkExpense.updateMany(
        { auto_key: autoKey, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
            deletedBy: user.id || "system",
            deletedByName: user.name || "النظام",
          },
        }
      );
    }
  }
}

/**
 * Creates an Audit Log entry with human-readable Arabic differences
 */
export async function logZkAudit({
  user,
  action,
  entity,
  entity_id,
  before,
  after,
  override = false,
  notes = "",
}: {
  user: { id?: string; name?: string };
  action: "إضافة" | "تعديل" | "حذف" | "استيراد" | "ترقيم" | "استعادة" | "تسوية";
  entity: "متبرع" | "استلام" | "تبييض" | "مصروف" | "مستفيد" | "توزيع" | "تسوية" | "إعدادات";
  entity_id: string;
  before?: any;
  after?: any;
  override?: boolean;
  notes?: string;
}) {
  await dbConnect();
  const diff = computeFieldDiff(before, after);

  await ZkAudit.create({
    ts: new Date(),
    user_id: user.id || "",
    user_name: user.name || "غير محدد",
    action,
    entity,
    entity_id: String(entity_id),
    before: before ? JSON.parse(JSON.stringify(before)) : null,
    after: after ? JSON.parse(JSON.stringify(after)) : null,
    diff,
    override,
    notes,
  });
}

/**
 * Generates Donor Statement (كشف حساب متبرع)
 */
export async function getDonorStatement(donorId: string, season?: string) {
  await dbConnect();
  const donor = await ZkDonor.findById(donorId).lean();
  if (!donor) throw new Error("المتبرع غير موجود");

  const seasonQuery = season && season !== "all" ? { season } : {};
  const notDeleted = { deletedAt: null };

  const receipts = await ZkReceipt.find({ donor_id: donorId, ...notDeleted, ...seasonQuery })
    .sort({ date: 1 })
    .lean();

  // Find all milling allocations for this donor
  const mills = await ZkMill.find({
    "allocs.donor_id": new mongoose.Types.ObjectId(donorId),
    ...notDeleted,
    ...seasonQuery,
  })
    .sort({ date: 1 })
    .lean();

  let totalBarleyReceived = 0;
  let totalRiceReceived = 0;
  let totalCashDonated = 0;
  const otherItems: Record<string, number> = {};

  receipts.forEach((r) => {
    if (r.item === "barley") totalBarleyReceived += r.quantity || 0;
    else if (r.item === "rice") totalRiceReceived += r.quantity || 0;
    else if (r.item === "cash") totalCashDonated += r.amount || r.quantity || 0;
    else if (r.item === "other") {
      const name = r.item_name || "صنف آخر";
      otherItems[name] = (otherItems[name] || 0) + (r.quantity || 0);
    }
  });

  // Calculate milling sent & share of resulting white rice
  let totalBarleyMilled = 0;
  let totalEstimatedRiceProduced = 0;

  const millingRecords = mills.map((m) => {
    const alloc = m.allocs.find((a: any) => String(a.donor_id) === String(donorId));
    const allocKg = alloc ? alloc.kg : 0;
    totalBarleyMilled += allocKg;

    const millingRate = m.in_kg > 0 ? (m.rice_kg / m.in_kg) : 0;
    const donorRiceShare = allocKg * millingRate;
    totalEstimatedRiceProduced += donorRiceShare;

    return {
      millNo: m.no,
      date: m.date,
      place: m.place,
      in_kg_total: m.in_kg,
      donor_barley_kg: allocKg,
      total_rice_kg: m.rice_kg,
      milling_rate_percent: Number((millingRate * 100).toFixed(1)),
      donor_rice_share_kg: Number(donorRiceShare.toFixed(1)),
    };
  });

  const remainingBarleyInWarehouse = totalBarleyReceived - totalBarleyMilled;

  return {
    donor,
    summary: {
      totalBarleyReceived,
      totalRiceReceived,
      totalCashDonated,
      otherItems,
      totalBarleyMilled,
      totalEstimatedRiceProduced: Number(totalEstimatedRiceProduced.toFixed(1)),
      remainingBarleyInWarehouse,
    },
    receipts,
    millingRecords,
  };
}

/**
 * Generates Beneficiary Statement (كشف حساب مستفيد)
 */
export async function getBeneficiaryStatement(beneficiaryId: string, season?: string) {
  await dbConnect();
  let beneficiary = await ZkBeneficiary.findById(beneficiaryId).lean();
  if (!beneficiary) {
    const mainB = await Beneficiary.findById(beneficiaryId).lean();
    if (mainB) {
      beneficiary = {
        _id: mainB._id,
        name: mainB.name,
        phone: mainB.phone,
        area: mainB.address,
        family_size: mainB.familyMembers || 1,
        notes: mainB.notes,
        extra: mainB.internalId ? `كود: ${mainB.internalId}` : (mainB.nationalId || ""),
      } as any;
    }
  }
  if (!beneficiary) throw new Error("المستفيد غير موجود");

  const seasonQuery = season && season !== "all" ? { season } : {};
  const notDeleted = { deletedAt: null };

  const distributions = await ZkDistribution.find({
    beneficiary_id: beneficiaryId,
    ...notDeleted,
    ...seasonQuery,
  })
    .sort({ date: 1 })
    .lean();

  let totalRiceKg = 0;
  let totalBags = 0;

  distributions.forEach((d) => {
    totalRiceKg += d.quantity_kg || 0;
    totalBags += d.bags || 0;
  });

  return {
    beneficiary,
    summary: {
      totalDistributions: distributions.length,
      totalRiceKg,
      totalBags,
    },
    distributions,
  };
}

/**
 * Generates Warehouse Movement Statement with running balance (كشف حركة مخزن)
 */
export async function getStoreStatement(store: "barley" | "rice", season?: string) {
  await dbConnect();
  const settings = await getZkSettings();
  const seasonQuery = season && season !== "all" ? { season } : {};
  const notDeleted = { deletedAt: null };

  const openingKg = store === "barley" ? settings.opening_barley_kg || 0 : settings.opening_rice_kg || 0;

  const events: Array<{
    date: Date;
    type: string;
    no?: string;
    description: string;
    in_kg: number;
    out_kg: number;
    balance: number;
    notes?: string;
  }> = [];

  if (store === "barley") {
    // Receipts
    const receipts = await ZkReceipt.find({ item: "barley", ...notDeleted, ...seasonQuery }).lean();
    receipts.forEach((r) => {
      events.push({
        date: r.date,
        type: "وارد استلام",
        no: r.no,
        description: `توريد من المتبرع: ${r.donor_name} (${r.bags} شيكارة)`,
        in_kg: r.quantity || 0,
        out_kg: 0,
        balance: 0,
        notes: r.notes,
      });
    });

    // Milling (outward)
    const mills = await ZkMill.find({ ...notDeleted, ...seasonQuery }).lean();
    mills.forEach((m) => {
      events.push({
        date: m.date,
        type: "صادر للتبييض",
        no: m.no,
        description: `تبييض بمضرب: ${m.place}`,
        in_kg: 0,
        out_kg: m.in_kg || 0,
        balance: 0,
        notes: m.notes,
      });
    });

    // Adjustments
    const adjs = await ZkAdjustment.find({ store: "barley", ...notDeleted, ...seasonQuery }).lean();
    adjs.forEach((a) => {
      events.push({
        date: a.date,
        type: a.kg >= 0 ? "تسوية إضافة" : "تسوية خصم",
        description: `تسوية جردية: ${a.reason}`,
        in_kg: a.kg > 0 ? a.kg : 0,
        out_kg: a.kg < 0 ? Math.abs(a.kg) : 0,
        balance: 0,
        notes: a.notes,
      });
    });
  } else {
    // Rice Store
    // Direct receipts
    const receipts = await ZkReceipt.find({ item: "rice", ...notDeleted, ...seasonQuery }).lean();
    receipts.forEach((r) => {
      events.push({
        date: r.date,
        type: "وارد استلام مباشر",
        no: r.no,
        description: `توريد أرز من المتبرع: ${r.donor_name}`,
        in_kg: r.quantity || 0,
        out_kg: 0,
        balance: 0,
        notes: r.notes,
      });
    });

    // From Milling
    const mills = await ZkMill.find({ ...notDeleted, ...seasonQuery }).lean();
    mills.forEach((m) => {
      events.push({
        date: m.date,
        type: "وارد من التبييض",
        no: m.no,
        description: `أرز أبيض ناتج من تبييض مضرب: ${m.place} (ردة: ${m.bran_kg}كجم)`,
        in_kg: m.rice_kg || 0,
        out_kg: 0,
        balance: 0,
        notes: m.notes,
      });
    });

    // Distributions
    const dists = await ZkDistribution.find({ ...notDeleted, ...seasonQuery }).lean();
    dists.forEach((d) => {
      events.push({
        date: d.date,
        type: "صادر توزيع",
        no: d.no,
        description: `صرف للمستفيد: ${d.beneficiary_name} (${d.unit === "شيكارة" ? `${d.bags} شيكارة` : `${d.quantity_kg} كجم`})`,
        in_kg: 0,
        out_kg: d.quantity_kg || 0,
        balance: 0,
        notes: d.notes,
      });
    });

    // Adjustments
    const adjs = await ZkAdjustment.find({ store: "rice", ...notDeleted, ...seasonQuery }).lean();
    adjs.forEach((a) => {
      events.push({
        date: a.date,
        type: a.kg >= 0 ? "تسوية إضافة" : "تسوية خصم",
        description: `تسوية جردية: ${a.reason}`,
        in_kg: a.kg > 0 ? a.kg : 0,
        out_kg: a.kg < 0 ? Math.abs(a.kg) : 0,
        balance: 0,
        notes: a.notes,
      });
    });
  }

  // Sort events chronologically
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate cumulative running balance
  let running = openingKg;
  events.forEach((ev) => {
    running += ev.in_kg - ev.out_kg;
    ev.balance = running;
  });

  return {
    store,
    season: season || settings.season,
    openingKg,
    closingBalance: running,
    events,
  };
}

/**
 * Re-numbering tool for Admin: renumbers from 1 chronologically
 */
export async function renumberEntity(
  entityType: "receipts" | "mills" | "distributions",
  user: { id?: string; name?: string }
) {
  await dbConnect();
  let model: any = ZkReceipt;
  let label = "استلام";
  if (entityType === "mills") {
    model = ZkMill;
    label = "تبييض";
  } else if (entityType === "distributions") {
    model = ZkDistribution;
    label = "توزيع";
  }

  // Fetch all non-deleted records sorted by date ASC, then createdAt ASC
  const records = await model.find({ deletedAt: null }).sort({ date: 1, createdAt: 1 });

  let counter = 1;
  const updates: Array<{ id: string; oldNo: string; newNo: string }> = [];

  for (const rec of records) {
    const newNo = padSerialNo(counter);
    if (rec.no !== newNo) {
      updates.push({ id: String(rec._id), oldNo: rec.no, newNo });
      rec.no = newNo;
      await rec.save();
    }
    counter++;
  }

  await logZkAudit({
    user,
    action: "ترقيم",
    entity: (label === "استلام" ? "استلام" : label === "تبييض" ? "تبييض" : "توزيع") as any,
    entity_id: "batch",
    before: { updatedCount: updates.length },
    after: { totalNumbered: records.length, updates },
    notes: `إعادة ترقيم جميع عمليات ${label} من 00001 تصاعديًا حسب التاريخ`,
  });

  return { updatedCount: updates.length, total: records.length };
}

