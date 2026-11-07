"use client";

import React, { Suspense, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  ArrowRight,
  Printer,
  Search,
  RefreshCw,
  ChevronDown,
  Layers,
  Check,
  CreditCard
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
}

type DisplayViewMode = "both" | "front" | "back" | "duplex";
type FilterMode = "all" | "range" | "specific";

const formatBarcodeValue = (internalId?: string | number) => {
  const idStr = String(internalId || "0").trim();
  return `DHZ${idStr.padStart(5, "0")}`;
};

function CarnetInner() {
  const searchParams = useSearchParams();

  // URL query params initialization
  const initialMode = (searchParams.get("mode") as FilterMode) || "all";
  const initialFrom = searchParams.get("from") || "";
  const initialTo = searchParams.get("to") || "";
  const initialIdsParam = searchParams.get("ids") || "";

  // Data fetching from beneficiaries database
  const { data, isLoading, mutate } = useSWR<{ beneficiaries: Beneficiary[] }>(
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
  const initialSyncDoneRef = React.useRef(false);

  // Initialize selection once when data first arrives
  useEffect(() => {
    if (!initialSyncDoneRef.current && allBeneficiaries.length > 0) {
      initialSyncDoneRef.current = true;
      if (initialIdsParam) {
        const ids = initialIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
        setPrintSelection(new Set(ids));
      } else if (filterMode === "range" && rangeFrom && rangeTo) {
        const from = parseInt(rangeFrom, 10);
        const to = parseInt(rangeTo, 10);
        const matched = allBeneficiaries
          .filter((b) => {
            const id = parseInt(b.internalId || "0", 10);
            return id >= from && id <= to;
          })
          .map((b) => b._id);
        setPrintSelection(new Set(matched));
      } else {
        setPrintSelection(new Set(allBeneficiaries.map((b) => b._id)));
      }
    }
  }, [allBeneficiaries, initialIdsParam, filterMode, rangeFrom, rangeTo]);

  // Handler when user explicitly changes filter mode
  const handleModeChange = (newMode: FilterMode) => {
    setFilterMode(newMode);
    if (newMode === "all") {
      setPrintSelection(new Set(allBeneficiaries.map((b) => b._id)));
    } else if (newMode === "range") {
      const from = parseInt(rangeFrom, 10);
      const to = parseInt(rangeTo, 10);
      if (!isNaN(from) && !isNaN(to)) {
        const matched = allBeneficiaries
          .filter((b) => {
            const id = parseInt(b.internalId || "0", 10);
            return id >= from && id <= to;
          })
          .map((b) => b._id);
        setPrintSelection(new Set(matched));
      }
    }
  };

  // Handler when user changes range inputs
  const handleRangeFromChange = (val: string) => {
    setRangeFrom(val);
    const from = parseInt(val, 10);
    const to = parseInt(rangeTo, 10);
    if (!isNaN(from) && !isNaN(to)) {
      const matched = allBeneficiaries
        .filter((b) => {
          const id = parseInt(b.internalId || "0", 10);
          return id >= from && id <= to;
        })
        .map((b) => b._id);
      setPrintSelection(new Set(matched));
    }
  };

  const handleRangeToChange = (val: string) => {
    setRangeTo(val);
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(val, 10);
    if (!isNaN(from) && !isNaN(to)) {
      const matched = allBeneficiaries
        .filter((b) => {
          const id = parseInt(b.internalId || "0", 10);
          return id >= from && id <= to;
        })
        .map((b) => b._id);
      setPrintSelection(new Set(matched));
    }
  };

  const togglePrintSelect = (id: string, explicitChecked?: boolean) => {
    setPrintSelection((prev) => {
      const next = new Set(prev);
      const shouldSelect = explicitChecked !== undefined ? explicitChecked : !next.has(id);
      if (shouldSelect) {
        next.add(id);
      } else {
        next.delete(id);
      }
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

  // Front Card matching daawat_alhaq_v9_kolna_wahed.html
  const renderFrontCard = (b: Beneficiary) => {
    const code = formatBarcodeValue(b.internalId);
    const spouseName = b.spouse?.name || b.marriageDetails || "-";

    return (
      <div className="id-card front-card">
        <img className="f-wm" src="/logos/kolna-wahed.png" alt="" />
        <div className="f-sweep"></div>
        <div className="f-line"></div>

        {/* Header: logo+orgname together (left) | badge (right) */}
        <div className="f-head">
          <div className="f-brand-group">
            <img className="f-logo" src="/logos/kolna-wahed.png" alt="" />
            <div className="f-org">
              <span className="f-name">دعوة الحق</span>
              <span className="f-sub">معاً نُغيّر حياة</span>
            </div>
          </div>
          <div className="f-badge">بطاقة مستفيد</div>
        </div>

        {/* Body: right=fields | left=barcode */}
        <div className="f-body">
          <div className="f-data">
            <div className="f-row">
              <div className="f-lbl">اسم المستفيد</div>
              <div className="f-val">{b.name}</div>
            </div>
            <div className="f-div"></div>
            <div className="f-row">
              <div className="f-lbl">الرقم القومي</div>
              <div className="f-val num">{b.nationalId || "-"}</div>
            </div>
            <div className="f-div"></div>
            <div className="f-row">
              <div className="f-lbl">اسم الزوج / الزوجة</div>
              <div className="f-val f-val-sm">{spouseName}</div>
            </div>
          </div>
          <div className="f-bc-area">
            <div className="f-bc-inner">
              <div className="f-bcbox">
                <Code128Barcode value={code} height={42} />
              </div>
              <div className="f-bcnum">{code}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Back Card matching daawat_alhaq_v9_kolna_wahed.html
  const renderBackCard = () => {
    return (
      <div className="id-card back-card">
        {/* Gold top strip */}
        <div className="bk-top-strip"></div>

        {/* Watermark */}
        <img className="bk-wm" src="/logos/kolna-wahed.png" alt="" />

        {/* Tq left accent */}
        <div className="bk-left-accent"></div>

        {/* Main content */}
        <div className="bk-content">
          {/* Logo + org name */}
          <div className="bk-brand">
            <img className="bk-logo" src="/logos/kolna-wahed.png" alt="" />
            <div className="bk-brand-text">
              <div className="bk-org-name">دعوة الحق</div>
              <div className="bk-org-sub">مسجد الصديق — مركز خدمة المجتمع</div>
            </div>
          </div>

          {/* Separator */}
          <div className="bk-sep"></div>

          {/* Instructions box */}
          <div className="bk-inst-box">
            <div className="bk-inst-title">
              <span className="bk-inst-icon">📋</span> تعليمات الاستخدام
            </div>
            <ul className="bk-inst-list">
              <li>البطاقة شخصية ولا يحق لغير حاملها استخدامها.</li>
              <li>تُستخدم للحصول على خدمات الجمعية المعتمدة.</li>
              <li>يُرجى المحافظة عليها وعدم إتلافها.</li>
              <li>في حال الفقدان أبلغ أقرب فرع فوراً.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bk-foot">
          <div className="bk-foot-inner">
            <div className="bk-foot-item">
              <span className="bk-foot-icon">🕌</span>
              <span>مسجد الصديق</span>
            </div>
            <div className="bk-foot-divider"></div>
            <div className="bk-foot-item">
              <span className="bk-foot-icon">🌐</span>
              <span>elhaq-next.vercel.app</span>
            </div>
            <div className="bk-foot-divider"></div>
            <div className="bk-foot-item">
              <span className="bk-foot-icon">📞</span>
              <span>01069217990</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground carnet-page-wrapper">
      {/* Top Header - Hidden in Print */}
      <header className="sticky top-0 z-30 bg-card border-b border-border shadow-sm no-print">
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
                <h1 className="text-lg font-black text-foreground flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#4CB4A4]" />
                  دعوة الحق — نظام بطاقات المستفيدين
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#4CB4A4]/15 text-[#25695E] dark:text-[#4CB4A4] border border-[#4CB4A4]/30">
                  v9.0 الأصلية
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                التصميم المطابق لـ ISO/IEC 7810 ID-1 مع الباركود والتعليمات الرسمية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => mutate()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background text-foreground hover:bg-muted text-xs font-bold transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>تحديث</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={printableList.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4CB4A4] hover:bg-[#3A9C8D] text-white text-sm font-bold shadow-md shadow-[#4CB4A4]/25 transition-all disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة ({printableList.length} بطاقة)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Control Panel / Filter Toolbar - Hidden in Print */}
      <section className="border-b border-border bg-muted/30 px-4 sm:px-6 py-4 no-print">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filter Mode Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card border border-border">
              <button
                type="button"
                onClick={() => handleModeChange("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === "all"
                    ? "bg-[#4CB4A4] text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الكل ({allBeneficiaries.length})
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("range")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === "range"
                    ? "bg-[#4CB4A4] text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                من - إلى (نطاق)
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("specific")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === "specific"
                    ? "bg-[#4CB4A4] text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                اختيار محدد {selectedIds.size > 0 && `(${selectedIds.size})`}
              </button>
            </div>

            {/* View Mode Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card border border-border">
              <span className="text-[11px] font-bold text-muted-foreground px-2">العرض:</span>
              <button
                type="button"
                onClick={() => setViewMode("both")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "both"
                    ? "bg-[#25695E] text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الوجهين معاً
              </button>
              <button
                type="button"
                onClick={() => setViewMode("front")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "front"
                    ? "bg-[#25695E] text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الوجه الأمامي فقط
              </button>
              <button
                type="button"
                onClick={() => setViewMode("back")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "back"
                    ? "bg-[#25695E] text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                الوجه الخلفي فقط
              </button>
              <button
                type="button"
                onClick={() => setViewMode("duplex")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === "duplex"
                    ? "bg-[#25695E] text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="صفحة وجوه تليها صفحة ظهور"
              >
                ثنائي الوجه (Duplex)
              </button>
            </div>
          </div>

          {/* Conditional Filters: Range or Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              {filterMode === "range" && (
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-card border border-border shadow-xs">
                  <span className="text-xs font-bold text-muted-foreground mr-1">من رقم:</span>
                  <input
                    type="number"
                    value={rangeFrom}
                    onChange={(e) => handleRangeFromChange(e.target.value)}
                    placeholder="1"
                    className="w-20 px-2.5 py-1 rounded-lg border border-border bg-background text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#4CB4A4]/40"
                  />
                  <span className="text-xs font-bold text-muted-foreground">إلى:</span>
                  <input
                    type="number"
                    value={rangeTo}
                    onChange={(e) => handleRangeToChange(e.target.value)}
                    placeholder="40"
                    className="w-20 px-2.5 py-1 rounded-lg border border-border bg-background text-foreground text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#4CB4A4]/40"
                  />
                </div>
              )}

              {/* Instant Search Bar */}
              <div className="relative min-w-[240px] sm:min-w-[320px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث سريع بالاسم أو الرقم أو الرقم القومي..."
                  className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#4CB4A4]/40"
                />
              </div>
            </div>

            {/* Selection Quick Actions */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-foreground">
                المحدد: <span className="text-[#25695E] dark:text-[#4CB4A4]">{printableList.length}</span> من {filteredBeneficiaries.length}
              </span>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[#4CB4A4] hover:underline font-bold"
              >
                تحديد الكل
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-muted-foreground hover:text-foreground font-semibold"
              >
                إلغاء التحديد
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
            <p className="mt-4 text-sm font-bold text-muted-foreground animate-pulse">
              جاري تحميل بطاقات المستفيدين بالباركود...
            </p>
          </div>
        ) : filteredBeneficiaries.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border rounded-2xl bg-card">
            <div className="text-5xl mb-3">🪪</div>
            <h3 className="text-lg font-bold text-foreground">لا توجد بطاقات مطابقة للاختيار</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              تأكد من شروط البحث أو تحديد نطاق المستفيدين.
            </p>
          </div>
        ) : (
          <>
            {/* Visual Web Preview */}
            <div className="no-print">
              <div className="cards-grid">
                {cardsToRender.map((b, idx) => {
                  const isSelected = printSelection.has(b._id);

                  return (
                    <div
                      key={b._id}
                      className={`card-wrapper ${isSelected ? "sel-print" : ""}`}
                      onClick={(e) => {
                        // If clicked directly on the checkbox or an interactive element, do not double-toggle
                        if ((e.target as HTMLElement).tagName !== "INPUT") {
                          togglePrintSelect(b._id);
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        className="card-checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          togglePrintSelect(b._id, e.target.checked);
                        }}
                      />
                      <div className="card-label">
                        بطاقة #{b.internalId || idx + 1} — {b.name}
                      </div>
                      <div className="card-pair">
                        {(viewMode === "both" || viewMode === "front" || viewMode === "duplex") && (
                          renderFrontCard(b)
                        )}
                        {(viewMode === "both" || viewMode === "back") && (
                          renderBackCard()
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
                    <ChevronDown className="w-4 h-4 text-[#4CB4A4]" />
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

            {/* Print Output - Exact print layout matching daawat_alhaq_v9_kolna_wahed.html */}
            <div className="print-sheets-root">
              {viewMode === "duplex" ? (
                <>
                  <div className="print-grid-container">
                    {printableList.map((b) => (
                      <div key={`front-${b._id}`} className="print-card-box">
                        {renderFrontCard(b)}
                      </div>
                    ))}
                  </div>
                  <div className="page-break" />
                  <div className="print-grid-container">
                    {printableList.map((b) => (
                      <div key={`back-${b._id}`} className="print-card-box">
                        {renderBackCard()}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="print-grid-container">
                  {printableList.map((b) => (
                    <React.Fragment key={b._id}>
                      {(viewMode === "both" || viewMode === "front") && (
                        <div className="print-card-box">{renderFrontCard(b)}</div>
                      )}
                      {(viewMode === "both" || viewMode === "back") && (
                        <div className="print-card-box">{renderBackCard()}</div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* EXACT STYLES FROM daawat_alhaq_v9_kolna_wahed.html */}
      <style jsx global>{`
        /* CSS Variables */
        :root {
          --bg: #FCF4E4;
          --panel: #FFFFFF;
          --card-bg: #FFFFFF;
          --border: #BFE6D9;
          --blue: #4CB4A4;
          --blue-lt: #4CB4A4;
          --blue-dk: #25695E;
          --accent: #4CB4A4;
          --text: #4A3626;
          --muted: #6E9E94;
          --dim: #9DBBB1;
          --green: #4CB4A4;
          --red: #C0392B;
          --orange: #F9CE5B;
          --r: 12px;
          --tq: #4CB4A4;
          --tq-dk: #3A9C8D;
          --tq-xdk: #25695E;
          --tq-lt: #ECF7EC;
          --gold: #F9CE5B;
          --gold-dk: #D9AE3A;
          --brown: #4A3626;
          --cream: #FCF4E4;
        }

        .cards-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          justify-content: flex-start;
        }

        .card-wrapper {
          display: flex;
          flex-direction: column;
          position: relative;
          cursor: pointer;
          transition: opacity 0.2s ease, filter 0.2s ease, transform 0.15s ease;
        }

        .card-wrapper:not(.sel-print) {
          opacity: 0.35 !important;
          filter: grayscale(70%) !important;
        }

        .card-wrapper.sel-print {
          opacity: 1 !important;
          filter: none !important;
        }

        .card-wrapper:hover {
          opacity: 0.95 !important;
          transform: translateY(-2px);
        }

        .card-label {
          font-size: 8.5px;
          color: var(--muted);
          letter-spacing: 1.5px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 3px;
        }

        .card-checkbox {
          position: absolute;
          top: -9px;
          right: -9px;
          width: 18px;
          height: 18px;
          accent-color: var(--tq);
          z-index: 10;
          cursor: pointer;
        }

        .card-pair {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        /* ── ID Card (% responsive, ISO/IEC 7810 ID-1) ── */
        .id-card {
          font-family: 'Cairo', sans-serif !important;
          width: 405px;
          aspect-ratio: 85.6 / 54;
          border-radius: 4%;
          position: relative;
          overflow: hidden;
          color: var(--brown);
          flex-shrink: 0;
          background: #F3E4C4 !important;
          box-shadow: 0 2px 12px rgba(0,0,0,.08), 0 0 0 1.5px var(--border);
          direction: rtl;
        }

        .id-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .id-card > * {
          position: relative;
          z-index: 2;
        }

        /* Front elements */
        .f-wm {
          position: absolute;
          top: 50%;
          right: -11%;
          transform: translateY(-50%);
          width: 64%;
          opacity: 0.14 !important;
          z-index: 1;
          pointer-events: none;
        }

        .f-sweep, .f-line {
          display: none !important;
        }

        .f-head {
          position: absolute;
          top: 4%;
          left: 7% !important;
          right: 7% !important;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2%;
          z-index: 3;
          direction: ltr;
        }

        .f-brand-group {
          display: flex;
          align-items: center;
          gap: 3%;
          direction: ltr;
        }

        .f-logo {
          width: 23.5% !important;
          aspect-ratio: 1;
          object-fit: contain;
          flex-shrink: 0;
        }

        .f-org {
          display: flex;
          flex-direction: column;
          line-height: 1.25;
          direction: rtl;
          text-align: right;
        }

        .f-name {
          font-size: 15px !important;
          font-weight: 900;
          color: #4CB4A4;
          font-family: 'Cairo', sans-serif;
        }

        .f-sub {
          font-size: 10.8px !important;
          color: #6E9E94;
          font-weight: 500;
          margin-top: 1%;
          font-family: 'Cairo', sans-serif;
        }

        .f-badge {
          font-size: 10.8px !important;
          font-weight: 700;
          color: #fff;
          border: none;
          border-radius: 20px;
          padding: 1.5% 4%;
          background: #4CB4A4;
          white-space: nowrap;
          flex-shrink: 0;
          font-family: 'Cairo', sans-serif;
        }

        /* Front body */
        .f-body {
          position: absolute;
          top: 31%;
          bottom: 5%;
          left: 7% !important;
          right: 7% !important;
          display: flex;
          flex-direction: row;
          align-items: stretch;
          gap: 2%;
          z-index: 3;
          direction: rtl;
        }

        .f-data {
          flex: 1 1 55%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }

        .f-data .f-row {
          display: flex;
          flex-direction: column;
          margin-bottom: 6%;
        }

        .f-data .f-row:last-child {
          margin-bottom: 0;
        }

        .f-lbl {
          font-size: clamp(9.83px, 1.88%, 16.38px);
          color: #4CB4A4;
          font-weight: 700;
          margin-bottom: 1%;
          font-family: 'Cairo', sans-serif !important;
          display: block;
          text-align: right;
          direction: rtl;
          background: none !important;
          border: none !important;
          padding: 0 !important;
          white-space: nowrap;
        }

        .f-val {
          font-size: clamp(14.75px, 3.76%, 32.77px);
          font-weight: 700;
          color: #4A3626;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
          line-height: 1.25 !important;
          font-family: 'Cairo', sans-serif !important;
          display: block;
          text-align: right;
          direction: rtl;
          background: none !important;
          border: none !important;
          padding: 0 !important;
        }

        .f-val.num {
          direction: ltr !important;
          text-align: right;
          font-size: clamp(13.11px, 3.11%, 27.85px);
          letter-spacing: .15em;
          color: #25695E;
          font-weight: 600;
          font-family: monospace !important;
          background: none !important;
          border: none !important;
          padding: 0 !important;
        }

        .f-val-sm {
          font-size: 8.6px !important;
          color: #4A3626;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: 'Cairo', sans-serif !important;
          display: block;
          text-align: right;
          direction: rtl;
          background: none !important;
          border: none !important;
          padding: 0 !important;
        }

        .f-div {
          height: 1px;
          background: transparent;
          margin: 1.5% 0;
        }

        .f-bc-area {
          flex: 0 0 40%;
          display: flex;
          align-items: center;
          justify-content: center;
          border-right: 1.5px solid transparent;
          padding-right: 3%;
        }

        .f-bc-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4%;
          width: 100%;
        }

        .f-bcbox {
          background: #fff;
          border: 1px solid #BFE6D9;
          border-radius: 5px;
          padding: 5% 4%;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          box-shadow: 0 1px 4px rgba(0,0,0,.06);
        }

        .f-bcbox svg {
          display: block;
          width: 100%;
          height: auto;
        }

        .f-bcnum {
          font-size: 6.4px !important;
          color: #25695E;
          letter-spacing: .12em;
          font-weight: 700;
          direction: ltr;
          text-align: center;
          font-family: monospace;
        }

        /* ── BACK CARD ── */
        .back-card {
          background: #F3E4C4 !important;
          color: #4A3626 !important;
          font-family: 'Cairo', sans-serif !important;
          overflow: hidden !important;
          position: relative !important;
        }

        .bk-top-strip {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 7%;
          background: #F9CE5B;
          z-index: 2;
        }

        .bk-left-accent {
          position: absolute;
          top: 7%; bottom: 14%; left: 0;
          width: 2.5%;
          background: #4CB4A4;
          z-index: 2;
        }

        .bk-wm {
          position: absolute;
          top: 50%; right: -5%;
          transform: translateY(-50%);
          width: 55%;
          opacity: 0.14 !important;
          z-index: 1;
          pointer-events: none;
        }

        .bk-content {
          position: absolute;
          top: 9%; bottom: 16%;
          left: 5%; right: 3%;
          z-index: 3;
          display: flex;
          flex-direction: column;
          gap: 4%;
        }

        .bk-brand {
          display: flex;
          align-items: center;
          gap: 4%;
        }

        .bk-logo {
          width: 18%;
          aspect-ratio: 1;
          object-fit: contain;
          flex-shrink: 0;
        }

        .bk-brand-text {
          display: flex;
          flex-direction: column;
          gap: 2%;
        }

        .bk-org-name {
          font-size: clamp(14.75px, 3.44%, 27.85px);
          font-weight: 900;
          color: #4CB4A4;
          line-height: 1.2;
        }

        .bk-org-sub {
          font-size: clamp(8.19px, 1.72%, 13.93px);
          color: #6E9E94;
          font-weight: 500;
          line-height: 1.4;
        }

        .bk-sep {
          height: 1.5px;
          background: #F9CE5B;
          flex-shrink: 0;
          opacity: .7;
        }

        .bk-inst-box {
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          border: 1px solid rgba(76,180,164,0.2);
          border-right: 2px solid rgba(76,180,164,0.4);
          border-radius: 6px;
          padding: 4% 5%;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 5%;
        }

        .bk-inst-title {
          font-size: clamp(9.83px, 2.05%, 16.38px);
          font-weight: 800;
          color: #4CB4A4;
          display: flex;
          align-items: center;
          gap: 4%;
        }

        .bk-inst-icon {
          font-size: clamp(11.47px, 2.29%, 18.02px);
        }

        .bk-inst-list {
          list-style: none;
          padding: 0; margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4%;
        }

        .bk-inst-list li {
          font-size: clamp(8.19px, 1.64%, 13.11px);
          color: #3F6A62;
          line-height: 1.4;
          padding-right: 8%;
          position: relative;
        }

        .bk-inst-list li::before {
          content: '';
          position: absolute;
          right: 0; top: 45%;
          transform: translateY(-50%);
          width: clamp(3px, .7%, 5px);
          height: clamp(3px, .7%, 5px);
          background: #F9CE5B;
          border-radius: 50%;
        }

        .bk-foot {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 14%;
          background: #4CB4A4;
          z-index: 4;
          display: flex;
          align-items: center;
        }

        .bk-foot-inner {
          display: flex;
          align-items: center;
          justify-content: space-around;
          width: 100%;
          padding: 0 2%;
        }

        .bk-foot-item {
          display: flex;
          align-items: center;
          gap: 3%;
          font-size: clamp(9.22px, 1.93%, 15.67px);
          color: #fff;
          font-weight: 600;
          white-space: nowrap;
          flex: 1;
          justify-content: center;
        }

        .bk-foot-icon {
          font-size: clamp(11.06px, 2.22%, 18.43px);
        }

        .bk-foot-divider {
          width: 1px;
          height: 55%;
          background: rgba(255,255,255,.35);
          flex-shrink: 0;
        }

        /* ── SCREEN vs PRINT ── */
        @media screen {
          .print-sheets-root {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 4mm;
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

          .print-grid-container {
            display: grid !important;
            grid-template-columns: repeat(2, 85.6mm) !important;
            gap: 4mm 6mm !important;
            justify-content: center !important;
            align-content: start !important;
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

          .id-card {
            width: 85.6mm !important;
            aspect-ratio: 85.6 / 54 !important;
            border-radius: 3.18mm !important;
            box-shadow: none !important;
            border: 0.2mm solid #bbb !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
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
