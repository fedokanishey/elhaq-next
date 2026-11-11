"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Warehouse,
  Factory,
  Package,
  HeartHandshake,
  Send,
  Receipt,
  Scale,
  FileText,
  FileCheck2,
  CalendarDays,
  History,
  Settings,
  Plus,
  Search,
  Printer,
  Download,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  X,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ShoppingCart,
  TrendingUp,
  Coins,
  ScanBarcode,
} from "lucide-react";
import { formatNumber, formatCurrency, padSerialNo } from "@/lib/services/zakat-rice/utils";
import QRScannerModal from "@/components/QRScannerModal";
import ZkReceiptPrintModal from "./ZkReceiptPrintModal";
import ZkStatementPrintModal from "./ZkStatementPrintModal";
import ZkExcelImportModal from "./ZkExcelImportModal";
import ZkAuditModal from "./ZkAuditModal";
import ZkSearchableSelect from "./ZkSearchableSelect";

export default function ZkMainView() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [season, setSeason] = useState<string>("2026");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modals state
  const [printReceiptData, setPrintReceiptData] = useState<any | null>(null);
  const [statementModalData, setStatementModalData] = useState<any | null>(null);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);

  // Form Modals
  const [isDonorModalOpen, setIsDonorModalOpen] = useState(false);
  const [editingDonor, setEditingDonor] = useState<any | null>(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<any | null>(null);
  const [receiptTypeFilter, setReceiptTypeFilter] = useState<"all" | "donation" | "purchase" | "sale">("all");

  const [isMillModalOpen, setIsMillModalOpen] = useState(false);
  const [editingMill, setEditingMill] = useState<any | null>(null);

  const [isBeneficiaryModalOpen, setIsBeneficiaryModalOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<any | null>(null);
  const [isBeneficiaryTabScannerOpen, setIsBeneficiaryTabScannerOpen] = useState(false);

  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [editingDistribution, setEditingDistribution] = useState<any | null>(null);
  const [isDistributionTabScannerOpen, setIsDistributionTabScannerOpen] = useState(false);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);

  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);

  // Delete Confirmation Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({ isOpen: false, title: "", message: "", onConfirm: async () => {} });

  // 1. Fetch Live Stock & Summary
  const { data: stockRes, isValidating: isStockValidating } = useSWR(
    `/api/zakat-rice/stock?season=${season}`,
    fetcher,
    { refreshInterval: 15000 }
  );
  const stock = stockRes?.data;

  // 2. Fetch Settings
  const { data: settingsRes } = useSWR(`/api/zakat-rice/settings`, fetcher);
  const settings = settingsRes?.data;

  // Update season from settings on first load
  useEffect(() => {
    if (settings?.season && season === "2026") {
      setSeason(settings.season);
    }
  }, [settings]);

  // SWR queries - Preload donors & beneficiaries so all modals & tabs open instantly without delays
  const { data: donorsRes, mutate: mutateDonors } = useSWR(
    `/api/zakat-rice/donors?season=${season}&limit=1000${activeTab === "donors" && searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ""}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 8000 }
  );
  const donors = donorsRes?.data || [];

  const { data: receiptsRes, mutate: mutateReceipts } = useSWR(
    activeTab === "receipts"
      ? `/api/zakat-rice/receipts?season=${season}&q=${encodeURIComponent(searchTerm)}`
      : null,
    fetcher
  );
  const receipts = receiptsRes?.data || [];
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r: any) => {
      if (receiptTypeFilter === "all") return true;
      const op = r.operation_type || "donation";
      return op === receiptTypeFilter;
    });
  }, [receipts, receiptTypeFilter]);

  const { data: millsRes, mutate: mutateMills } = useSWR(
    activeTab === "mills"
      ? `/api/zakat-rice/mills?season=${season}&q=${encodeURIComponent(searchTerm)}`
      : null,
    fetcher
  );
  const mills = millsRes?.data || [];

  const { data: beneficiariesRes, mutate: mutateBeneficiaries } = useSWR(
    `/api/zakat-rice/beneficiaries?limit=0${activeTab === "beneficiaries" && searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ""}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 8000 }
  );
  const beneficiaries = beneficiariesRes?.data || [];

  const { data: distributionsRes, mutate: mutateDistributions } = useSWR(
    activeTab === "distributions"
      ? `/api/zakat-rice/distributions?season=${season}&q=${encodeURIComponent(searchTerm)}`
      : null,
    fetcher
  );
  const distributions = distributionsRes?.data || [];

  const { data: expensesRes, mutate: mutateExpenses } = useSWR(
    activeTab === "expenses"
      ? `/api/zakat-rice/expenses?season=${season}&q=${encodeURIComponent(searchTerm)}`
      : null,
    fetcher
  );
  const expenses = expensesRes?.data || [];

  const { data: adjustmentsRes, mutate: mutateAdjustments } = useSWR(
    activeTab === "adjustments" ? `/api/zakat-rice/adjustments?season=${season}` : null,
    fetcher
  );
  const adjustments = adjustmentsRes?.data || [];

  const { data: auditRes, mutate: mutateAudit } = useSWR(
    activeTab === "audit" ? `/api/zakat-rice/audit?q=${encodeURIComponent(searchTerm)}` : null,
    fetcher
  );
  const auditLogs = auditRes?.data || [];

  const { data: trashRes, mutate: mutateTrash } = useSWR(
    activeTab === "settings" ? `/api/zakat-rice/trash` : null,
    fetcher
  );
  const trashItems = trashRes?.data || [];

  // Global refresh
  const refreshAll = useCallback(() => {
    mutate(`/api/zakat-rice/stock?season=${season}`);
    if (activeTab === "donors") mutateDonors();
    if (activeTab === "receipts") mutateReceipts();
    if (activeTab === "mills") mutateMills();
    if (activeTab === "beneficiaries") mutateBeneficiaries();
    if (activeTab === "distributions") mutateDistributions();
    if (activeTab === "expenses") mutateExpenses();
    if (activeTab === "adjustments") mutateAdjustments();
    if (activeTab === "audit") mutateAudit();
    if (activeTab === "settings") mutateTrash();
  }, [season, activeTab, mutateDonors, mutateReceipts, mutateMills, mutateBeneficiaries, mutateDistributions, mutateExpenses, mutateAdjustments, mutateAudit, mutateTrash]);

  // Open Donor Statement
  const openDonorStatement = async (donorId: string) => {
    try {
      const res = await fetch(`/api/zakat-rice/statements/donor/${donorId}?season=${season}`);
      const r = await res.json();
      if (!r.ok) throw new Error(r.error?.message);
      const d = r.data;

      const headers = ["رقم العملية", "التاريخ", "النوع", "الكمية (كجم)", "الشكاير", "الملاحظات"];
      const rows = d.receipts.map((rec: any) => [
        rec.no,
        new Date(rec.date).toLocaleDateString("ar-EG"),
        rec.item === "barley" ? "شعير" : rec.item === "rice" ? "أرز" : rec.item === "cash" ? "نقدي" : rec.item_name,
        formatNumber(rec.quantity),
        rec.bags > 0 ? rec.bags : "—",
        rec.notes || "—",
      ]);

      setStatementModalData({
        title: `كشف حساب المتبرع: ${d.donor.name}`,
        season,
        headers,
        rows,
        summaryCards: [
          { label: "إجمالي الشعير المستلم", value: `${formatNumber(d.summary.totalBarleyReceived)} كجم` },
          { label: "الشعير المحول للتبييض", value: `${formatNumber(d.summary.totalBarleyMilled)} كجم` },
          { label: "نصيب الأرز الأبيض الناتج", value: `${formatNumber(d.summary.totalEstimatedRiceProduced)} كجم` },
          { label: "المتبقي له في مخزن الشعير", value: `${formatNumber(d.summary.remainingBarleyInWarehouse)} كجم` },
        ],
        notes: `بيانات الأرض: ${d.donor.land_description || "غير محدد"} | هاتف: ${d.donor.phone || "—"}`,
      });
    } catch (err: any) {
      toast.error(err.message || "فشل فتح كشف الحساب");
    }
  };

  // Open Beneficiary Statement
  const openBeneficiaryStatement = async (bId: string) => {
    try {
      const res = await fetch(`/api/zakat-rice/statements/beneficiary/${bId}?season=${season}`);
      const r = await res.json();
      if (!r.ok) throw new Error(r.error?.message);
      const d = r.data;

      const headers = ["رقم الإذن", "التاريخ", "الكمية (كجم)", "الوحدة الأصلية", "مكان التوزيع", "ملاحظات"];
      const rows = d.distributions.map((dist: any) => [
        dist.no,
        new Date(dist.date).toLocaleDateString("ar-EG"),
        formatNumber(dist.quantity_kg),
        dist.unit === "شيكارة" ? `${dist.bags} شيكارة` : `${dist.entered_qty} كجم`,
        dist.place || "المقر",
        dist.notes || "—",
      ]);

      setStatementModalData({
        title: `كشف استلامات المستفيد: ${d.beneficiary.name}`,
        season,
        headers,
        rows,
        summaryCards: [
          { label: "مرات الصرف", value: d.summary.totalDistributions },
          { label: "إجمالي الأرز المستلم", value: `${formatNumber(d.summary.totalRiceKg)} كجم` },
          { label: "عدد أفراد الأسرة", value: d.beneficiary.family_size || 1 },
          { label: "المنطقة", value: d.beneficiary.area || "—" },
        ],
        notes: `الهاتف: ${d.beneficiary.phone || "—"} | ملاحظات: ${d.beneficiary.notes || "—"}`,
      });
    } catch (err: any) {
      toast.error(err.message || "فشل جلب كشف المستفيد");
    }
  };

  // Open Store Cumulative Statement
  const openStoreStatement = async (storeType: "barley" | "rice") => {
    try {
      const res = await fetch(`/api/zakat-rice/statements/store/${storeType}?season=${season}`);
      const r = await res.json();
      if (!r.ok) throw new Error(r.error?.message);
      const d = r.data;

      const headers = ["التاريخ", "النوع", "الرقم", "البيان والتفاصيل", "الوارد (+)", "المنصرف (-)", "الرصيد التراكمي"];
      const rows = d.events.map((ev: any) => [
        new Date(ev.date).toLocaleDateString("ar-EG"),
        ev.type,
        ev.no || "—",
        ev.description,
        ev.in_kg > 0 ? `${formatNumber(ev.in_kg)} كجم` : "—",
        ev.out_kg > 0 ? `${formatNumber(ev.out_kg)} كجم` : "—",
        `${formatNumber(ev.balance)} كجم`,
      ]);

      setStatementModalData({
        title: `كشف حركة ${storeType === "barley" ? "مخزن الشعير" : "مخزن الأرز الأبيض"} التراكمي`,
        season,
        headers,
        rows,
        summaryCards: [
          { label: "رصيد أول المدة (افتتاحي)", value: `${formatNumber(d.openingKg)} كجم` },
          { label: "الرصيد الختامي الحالي", value: `${formatNumber(d.closingBalance)} كجم` },
          { label: "إجمالي الحركات", value: d.events.length },
          { label: "حالة المخزون", value: "محسوب آليًا بدقة" },
        ],
      });
    } catch (err: any) {
      toast.error(err.message || "فشل جلب كشف حركة المخزن");
    }
  };

  // Open Season Final Summary
  const openSeasonSummary = async () => {
    try {
      const res = await fetch(`/api/zakat-rice/season-summary?season=${season}`);
      const r = await res.json();
      if (!r.ok) throw new Error(r.error?.message);
      const d = r.data;

      const headers = ["البيان", "القيمة / الكمية", "ملاحظات"];
      const rows = [
        ["رصيد الشعير الحالي بالمخزن", `${formatNumber(d.stock.barley.balance)} كجم`, "شعير متاح للتبييض"],
        ["إجمالي الشعير المستلم هذا الموسم", `${formatNumber(d.stock.barley.received)} كجم`, `توريدات من المزارعين (${d.stock.barley.bags} شيكارة)`],
        ["إجمالي الشعير المحول للمضارب", `${formatNumber(d.stock.barley.milled)} كجم`, "محول للتبييض"],
        ["متوسط نسبة التصافي بالمضارب", `${d.averageMillingRate}%`, "معدل ناتج الأرز الأبيض من الشعير"],
        ["أرز أبيض ناتج من التبييض", `${formatNumber(d.stock.rice.fromMilling)} كجم`, "مستلم من المطاحن"],
        ["أرز مستلم تبرع مباشر", `${formatNumber(d.stock.rice.receivedDirect)} كجم`, "تبرعات أرز جاهز"],
        ["إجمالي الأرز الموزع على المستحقين", `${formatNumber(d.stock.rice.distributed)} كجم`, `موزع على ${d.stock.counts.beneficiaries} مستفيد`],
        ["رصيد الأرز المتبقي بالمخزن", `${formatNumber(d.stock.rice.balance)} كجم`, "أرز أبيض متوفر للتوزيع"],
        ["إجمالي التبرعات النقدية المخصصة للأرز", formatCurrency(d.cashSummary.totalDonations), "تبرعات نقدية"],
        ["إجمالي المصروفات التشغيلية", formatCurrency(d.cashSummary.totalExpenses), "طحن ونقل وعمالة"],
        ["صافي الفائض / العجز النقدي", formatCurrency(d.cashSummary.cashNet), d.cashSummary.cashNet >= 0 ? "فائض نقدي" : "عجز نقدي"],
      ];

      setStatementModalData({
        title: `التقرير الختامي لموسم زكاة المحاصيل والأرز ${d.season}`,
        season: d.season,
        headers,
        rows,
        summaryCards: [
          { label: "رصيد الأرز الحالي", value: `${formatNumber(d.stock.rice.balance)} كجم` },
          { label: "رصيد الشعير الحالي", value: `${formatNumber(d.stock.barley.balance)} كجم` },
          { label: "إجمالي الموزع", value: `${formatNumber(d.stock.rice.distributed)} كجم` },
          { label: "المستفيدين المسجلين", value: d.stock.counts.beneficiaries },
        ],
        notes: `تم اعتماد هذا التقرير من جمعية ${d.org_name}. نسأل الله أن يتقبل من جميع المتبرعين والقائمين على المشروع.`,
      });
    } catch (err: any) {
      toast.error(err.message || "فشل توليد التقرير الختامي");
    }
  };

  // Tab definitions
  const tabs = [
    { id: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
    { id: "donors", label: "المتبرعون", icon: Users },
    { id: "receipts", label: "الاستلام والتوريد", icon: Inbox },
    { id: "barley-store", label: "مخزن الشعير", icon: Warehouse },
    { id: "mills", label: "تبييض الأرز", icon: Factory },
    { id: "rice-store", label: "مخزن الأرز", icon: Package },
    { id: "beneficiaries", label: "المستفيدون", icon: HeartHandshake },
    { id: "distributions", label: "صرف وتوزيع الأرز", icon: Send },
    { id: "expenses", label: "المصروفات التشغيلية", icon: Receipt },
    { id: "adjustments", label: "التسويات الجردية", icon: Scale },
    { id: "statements", label: "كشوف الحساب", icon: FileText },
    { id: "reports", label: "التقارير الشاملة (14)", icon: FileCheck2 },
    { id: "season-summary", label: "التقرير الختامي للموسم", icon: CalendarDays },
    { id: "audit", label: "سجل المراجعة والتدقيق", icon: History },
    { id: "settings", label: "الإعدادات وسلة المحذوفات", icon: Settings },
  ];

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-800 text-white rounded-3xl p-6 shadow-xl border border-emerald-700/50">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center p-2 border border-white/20 shadow-inner">
              <span className="text-3xl">🌾</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-amber-950 uppercase tracking-wider">
                  دعوة الحق الزرقا
                </span>
                <span className="text-emerald-300 text-xs">· منظومة متكاملة</span>
              </div>
              <h1 className="text-2xl font-black mt-1 tracking-tight">
                إدارة المخازن وزكاة المحاصيل والأرز
              </h1>
              <p className="text-emerald-100/80 text-xs mt-0.5">
                تتبع كامل للزكاة من استلام محصول المتبرع حتى تبييضه وتوزيعه على المستفيدين المستحقين
              </p>
            </div>
          </div>

          {/* Quick Season & Stock Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 text-xs flex items-center gap-2">
              <span className="text-emerald-200">الموسم:</span>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="bg-emerald-950/80 text-white font-bold rounded-lg px-2 py-1 border border-emerald-600 focus:outline-none cursor-pointer"
              >
                <option value="2026">موسم 2026</option>
                <option value="2025">موسم 2025</option>
                <option value="all">كل المواسم</option>
              </select>
            </div>

            <button
              onClick={refreshAll}
              disabled={isStockValidating}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 text-white transition-colors"
              title="تحديث البيانات فورًا"
            >
              <RefreshCw className={`w-4 h-4 ${isStockValidating ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Live Stock Alert Banner */}
        {stock && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/15 text-xs">
            <div className={`p-3 rounded-2xl border ${stock.barley.isLow ? "bg-rose-500/20 border-rose-400 text-rose-100" : "bg-white/10 border-white/15"}`}>
              <div className="flex items-center justify-between">
                <span className="text-white/90 font-bold">رصيد مخزن الشعير:</span>
                {stock.barley.isLow && <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-bold">منخفض</span>}
              </div>
              <div className="text-xl font-black mt-1 text-white">
                {formatNumber(stock.barley.balance)} <span className="text-xs font-normal">كجم</span>
              </div>
            </div>

            <div className={`p-3 rounded-2xl border ${stock.rice.isLow ? "bg-rose-500/20 border-rose-400 text-rose-100" : "bg-white/10 border-white/15"}`}>
              <div className="flex items-center justify-between">
                <span className="text-white/90 font-bold">رصيد مخزن الأرز الأبيض:</span>
                {stock.rice.isLow && <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-bold">منخفض</span>}
              </div>
              <div className="text-xl font-black mt-1 text-white">
                {formatNumber(stock.rice.balance)} <span className="text-xs font-normal">كجم</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
              <span className="text-white/90 font-bold block">إجمالي الموزع للأسر:</span>
              <div className="text-xl font-black mt-1 text-emerald-300">
                {formatNumber(stock.rice.distributed)} <span className="text-xs font-normal">كجم</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
              <span className="text-white/90 font-bold block">التبرعات النقدية للأرز:</span>
              <div className="text-xl font-black mt-1 text-amber-300">
                {formatCurrency(stock.cash.totalAmount)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchTerm("");
                }}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-emerald-700 text-white shadow-md shadow-emerald-700/20 scale-[1.02]"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-emerald-600 dark:text-emerald-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab View Contents */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 min-h-[500px]">
        {/* ==============================================================
            TAB 1: لوحة التحكم (DASHBOARD)
           ============================================================== */}
        {activeTab === "dashboard" && stock && (
          <div className="space-y-6">
            {/* Quick Actions Row */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setEditingReceipt(null);
                  setIsReceiptModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                تسجيل توريد / استلام جديد
              </button>

              <button
                onClick={() => {
                  setEditingDistribution(null);
                  setIsDistributionModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Send className="w-4 h-4" />
                صرف وتوزيع أرز لمستفيد
              </button>

              <button
                onClick={() => {
                  setEditingMill(null);
                  setIsMillModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Factory className="w-4 h-4" />
                تسجيل عملية تبييض بمضرب
              </button>

              <button
                onClick={() => {
                  setEditingDonor(null);
                  setIsDonorModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-300 dark:border-slate-700"
              >
                <Users className="w-4 h-4 text-emerald-600" />
                + متبرع جديد للمخزن
              </button>
            </div>

            {/* Warehouse Detailed Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Barley Card */}
              <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">مخزن الشعير الخام</span>
                  <Warehouse className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-950 dark:text-amber-100 mt-2">
                  {formatNumber(stock.barley.balance)} <span className="text-xs font-semibold">كجم</span>
                </div>
                <div className="text-xs text-amber-800 dark:text-amber-300 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>الوارد من المزارعين:</span>
                    <strong>{formatNumber(stock.barley.received)} كجم</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>المنصرف للتبييض:</span>
                    <strong>{formatNumber(stock.barley.milled)} كجم</strong>
                  </div>
                </div>
                <button
                  onClick={() => openStoreStatement("barley")}
                  className="w-full mt-3 py-1.5 text-[11px] font-bold text-amber-900 bg-white/80 dark:bg-amber-900/40 rounded-lg hover:bg-white border border-amber-200 dark:border-amber-800 transition-colors"
                >
                  عرض كشف حركة مخزن الشعير
                </button>
              </div>

              {/* Rice Card */}
              <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">مخزن الأرز الأبيض</span>
                  <Package className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-2">
                  {formatNumber(stock.rice.balance)} <span className="text-xs font-semibold">كجم</span>
                </div>
                <div className="text-xs text-emerald-800 dark:text-emerald-300 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>الناتج من التبييض:</span>
                    <strong>{formatNumber(stock.rice.fromMilling)} كجم</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>المصروف للمستحقين:</span>
                    <strong>{formatNumber(stock.rice.distributed)} كجم</strong>
                  </div>
                </div>
                <button
                  onClick={() => openStoreStatement("rice")}
                  className="w-full mt-3 py-1.5 text-[11px] font-bold text-emerald-900 bg-white/80 dark:bg-emerald-900/40 rounded-lg hover:bg-white border border-emerald-200 dark:border-emerald-800 transition-colors"
                >
                  عرض كشف حركة مخزن الأرز
                </button>
              </div>

              {/* Counts Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">إحصاءات المشاركين</span>
                  <Users className="w-5 h-5 text-teal-600" />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                  <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block">المتبرعون بالمخزن</span>
                    <strong className="text-base text-slate-900 dark:text-white">{stock.counts.donors}</strong>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block">المستفيدون</span>
                    <strong className="text-base text-slate-900 dark:text-white">{stock.counts.beneficiaries}</strong>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block">إيصالات الاستلام</span>
                    <strong className="text-base text-slate-900 dark:text-white">{stock.counts.receipts}</strong>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block">أذونات التوزيع</span>
                    <strong className="text-base text-slate-900 dark:text-white">{stock.counts.distributions}</strong>
                  </div>
                </div>
              </div>

              {/* Financial Card */}
              <div className="p-5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200">المالية وصندوق التبرعات</span>
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-blue-100 dark:border-blue-900">
                    <span className="text-slate-600 dark:text-slate-400">التبرعات النقدية:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(stock.cash.donationsTotal ?? stock.cash.totalAmount)}
                    </strong>
                  </div>
                  {(stock.cash.salesTotal ?? 0) > 0 && (
                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-blue-100 dark:border-blue-900">
                      <span className="text-slate-600 dark:text-slate-400">مبيعات الرجيع:</span>
                      <strong className="text-amber-700 dark:text-amber-400">
                        +{formatCurrency(stock.cash.salesTotal)}
                      </strong>
                    </div>
                  )}
                  {(stock.cash.purchasesTotal ?? 0) > 0 && (
                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-blue-100 dark:border-blue-900">
                      <span className="text-slate-600 dark:text-slate-400">مشتريات ممولة من الصندوق:</span>
                      <strong className="text-rose-700 dark:text-rose-400">
                        -{formatCurrency(stock.cash.purchasesTotal)}
                      </strong>
                    </div>
                  )}
                  <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-blue-100 dark:border-blue-900">
                    <span className="text-slate-600 dark:text-slate-400">مصروفات التشغيل (طحن ونقل وعمالة):</span>
                    <strong className="text-rose-700 dark:text-rose-400">
                      -{formatCurrency(stock.expenses.totalAmount)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div>
                      <span className="text-emerald-900 dark:text-emerald-200 font-bold block text-xs">صافي رصيد الصندوق المتبقي:</span>
                      <span className="text-[10px] text-slate-500 block">(بعد خصم المشتريات والمصروفات)</span>
                    </div>
                    <strong className={`text-sm font-black ${stock.cash.totalAmount >= 0 ? "text-emerald-800 dark:text-emerald-300" : "text-rose-700 dark:text-rose-400"}`}>
                      {formatCurrency(stock.cash.totalAmount)}
                    </strong>
                  </div>
                </div>
                <button
                  onClick={() => openSeasonSummary()}
                  className="w-full mt-3 py-1.5 text-[11px] font-bold text-blue-900 bg-white/80 dark:bg-blue-900/40 rounded-lg hover:bg-white border border-blue-200 dark:border-blue-800 transition-colors"
                >
                  التقرير المالي والختامي للموسم
                </button>
              </div>
            </div>

            {/* Other Items Summary Row */}
            {stock.otherItems && stock.otherItems.length > 0 && (
              <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                <h3 className="text-xs font-bold text-purple-900 dark:text-purple-200 mb-3 flex items-center gap-2">
                  <span>📦</span> الأصناف والتبرعات العينية الأخرى المسجلة:
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {stock.otherItems.map((item: any, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-purple-200 dark:border-purple-800/50">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{item.name}</span>
                      <span className="text-sm font-black text-purple-700 dark:text-purple-300 mt-1 block">
                        {formatNumber(item.totalQuantity)} {item.unit}
                      </span>
                      {item.bags > 0 && (
                        <span className="text-[10px] text-slate-500 block">({item.bags} شيكارة/عبوة)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent 10 Activities Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-600" />
                  آخر 10 حركات مسجلة بالنظام
                </h3>
                <span className="text-[11px] text-slate-500">تحديث حي تلقائي</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {stock.recentActivity?.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">لا توجد حركات مسجلة حتى الآن</div>
                ) : (
                  stock.recentActivity?.map((act: any) => (
                    <div key={act.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            act.type === "استلام"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : act.type === "توزيع"
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {act.type} {act.no ? `#${act.no}` : ""}
                        </span>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{act.title}</p>
                          <p className="text-[11px] text-slate-500">{act.subTitle}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="font-black text-slate-900 dark:text-white block">{act.amountOrQty}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(act.date).toLocaleDateString("ar-EG")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 2: المتبرعون (DONORS)
           ============================================================== */}
        {activeTab === "donors" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث باسم المتبرع أو الهاتف أو بيانات الأرض..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => {
                    setEditingDonor(null);
                    setIsDonorModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  إضافة متبرع جديد للمخزن
                </button>
              </div>
            </div>

            {/* Donors Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">اسم المتبرع</th>
                    <th className="p-3">الهاتف</th>
                    <th className="p-3">بيانات / وصف الأرض</th>
                    <th className="p-3">الموسم</th>
                    <th className="p-3">الملاحظات</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {donors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-600 dark:text-slate-300 font-bold text-sm">
                        لا يوجد متبرعون مسجلون
                      </td>
                    </tr>
                  ) : (
                    donors.map((d: any) => (
                      <tr key={d._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{d.name}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{d.phone || "—"}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{d.land_description || "—"}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{d.season}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{d.notes || "—"}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openDonorStatement(d._id)}
                              className="px-2 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-md hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800"
                              title="عرض كشف حساب المتبرع"
                            >
                              كشف حساب
                            </button>
                            <button
                              onClick={() => {
                                setEditingDonor(d);
                                setIsDonorModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md"
                              title="تعديل"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirm({
                                  isOpen: true,
                                  title: "تأكيد حذف المتبرع",
                                  message: `هل أنت متأكد من رغبتك في حذف المتبرع (${d.name})؟ لن يتم الحذف إن كان له عمليات استلام مسجلة.`,
                                  onConfirm: async () => {
                                    const res = await fetch(`/api/zakat-rice/donors/${d._id}`, { method: "DELETE" });
                                    const result = await res.json();
                                    if (result.ok) {
                                      toast.success("تم حذف المتبرع بنجاح");
                                      mutateDonors();
                                    } else {
                                      toast.error(result.error?.message || "فشل الحذف");
                                    }
                                  },
                                });
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 3: الاستلام والتوريد (RECEIPTS, PURCHASES & SALES)
           ============================================================== */}
        {activeTab === "receipts" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث برقم العملية أو الطرف أو الصنف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {/* Segmented Type Filter */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setReceiptTypeFilter("all")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      receiptTypeFilter === "all"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    الكل ({receipts.length})
                  </button>
                  <button
                    onClick={() => setReceiptTypeFilter("donation")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      receiptTypeFilter === "donation"
                        ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    تبرعات ({receipts.filter((r: any) => (r.operation_type || "donation") === "donation").length})
                  </button>
                  <button
                    onClick={() => setReceiptTypeFilter("purchase")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      receiptTypeFilter === "purchase"
                        ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    مشتريات ({receipts.filter((r: any) => r.operation_type === "purchase").length})
                  </button>
                  <button
                    onClick={() => setReceiptTypeFilter("sale")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      receiptTypeFilter === "sale"
                        ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    مبيعات ({receipts.filter((r: any) => r.operation_type === "sale").length})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => {
                    setEditingReceipt(null);
                    setIsReceiptModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  تسجيل عملية جديدة
                </button>
              </div>
            </div>

            {/* Receipts Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">رقم العملية</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">نوع العملية</th>
                    <th className="p-3">الجهة / المتبرع</th>
                    <th className="p-3">نوع الصنف</th>
                    <th className="p-3">الكمية / الوزن</th>
                    <th className="p-3">المبلغ المالي</th>
                    <th className="p-3">الشكاير</th>
                    <th className="p-3">المخزن</th>
                    <th className="p-3">الموظف</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-600 dark:text-slate-300 font-bold text-sm">
                        لا توجد عمليات مسجلة في هذا القسم
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map((r: any) => {
                      const op = r.operation_type || "donation";
                      return (
                        <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                            {r.no}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                            {new Date(r.date).toLocaleDateString("ar-EG")}
                          </td>
                          <td className="p-3">
                            {op === "purchase" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                <ShoppingCart className="w-3 h-3" />
                                شراء ممول
                              </span>
                            ) : op === "sale" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <TrendingUp className="w-3 h-3" />
                                بيع مخرجات
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <HeartHandshake className="w-3 h-3" />
                                تبرع وارد
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            {r.donor_name || (op === "purchase" ? "شراء من التبرعات" : "بيع رجيع")}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.item === "barley"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : r.item === "rice"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : r.item === "cash"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                  : r.item === "bran"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
                                  : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                              }`}
                            >
                              {r.item === "barley" ? "شعير" : r.item === "rice" ? "أرز" : r.item === "cash" ? "نقدي" : r.item === "bran" ? "رجيع/ردة" : (r.item_name || "صنف آخر")}
                            </span>
                          </td>
                          <td className="p-3 font-black text-slate-900 dark:text-white">
                            {r.item === "cash" ? "—" : `${formatNumber(r.quantity)} ${r.unit}`}
                          </td>
                          <td className="p-3">
                            {op === "purchase" ? (
                              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                -{formatCurrency(r.amount)}
                              </span>
                            ) : op === "sale" ? (
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                +{formatCurrency(r.amount)}
                              </span>
                            ) : r.item === "cash" ? (
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                +{formatCurrency(r.amount || r.quantity)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                            {r.bags > 0 ? `${r.bags} (${r.bag_kg}كجم)` : "—"}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{r.store_label}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">{r.createdByName || "—"}</td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setPrintReceiptData({
                                    type: "receipt",
                                    operationType: r.operation_type || "donation",
                                    no: r.no,
                                    date: r.date,
                                    partyName: r.donor_name,
                                    itemTitle: r.item === "barley" ? "شعير خام" : r.item === "rice" ? "أرز أبيض" : r.item === "cash" ? "تبرع نقدي" : r.item === "bran" ? "رجيع / ردة" : r.item_name,
                                    quantity: r.quantity,
                                    unit: r.unit,
                                    bags: r.bags,
                                    bagKg: r.bag_kg,
                                    amount: r.amount,
                                    paymentMethod: r.payment_method,
                                    storeLabel: r.store_label,
                                    notes: r.notes,
                                    createdByName: r.createdByName,
                                  });
                                }}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-md"
                                title="طباعة إيصال"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingReceipt(r);
                                  setIsReceiptModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md"
                                title="تعديل"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteConfirm({
                                    isOpen: true,
                                    title: `تأكيد حذف عملية ${op === "purchase" ? "الشراء" : op === "sale" ? "البيع" : "الاستلام"}`,
                                    message: `هل أنت متأكد من حذف عملية رقم (${r.no}) لـ (${r.donor_name})؟ سيتم عكس التأثير على رصيد المخزن والنقدية آلياً.`,
                                    onConfirm: async () => {
                                      const res = await fetch(`/api/zakat-rice/receipts/${r._id}`, { method: "DELETE" });
                                      const result = await res.json();
                                      if (result.ok) {
                                        toast.success("تم حذف العملية بنجاح");
                                        mutateReceipts();
                                        mutate(`/api/zakat-rice/stock?season=${season}`);
                                      } else {
                                        toast.error(result.error?.message || "فشل الحذف");
                                      }
                                    },
                                  });
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 4: مخزن الشعير (BARLEY STORE STATEMENT)
           ============================================================== */}
        {activeTab === "barley-store" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">كشف حركة مخزن الشعير التراكمي</h2>
                <p className="text-xs text-slate-500">متابعة دقيقة لكل ما دخل المخزن من المزارعين وما خرج للتبييض بالمضارب</p>
              </div>
              <button
                onClick={() => openStoreStatement("barley")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow"
              >
                <Printer className="w-4 h-4" />
                طباعة وتصدير الكشف (A4)
              </button>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">الرصيد الفعلي الحالي بمخزن الشعير</span>
                <span className="text-2xl font-black text-amber-950 dark:text-white mt-1 block">
                  {formatNumber(stock?.barley.balance)} كجم
                </span>
              </div>
              <button
                onClick={() => openStoreStatement("barley")}
                className="px-4 py-2 text-xs font-bold text-amber-900 bg-white rounded-xl shadow-xs border border-amber-200 hover:bg-amber-100"
              >
                عرض سجل الحركات الكاملة
              </button>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 5: تبييض الأرز (MILLS)
           ============================================================== */}
        {activeTab === "mills" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث برقم العملية أو المضرب أو الملاحظات..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => {
                    setEditingMill(null);
                    setIsMillModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  تسجيل عملية تبييض جديدة
                </button>
              </div>
            </div>

            {/* Mills Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">رقم العملية</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">المضرب / الجهة</th>
                    <th className="p-3">الشعير الداخل</th>
                    <th className="p-3">الأرز الناتج</th>
                    <th className="p-3">نسبة التصافي</th>
                    <th className="p-3">الردة والفاقد</th>
                    <th className="p-3">التكاليف التشغيلية</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {mills.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-600 dark:text-slate-300 font-bold text-sm">
                        لا توجد عمليات تبييض مسجلة
                      </td>
                    </tr>
                  ) : (
                    mills.map((m: any) => {
                      const rate = m.in_kg > 0 ? (m.rice_kg / m.in_kg) * 100 : 0;
                      const totalCosts = Object.values(m.costs || {}).reduce((acc: number, c: any) => acc + (Number(c) || 0), 0);
                      return (
                        <tr key={m._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                            {m.no}
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                            {new Date(m.date).toLocaleDateString("ar-EG")}
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{m.place}</td>
                          <td className="p-3 font-bold text-amber-800 dark:text-amber-300">
                            {formatNumber(m.in_kg)} كجم
                          </td>
                          <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400">
                            {formatNumber(m.rice_kg)} كجم
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">
                            ردة: {formatNumber(m.bran_kg)} | فاقد: {formatNumber(m.waste_kg)}
                          </td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            {totalCosts > 0 ? formatCurrency(totalCosts) : "—"}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingMill(m);
                                  setIsMillModalOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md"
                                title="تعديل"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteConfirm({
                                    isOpen: true,
                                    title: "تأكيد حذف عملية التبييض",
                                    message: `هل أنت متأكد من حذف عملية تبييض رقم (${m.no}) بمضرب (${m.place})؟ سيتم حذف المصروفات التشغيلية المرتبطة بها آليًا، مع التحقق من عدم جعل رصيد الأرز سالبًا.`,
                                    onConfirm: async () => {
                                      const res = await fetch(`/api/zakat-rice/mills/${m._id}`, { method: "DELETE" });
                                      const result = await res.json();
                                      if (result.ok) {
                                        toast.success("تم حذف عملية التبييض");
                                        mutateMills();
                                        mutate(`/api/zakat-rice/stock?season=${season}`);
                                      } else {
                                        toast.error(result.error?.message || "فشل الحذف");
                                      }
                                    },
                                  });
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 6: مخزن الأرز الأبيض (RICE STORE STATEMENT)
           ============================================================== */}
        {activeTab === "rice-store" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">كشف حركة مخزن الأرز الأبيض التراكمي</h2>
                <p className="text-xs text-slate-500">تتبع دقيق لكل وارد من التبييض أو الاستلام المباشر، وكل منصرف توزيع للمستفيدين</p>
              </div>
              <button
                onClick={() => openStoreStatement("rice")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow"
              >
                <Printer className="w-4 h-4" />
                طباعة وتصدير الكشف (A4)
              </button>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-900 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">الرصيد الحي المتاح بمخزن الأرز</span>
                <span className="text-2xl font-black text-emerald-950 dark:text-white mt-1 block">
                  {formatNumber(stock?.rice.balance)} كجم
                </span>
              </div>
              <button
                onClick={() => openStoreStatement("rice")}
                className="px-4 py-2 text-xs font-bold text-emerald-900 bg-white rounded-xl shadow-xs border border-emerald-200 hover:bg-emerald-100"
              >
                عرض سجل الحركات الكاملة
              </button>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 7: المستفيدون (BENEFICIARIES)
           ============================================================== */}
        {activeTab === "beneficiaries" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث باسم المستفيد أو الهاتف أو المنطقة..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-9 pl-9 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setIsBeneficiaryTabScannerOpen(true)}
                    className="absolute left-2.5 top-2.5 text-slate-400 hover:text-emerald-600 transition-colors"
                    title="مسح باركود المستفيد"
                  >
                    <ScanBarcode className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setIsExcelImportOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  استيراد من Excel / CSV
                </button>
                <button
                  onClick={() => {
                    setEditingBeneficiary(null);
                    setIsBeneficiaryModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  إضافة مستفيد جديد
                </button>
              </div>
            </div>

            {/* Beneficiaries Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">اسم المستفيد</th>
                    <th className="p-3">الهاتف</th>
                    <th className="p-3">العنوان / المنطقة</th>
                    <th className="p-3">أفراد الأسرة</th>
                    <th className="p-3">بيانات إضافية</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {beneficiaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-600 dark:text-slate-300 font-bold text-sm">
                        لا يوجد مستفيدون مسجلون
                      </td>
                    </tr>
                  ) : (
                    beneficiaries.map((b: any) => (
                      <tr key={b._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{b.name}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{b.phone || "—"}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{b.area || "—"}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{b.family_size || 1}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{b.extra || b.notes || "—"}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openBeneficiaryStatement(b._id)}
                              className="px-2 py-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-md hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800"
                              title="كشف ما استلمه المستفيد"
                            >
                              كشف استلامات
                            </button>
                            <button
                              onClick={() => {
                                setEditingBeneficiary(b);
                                setIsBeneficiaryModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md"
                              title="تعديل"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirm({
                                  isOpen: true,
                                  title: "تأكيد حذف المستفيد",
                                  message: `هل أنت متأكد من حذف المستفيد (${b.name})؟ لن يتم الحذف إن كان له أذونات توزيع سابقة مسجلة.`,
                                  onConfirm: async () => {
                                    const res = await fetch(`/api/zakat-rice/beneficiaries/${b._id}`, { method: "DELETE" });
                                    const result = await res.json();
                                    if (result.ok) {
                                      toast.success("تم حذف المستفيد بنجاح");
                                      mutateBeneficiaries();
                                    } else {
                                      toast.error(result.error?.message || "فشل الحذف");
                                    }
                                  },
                                });
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 8: صرف وتوزيع الأرز (DISTRIBUTIONS)
           ============================================================== */}
        {activeTab === "distributions" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث برقم الإذن أو اسم المستفيد أو المقر..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-9 pl-9 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setIsDistributionTabScannerOpen(true)}
                    className="absolute left-2.5 top-2.5 text-slate-400 hover:text-emerald-600 transition-colors"
                    title="مسح باركود"
                  >
                    <ScanBarcode className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDistributionTabScannerOpen(true)}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-1.5 transition-all font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                  title="مسح باركود المستفيد أو إذن التوزيع"
                >
                  <ScanBarcode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>مسح باركود</span>
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => {
                    setEditingDistribution(null);
                    setIsDistributionModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  تسجيل إذن توزيع جديد
                </button>
              </div>
            </div>

            {/* Distributions Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">رقم الإذن</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">اسم المستفيد</th>
                    <th className="p-3">الكمية المصروفة</th>
                    <th className="p-3">الوحدة الأصلية</th>
                    <th className="p-3">مكان الصرف</th>
                    <th className="p-3">الموظف المسجل</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {distributions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-600 dark:text-slate-300 font-bold text-sm">
                        لا توجد أذونات توزيع مسجلة
                      </td>
                    </tr>
                  ) : (
                    distributions.map((d: any) => (
                      <tr key={d._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-emerald-800 dark:text-emerald-300">
                          {d.no}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                          {new Date(d.date).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{d.beneficiary_name}</td>
                        <td className="p-3 font-black text-emerald-700 dark:text-emerald-400">
                          {formatNumber(d.quantity_kg)} كجم
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                          {d.unit === "شيكارة" ? `${d.bags} شيكارة (${d.bag_kg}كجم)` : `${d.entered_qty} كجم`}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{d.place || "المقر"}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{d.createdByName || "—"}</td>
                        <td className="p-3">
                          {d.override ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              تجاوز رصيد
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              طبيعي
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setPrintReceiptData({
                                  type: "distribution",
                                  no: d.no,
                                  date: d.date,
                                  partyName: d.beneficiary_name,
                                  itemTitle: "أرز أبيض بلدي",
                                  quantity: d.quantity_kg,
                                  unit: "كجم",
                                  bags: d.bags,
                                  bagKg: d.bag_kg,
                                  place: d.place,
                                  notes: d.notes,
                                  createdByName: d.createdByName,
                                });
                              }}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-md"
                              title="طباعة إذن الصرف"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingDistribution(d);
                                setIsDistributionModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md"
                              title="تعديل"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirm({
                                  isOpen: true,
                                  title: "تأكيد حذف إذن التوزيع",
                                  message: `هل أنت متأكد من حذف إذن توزيع رقم (${d.no}) للمستفيد (${d.beneficiary_name})؟ سيتم إعادة (${d.quantity_kg} كجم) لرصيد مخزن الأرز آليًا.`,
                                  onConfirm: async () => {
                                    const res = await fetch(`/api/zakat-rice/distributions/${d._id}`, { method: "DELETE" });
                                    const result = await res.json();
                                    if (result.ok) {
                                      toast.success("تم حذف إذن التوزيع");
                                      mutateDistributions();
                                      mutate(`/api/zakat-rice/stock?season=${season}`);
                                    } else {
                                      toast.error(result.error?.message || "فشل الحذف");
                                    }
                                  },
                                });
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 9: المصروفات التشغيلية (EXPENSES)
           ============================================================== */}
        {activeTab === "expenses" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث بنوع المصروف أو المستلم أو السائق..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => {
                    setEditingExpense(null);
                    setIsExpenseModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  إضافة مصروف تشغيلي جديد
                </button>
              </div>
            </div>

            {/* Expenses Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">نوع المصروف</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">العدد والوحدة</th>
                    <th className="p-3">المستلم / الجهة</th>
                    <th className="p-3">السائق / السيارة</th>
                    <th className="p-3">العملية المرتبطة</th>
                    <th className="p-3">المصدر</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-600 dark:text-slate-300 font-bold text-sm">
                        لا توجد مصروفات مسجلة
                      </td>
                    </tr>
                  ) : (
                    expenses.map((e: any) => (
                      <tr key={e._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                          {new Date(e.date).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{e.type}</td>
                        <td className="p-3 font-black text-rose-700 dark:text-rose-400">
                          {formatCurrency(e.amount)}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                          {e.qty} {e.unit}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{e.party || "—"}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{e.car_driver || "—"}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{e.ref_text || "—"}</td>
                        <td className="p-3">
                          {e.auto ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              تلقائي من تبييض
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              يدوي
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {!e.auto && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingExpense(e);
                                    setIsExpenseModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md"
                                  title="تعديل"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteConfirm({
                                      isOpen: true,
                                      title: "تأكيد حذف المصروف",
                                      message: `هل أنت متأكد من حذف مصروف (${e.type}) بمبلغ (${e.amount} ج.م)؟`,
                                      onConfirm: async () => {
                                        const res = await fetch(`/api/zakat-rice/expenses/${e._id}`, { method: "DELETE" });
                                        const result = await res.json();
                                        if (result.ok) {
                                          toast.success("تم حذف المصروف");
                                          mutateExpenses();
                                          mutate(`/api/zakat-rice/stock?season=${season}`);
                                        } else {
                                          toast.error(result.error?.message || "فشل الحذف");
                                        }
                                      },
                                    });
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 10: التسويات الجردية (ADJUSTMENTS)
           ============================================================== */}
        {activeTab === "adjustments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">التسويات الجردية للمخازن</h2>
                <p className="text-xs text-slate-500">معالجة أي فروق جردية فعلية (زيادة أو عجز) مع إلزامية توثيق السبب</p>
              </div>
              <button
                onClick={() => setIsAdjustmentModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow"
              >
                <Plus className="w-4 h-4" />
                تسجيل تسوية جردية جديدة
              </button>
            </div>

            {/* Adjustments Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">المخزن</th>
                    <th className="p-3">نوع التسوية</th>
                    <th className="p-3">الكمية (كجم)</th>
                    <th className="p-3">السبب الإلزامي</th>
                    <th className="p-3">الموظف المسجل</th>
                    <th className="p-3 text-center">إلغاء التسوية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-600 dark:text-slate-300 font-bold text-sm">
                        لا توجد تسويات جردية مسجلة
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((a: any) => (
                      <tr key={a._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                          {new Date(a.date).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          {a.store === "barley" ? "مخزن الشعير" : "مخزن الأرز"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              a.kg > 0
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-rose-100 text-rose-800 border border-rose-300"
                            }`}
                          >
                            {a.kg > 0 ? "زيادة جردية (+)" : "عجز / نقص (-)"}
                          </span>
                        </td>
                        <td className="p-3 font-black text-slate-900 dark:text-white">
                          {formatNumber(Math.abs(a.kg))} كجم
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{a.reason}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{a.createdByName || "—"}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              setDeleteConfirm({
                                isOpen: true,
                                title: "إلغاء وحذف التسوية",
                                message: `هل أنت متأكد من إلغاء تسوية (${a.reason})؟ ستعود الأرصدة لوضعها السابق.`,
                                onConfirm: async () => {
                                  const res = await fetch(`/api/zakat-rice/adjustments/${a._id}`, { method: "DELETE" });
                                  const result = await res.json();
                                  if (result.ok) {
                                    toast.success("تم إلغاء التسوية");
                                    mutateAdjustments();
                                    mutate(`/api/zakat-rice/stock?season=${season}`);
                                  } else {
                                    toast.error(result.error?.message || "فشل الإلغاء");
                                  }
                                },
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 11: كشوف الحساب (STATEMENTS)
           ============================================================== */}
        {activeTab === "statements" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">كشوف الحساب التفصيلية الرسمية</h2>
              <p className="text-xs text-slate-500">استخراج وطباعة كشوف الحساب الرسمية المعتمدة لجميع أطراف المشروع</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center space-y-3">
                <span className="text-3xl block">🌾</span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">كشف حركة مخزن الشعير</h3>
                <p className="text-xs text-slate-500">حركة الوارد والمنصرف للتبييض مع الرصيد التراكمي المستمر</p>
                <button
                  onClick={() => openStoreStatement("barley")}
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow"
                >
                  استخراج وطباعة
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center space-y-3">
                <span className="text-3xl block">🍚</span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">كشف حركة مخزن الأرز الأبيض</h3>
                <p className="text-xs text-slate-500">ناتج التبييض والوارد المباشر والصادر للتوزيع برصيد حي</p>
                <button
                  onClick={() => openStoreStatement("rice")}
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow"
                >
                  استخراج وطباعة
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center space-y-3">
                <span className="text-3xl block">👨‍🌾</span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">كشف حساب متبرع</h3>
                <p className="text-xs text-slate-500">كل توريدات المتبرع وناتج التبييض التقديري والمتبقي بالمخزن</p>
                <button
                  onClick={() => setActiveTab("donors")}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  اختيار متبرع من القائمة
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center space-y-3">
                <span className="text-3xl block">🤝</span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">كشف استلامات مستفيد</h3>
                <p className="text-xs text-slate-500">سجل استلامات المستفيد من الأرز وتواريخ الصرف</p>
                <button
                  onClick={() => setActiveTab("beneficiaries")}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  اختيار مستفيد من القائمة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 12: التقارير الـ 14 (REPORTS)
           ============================================================== */}
        {activeTab === "reports" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">منظومة التقارير الشاملة (14 تقريرًا)</h2>
              <p className="text-xs text-slate-500">تقارير إدارية ورقابية ومالية جاهزة للطباعة وللتصدير الفوري بصيغتي Excel و CSV</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { key: "donors", title: "1. تقرير المتبرعين الإجمالي", desc: "كل متبرع ومجموع ما تبرع به مقسمًا بالنوع" },
                { key: "receipts", title: "2. تقرير الاستلامات المفصل", desc: "جميع الاستلامات بالتفصيل والأوزان" },
                { key: "items-summary", title: "3. حصر الأصناف والتوريدات", desc: "إجمالي منفصل للشعير والأرز والسلع والنقدي" },
                { key: "barley-store", title: "4. تقرير مخزن الشعير", desc: "الرصيد والحركة وكميات التبييض" },
                { key: "rice-store", title: "5. تقرير مخزن الأرز الأبيض", desc: "الرصيد والوارد من التبييض والتوزيعات" },
                { key: "mills", title: "6. تقرير عمليات التبييض بالمضارب", desc: "المدخلات والمخرجات ونسب التصافي" },
                { key: "beneficiaries", title: "7. تقرير المستفيدين ومجموع الصرف", desc: "القائمة الكاملة ومجموع ما استلمه كل مستفيد" },
                { key: "distributions", title: "8. تقرير التوزيعات المفصل", desc: "كل أذونات الصرف والتواريخ والموظف" },
                { key: "expenses", title: "9. تقرير المصروفات التشغيلية", desc: "طحن ونقل وعمالة وسيارات بتفصيل المبالغ" },
                { key: "cost-summary", title: "10. تقرير التكاليف المجمع", desc: "إجمالي التكلفة وتكلفة إنتاج الكيلو من الأرز" },
                { key: "cash-donations", title: "11. تقرير التبرعات النقدية", desc: "كل تبرع نقدي مع الغرض وطريقة الدفع" },
                { key: "adjustments", title: "12. تقرير التسويات الجردية", desc: "فروق الجرد والأسباب الموثقة" },
                { key: "variances-rates", title: "13. تقرير معدلات التصافي والفاقد", desc: "نسبة تصافي كل مضرب ومعدل الفاقد والردة" },
                { key: "audit", title: "14. سجل المراجعة والتدقيق", desc: "كل التعديلات بالمستخدم والوقت وقبل وبعد" },
              ].map((rep) => (
                <div key={rep.key} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-emerald-900 dark:text-emerald-300">{rep.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-1">{rep.desc}</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/zakat-rice/reports/${rep.key}?season=${season}`);
                        const r = await res.json();
                        if (!r.ok) throw new Error(r.error?.message);
                        const d = r.data;
                        setStatementModalData({
                          title: d.title,
                          season: d.season,
                          headers: d.headers,
                          rows: d.rows,
                        });
                      } catch (err: any) {
                        toast.error(err.message || "فشل تحميل التقرير");
                      }
                    }}
                    className="mt-3 w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    عرض وطباعة وتصدير
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 13: التقرير الختامي للموسم (SEASON SUMMARY)
           ============================================================== */}
        {activeTab === "season-summary" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">التقرير الختامي المعتمد للموسم</h2>
                <p className="text-xs text-slate-500">وثيقة رسمية شاملة لكافة مخرجات وأرصدة وتوزيعات الموسم</p>
              </div>
              <button
                onClick={openSeasonSummary}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow"
              >
                <Printer className="w-4 h-4" />
                معاينة وطباعة التقرير الختامي (A4)
              </button>
            </div>
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="text-4xl block">📋</span>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                تقرير موسم زكاة المحاصيل والأرز {season}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                يحتوي على ملخص شامل لإجمالي المحاصيل المستلمة، نسب التبييض والتصافي بالمضارب، أعداد المستفيدين، وتقرير الفائض والعجز النقدي.
              </p>
              <button
                onClick={openSeasonSummary}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow"
              >
                عرض التقرير الكامل الآن
              </button>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 14: سجل المراجعة والتدقيق (AUDIT LOG)
           ============================================================== */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">سجل المراجعة والتدقيق الصارم (Audit Log)</h2>
                <p className="text-xs text-slate-500">توثيق رقابي آلي لكل إضافة، تعديل، حذف، استيراد، أو تجاوز رصيد بالمستخدم والتاريخ</p>
              </div>
            </div>

            {/* Audit Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">الوقت والتاريخ</th>
                    <th className="p-3">المستخدم</th>
                    <th className="p-3">الإجراء</th>
                    <th className="p-3">الكيان</th>
                    <th className="p-3">البيان</th>
                    <th className="p-3 text-center">مقارنة التغييرات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        لا توجد سجلات مراجعة
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((a: any) => (
                      <tr key={a._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-slate-600 dark:text-slate-400 font-mono">
                          {new Date(a.ts).toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{a.user_name || "النظام"}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              a.action === "إضافة"
                                ? "bg-emerald-100 text-emerald-800"
                                : a.action === "تعديل"
                                ? "bg-blue-100 text-blue-800"
                                : a.action === "حذف"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {a.action}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{a.entity}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{a.notes || "—"}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setSelectedAuditLog(a)}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200 hover:bg-emerald-100"
                          >
                            عرض الفروق
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 15: الإعدادات وسلة المحذوفات (SETTINGS & TRASH)
           ============================================================== */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">إعدادات النظام وأدوات الصيانة</h2>
              <p className="text-xs text-slate-500">إدارة الموسم، الأرصدة الافتتاحية، حدود التنبيه، وسلة المحذوفات القابلة للاستعادة</p>
            </div>

            {/* Maintenance Tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">أداة إعادة ترقيم العمليات من 00001</h3>
                <p className="text-xs text-slate-500">
                  ترتيب أرقام الاستلامات أو التبييض أو التوزيع تصاعديًا حسب التاريخ لمنع أي فجوات تسلسلية.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/zakat-rice/admin/renumber", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ entityType: "receipts" }),
                      });
                      const r = await res.json();
                      if (r.ok) toast.success(`تمت إعادة ترقيم الاستلامات (${r.data.updatedCount} معدل)`);
                      else toast.error(r.error?.message);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-300 hover:bg-emerald-100"
                  >
                    ترقيم الاستلامات
                  </button>

                  <button
                    onClick={async () => {
                      const res = await fetch("/api/zakat-rice/admin/renumber", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ entityType: "distributions" }),
                      });
                      const r = await res.json();
                      if (r.ok) toast.success(`تمت إعادة ترقيم التوزيعات (${r.data.updatedCount} معدل)`);
                      else toast.error(r.error?.message);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-teal-800 bg-teal-50 rounded-lg border border-teal-300 hover:bg-teal-100"
                  >
                    ترقيم التوزيعات
                  </button>
                </div>
              </div>

              {/* Trash Section */}
              <div className="p-5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-2">
                <h3 className="text-xs font-bold text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  سلة المحذوفات الناعمة (Soft Delete)
                </h3>
                <p className="text-xs text-rose-800/80 dark:text-rose-300">
                  يوجد حاليًا ({trashItems.length}) سجل محذوف. يمكن للمدير استعادة أي سجل فورًا لإعادته للأرصدة.
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5 mt-2">
                  {trashItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-rose-200 dark:border-rose-900 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{item.title}</span>
                        <span className="text-[10px] text-slate-500">{item.entity} · {item.details}</span>
                      </div>
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/zakat-rice/trash/${item.id}/restore?entity=${item.entity}`, {
                            method: "POST",
                          });
                          const r = await res.json();
                          if (r.ok) {
                            toast.success("تمت استعادة السجل بنجاح");
                            mutateTrash();
                            mutate(`/api/zakat-rice/stock?season=${season}`);
                          } else {
                            toast.error(r.error?.message);
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 rounded border border-emerald-300 hover:bg-emerald-100"
                      >
                        استعادة
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==============================================================
          MODALS
         ============================================================== */}

      {/* 1. Donor Form Modal */}
      {isDonorModalOpen && (
        <DonorFormModal
          isOpen={isDonorModalOpen}
          donor={editingDonor}
          season={season}
          onClose={() => setIsDonorModalOpen(false)}
          onSuccess={() => {
            mutateDonors();
            setIsDonorModalOpen(false);
          }}
        />
      )}

      {/* 2. Receipt Form Modal */}
      {isReceiptModalOpen && (
        <ReceiptFormModal
          isOpen={isReceiptModalOpen}
          receipt={editingReceipt}
          season={season}
          donors={donors}
          availableCash={stock?.cash?.totalAmount || 0}
          onClose={() => setIsReceiptModalOpen(false)}
          onSuccess={(savedReceipt) => {
            mutateReceipts();
            mutate(`/api/zakat-rice/stock?season=${season}`);
            setIsReceiptModalOpen(false);
            if (savedReceipt) {
              setPrintReceiptData({
                type: "receipt",
                operationType: savedReceipt.operation_type || "donation",
                no: savedReceipt.no,
                date: savedReceipt.date,
                partyName: savedReceipt.donor_name,
                itemTitle: savedReceipt.item === "barley" ? "شعير خام" : savedReceipt.item === "rice" ? "أرز أبيض" : savedReceipt.item === "cash" ? "تبرع نقدي" : savedReceipt.item === "bran" ? "رجيع / ردة" : savedReceipt.item_name,
                quantity: savedReceipt.quantity,
                unit: savedReceipt.unit,
                bags: savedReceipt.bags,
                bagKg: savedReceipt.bag_kg,
                amount: savedReceipt.amount,
                paymentMethod: savedReceipt.payment_method,
                storeLabel: savedReceipt.store_label,
                notes: savedReceipt.notes,
                createdByName: savedReceipt.createdByName,
              });
            }
          }}
          onOpenAddDonor={() => {
            setEditingDonor(null);
            setIsDonorModalOpen(true);
          }}
        />
      )}

      {/* 3. Mill Form Modal */}
      {isMillModalOpen && (
        <MillFormModal
          isOpen={isMillModalOpen}
          mill={editingMill}
          season={season}
          donors={donors}
          onClose={() => setIsMillModalOpen(false)}
          onOpenAddDonor={() => {
            setEditingDonor(null);
            setIsDonorModalOpen(true);
          }}
          onSuccess={() => {
            mutateMills();
            mutate(`/api/zakat-rice/stock?season=${season}`);
            setIsMillModalOpen(false);
          }}
        />
      )}

      {/* 4. Beneficiary Form Modal */}
      {isBeneficiaryModalOpen && (
        <BeneficiaryFormModal
          isOpen={isBeneficiaryModalOpen}
          beneficiary={editingBeneficiary}
          onClose={() => setIsBeneficiaryModalOpen(false)}
          onSuccess={() => {
            mutateBeneficiaries();
            setIsBeneficiaryModalOpen(false);
          }}
        />
      )}

      {/* 5. Distribution Form Modal (WITH LIVE RICE STOCK BANNER) */}
      {isDistributionModalOpen && (
        <DistributionFormModal
          isOpen={isDistributionModalOpen}
          distribution={editingDistribution}
          season={season}
          currentRiceStock={stock?.rice.balance || 0}
          beneficiaries={beneficiaries}
          onClose={() => setIsDistributionModalOpen(false)}
          onSuccess={(savedDist) => {
            mutateDistributions();
            mutate(`/api/zakat-rice/stock?season=${season}`);
            setIsDistributionModalOpen(false);
            if (savedDist) {
              setPrintReceiptData({
                type: "distribution",
                no: savedDist.no,
                date: savedDist.date,
                partyName: savedDist.beneficiary_name,
                itemTitle: "أرز أبيض بلدي",
                quantity: savedDist.quantity_kg,
                unit: "كجم",
                bags: savedDist.bags,
                bagKg: savedDist.bag_kg,
                place: savedDist.place,
                notes: savedDist.notes,
                createdByName: savedDist.createdByName,
              });
            }
          }}
          onOpenAddBeneficiary={() => {
            setEditingBeneficiary(null);
            setIsBeneficiaryModalOpen(true);
          }}
        />
      )}

      {/* 6. Expense Form Modal */}
      {isExpenseModalOpen && (
        <ExpenseFormModal
          isOpen={isExpenseModalOpen}
          expense={editingExpense}
          season={season}
          onClose={() => setIsExpenseModalOpen(false)}
          onSuccess={() => {
            mutateExpenses();
            mutate(`/api/zakat-rice/stock?season=${season}`);
            setIsExpenseModalOpen(false);
          }}
        />
      )}

      {/* 7. Adjustment Form Modal */}
      {isAdjustmentModalOpen && (
        <AdjustmentFormModal
          isOpen={isAdjustmentModalOpen}
          season={season}
          barleyStock={stock?.barley.balance || 0}
          riceStock={stock?.rice.balance || 0}
          onClose={() => setIsAdjustmentModalOpen(false)}
          onSuccess={() => {
            mutateAdjustments();
            mutate(`/api/zakat-rice/stock?season=${season}`);
            setIsAdjustmentModalOpen(false);
          }}
        />
      )}

      {/* Receipt Print Modal */}
      <ZkReceiptPrintModal
        isOpen={Boolean(printReceiptData)}
        onClose={() => setPrintReceiptData(null)}
        data={printReceiptData}
      />

      {/* Statement Print Modal */}
      <ZkStatementPrintModal
        isOpen={Boolean(statementModalData)}
        onClose={() => setStatementModalData(null)}
        title={statementModalData?.title || ""}
        season={statementModalData?.season}
        headers={statementModalData?.headers || []}
        rows={statementModalData?.rows || []}
        summaryCards={statementModalData?.summaryCards}
        notes={statementModalData?.notes}
      />

      {/* Excel Import Modal */}
      <ZkExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onSuccess={() => {
          mutateBeneficiaries();
          toast.success("تم تحديث قائمة المستفيدين");
        }}
      />

      {/* Beneficiary Tab Scanner Modal */}
      {isBeneficiaryTabScannerOpen && (
        <QRScannerModal
          isOpen={isBeneficiaryTabScannerOpen}
          onClose={() => setIsBeneficiaryTabScannerOpen(false)}
          onScan={(val) => {
            let clean = val.trim();
            if (clean.toLowerCase().startsWith("dhz")) clean = clean.slice(3).replace(/^0+/, "");
            setSearchTerm(clean);
            setIsBeneficiaryTabScannerOpen(false);
            toast.success(`تم مسح الباركود: ${clean}`);
          }}
          title="مسح باركود المستفيد للبحث"
        />
      )}

      {/* Distribution Tab Scanner Modal */}
      {isDistributionTabScannerOpen && (
        <QRScannerModal
          isOpen={isDistributionTabScannerOpen}
          onClose={() => setIsDistributionTabScannerOpen(false)}
          onScan={(val) => {
            let clean = val.trim();
            if (!clean) return;

            let cleanCode = clean.toLowerCase().replace(/[*]/g, "").trim();
            if (cleanCode.startsWith("dhz")) {
              cleanCode = cleanCode.replace(/^dhz0*/, "");
            }
            const cleanNum = cleanCode.replace(/^0+/, "");

            // Look up in loaded beneficiaries
            const foundBen = beneficiaries.find((b: any) => {
              const bInt = String(b.internalId || "").trim();
              if (bInt && (bInt === cleanCode || bInt === cleanNum || parseInt(bInt, 10) === parseInt(cleanNum, 10))) {
                return true;
              }
              const bExtra = String(b.extra || "");
              const match = bExtra.match(/\d+/);
              if (match && (match[0] === cleanCode || match[0] === cleanNum || parseInt(match[0], 10) === parseInt(cleanNum, 10))) {
                return true;
              }
              if (String(b._id) === clean) return true;
              return false;
            });

            if (foundBen) {
              setSearchTerm(foundBen.name);
              setIsDistributionTabScannerOpen(false);
              toast.success(`تم العثور على المستفيد: ${foundBen.name} - جاري تصفية توزيعاته`);
            } else {
              setSearchTerm(cleanNum || clean);
              setIsDistributionTabScannerOpen(false);
              toast.success(`تم مسح الباركود: ${cleanNum || clean}`);
            }
          }}
          title="مسح باركود المستفيد أو إذن الصرف"
        />
      )}

      {/* Audit Diff Modal */}
      <ZkAuditModal
        isOpen={Boolean(selectedAuditLog)}
        onClose={() => setSelectedAuditLog(null)}
        auditItem={selectedAuditLog}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-right dir-rtl">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{deleteConfirm.title}</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              {deleteConfirm.message}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: false, title: "", message: "", onConfirm: async () => {} })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteConfirm.onConfirm();
                  setDeleteConfirm({ isOpen: false, title: "", message: "", onConfirm: async () => {} });
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow transition-colors"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// SUB-FORM MODAL COMPONENTS
// =========================================================================

// --- 1. Donor Form Modal ---
function DonorFormModal({
  isOpen,
  donor,
  season,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  donor: any | null;
  season: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(donor?.name || "");
  const [phone, setPhone] = useState(donor?.phone || "");
  const [land, setLand] = useState(donor?.land_description || "");
  const [notes, setNotes] = useState(donor?.notes || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("اسم المتبرع إلزامي");
    setSubmitting(true);

    try {
      const url = donor ? `/api/zakat-rice/donors/${donor._id}` : "/api/zakat-rice/donors";
      const method = donor ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          land_description: land,
          notes,
          season,
          version: donor?.version,
        }),
      });
      const r = await res.json();
      if (r.ok) {
        toast.success(donor ? "تم تحديث بيانات المتبرع" : "تمت إضافة المتبرع بنجاح");
        if (r.warning) toast.warning(r.warning);
        onSuccess();
      } else {
        toast.error(r.error?.message || "فشلت العملية");
      }
    } catch (err: any) {
      toast.error("حدث خطأ أثناء حفظ البيانات");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 dir-rtl text-right">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {donor ? "تعديل بيانات المتبرع" : "إضافة متبرع جديد للمخزن"}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              اسم المتبرع الكريم <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: الحاج إبراهيم الشرقاوي"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">رقم الهاتف</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010..."
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">بيانات / وصف الأرض</label>
              <input
                type="text"
                value={land}
                onChange={(e) => setLand(e.target.value)}
                placeholder="حوض النجيل - 2 فدان"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">ملاحظات إضافية</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل خاصة بتوريد المحصول..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              حفظ بيانات المتبرع
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 2. Receipt / Movement Form Modal (Donation, Purchase, Sale) ---
function ReceiptFormModal({
  isOpen,
  receipt,
  season,
  donors,
  availableCash = 0,
  onClose,
  onSuccess,
  onOpenAddDonor,
}: {
  isOpen: boolean;
  receipt: any | null;
  season: string;
  donors: any[];
  availableCash?: number;
  onClose: () => void;
  onSuccess: (saved: any) => void;
  onOpenAddDonor: () => void;
}) {
  const [operationType, setOperationType] = useState<"donation" | "purchase" | "sale">(
    receipt?.operation_type || "donation"
  );
  const [donorId, setDonorId] = useState(receipt?.donor_id || "");
  const [partyName, setPartyName] = useState(
    receipt?.donor_name && !receipt?.donor_id ? receipt.donor_name : ""
  );
  const [item, setItem] = useState<string>(receipt?.item || "barley");
  const [itemName, setItemName] = useState(receipt?.item_name || "");
  const [bags, setBags] = useState<number | string>(receipt?.bags || "");
  const [bagKg, setBagKg] = useState<number | string>(receipt?.bag_kg || 25);
  const [quantity, setQuantity] = useState<number | string>(receipt?.quantity || "");
  const [unit, setUnit] = useState<string>(receipt?.unit || "كجم");
  const [amount, setAmount] = useState<number | string>(receipt?.amount || "");
  const [pricePerUnit, setPricePerUnit] = useState<number | string>("");
  const [purpose, setPurpose] = useState(receipt?.purpose || "شراء أرز للمستحقين");
  const [paymentMethod, setPaymentMethod] = useState(receipt?.payment_method || "نقدًا");
  const [notes, setNotes] = useState(receipt?.notes || "");
  const [date, setDate] = useState(
    receipt?.date
      ? new Date(receipt.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);

  // Searchable donor options
  const donorOptions = useMemo(() => {
    return donors.map((d: any) => ({
      value: String(d._id),
      label: d.name,
      subLabel: d.land_description ? `الأرض: ${d.land_description}` : undefined,
      phone: d.phone || undefined,
      extra: d.land_area_qirat ? `${d.land_area_qirat} قيراط` : undefined,
    }));
  }, [donors]);

  // Switch operation type handler
  const handleSwitchOpType = (type: "donation" | "purchase" | "sale") => {
    setOperationType(type);
    if (type === "donation") {
      if (item === "bran") setItem("barley");
      setPurpose("شراء أرز للمستحقين");
    } else if (type === "purchase") {
      if (item === "cash" || item === "bran") setItem("barley");
      setUnit("كجم");
      setPurpose("شراء محاصيل من أموال التبرعات");
    } else if (type === "sale") {
      setItem("bran");
      setUnit("كجم");
      setPurpose("بيع رجيع ومخرجات لصالح صندوق الأرز");
    }
  };

  // Auto calculate total kg when bags or bagKg changes for barley/rice/bran
  useEffect(() => {
    if ((item === "barley" || item === "rice" || item === "bran") && bags && bagKg) {
      const calc = Number(bags) * Number(bagKg);
      if (!isNaN(calc) && calc > 0) {
        setQuantity(calc);
      }
    }
  }, [bags, bagKg, item]);

  // Auto calculate total amount from pricePerUnit * quantity
  useEffect(() => {
    if ((operationType === "purchase" || operationType === "sale") && pricePerUnit && quantity) {
      const calc = Number(pricePerUnit) * Number(quantity);
      if (!isNaN(calc) && calc > 0) {
        setAmount(Math.round(calc));
      }
    }
  }, [pricePerUnit, quantity, operationType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (operationType === "donation") {
      if (!donorId) return toast.error("يجب اختيار المتبرع الكريم في عملية التبرع");
      if (item === "cash" && (!amount || Number(amount) <= 0)) {
        return toast.error("يجب إدخال مبلغ التبرع النقدي");
      }
      if (item !== "cash" && (!quantity || Number(quantity) <= 0)) {
        return toast.error("يجب إدخال كمية الصنف المستلم");
      }
    } else if (operationType === "purchase") {
      if (!quantity || Number(quantity) <= 0) {
        return toast.error("يجب تحديد الكمية المشتراة بالكيلوجرام");
      }
      if (!amount || Number(amount) <= 0) {
        return toast.error("يجب تحديد إجمالي المبلغ المدفوع للشراء (يُخصم من التبرعات النقدية)");
      }
    } else if (operationType === "sale") {
      if (!amount || Number(amount) <= 0) {
        return toast.error("يجب تحديد المبلغ المحصل من البيع (يُضاف لرصيد التبرعات النقدية)");
      }
    }

    setSubmitting(true);

    try {
      const url = receipt ? `/api/zakat-rice/receipts/${receipt._id}` : "/api/zakat-rice/receipts";
      const method = receipt ? "PATCH" : "POST";
      const defaultParty = operationType === "purchase" ? "شراء من التبرعات النقدية" : "بيع رجيع ومخرجات";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation_type: operationType,
          donor_id: operationType === "donation" ? donorId : null,
          donor_name: operationType === "donation" ? undefined : (partyName.trim() || defaultParty),
          date,
          item,
          item_name: item === "bran" ? "رجيع / ردة" : itemName,
          bags: Number(bags) || 0,
          bag_kg: Number(bagKg) || 0,
          quantity: item === "cash" ? Number(amount) : Number(quantity),
          unit: item === "cash" ? "جنيه" : unit,
          amount: Number(amount) || 0,
          purpose: purpose || (operationType === "purchase" ? "شراء محصول من أموال التبرعات" : operationType === "sale" ? "بيع رجيع ومخرجات لصالح الصندوق" : "شراء أرز للمستحقين"),
          payment_method: paymentMethod,
          notes,
          season,
          version: receipt?.version,
        }),
      });
      const r = await res.json();
      if (r.ok) {
        toast.success(
          receipt
            ? "تم تحديث العملية بنجاح"
            : operationType === "purchase"
            ? "تم تسجيل عملية الشراء وخصم المبلغ من رصيد التبرعات بنجاح"
            : operationType === "sale"
            ? "تم تسجيل عملية البيع وإضافة المبلغ لرصيد التبرعات بنجاح"
            : "تم تسجيل إيصال الاستلام بنجاح"
        );
        onSuccess(r.data);
      } else {
        toast.error(r.error?.message || "فشلت العملية");
      }
    } catch (err: any) {
      toast.error("حدث خطأ أثناء حفظ العملية");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 dir-rtl text-right my-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {receipt ? (
              `تعديل عملية رقم ${receipt.no}`
            ) : operationType === "purchase" ? (
              <>
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                تسجيل شراء محاصيل (خصماً من التبرعات النقدية للأرز)
              </>
            ) : operationType === "sale" ? (
              <>
                <TrendingUp className="w-5 h-5 text-amber-600" />
                تسجيل بيع مخرجات / رجيع (إيداع بصندوق التبرعات)
              </>
            ) : (
              <>
                <HeartHandshake className="w-5 h-5 text-emerald-600" />
                تسجيل إيصال توريد / استلام تبرع جديد
              </>
            )}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Operation Type Selector Tabs */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              نوع العملية <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleSwitchOpType("donation")}
                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  operationType === "donation"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50 dark:hover:bg-slate-700"
                }`}
              >
                <HeartHandshake className="w-4 h-4" />
                تبرع (وارد)
              </button>

              <button
                type="button"
                onClick={() => handleSwitchOpType("purchase")}
                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  operationType === "purchase"
                    ? "bg-blue-700 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50 dark:hover:bg-slate-700"
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                شراء من التبرعات
              </button>

              <button
                type="button"
                onClick={() => handleSwitchOpType("sale")}
                className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  operationType === "sale"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/50 dark:hover:bg-slate-700"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                بيع مخرجات (رجيع)
              </button>
            </div>
          </div>

          {/* 2. Party Selection (Donor for Donation, Supplier for Purchase, Buyer for Sale) */}
          {operationType === "donation" ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  المتبرع الكريم <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={onOpenAddDonor}
                  className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  + متبرع جديد للمخزن
                </button>
              </div>
              <ZkSearchableSelect
                options={donorOptions}
                value={donorId}
                onChange={setDonorId}
                required
                placeholder="-- اختر أو ابحث عن اسم المتبرع --"
                searchPlaceholder="ابحث باسم المتبرع، الهاتف، أو وصف الأرض..."
                emptyMessage="لا يوجد متبرع بهذا الاسم، يمكنك إضافته عبر زر (+ متبرع جديد)"
              />
            </div>
          ) : operationType === "purchase" ? (
            <div className="space-y-2">
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900 flex items-center justify-between">
                <div>
                  <span className="text-blue-950 dark:text-blue-200 font-bold block text-xs">
                    رصيد التبرعات النقدية المتوفر للشراء:
                  </span>
                  <span className="text-base font-black text-blue-700 dark:text-blue-300">
                    {formatCurrency(availableCash)}
                  </span>
                </div>
                {availableCash <= 0 && (
                  <span className="text-[11px] px-2 py-1 rounded bg-rose-100 text-rose-800 font-bold">
                    ⚠️ الرصيد منخفض
                  </span>
                )}
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  التاجر / المورد المشترى منه (اختياري)
                </label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="مثال: تاجر أرز محلي، مضرب النور... (اختياري)"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 text-amber-950 dark:text-amber-200 text-xs font-semibold">
                💰 إيراد بيع الرجيع والمخرجات يتم إيداعه بالكامل لصالح صندوق التبرعات النقدية لشراء الأرز.
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  المشتري / التاجر (اختياري)
                </label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="مثال: تاجر أعلاف، مشتري الرجيع... (اختياري)"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* 3. Item Selector Chips */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              {operationType === "purchase" ? "الصنف المشترى للمخزن" : operationType === "sale" ? "الصنف المباع" : "نوع الصنف المستلَم"} <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2 text-center">
              {operationType === "donation" && [
                { id: "barley", label: "شعير خام", emoji: "🌾" },
                { id: "rice", label: "أرز أبيض", emoji: "🍚" },
                { id: "cash", label: "تبرع نقدي", emoji: "💵" },
                { id: "other", label: "صنف عيني آخر", emoji: "📦" },
              ].map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    setItem(it.id);
                    if (it.id === "cash") setUnit("جنيه");
                    else setUnit("كجم");
                  }}
                  className={`p-2.5 rounded-xl border font-bold transition-all ${
                    item === it.id
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-base block mb-0.5">{it.emoji}</span>
                  {it.label}
                </button>
              ))}

              {operationType === "purchase" && [
                { id: "barley", label: "شعير خام", emoji: "🌾" },
                { id: "rice", label: "أرز أبيض", emoji: "🍚" },
                { id: "other", label: "صنف آخر", emoji: "📦" },
              ].map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    setItem(it.id);
                    setUnit("كجم");
                  }}
                  className={`p-2.5 rounded-xl border font-bold transition-all ${
                    item === it.id
                      ? "bg-blue-700 text-white border-blue-700 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-base block mb-0.5">{it.emoji}</span>
                  {it.label}
                </button>
              ))}

              {operationType === "sale" && [
                { id: "bran", label: "رجيع / ردة", emoji: "🌾" },
                { id: "other", label: "كسر أرز", emoji: "🍚" },
                { id: "rice", label: "أرز أبيض", emoji: "🍚" },
                { id: "barley", label: "شعير خام", emoji: "🌾" },
              ].map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    setItem(it.id);
                    setUnit("كجم");
                  }}
                  className={`p-2.5 rounded-xl border font-bold transition-all ${
                    item === it.id
                      ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-base block mb-0.5">{it.emoji}</span>
                  {it.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Crop Inputs (Barley, Rice, Bran, or Other non-cash) */}
          {item !== "cash" && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">عدد الشكاير</label>
                  <input
                    type="number"
                    min="0"
                    value={bags}
                    onChange={(e) => setBags(e.target.value)}
                    placeholder="مثال: 10"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">وزن الشيكارة (كجم)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={bagKg}
                    onChange={(e) => setBagKg(e.target.value)}
                    placeholder="مثال: 25"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">الوزن الإجمالي (كجم) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="كجم"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-emerald-800 dark:text-emerald-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {item === "other" && (
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">اسم الصنف بالتفصيل *</label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder={operationType === "sale" ? "مثال: كسر أرز / سفا" : "مثال: سكر / مكرونة"}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* 5. Financial Inputs for Purchase */}
          {operationType === "purchase" && (
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-950 dark:text-blue-200 text-xs flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-blue-600" />
                  المبلغ المدفوع (خصماً من التبرعات النقدية)
                </span>
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                  متوفر: {formatCurrency(availableCash)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-blue-950 dark:text-blue-200 block mb-1">
                    إجمالي المبلغ (ج.م) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="إجمالي التكلفة"
                    className="w-full p-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 font-black text-rose-700 dark:text-rose-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-blue-950 dark:text-blue-200 block mb-1">سعر الكيلو (تقريبي)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    placeholder="سعر الكيلو"
                    className="w-full p-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-blue-950 dark:text-blue-200 block mb-1">طريقة الدفع</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="نقدًا">نقدًا</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="شيك">شيك</option>
                  </select>
                </div>
              </div>
              <div className="text-[11px] text-blue-800 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-900/40 p-2 rounded-lg">
                💡 سيتم خصم مبلغ <strong>{formatCurrency(Number(amount) || 0)}</strong> من رصيد التبرعات النقدية للأرز، وإضافة كمية <strong>{formatNumber(Number(quantity) || 0)} كجم</strong> مباشرة إلى رصيد المخزن.
              </div>
            </div>
          )}

          {/* 6. Financial Inputs for Sale */}
          {operationType === "sale" && (
            <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 dark:text-amber-200 text-xs flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-600" />
                  المبلغ المحصل (إيداع بصندوق تبرعات الأرز)
                </span>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  توريد نقدية لصالح الأرز
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-amber-950 dark:text-amber-200 block mb-1">
                    المبلغ المحصل (ج.م) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="إجمالي الإيراد"
                    className="w-full p-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 font-black text-emerald-700 dark:text-emerald-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-amber-950 dark:text-amber-200 block mb-1">سعر الكيلو (تقريبي)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    placeholder="سعر الكيلو"
                    className="w-full p-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-amber-950 dark:text-amber-200 block mb-1">طريقة التحصيل</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="نقدًا">نقدًا</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="شيك">شيك</option>
                  </select>
                </div>
              </div>
              <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 p-2 rounded-lg">
                💡 سيتم إضافة مبلغ <strong>{formatCurrency(Number(amount) || 0)}</strong> بالكامل إلى صندوق التبرعات النقدية للأرز لشراء أرز إضافي للمستحقين.
              </div>
            </div>
          )}

          {/* 7. Cash Donation Inputs (Only when operationType is donation and item is cash) */}
          {operationType === "donation" && item === "cash" && (
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-blue-950 dark:text-blue-200 block mb-1">المبلغ بالجنيه *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="المبلغ"
                    className="w-full p-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 font-black text-blue-900 dark:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-blue-950 dark:text-blue-200 block mb-1">طريقة الدفع</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="نقدًا">نقدًا</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="شيك">شيك</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-blue-950 dark:text-blue-200 block mb-1">الغرض</label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="الصدقة / الزكاة"
                    className="w-full p-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 8. Date and Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">تاريخ العملية</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">الملاحظات</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات اختيارية..."
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white rounded-xl shadow transition-colors ${
                operationType === "purchase"
                  ? "bg-blue-700 hover:bg-blue-800"
                  : operationType === "sale"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-700 hover:bg-emerald-800"
              }`}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {operationType === "purchase" ? "تسجيل الشراء وحفظ الإذن" : operationType === "sale" ? "تسجيل البيع وحفظ الإيصال" : "حفظ واستخراج الإيصال"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 3. Mill Form Modal (Milling Operations) ---
function MillFormModal({
  isOpen,
  mill,
  season,
  donors,
  onClose,
  onSuccess,
  onOpenAddDonor,
}: {
  isOpen: boolean;
  mill: any | null;
  season: string;
  donors: any[];
  onClose: () => void;
  onSuccess: () => void;
  onOpenAddDonor?: () => void;
}) {
  const [place, setPlace] = useState(mill?.place || "");
  const [date, setDate] = useState(mill?.date ? new Date(mill.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
  const [bags, setBags] = useState<number | string>(mill?.bags || "");
  const [riceKg, setRiceKg] = useState<number | string>(mill?.rice_kg || "");
  const [branKg, setBranKg] = useState<number | string>(mill?.bran_kg || "");
  const [wasteKg, setWasteKg] = useState<number | string>(mill?.waste_kg || "");
  const [notes, setNotes] = useState(mill?.notes || "");
  const [override, setOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Searchable donor options for milling allocations (including general barley stock)
  const donorOptions = useMemo(() => {
    const list: any[] = [
      {
        value: "general",
        label: "مخزون الشعير العام بالمخزن",
        subLabel: "خصم عام من رصيد مخزن الشعير",
        extra: "رصيد عام",
      },
    ];
    donors.forEach((d: any) => {
      list.push({
        value: String(d._id),
        label: d.name,
        subLabel: d.land_description ? `الأرض: ${d.land_description}` : undefined,
        phone: d.phone || undefined,
        extra: d.land_area_qirat ? `${d.land_area_qirat} قيراط` : undefined,
      });
    });
    return list;
  }, [donors]);

  // Allocations state
  const [allocs, setAllocs] = useState<Array<{ donor_id: string; donor_name: string; kg: number | string }>>(() => {
    if (mill?.allocs && mill.allocs.length > 0) return mill.allocs;
    if (donors && donors.length > 0) {
      return [{ donor_id: String(donors[0]._id), donor_name: donors[0].name, kg: "" }];
    }
    return [{ donor_id: "general", donor_name: "مخزون الشعير العام بالمخزن", kg: "" }];
  });

  // Operational costs state
  const [costs, setCosts] = useState({
    millCost: mill?.costs?.millCost || "",
    loadCost: mill?.costs?.loadCost || "",
    transportCost: mill?.costs?.transportCost || "",
    unloadCost: mill?.costs?.unloadCost || "",
    labor: mill?.costs?.labor || "",
    extra: mill?.costs?.extra || "",
  });

  const totalInKg = useMemo(() => {
    return allocs.reduce((acc, a) => acc + (Number(a.kg) || 0), 0);
  }, [allocs]);

  const millingRate = useMemo(() => {
    if (totalInKg <= 0 || !riceKg) return 0;
    return (Number(riceKg) / totalInKg) * 100;
  }, [totalInKg, riceKg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!place.trim()) return toast.error("اسم المضرب إلزامي");
    if (totalInKg <= 0) return toast.error("يجب تحديد كميات الشعير وتوزيعها");
    setSubmitting(true);

    try {
      const url = mill ? `/api/zakat-rice/mills/${mill._id}` : "/api/zakat-rice/mills";
      const method = mill ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place,
          date,
          bags: Number(bags) || 0,
          in_kg: totalInKg,
          rice_kg: Number(riceKg) || 0,
          bran_kg: Number(branKg) || 0,
          waste_kg: Number(wasteKg) || 0,
          notes,
          allocs: allocs.map((a) => ({
            donor_id: a.donor_id === "general" ? undefined : a.donor_id,
            donor_name: a.donor_name || "مخزون الشعير العام بالمخزن",
            kg: Number(a.kg) || 0,
          })),
          costs,
          season,
          override,
          version: mill?.version,
        }),
      });
      const r = await res.json();
      if (r.ok) {
        toast.success(mill ? "تم تحديث عملية التبييض" : "تم تسجيل عملية التبييض وتوليد المصروفات بنجاح");
        onSuccess();
      } else {
        toast.error(r.error?.message || "فشلت العملية");
      }
    } catch (err: any) {
      toast.error("حدث خطأ أثناء حفظ عملية التبييض");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 dir-rtl text-right my-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {mill ? `تعديل عملية تبييض رقم ${mill.no}` : "تسجيل عملية تبييض جديدة بالمضرب"}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">اسم المضرب / الجهة *</label>
              <input
                type="text"
                required
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="مضرب البركة بالزرقا"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">تاريخ العملية</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">عدد الشكاير</label>
              <input
                type="number"
                value={bags}
                onChange={(e) => setBags(e.target.value)}
                placeholder="عدد الشكاير"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Allocation of Barley per Donor */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
              <label className="font-bold text-slate-800 dark:text-slate-200">
                توزيع الشعير المحول للتبييض على المتبرعين (إجمالي الدخول: <span className="text-emerald-700 dark:text-emerald-400 font-black">{formatNumber(totalInKg)} كجم</span>)
              </label>
              <div className="flex items-center gap-2">
                {onOpenAddDonor && (
                  <button
                    type="button"
                    onClick={onOpenAddDonor}
                    className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    + متبرع جديد للمخزن
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAllocs([...allocs, { donor_id: "general", donor_name: "مخزون الشعير العام بالمخزن", kg: "" }]);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-lg shadow-xs hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors"
                >
                  + إضافة متبرع
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {allocs.map((al, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <ZkSearchableSelect
                      options={donorOptions}
                      value={al.donor_id}
                      onChange={(val) => {
                        const sel = donorOptions.find((d: any) => String(d.value) === String(val));
                        const updated = [...allocs];
                        updated[idx].donor_id = val;
                        updated[idx].donor_name = sel?.label || "";
                        setAllocs(updated);
                      }}
                      placeholder="-- اختر المتبرع أو المخزون العام --"
                      searchPlaceholder="ابحث باسم المتبرع، أو المخزون العام..."
                    />
                  </div>
                  <div className="w-36 flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min="1"
                      placeholder="كجم شعير"
                      value={al.kg}
                      onChange={(e) => {
                        const updated = [...allocs];
                        updated[idx].kg = e.target.value;
                        setAllocs(updated);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">كجم</span>
                  </div>
                  {allocs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAllocs(allocs.filter((_, i) => i !== idx));
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl shrink-0 transition-colors"
                      title="إزالة المتبرع"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Milling Output */}
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 dark:text-emerald-200">نواتج التبييض الفعلية:</span>
              <span className="font-black text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-700 text-xs">
                نسبة التصافي: {millingRate.toFixed(1)}%
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-emerald-900 dark:text-emerald-300 block mb-1">الأرز الأبيض الناتج (كجم) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={riceKg}
                  onChange={(e) => setRiceKg(e.target.value)}
                  placeholder="كجم أرز أبيض"
                  className="w-full p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 font-black text-emerald-900 dark:text-emerald-200 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">الردة (كجم)</label>
                <input
                  type="number"
                  min="0"
                  value={branKg}
                  onChange={(e) => setBranKg(e.target.value)}
                  placeholder="كجم ردة"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">الفاقد / الكنانة (كجم)</label>
                <input
                  type="number"
                  min="0"
                  value={wasteKg}
                  onChange={(e) => setWasteKg(e.target.value)}
                  placeholder="كجم فاقد"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Operational Costs (Auto Expenses Generation) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="font-bold text-slate-800 dark:text-slate-200 block">
              التكاليف والمصروفات التشغيلية (تولَّد آلياً في شجرة المصروفات):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <div>
                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold block mb-1">أجر الطحن</span>
                <input
                  type="number"
                  value={costs.millCost}
                  onChange={(e) => setCosts({ ...costs, millCost: e.target.value })}
                  placeholder="ج.م"
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold block mb-1">تحميل</span>
                <input
                  type="number"
                  value={costs.loadCost}
                  onChange={(e) => setCosts({ ...costs, loadCost: e.target.value })}
                  placeholder="ج.م"
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold block mb-1">نقل وسيارات</span>
                <input
                  type="number"
                  value={costs.transportCost}
                  onChange={(e) => setCosts({ ...costs, transportCost: e.target.value })}
                  placeholder="ج.م"
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold block mb-1">تنزيل</span>
                <input
                  type="number"
                  value={costs.unloadCost}
                  onChange={(e) => setCosts({ ...costs, unloadCost: e.target.value })}
                  placeholder="ج.م"
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold block mb-1">عمالة</span>
                <input
                  type="number"
                  value={costs.labor}
                  onChange={(e) => setCosts({ ...costs, labor: e.target.value })}
                  placeholder="ج.م"
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold block mb-1">أخرى</span>
                <input
                  type="number"
                  value={costs.extra}
                  onChange={(e) => setCosts({ ...costs, extra: e.target.value })}
                  placeholder="ج.م"
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              حفظ عملية التبييض
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 4. Beneficiary Form Modal ---
function BeneficiaryFormModal({
  isOpen,
  beneficiary,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  beneficiary: any | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(beneficiary?.name || "");
  const [phone, setPhone] = useState(beneficiary?.phone || "");
  const [area, setArea] = useState(beneficiary?.area || "");
  const [familySize, setFamilySize] = useState(beneficiary?.family_size || 1);
  const [extra, setExtra] = useState(beneficiary?.extra || "");
  const [notes, setNotes] = useState(beneficiary?.notes || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("اسم المستفيد إلزامي");
    setSubmitting(true);

    try {
      const url = beneficiary ? `/api/zakat-rice/beneficiaries/${beneficiary._id}` : "/api/zakat-rice/beneficiaries";
      const method = beneficiary ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          area,
          family_size: Number(familySize) || 1,
          extra,
          notes,
          version: beneficiary?.version,
        }),
      });
      const r = await res.json();
      if (r.ok) {
        toast.success(beneficiary ? "تم تحديث المستفيد" : "تمت إضافة المستفيد بنجاح");
        if (r.warning) toast.warning(r.warning);
        onSuccess();
      } else {
        toast.error(r.error?.message || "فشلت العملية");
      }
    } catch (err: any) {
      toast.error("حدث خطأ أثناء حفظ المستفيد");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 dir-rtl text-right">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {beneficiary ? "تعديل بيانات المستفيد" : "إضافة مستفيد جديد"}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              اسم المستفيد <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم ثلاثي أو رباعي"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">رقم الهاتف</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010..."
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">عدد أفراد الأسرة</label>
              <input
                type="number"
                min="1"
                value={familySize}
                onChange={(e) => setFamilySize(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">المنطقة / العنوان</label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="الزرقا - شارع الجلاء"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">الرقم القومي / بيانات إضافية</label>
            <input
              type="text"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="بيانات إضافية أو الرقم القومي..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              حفظ المستفيد
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 5. Distribution Form Modal (WITH LIVE RICE STOCK BANNER) ---
function DistributionFormModal({
  isOpen,
  distribution,
  season,
  currentRiceStock,
  beneficiaries,
  onClose,
  onSuccess,
  onOpenAddBeneficiary,
}: {
  isOpen: boolean;
  distribution: any | null;
  season: string;
  currentRiceStock: number;
  beneficiaries: any[];
  onClose: () => void;
  onSuccess: (saved: any) => void;
  onOpenAddBeneficiary: () => void;
}) {
  const [beneficiaryId, setBeneficiaryId] = useState(distribution?.beneficiary_id || "");
  const [unit, setUnit] = useState<"كجم" | "شيكارة">(distribution?.unit || "كجم");
  const [enteredQty, setEnteredQty] = useState<number | string>(distribution?.entered_qty || "");
  const [bags, setBags] = useState<number | string>(distribution?.bags || 1);
  const [bagKg, setBagKg] = useState<number | string>(distribution?.bag_kg || 25);
  const [place, setPlace] = useState(distribution?.place || "المقر الرئيسي للجمعية");
  const [notes, setNotes] = useState(distribution?.notes || "");
  const [date, setDate] = useState(distribution?.date ? new Date(distribution.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
  const [override, setOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);

  // Searchable beneficiary options
  const beneficiaryOptions = useMemo(() => {
    return beneficiaries.map((b: any) => ({
      value: String(b._id),
      label: b.name,
      subLabel: b.area || undefined,
      phone: b.phone || undefined,
      extra: b.extra ? b.extra : (b.internalId ? `كود: ${b.internalId}` : `أسرة: ${b.family_size || 1}`),
      internalId: b.internalId || (b.extra ? String(b.extra).replace(/[^\d]/g, "") : ""),
      nationalId: b.nationalId || "",
    }));
  }, [beneficiaries]);

  const handleBarcodeScan = (scannedValue: string) => {
    const raw = scannedValue.trim();
    if (!raw) return;

    let clean = raw.toLowerCase().replace(/[*]/g, "").trim();
    if (clean.startsWith("dhz")) {
      clean = clean.replace(/^dhz0*/, "");
    }
    const cleanNum = clean.replace(/^0+/, "");

    // Search in loaded beneficiaries list
    const found = beneficiaries.find((b: any) => {
      const bInt = String(b.internalId || "").trim();
      if (bInt && (bInt === clean || bInt === cleanNum || parseInt(bInt, 10) === parseInt(cleanNum, 10))) {
        return true;
      }
      const bExtra = String(b.extra || "");
      const match = bExtra.match(/\d+/);
      if (match && (match[0] === clean || match[0] === cleanNum || parseInt(match[0], 10) === parseInt(cleanNum, 10))) {
        return true;
      }
      if (String(b._id) === raw) return true;
      if (b.nationalId && String(b.nationalId).trim() === raw) return true;
      if (b.phone && String(b.phone).trim() === raw) return true;
      return false;
    });

    if (found) {
      setBeneficiaryId(String(found._id));
      setIsBarcodeModalOpen(false);
      const codeDisplay = found.internalId ? `كود: ${found.internalId}` : (found.extra || "");
      toast.success(`تم اختيار المستفيد بنجاح: ${found.name} ${codeDisplay ? `(${codeDisplay})` : ""}`);
    } else {
      toast.error(`لم يتم العثور على مستفيد بالباركود / الكود: ${raw}`);
    }
  };

  // Compute final kg deducted
  const finalKgDeducted = useMemo(() => {
    if (unit === "شيكارة") {
      const b = Number(bags);
      const k = Number(bagKg);
      return (b > 0 ? b : 1) * (k > 0 ? k : 0);
    }
    return Number(enteredQty) || 0;
  }, [unit, bags, bagKg, enteredQty]);

  const hasSufficientStock = currentRiceStock >= finalKgDeducted;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiaryId) return toast.error("يجب اختيار المستفيد");
    if (finalKgDeducted <= 0) return toast.error("الكمية يجب أن تكون أكبر من صفر");

    if (!hasSufficientStock && !override) {
      return toast.error("رصيد الأرز غير كافٍ. يتطلب تفعيل خيار تجاوز الرصيد بموافقة المدير");
    }

    setSubmitting(true);
    try {
      const url = distribution ? `/api/zakat-rice/distributions/${distribution._id}` : "/api/zakat-rice/distributions";
      const method = distribution ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiary_id: beneficiaryId,
          date,
          place,
          unit,
          entered_qty: Number(enteredQty) || finalKgDeducted,
          bags: Number(bags) || 0,
          bag_kg: Number(bagKg) || 0,
          quantity_kg: finalKgDeducted,
          override,
          notes,
          season,
          version: distribution?.version,
        }),
      });
      const r = await res.json();
      if (r.ok) {
        toast.success(distribution ? "تم تحديث إذن التوزيع" : `تم صرف ${finalKgDeducted} كجم بنجاح!`);
        if (r.warning) toast.warning(r.warning);
        onSuccess(r.data);
      } else {
        toast.error(r.error?.message || "فشلت العملية");
      }
    } catch (err: any) {
      toast.error("حدث خطأ أثناء حفظ التوزيع");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 dir-rtl text-right my-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {distribution ? `تعديل إذن صرف رقم ${distribution.no}` : "تسجيل إذن صرف وتوزيع أرز جديد"}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Rice Stock Banner */}
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between mb-4 ${
            hasSufficientStock
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {hasSufficientStock ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
            <div>
              <span className="font-bold block">
                {hasSufficientStock ? "الرصيد المتاح في مخزن الأرز كافٍ للصرف" : "تنبيه: الرصيد المتاح غير كافٍ للصرف!"}
              </span>
              <span className="text-[11px] opacity-80">
                المتوفر حاليًا: {formatNumber(currentRiceStock)} كجم (≈ {Math.floor(currentRiceStock / 25)} شيكارة)
              </span>
            </div>
          </div>
          <span className="font-black text-sm">{formatNumber(currentRiceStock)} كجم</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Beneficiary Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                اسم المستفيد المستحق <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={onOpenAddBeneficiary}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                + مستفيد جديد
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <ZkSearchableSelect
                  options={beneficiaryOptions}
                  value={beneficiaryId}
                  onChange={setBeneficiaryId}
                  required
                  placeholder="-- اختر أو ابحث عن اسم المستفيد --"
                  searchPlaceholder="ابحث بالاسم، الكود، الهاتف، أو العنوان..."
                  emptyMessage="لم يتم العثور على مستفيد بهذا الاسم، يمكنك إضافته من زر (+ مستفيد جديد)"
                  onScanBarcode={() => setIsBarcodeModalOpen(true)}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsBarcodeModalOpen(true)}
                className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-1.5 transition-all font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                title="مسح باركود المستفيد بالكاميرا أو الإدخال اليدوي"
              >
                <ScanBarcode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">مسح باركود</span>
              </button>
            </div>
          </div>

          {/* Unit and Quantity Selection */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-4">
              <label className="font-bold text-slate-700 dark:text-slate-300">طريقة الصرف:</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="radio"
                    name="distUnit"
                    checked={unit === "كجم"}
                    onChange={() => setUnit("كجم")}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  بالكيلو جرام
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="radio"
                    name="distUnit"
                    checked={unit === "شيكارة"}
                    onChange={() => setUnit("شيكارة")}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  بالشيكارة
                </label>
              </div>
            </div>

            {unit === "كجم" ? (
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">الكمية المطلوبة (كجم) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={enteredQty}
                  onChange={(e) => setEnteredQty(e.target.value)}
                  placeholder="مثال: 10 كجم"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-emerald-800 dark:text-emerald-300 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">عدد الشكاير</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={bags}
                    onChange={(e) => setBags(e.target.value)}
                    placeholder="1"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">وزن الشيكارة (كجم)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={bagKg}
                    onChange={(e) => setBagKg(e.target.value)}
                    placeholder="مثال: 25"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className="text-left font-bold text-emerald-800 dark:text-emerald-300 text-xs pt-1">
              الخصم الفعلي من المخزن: {formatNumber(finalKgDeducted)} كجم
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">مكان الصرف / المقر</label>
              <input
                type="text"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="المقر الرئيسي للجمعية"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">تاريخ الصرف</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Override checkbox for Admin */}
          {!hasSufficientStock && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-300 dark:border-amber-800 flex items-center gap-2">
              <input
                type="checkbox"
                id="overrideCb"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
              />
              <label htmlFor="overrideCb" className="text-xs font-bold text-amber-950 dark:text-amber-200 cursor-pointer">
                تأكيد صرف استثنائي وتجاوز الرصيد الحالي بموافقة المدير (توثيق Audit)
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting || (!hasSufficientStock && !override)}
              className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl shadow transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              حفظ وصرف الأرز فورًا
            </button>
          </div>
        </form>

        {/* QR / Barcode Scanner Modal */}
        {isBarcodeModalOpen && (
          <QRScannerModal
            isOpen={isBarcodeModalOpen}
            onClose={() => setIsBarcodeModalOpen(false)}
            onScan={handleBarcodeScan}
            title="مسح باركود بطاقة المستفيد"
          />
        )}
      </div>
    </div>
  );
}

// --- 6. Expense Form Modal ---
function ExpenseFormModal({
  isOpen,
  expense,
  season,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  expense: any | null;
  season: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState(expense?.type || "نقل");
  const [amount, setAmount] = useState<number | string>(expense?.amount || "");
  const [qty, setQty] = useState<number | string>(expense?.qty || 1);
  const [unit, setUnit] = useState(expense?.unit || "شيكارة");
  const [party, setParty] = useState(expense?.party || "");
  const [carDriver, setCarDriver] = useState(expense?.car_driver || "");
  const [refText, setRefText] = useState(expense?.ref_text || "");
  const [date, setDate] = useState(expense?.date ? new Date(expense.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState(expense?.notes || "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type.trim() || Number(amount) < 0) return toast.error("بيانات المصروف غير مكتملة");
    setSubmitting(true);

    try {
      const url = expense ? `/api/zakat-rice/expenses/${expense._id}` : "/api/zakat-rice/expenses";
      const method = expense ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: Number(amount),
          qty: Number(qty) || 1,
          unit,
          party,
          car_driver: carDriver,
          ref_text: refText,
          date,
          notes,
          season,
          version: expense?.version,
        }),
      });
      const r = await res.json();
      if (r.ok) {
        toast.success(expense ? "تم تعديل المصروف" : "تم تسجيل المصروف بنجاح");
        onSuccess();
      } else {
        toast.error(r.error?.message || "فشلت العملية");
      }
    } catch (err: any) {
      toast.error("حدث خطأ أثناء حفظ المصروف");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 dir-rtl text-right">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {expense ? "تعديل المصروف التشغيلي" : "تسجيل مصروف تشغيلي جديد"}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">نوع المصروف *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="تحميل">تحميل</option>
                <option value="تنزيل">تنزيل</option>
                <option value="نقل">نقل وسيارات</option>
                <option value="تبييض">تبييض وطحن</option>
                <option value="عمالة">أجور عمالة</option>
                <option value="تخزين">تخزين وحراسة</option>
                <option value="تعبئة">تعبئة وشكاير</option>
                <option value="أخرى">مصروفات أخرى</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">المبلغ (ج.م) *</label>
              <input
                type="number"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="المبلغ"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-rose-700 dark:text-rose-400 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">المستلم / الجهة</label>
              <input
                type="text"
                value={party}
                onChange={(e) => setParty(e.target.value)}
                placeholder="اسم الشخص أو المضرب"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">السائق / السيارة</label>
              <input
                type="text"
                value={carDriver}
                onChange={(e) => setCarDriver(e.target.value)}
                placeholder="اسم السائق ورقم السيارة"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">العملية المرتبطة</label>
              <input
                type="text"
                value={refText}
                onChange={(e) => setRefText(e.target.value)}
                placeholder="مثال: تبييض 00025"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">تاريخ المصروف</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              حفظ المصروف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- 7. Adjustment Form Modal ---
function AdjustmentFormModal({
  isOpen,
  season,
  barleyStock,
  riceStock,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  season: string;
  barleyStock: number;
  riceStock: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [store, setStore] = useState<"barley" | "rice">("barley");
  const [adjType, setAdjType] = useState<"add" | "sub">("add");
  const [kg, setKg] = useState<number | string>("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  const currentBal = store === "barley" ? barleyStock : riceStock;
  const numKg = Number(kg) || 0;
  const finalAdjustmentKg = adjType === "add" ? numKg : -numKg;
  const balanceAfter = currentBal + finalAdjustmentKg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numKg || numKg <= 0) return toast.error("الكمية يجب أن تكون أكبر من صفر");
    if (!reason.trim()) return toast.error("سبب التسوية إلزامي");
    setSubmitting(true);

    try {
      const res = await fetch("/api/zakat-rice/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store,
          kg: finalAdjustmentKg,
          reason,
          date,
          season,
        }),
      });
      const r = await res.json();
      if (r.ok) {
        toast.success("تم تسجيل التسوية الجردية بنجاح");
        onSuccess();
      } else {
        toast.error(r.error?.message || "فشلت العملية");
      }
    } catch (err: any) {
      toast.error("حدث خطأ أثناء حفظ التسوية");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 dir-rtl text-right">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">تسجيل تسوية جردية لمخزن</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">المخزن المعني *</label>
              <select
                value={store}
                onChange={(e) => setStore(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="barley">مخزن الشعير الخام</option>
                <option value="rice">مخزن الأرز الأبيض</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">نوع التسوية *</label>
              <select
                value={adjType}
                onChange={(e) => setAdjType(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="add">تسوية إضافة (+)</option>
                <option value="sub">تسوية خصم / عجز (-)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">الكمية بالكيلو جرام (كجم) *</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              required
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="مثال: 50 كجم"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black text-sm placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Balance Preview Card */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold block">الرصيد الحالي:</span>
              <strong className="text-slate-900 dark:text-white font-bold">{formatNumber(currentBal)} كجم</strong>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div className="text-left">
              <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold block">الرصيد بعد التسوية:</span>
              <strong className={balanceAfter < 0 ? "text-rose-600 dark:text-rose-400 font-black" : "text-emerald-700 dark:text-emerald-300 font-black"}>
                {formatNumber(balanceAfter)} كجم
              </strong>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              السبب الإلزامي للتسوية <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: جرد سنوي، رطوبة، عجز مبرر، تصحيح كميات سابقة..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting || balanceAfter < 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl shadow transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              تأكيد وتطبيق التسوية
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

