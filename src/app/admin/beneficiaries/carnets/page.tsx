"use client";

import React, { Suspense, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  Printer,
  CheckSquare,
  Square,
  Search,
  Filter,
  Layers,
  CreditCard,
  Phone,
  Globe,
  Home,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  ChevronDown
} from "lucide-react";
import Code128Barcode from "@/components/Code128Barcode";
import BrandedLoader from "@/components/BrandedLoader";

interface Beneficiary {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  nationalId?: string;
  internalId?: string;
  maritalStatus?: string;
  marriageDetails?: string;
  spouse?: {
    name?: string;
    nationalId?: string;
    phone?: string;
  };
  category?: string;
}

type DisplayViewMode = "both" | "front" | "back" | "duplex";
type FilterMode = "all" | "range" | "specific";

const formatBarcodeValue = (internalId?: string | number) => {
  const idStr = String(internalId || "0").trim();
  return `DHZ${idStr.padStart(5, "0")}`;
};

function CarnetInner() {
  const searchParams = useSearchParams();
  const { user } = useUser();

  // URL query params initialization
  const initialMode = (searchParams.get("mode") as FilterMode) || "all";
  const initialFrom = searchParams.get("from") || "";
  const initialTo = searchParams.get("to") || "";
  const initialIdsParam = searchParams.get("ids") || "";

  // Data fetching
  const { data, error, isLoading, mutate } = useSWR<{ beneficiaries: Beneficiary[] }>(
    "/api/beneficiaries",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const allBeneficiaries = useMemo(() => {
    const list = data?.beneficiaries || [];
    return [...list].sort((a, b) => {
      const aId = parseInt(a.internalId || "0", 10);
      const bId = parseInt(b.internalId || "0", 10);
      return aId - bId;
    });
  }, [data]);

  // View & Filtering states
  const [viewMode, setViewMode] = useState<DisplayViewMode>("both");
  const [filterMode, setFilterMode] = useState<FilterMode>(initialMode);
  const [rangeFrom, setRangeFrom] = useState(initialFrom);
  const [rangeTo, setRangeTo] = useState(initialTo);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(24);

  // Initialize selectedIds from URL if provided
  useEffect(() => {
    if (initialIdsParam) {
      const ids = initialIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
      setSelectedIds(new Set(ids));
    }
  }, [initialIdsParam]);

  // Compute filtered list based on filterMode
  const filteredBeneficiaries = useMemo(() => {
    let result = allBeneficiaries;

    if (filterMode === "range") {
      const from = parseInt(rangeFrom, 10);
      const to = parseInt(rangeTo, 10);
      if (!isNaN(from) && !isNaN(to)) {
        result = result.filter((b) => {
          const id = parseInt(b.internalId || "0", 10);
          return id >= from && id <= to;
        });
      }
    } else if (filterMode === "specific" && selectedIds.size > 0) {
      result = result.filter((b) => selectedIds.has(b._id));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.internalId && b.internalId.includes(q)) ||
          (b.nationalId && b.nationalId.includes(q)) ||
          (b.phone && b.phone.includes(q))
      );
    }

    return result;
  }, [allBeneficiaries, filterMode, rangeFrom, rangeTo, selectedIds, searchTerm]);

  // Print selection state (which cards from the filtered list should print)
  const [printSelection, setPrintSelection] = useState<Set<string>>(new Set());

  // Automatically select all in filtered list when filtered list changes
  useEffect(() => {
    if (filteredBeneficiaries.length > 0) {
      setPrintSelection(new Set(filteredBeneficiaries.map((b) => b._id)));
    } else {
      setPrintSelection(new Set());
    }
  }, [filteredBeneficiaries]);

  const togglePrintSelect = (id: string) => {
    setPrintSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setPrintSelection(new Set(filteredBeneficiaries.map((b) => b._id)));
  };

  const handleDeselectAll = () => {
    setPrintSelection(new Set());
  };

  const handleInvertSelect = () => {
    setPrintSelection((prev) => {
      const next = new Set<string>();
      filteredBeneficiaries.forEach((b) => {
        if (!prev.has(b._id)) next.add(b._id);
      });
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const cardsToRender = filteredBeneficiaries.slice(0, visibleCount);
  const printableList = filteredBeneficiaries.filter((b) => printSelection.has(b._id));

  // Front Card Component
  const renderFrontCard = (b: Beneficiary) => {
    const code = formatBarcodeValue(b.internalId);
    const spouseName = b.spouse?.name || b.marriageDetails || "-";

    return (
      <div className="id-card-element front-card relative overflow-hidden rounded-[3.2mm] text-[#4A3626] bg-[#F3E4C4] border border-[#BFE6D9] shadow-sm select-none">
        {/* Top Gold Line */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-[#F9CE5B] z-10" />

        {/* Bottom Gold Sweep */}
        <div className="absolute bottom-0 left-0 right-0 h-[5px] bg-[#F9CE5B] z-10" />

        {/* Subtle Watermark Logo */}
        <div className="absolute top-1/2 right-[-8%] -translate-y-1/2 w-[60%] opacity-[0.06] pointer-events-none z-0">
          <Image
            src="/logos/logo-full.png"
            alt="Watermark"
            width={300}
            height={300}
            className="w-full h-auto object-contain"
            priority={false}
          />
        </div>

        {/* Content Header: Logo + Org Name + Badge */}
        <div className="relative z-10 pt-2.5 px-3 flex items-center justify-between gap-2 border-b border-[#BFE6D9]/40 pb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/70 p-0.5 border border-[#BFE6D9] shrink-0 flex items-center justify-center">
              <Image
                src="/logos/logo-full.png"
                alt="Logo"
                width={30}
                height={30}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-right leading-tight">
              <h4 className="text-[12px] font-black text-[#25695E] tracking-tight">
                جمعية دعوة الحق الخيرية
              </h4>
              <p className="text-[8.5px] font-semibold text-[#6E9E94]">
                معاً نُغيّر حياة — بطاقة معتمدة
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#4CB4A4] text-white text-[9px] font-bold shadow-xs whitespace-nowrap">
            بطاقة مستفيد
          </span>
        </div>

        {/* Card Body: 2 Columns (Right: Data Fields | Left: Barcode) */}
        <div className="relative z-10 px-3 py-2 flex items-center justify-between gap-2">
          {/* Data Fields */}
          <div className="flex-1 space-y-1.5 text-right min-w-0">
            <div>
              <span className="text-[9px] font-bold text-[#3A9C8D] block">اسم المستفيد:</span>
              <span className="text-[12.5px] font-black text-[#4A3626] block truncate" title={b.name}>
                {b.name}
              </span>
            </div>

            <div>
              <span className="text-[9px] font-bold text-[#3A9C8D] block">الرقم القومي:</span>
              <span className="text-[11.5px] font-bold text-[#25695E] font-mono tracking-wider block">
                {b.nationalId || "غير مسجل"}
              </span>
            </div>

            <div>
              <span className="text-[8.5px] font-bold text-[#3A9C8D] block">الزوج / الزوجة:</span>
              <span className="text-[10px] font-semibold text-[#4A3626] block truncate">
                {spouseName}
              </span>
            </div>
          </div>

          {/* Barcode Area */}
          <div className="w-[125px] shrink-0 flex flex-col items-center justify-center bg-white/90 p-1.5 rounded-lg border border-[#BFE6D9] shadow-xs">
            <div className="w-full px-0.5">
              <Code128Barcode value={code} height={36} barColor="#111827" />
            </div>
            <span className="text-[9px] font-mono font-bold text-[#25695E] tracking-widest mt-1">
              {code}
            </span>
            <span className="text-[7.5px] text-[#6E9E94] font-medium">مسح الباركود المعتمد</span>
          </div>
        </div>

        {/* Footer Sub-strip */}
        <div className="absolute bottom-[5px] left-0 right-0 px-3 py-0.5 bg-[#4CB4A4]/15 flex items-center justify-between text-[7.5px] font-bold text-[#25695E] z-10">
          <span>رقم المستفيد: {b.internalId || "-"}</span>
          <span>مسجد الصديق — فرع الرملة</span>
        </div>
      </div>
    );
  };

  // Back Card Component
  const renderBackCard = (b?: Beneficiary) => {
    return (
      <div className="id-card-element back-card relative overflow-hidden rounded-[3.2mm] text-[#4A3626] bg-[#F3E4C4] border border-[#BFE6D9] shadow-sm select-none">
        {/* Top Gold Strip */}
        <div className="absolute top-0 left-0 right-0 h-[6px] bg-[#F9CE5B] z-10" />

        {/* Left Teal Accent Line */}
        <div className="absolute top-[6px] bottom-[18px] left-0 w-[4px] bg-[#4CB4A4] z-10" />

        {/* Subtle Watermark Logo */}
        <div className="absolute top-1/2 left-[-6%] -translate-y-1/2 w-[55%] opacity-[0.05] pointer-events-none z-0">
          <Image
            src="/logos/logo-full.png"
            alt="Watermark"
            width={280}
            height={280}
            className="w-full h-auto object-contain"
            priority={false}
          />
        </div>

        {/* Header Block: Logo + Brand + Tagline */}
        <div className="relative z-10 pt-2 px-3 flex items-center justify-between border-b border-[#BFE6D9]/40 pb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/70 p-0.5 border border-[#BFE6D9] shrink-0 flex items-center justify-center">
              <Image
                src="/logos/logo-full.png"
                alt="Logo"
                width={26}
                height={26}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-right leading-tight">
              <h4 className="text-[11.5px] font-black text-[#25695E]">
                مؤسسة دعوة الحق الخيرية
              </h4>
              <p className="text-[8px] font-semibold text-[#6E9E94]">
                مسجد الصديق — مركز خدمة وتنمية المجتمع
              </p>
            </div>
          </div>
          <span className="text-[8px] font-mono text-[#25695E] bg-white/80 px-1.5 py-0.5 rounded border border-[#BFE6D9]">
            {b?.internalId ? `ID: #${b.internalId}` : "OFFICIAL ID"}
          </span>
        </div>

        {/* Instructions Box */}
        <div className="relative z-10 mx-3 my-1.5 p-2 rounded-lg bg-white/60 border border-[#BFE6D9] backdrop-blur-xs">
          <div className="text-[8.5px] font-bold text-[#25695E] mb-1 flex items-center gap-1">
            <span>📋</span>
            <span>تعليمات الاستخدام الرسمية:</span>
          </div>
          <ul className="text-[7.5px] font-medium text-[#4A3626] space-y-0.5 leading-snug list-disc pr-3">
            <li>البطاقة شخصية وتعتبر وثيقة رسمية للمستفيد المعتمد.</li>
            <li>تُستخدم لإثبات الهوية واستلام الخدمات والمساعدات الدورية.</li>
            <li>يُرجى الحفاظ على سلامة شريط الباركود لسرعة عمليات الصرف.</li>
            <li>في حال فقدان الكارنيه، يُرجى إبلاغ إدارة الجمعية فوراً.</li>
          </ul>
        </div>

        {/* Bottom Contact Strip */}
        <div className="absolute bottom-0 left-0 right-0 h-[19px] bg-[#4CB4A4] text-white flex items-center justify-between px-3 text-[7.5px] font-bold z-10">
          <span className="flex items-center gap-1">
            <Home className="w-2.5 h-2.5" /> مسجد الصديق
          </span>
          <span className="flex items-center gap-1 font-mono">
            <Globe className="w-2.5 h-2.5" /> elhaq-next.vercel.app
          </span>
          <span className="flex items-center gap-1 font-mono">
            <Phone className="w-2.5 h-2.5" /> 01069217990
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground carnet-page-wrapper">
      {/* Top Header / Breadcrumb - Hidden in Print */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/beneficiaries"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-colors"
              title="العودة لصفحة المستفيدين"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">
                  منظومة الكارنيهات والبطاقات الرسمية
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  إصدار ISO-7810
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                طباعة وتصدير بطاقات الهوية الرسمية (Face & Back) بنظام الباركود Code 128
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => mutate()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background text-foreground hover:bg-muted text-xs font-semibold transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>تحديث</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={printableList.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold shadow-md shadow-primary/20 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المحددة ({printableList.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Control Panel / Filter Toolbar - Hidden in Print */}
      <section className="border-b border-border bg-muted/20 px-4 sm:px-6 py-4 no-print">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filter Mode Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card border border-border">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الكل ({allBeneficiaries.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("range")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === "range"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                نطاق أرقام (من - إلى)
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("specific")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === "specific"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                اختيار محدد {selectedIds.size > 0 && `(${selectedIds.size})`}
              </button>
            </div>

            {/* View Mode Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card border border-border">
              <span className="text-[11px] font-semibold text-muted-foreground px-2">العرض:</span>
              <button
                type="button"
                onClick={() => setViewMode("both")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "both"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الوجهين (أمام + خلف)
              </button>
              <button
                type="button"
                onClick={() => setViewMode("front")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "front"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الوجه الأمامي فقط
              </button>
              <button
                type="button"
                onClick={() => setViewMode("back")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "back"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الوجه الخلفي فقط
              </button>
              <button
                type="button"
                onClick={() => setViewMode("duplex")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "duplex"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="طباعة صفحة وجوه ثم صفحة ظهور متطابقة"
              >
                طباعة ثنائية (Duplex)
              </button>
            </div>
          </div>

          {/* Conditional Filters: Range or Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              {filterMode === "range" && (
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-card border border-border shadow-xs">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">من:</span>
                  <input
                    type="number"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    placeholder="مثال: 1"
                    className="w-20 px-2.5 py-1 rounded-lg border border-border bg-background text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">إلى:</span>
                  <input
                    type="number"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    placeholder="مثال: 40"
                    className="w-20 px-2.5 py-1 rounded-lg border border-border bg-background text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              )}

              {/* Instant Search Bar */}
              <div className="relative min-w-[240px] sm:min-w-[300px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث سريع بالاسم أو الرقم أو القومي..."
                  className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Selection Quick Actions */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-foreground">
                المحدد للطباعة: {printableList.length} من {filteredBeneficiaries.length}
              </span>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-primary hover:underline font-bold"
              >
                تحديد الكل
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-muted-foreground hover:text-foreground font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleInvertSelect}
                className="text-muted-foreground hover:text-foreground font-semibold"
              >
                عكس التحديد
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {isLoading && !data ? (
          <div className="text-center py-20">
            <BrandedLoader />
            <p className="mt-4 text-sm font-semibold text-muted-foreground animate-pulse">
              جاري تجهيز الكارنيهات والرموز الشريطية...
            </p>
          </div>
        ) : filteredBeneficiaries.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border rounded-2xl bg-card">
            <div className="text-5xl mb-3">🪪</div>
            <h3 className="text-lg font-bold text-foreground">لا توجد بطاقات مطابقة للشروط</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              تأكد من ضبط نطاق الأرقام أو كلمات البحث لاختيار المستفيدين المطلوبين.
            </p>
          </div>
        ) : (
          <>
            {/* Visual Screen Grid (Interactive Web Preview) - Hidden in Print */}
            <div className="no-print">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {cardsToRender.map((b) => {
                  const isSelected = printSelection.has(b._id);

                  return (
                    <div
                      key={b._id}
                      className={`p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? "bg-card border-primary/50 shadow-md ring-1 ring-primary/20"
                          : "bg-card/50 border-border opacity-70 hover:opacity-100"
                      }`}
                    >
                      {/* Card Item Header */}
                      <div className="flex items-center justify-between mb-2 px-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePrintSelect(b._id)}
                            className="w-4 h-4 rounded text-primary border-border focus:ring-primary accent-[#4CB4A4]"
                          />
                          <span className="text-xs font-bold text-foreground">
                            #{b.internalId || "-"} — {b.name}
                          </span>
                        </label>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {formatBarcodeValue(b.internalId)}
                        </span>
                      </div>

                      {/* Card Pair or Single View */}
                      <div className="flex flex-col gap-3">
                        {(viewMode === "both" || viewMode === "front" || viewMode === "duplex") && (
                          <div>{renderFrontCard(b)}</div>
                        )}
                        {(viewMode === "both" || viewMode === "back") && (
                          <div>{renderBackCard(b)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Show More Pagination */}
              {filteredBeneficiaries.length > visibleCount && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 24)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted text-sm font-bold shadow-sm transition-colors"
                  >
                    <ChevronDown className="w-4 h-4 text-primary" />
                    عرض المزيد ({filteredBeneficiaries.length - visibleCount} بطاقة متبقية)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(filteredBeneficiaries.length)}
                    className="mr-3 text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    عرض جميع البطاقات ({filteredBeneficiaries.length})
                  </button>
                </div>
              )}
            </div>

            {/* Print Sheets Layout (Rendered ONLY when printing) */}
            <div className="print-sheets-root">
              {viewMode === "duplex" ? (
                // Duplex mode: First all fronts, then all backs
                <>
                  <div className="print-duplex-fronts print-grid-container">
                    {printableList.map((b) => (
                      <div key={`front-${b._id}`} className="print-card-box">
                        {renderFrontCard(b)}
                      </div>
                    ))}
                  </div>
                  <div className="page-break" />
                  <div className="print-duplex-backs print-grid-container">
                    {printableList.map((b) => (
                      <div key={`back-${b._id}`} className="print-card-box">
                        {renderBackCard(b)}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                // Standard mode: Front only, Back only, or Both side-by-side
                <div className="print-grid-container">
                  {printableList.map((b) => (
                    <React.Fragment key={b._id}>
                      {(viewMode === "both" || viewMode === "front") && (
                        <div className="print-card-box">{renderFrontCard(b)}</div>
                      )}
                      {(viewMode === "both" || viewMode === "back") && (
                        <div className="print-card-box">{renderBackCard(b)}</div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Media Print Stylesheet matching ISO ID-1 Standard (85.6mm x 54mm) */}
      <style jsx global>{`
        @media screen {
          .print-sheets-root {
            display: none !important;
          }
          .id-card-element {
            width: 100%;
            max-width: 380px;
            aspect-ratio: 85.6 / 54;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 6mm;
          }

          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .no-print,
          nav,
          header,
          footer,
          aside,
          .carnet-page-wrapper > header,
          .carnet-page-wrapper > section {
            display: none !important;
          }

          .carnet-page-wrapper {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }

          .print-sheets-root {
            display: block !important;
          }

          /* 8 Cards per A4 sheet (2 columns x 4 rows) */
          .print-grid-container {
            display: grid !important;
            grid-template-columns: repeat(2, 85.6mm) !important;
            gap: 4mm 6mm !important;
            justify-content: center !important;
            align-content: start !important;
            page-break-inside: auto !important;
          }

          .print-card-box {
            width: 85.6mm !important;
            height: 54mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
          }

          .id-card-element {
            width: 85.6mm !important;
            height: 54mm !important;
            aspect-ratio: 85.6 / 54 !important;
            border-radius: 3.18mm !important;
            box-shadow: none !important;
            border: 0.25mm solid #cbd5e1 !important;
            background: #F3E4C4 !important;
            color: #4A3626 !important;
            box-sizing: border-box !important;
          }

          .page-break {
            page-break-before: always !important;
            break-before: page !important;
            height: 0 !important;
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function AdminCarnetsPage() {
  return (
    <Suspense fallback={<BrandedLoader />}>
      <CarnetInner />
    </Suspense>
  );
}

