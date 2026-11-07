import dbConnect from "@/lib/mongodb";
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
} from "@/lib/models/zakat-rice";
import { calculateStock, getZkSettings } from "./ledger";
import { formatNumber, formatCurrency } from "./utils";

export async function getZkReportData(reportKey: string, params: { season?: string; from?: string; to?: string }) {
  await dbConnect();
  const settings = await getZkSettings();
  const season = params.season || settings.season;
  const notDeleted = { deletedAt: null };

  const seasonFilter = season && season !== "all" ? { season } : {};

  const dateFilter: any = {};
  if (params.from || params.to) {
    dateFilter.date = {};
    if (params.from) dateFilter.date.$gte = new Date(params.from);
    if (params.to) {
      const end = new Date(params.to);
      end.setHours(23, 59, 59, 999);
      dateFilter.date.$lte = end;
    }
  }

  const query = { ...notDeleted, ...seasonFilter, ...dateFilter };

  switch (reportKey) {
    // 1. Donors Report
    case "donors": {
      const donors = await ZkDonor.find({ ...notDeleted, ...seasonFilter }).sort({ name: 1 }).lean();
      const receipts = await ZkReceipt.find(query).lean();

      const donorsMap: Record<string, {
        name: string;
        phone: string;
        land: string;
        barleyKg: number;
        riceKg: number;
        cashAmount: number;
        otherCount: number;
        receiptsCount: number;
      }> = {};

      donors.forEach((d) => {
        donorsMap[String(d._id)] = {
          name: d.name,
          phone: d.phone || "—",
          land: d.land_description || "—",
          barleyKg: 0,
          riceKg: 0,
          cashAmount: 0,
          otherCount: 0,
          receiptsCount: 0,
        };
      });

      receipts.forEach((r) => {
        const dId = String(r.donor_id);
        if (!donorsMap[dId]) {
          donorsMap[dId] = {
            name: r.donor_name,
            phone: "—",
            land: "—",
            barleyKg: 0,
            riceKg: 0,
            cashAmount: 0,
            otherCount: 0,
            receiptsCount: 0,
          };
        }
        donorsMap[dId].receiptsCount += 1;
        if (r.item === "barley") donorsMap[dId].barleyKg += r.quantity || 0;
        else if (r.item === "rice") donorsMap[dId].riceKg += r.quantity || 0;
        else if (r.item === "cash") donorsMap[dId].cashAmount += r.amount || r.quantity || 0;
        else if (r.item === "other") donorsMap[dId].otherCount += r.quantity || 1;
      });

      const list = Object.values(donorsMap).sort((a, b) => (b.barleyKg + b.riceKg) - (a.barleyKg + a.riceKg));
      return {
        title: "تقرير المتبرعين الإجمالي",
        season,
        headers: ["اسم المتبرع", "الهاتف", "وصف الأرض", "شعير (كجم)", "أرز (كجم)", "نقدي (ج.م)", "أصناف أخرى", "عدد التوريدات"],
        rows: list.map((d) => [
          d.name,
          d.phone,
          d.land,
          formatNumber(d.barleyKg),
          formatNumber(d.riceKg),
          formatCurrency(d.cashAmount),
          d.otherCount,
          d.receiptsCount,
        ]),
        summary: {
          totalDonors: list.length,
          totalBarleyKg: list.reduce((acc, x) => acc + x.barleyKg, 0),
          totalRiceKg: list.reduce((acc, x) => acc + x.riceKg, 0),
          totalCash: list.reduce((acc, x) => acc + x.cashAmount, 0),
        },
      };
    }

    // 2. Receipts Report
    case "receipts": {
      const receipts = await ZkReceipt.find(query).sort({ date: -1, no: -1 }).lean();
      return {
        title: "تقرير الاستلامات المفصل",
        season,
        headers: ["رقم الإيصال", "التاريخ", "اسم المتبرع", "نوع الصنف", "الكمية / الوزن", "الوحدة", "الشكاير", "المبلغ", "المخزن", "الموظف"],
        rows: receipts.map((r) => [
          r.no,
          new Date(r.date).toLocaleDateString("ar-EG"),
          r.donor_name,
          r.item === "barley" ? "شعير" : r.item === "rice" ? "أرز" : r.item === "cash" ? "نقدي" : (r.item_name || "صنف آخر"),
          formatNumber(r.quantity),
          r.unit,
          r.bags > 0 ? `${r.bags} (${r.bag_kg}كجم)` : "—",
          r.amount ? formatCurrency(r.amount) : "—",
          r.store_label,
          r.createdByName || "—",
        ]),
        summary: {
          count: receipts.length,
          barleyKg: receipts.filter((r) => r.item === "barley").reduce((acc, r) => acc + r.quantity, 0),
          riceKg: receipts.filter((r) => r.item === "rice").reduce((acc, r) => acc + r.quantity, 0),
          cash: receipts.filter((r) => r.item === "cash").reduce((acc, r) => acc + (r.amount || r.quantity), 0),
        },
      };
    }

    // 3. Items Summary Report (حصر الأصناف)
    case "items-summary": {
      const receipts = await ZkReceipt.find(query).lean();
      const groups: Record<string, { itemType: string; count: number; totalBags: number; totalQuantity: number; unit: string; totalAmount: number }> = {};

      receipts.forEach((r) => {
        const key = r.item === "other" ? `صنف آخر: ${r.item_name || "غير محدد"}` : (r.item === "barley" ? "شعير" : r.item === "rice" ? "أرز" : "تبرع نقدي");
        if (!groups[key]) {
          groups[key] = {
            itemType: key,
            count: 0,
            totalBags: 0,
            totalQuantity: 0,
            unit: r.unit || (r.item === "cash" ? "جنيه" : "كجم"),
            totalAmount: 0,
          };
        }
        groups[key].count += 1;
        groups[key].totalBags += r.bags || 0;
        groups[key].totalQuantity += r.quantity || 0;
        groups[key].totalAmount += r.amount || 0;
      });

      return {
        title: "حصر الأصناف والتوريدات",
        season,
        headers: ["الصنف", "عدد العمليات", "إجمالي الشكاير", "إجمالي الكمية", "الوحدة", "المبلغ النقدي"],
        rows: Object.values(groups).map((g) => [
          g.itemType,
          g.count,
          g.totalBags,
          formatNumber(g.totalQuantity),
          g.unit,
          g.totalAmount > 0 ? formatCurrency(g.totalAmount) : "—",
        ]),
      };
    }

    // 4. Barley Store Report
    case "barley-store": {
      const stock = await calculateStock(season);
      return {
        title: "تقرير مخزن الشعير",
        season,
        headers: ["البيان", "الكمية (كجم)", "عدد الشكاير التقديري", "الملاحظات"],
        rows: [
          ["رصيد أول المدة (افتتاحي)", formatNumber(stock.barley.opening), "—", "الرصيد المرحل"],
          ["إجمالي الوارد (استلامات)", formatNumber(stock.barley.received), stock.barley.bags, "من المزارعين والمتبرعين"],
          ["إجمالي الصادر للتبييض", formatNumber(stock.barley.milled), "—", "محول للمضارب"],
          ["التسويات الجردية", formatNumber(stock.barley.adjusted), "—", "تسويات بالزيادة أو النقص"],
          ["الرصيد الحالي بالمخزن", formatNumber(stock.barley.balance), "—", stock.barley.isLow ? "تنبيه: الرصيد أقل من الحد الأدنى!" : "رصيد آمن"],
        ],
        balance: stock.barley.balance,
      };
    }

    // 5. Rice Store Report
    case "rice-store": {
      const stock = await calculateStock(season);
      return {
        title: "تقرير مخزن الأرز الأبيض",
        season,
        headers: ["البيان", "الكمية (كجم)", "الملاحظات"],
        rows: [
          ["رصيد أول المدة (افتتاحي)", formatNumber(stock.rice.opening), "رصيد مرحل"],
          ["أرز ناتج من التبييض (المضارب)", formatNumber(stock.rice.fromMilling), "مستلم من التبييض"],
          ["أرز وارد استلام مباشر", formatNumber(stock.rice.receivedDirect), "متبرعون بأرز جاهز"],
          ["إجمالي المصروف (توزيعات)", formatNumber(stock.rice.distributed), "موزع على الأسر المستحقة"],
          ["التسويات الجردية", formatNumber(stock.rice.adjusted), "تسويات جردية"],
          ["الرصيد المتاح حاليًا", formatNumber(stock.rice.balance), stock.rice.isLow ? "تنبيه: تحت حد الأمان!" : "رصيد متوفر"],
        ],
        balance: stock.rice.balance,
      };
    }

    // 6. Mills Report
    case "mills": {
      const mills = await ZkMill.find(query).sort({ date: -1, no: -1 }).lean();
      return {
        title: "تقرير عمليات التبييض والمضارب",
        season,
        headers: ["رقم العملية", "التاريخ", "المضرب", "الشعير الداخل (كجم)", "الأرز الناتج (كجم)", "نسبة التصافي", "الردة (كجم)", "الفاقد (كجم)", "إجمالي التكاليف"],
        rows: mills.map((m) => {
          const rate = m.in_kg > 0 ? (m.rice_kg / m.in_kg) * 100 : 0;
          const costs = Object.values(m.costs || {}).reduce((acc: number, c: any) => acc + (Number(c) || 0), 0);
          return [
            m.no,
            new Date(m.date).toLocaleDateString("ar-EG"),
            m.place,
            formatNumber(m.in_kg),
            formatNumber(m.rice_kg),
            `${rate.toFixed(1)}%`,
            formatNumber(m.bran_kg),
            formatNumber(m.waste_kg),
            formatCurrency(costs),
          ];
        }),
        summary: {
          count: mills.length,
          totalInKg: mills.reduce((acc, m) => acc + (m.in_kg || 0), 0),
          totalRiceKg: mills.reduce((acc, m) => acc + (m.rice_kg || 0), 0),
        },
      };
    }

    // 7. Beneficiaries Report
    case "beneficiaries": {
      const beneficiaries = await ZkBeneficiary.find({ ...notDeleted }).sort({ name: 1 }).lean();
      const dists = await ZkDistribution.find(query).lean();

      const bMap: Record<string, { name: string; phone: string; area: string; family: number; totalKg: number; count: number }> = {};
      beneficiaries.forEach((b) => {
        bMap[String(b._id)] = {
          name: b.name,
          phone: b.phone || "—",
          area: b.area || "—",
          family: b.family_size || 1,
          totalKg: 0,
          count: 0,
        };
      });

      dists.forEach((d) => {
        const id = String(d.beneficiary_id);
        if (bMap[id]) {
          bMap[id].totalKg += d.quantity_kg || 0;
          bMap[id].count += 1;
        }
      });

      const rows = Object.values(bMap).map((b) => [
        b.name,
        b.phone,
        b.area,
        b.family,
        b.count,
        formatNumber(b.totalKg),
      ]);

      return {
        title: "تقرير المستفيدين وإجمالي الصرف",
        season,
        headers: ["اسم المستفيد", "الهاتف", "المنطقة", "أفراد الأسرة", "مرات الصرف", "إجمالي الأرز المستلم (كجم)"],
        rows,
        summary: {
          totalBeneficiaries: beneficiaries.length,
          totalKgDistributed: Object.values(bMap).reduce((acc, b) => acc + b.totalKg, 0),
        },
      };
    }

    // 8. Distributions Report
    case "distributions": {
      const dists = await ZkDistribution.find(query).sort({ date: -1, no: -1 }).lean();
      return {
        title: "تقرير التوزيعات المفصل",
        season,
        headers: ["رقم الإذن", "التاريخ", "اسم المستفيد", "الكمية (كجم)", "الوحدة الأصلية", "مكان التوزيع", "الموظف المسجل", "صرف استثنائي"],
        rows: dists.map((d) => [
          d.no,
          new Date(d.date).toLocaleDateString("ar-EG"),
          d.beneficiary_name,
          formatNumber(d.quantity_kg),
          d.unit === "شيكارة" ? `${d.bags} شيكارة` : `${d.entered_qty} كجم`,
          d.place || "المقر",
          d.createdByName || "—",
          d.override ? "نعم (تجاوز)" : "لا",
        ]),
        summary: {
          count: dists.length,
          totalKg: dists.reduce((acc, d) => acc + (d.quantity_kg || 0), 0),
        },
      };
    }

    // 9. Expenses Report
    case "expenses": {
      const expenses = await ZkExpense.find(query).sort({ date: -1 }).lean();
      return {
        title: "تقرير المصروفات التشغيلية",
        season,
        headers: ["التاريخ", "نوع المصروف", "المبلغ", "العدد والوحدة", "المستلم / الجهة", "السائق / السيارة", "الارتباط", "المصدر"],
        rows: expenses.map((e) => [
          new Date(e.date).toLocaleDateString("ar-EG"),
          e.type,
          formatCurrency(e.amount),
          `${e.qty} ${e.unit}`,
          e.party || "—",
          e.car_driver || "—",
          e.ref_text || "—",
          e.auto ? "آلي (تبييض)" : "يدوي",
        ]),
        summary: {
          count: expenses.length,
          totalAmount: expenses.reduce((acc, e) => acc + (e.amount || 0), 0),
        },
      };
    }

    // 10. Cost Summary Report (تقرير التكاليف المجمع)
    case "cost-summary": {
      const expenses = await ZkExpense.find(query).lean();
      const mills = await ZkMill.find(query).lean();

      const costByType: Record<string, number> = {};
      let totalAllExpenses = 0;

      expenses.forEach((e) => {
        costByType[e.type] = (costByType[e.type] || 0) + (e.amount || 0);
        totalAllExpenses += e.amount || 0;
      });

      const totalWhiteRiceProduced = mills.reduce((acc, m) => acc + (m.rice_kg || 0), 0);
      const costPerKg = totalWhiteRiceProduced > 0 ? totalAllExpenses / totalWhiteRiceProduced : 0;

      return {
        title: "تقرير التكاليف المجمع وتكلفة إنتاج الكيلو",
        season,
        headers: ["بند المصروف", "إجمالي التكلفة (ج.م)", "النسبة من الإجمالي"],
        rows: Object.entries(costByType).map(([type, amt]) => [
          type,
          formatCurrency(amt),
          totalAllExpenses > 0 ? `${((amt / totalAllExpenses) * 100).toFixed(1)}%` : "0%",
        ]),
        summary: {
          totalExpenses: totalAllExpenses,
          totalWhiteRiceKg: totalWhiteRiceProduced,
          costPerKgRice: Number(costPerKg.toFixed(2)),
        },
      };
    }

    // 11. Cash Donations Report
    case "cash-donations": {
      const cashReceipts = await ZkReceipt.find({ ...query, item: "cash" }).sort({ date: -1 }).lean();
      return {
        title: "تقرير التبرعات النقدية المخصصة للأرز",
        season,
        headers: ["رقم الإيصال", "التاريخ", "اسم المتبرع", "المبلغ", "الغرض", "طريقة الدفع", "الملاحظات"],
        rows: cashReceipts.map((r) => [
          r.no,
          new Date(r.date).toLocaleDateString("ar-EG"),
          r.donor_name,
          formatCurrency(r.amount || r.quantity),
          r.purpose || "شراء أرز",
          r.payment_method || "نقدًا",
          r.notes || "—",
        ]),
        summary: {
          count: cashReceipts.length,
          totalAmount: cashReceipts.reduce((acc, r) => acc + (r.amount || r.quantity || 0), 0),
        },
      };
    }

    // 12. Adjustments Report
    case "adjustments": {
      const adjs = await ZkAdjustment.find(query).sort({ date: -1 }).lean();
      return {
        title: "تقرير التسويات الجردية للمخازن",
        season,
        headers: ["التاريخ", "المخزن", "نوع التسوية", "الكمية (كجم)", "السبب الإلزامي", "الموظف المسجل"],
        rows: adjs.map((a) => [
          new Date(a.date).toLocaleDateString("ar-EG"),
          a.store === "barley" ? "مخزن الشعير" : "مخزن الأرز",
          a.kg >= 0 ? "تسوية إضافة (+)" : "تسوية خصم / عجز (-)",
          formatNumber(Math.abs(a.kg)),
          a.reason,
          a.createdByName || "—",
        ]),
        summary: {
          count: adjs.length,
          netBarleyAdjustment: adjs.filter((a) => a.store === "barley").reduce((acc, a) => acc + a.kg, 0),
          netRiceAdjustment: adjs.filter((a) => a.store === "rice").reduce((acc, a) => acc + a.kg, 0),
        },
      };
    }

    // 13. Variances and Milling Rates Report
    case "variances-rates": {
      const mills = await ZkMill.find(query).sort({ date: 1 }).lean();
      return {
        title: "تقرير معدلات التبييض والتصافي والفاقد",
        season,
        headers: ["رقم العملية", "المضرب", "التاريخ", "الشعير (كجم)", "الأرز (كجم)", "التصافي %", "الردة %", "الفاقد %"],
        rows: mills.map((m) => {
          const inKg = m.in_kg || 1;
          const riceRate = ((m.rice_kg || 0) / inKg) * 100;
          const branRate = ((m.bran_kg || 0) / inKg) * 100;
          const wasteRate = ((m.waste_kg || 0) / inKg) * 100;
          return [
            m.no,
            m.place,
            new Date(m.date).toLocaleDateString("ar-EG"),
            formatNumber(m.in_kg),
            formatNumber(m.rice_kg),
            `${riceRate.toFixed(1)}%`,
            `${branRate.toFixed(1)}%`,
            `${wasteRate.toFixed(1)}%`,
          ];
        }),
      };
    }

    // 14. Audit Log Report
    case "audit": {
      const auditLogs = await ZkAudit.find().sort({ ts: -1 }).limit(100).lean();
      return {
        title: "سجل المراجعة والتدقيق",
        season,
        headers: ["الوقت", "المستخدم", "الإجراء", "الكيان", "المعرف", "التغييرات", "تجاوز رصيد"],
        rows: auditLogs.map((a) => [
          new Date(a.ts).toLocaleString("ar-EG"),
          a.user_name || "—",
          a.action,
          a.entity,
          a.entity_id,
          a.diff && a.diff.length > 0 ? a.diff.map((d: any) => `${d.label}: ${d.before} -> ${d.after}`).join(" | ") : (a.notes || "—"),
          a.override ? "نعم" : "لا",
        ]),
      };
    }

    default:
      throw new Error(`تقرير غير معروف: ${reportKey}`);
  }
}

/**
 * Generates Full Season Summary (التقرير الختامي للموسم)
 */
export async function getSeasonSummary(seasonFilter?: string) {
  await dbConnect();
  const settings = await getZkSettings();
  const season = seasonFilter || settings.season;
  const stock = await calculateStock(season);

  // Top donors by total weight
  const receipts = await ZkReceipt.find({ season, deletedAt: null }).lean();
  const donorWeightMap: Record<string, { name: string; barley: number; rice: number; cash: number }> = {};

  receipts.forEach((r) => {
    const id = String(r.donor_id);
    if (!donorWeightMap[id]) {
      donorWeightMap[id] = { name: r.donor_name, barley: 0, rice: 0, cash: 0 };
    }
    if (r.item === "barley") donorWeightMap[id].barley += r.quantity || 0;
    else if (r.item === "rice") donorWeightMap[id].rice += r.quantity || 0;
    else if (r.item === "cash") donorWeightMap[id].cash += r.amount || r.quantity || 0;
  });

  const topDonors = Object.values(donorWeightMap)
    .sort((a, b) => (b.barley + b.rice) - (a.barley + a.rice))
    .slice(0, 10);

  // Overall milling efficiency
  const totalBarleyIn = stock.barley.milled;
  const totalRiceOut = stock.rice.fromMilling;
  const averageMillingRate = totalBarleyIn > 0 ? (totalRiceOut / totalBarleyIn) * 100 : 0;

  // Cash surplus or deficit
  const cashNet = stock.cash.totalAmount - stock.expenses.totalAmount;

  return {
    org_name: settings.org_name,
    org_logo: settings.org_logo,
    season,
    generatedAt: new Date(),
    stock,
    averageMillingRate: Number(averageMillingRate.toFixed(1)),
    cashSummary: {
      totalDonations: stock.cash.totalAmount,
      totalExpenses: stock.expenses.totalAmount,
      cashNet,
    },
    topDonors,
  };
}

