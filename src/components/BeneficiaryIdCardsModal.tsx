"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileText, Loader2, Search, X, CreditCard, ExternalLink, ChevronDown } from "lucide-react";
import Barcode from "@/components/Barcode";
import { QRCodeSVG } from "qrcode.react";

export interface BeneficiaryIdCardItem {
  _id: string;
  name: string;
  internalId?: string;
  nationalId?: string;
}

export interface BeneficiaryIdCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  beneficiaries: BeneficiaryIdCardItem[];
  isLoading?: boolean;
}

type ExportMode = "all" | "range" | "specific";

const formatBarcodeValue = (internalId?: string | number) => {
  const idStr = String(internalId || "0").trim();
  return `DHZ${idStr.padStart(5, "0")}`;
};

// Convert an SVG element to a PNG ArrayBuffer
async function svgToPngBuffer(svgEl: SVGElement, width: number, height: number): Promise<ArrayBuffer> {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to create blob"));
          blob.arrayBuffer().then(resolve).catch(reject);
        },
        "image/png"
      );
    };
    img.onerror = reject;
    img.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgData)));
  });
}

// Process beneficiaries in small batches to avoid Out of Memory
async function generateWordDocument(
  beneficiaries: BeneficiaryIdCardItem[],
  onProgress: (current: number, total: number) => void
) {
  const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, BorderStyle } =
    await import("docx");
  const { saveAs } = await import("file-saver");

  const BATCH_SIZE = 5;
  const BARCODE_RENDER_WIDTH = 400;
  const BARCODE_RENDER_HEIGHT = 160;
  const BARCODE_DOC_WIDTH = 180;
  const BARCODE_DOC_HEIGHT = 72;

  // Create a temporary container for rendering barcodes one batch at a time
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  const allChildren: any[] = [];

  try {
    for (let i = 0; i < beneficiaries.length; i += BATCH_SIZE) {
      const batch = beneficiaries.slice(i, i + BATCH_SIZE);
      onProgress(Math.min(i + BATCH_SIZE, beneficiaries.length), beneficiaries.length);

      // Render barcode SVGs for this batch
      const { createRoot } = await import("react-dom/client");
      const React = await import("react");

      const batchResults: ArrayBuffer[] = [];

      for (const beneficiary of batch) {
        const qrDiv = document.createElement("div");
        container.appendChild(qrDiv);

        const root = createRoot(qrDiv);
        root.render(
          React.createElement(Barcode, {
            value: formatBarcodeValue(beneficiary.internalId),
            width: 2.0,
            height: 60,
          })
        );

        await new Promise((r) => setTimeout(r, 50));

        const svgEl = qrDiv.querySelector("svg") as SVGElement;
        if (svgEl) {
          const pngBuffer = await svgToPngBuffer(svgEl, BARCODE_RENDER_WIDTH, BARCODE_RENDER_HEIGHT);
          batchResults.push(pngBuffer);
        } else {
          batchResults.push(new ArrayBuffer(0));
        }

        root.unmount();
        qrDiv.remove();
      }

      for (let j = 0; j < batch.length; j++) {
        const beneficiary = batch[j];
        const pngBuffer = batchResults[j];

        // Format code
        const codeValue = formatBarcodeValue(beneficiary.internalId);

        // Header paragraph
        allChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: "مؤسسة دعوة الحق الخيرية",
                font: "Cairo",
                bold: true,
                size: 24,
                color: "107C41",
              }),
            ],
          })
        );

        // Name paragraph
        allChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: beneficiary.name || "مستفيد غير محدد",
                font: "Cairo",
                bold: true,
                size: 28,
                color: "1F2937",
              }),
            ],
          })
        );

        // ID info
        allChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `رقم المستفيد: ${beneficiary.internalId || "-"} | الرقم القومي: ${beneficiary.nationalId || "-"}`,
                font: "Cairo",
                size: 20,
                color: "4B5563",
              }),
            ],
          })
        );

        // Barcode image if available
        if (pngBuffer && pngBuffer.byteLength > 0) {
          allChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [
                new ImageRun({
                  data: pngBuffer,
                  transformation: {
                    width: BARCODE_DOC_WIDTH,
                    height: BARCODE_DOC_HEIGHT,
                  },
                  type: "png",
                }),
              ],
            })
          );
        }

        // Code string under barcode
        allChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: codeValue,
                font: "Courier New",
                bold: true,
                size: 18,
                color: "111827",
              }),
            ],
          })
        );

        // Subtle divider line
        allChildren.push(
          new Paragraph({
            border: {
              bottom: {
                color: "D1D5DB",
                space: 1,
                style: BorderStyle.DASHED,
                size: 6,
              },
            },
            spacing: { after: 200 },
            children: [],
          })
        );
      }

      await new Promise((r) => setTimeout(r, 10));
    }
  } finally {
    container.remove();
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: allChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Barcode_Cards_${new Date().toISOString().slice(0, 10)}.docx`);
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 min-h-[220px] flex flex-col justify-between animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-24 bg-muted rounded" />
        <div className="h-5 w-48 bg-muted rounded" />
        <div className="h-3.5 w-32 bg-muted/70 rounded" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="h-16 flex-1 bg-muted rounded-lg" />
        <div className="h-16 w-16 bg-muted rounded-lg shrink-0" />
      </div>
    </div>
  );
}

export default function BeneficiaryIdCardsModal({
  isOpen,
  onClose,
  beneficiaries = [],
  isLoading = false,
}: BeneficiaryIdCardsModalProps) {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  // Progressive rendering state (prevents DOM freezing with 2000+ items)
  const [renderLimit, setRenderLimit] = useState(24);

  // Export customization state
  const [exportMode, setExportMode] = useState<ExportMode>("all");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [specificSearch, setSpecificSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sort beneficiaries by internalId for range logic
  const sortedBeneficiaries = useMemo(() => {
    return [...beneficiaries].sort((a, b) => {
      const aId = parseInt(a.internalId || "0", 10);
      const bId = parseInt(b.internalId || "0", 10);
      return aId - bId;
    });
  }, [beneficiaries]);

  // Filter beneficiaries for specific search
  const searchResults = useMemo(() => {
    if (!specificSearch.trim()) return [];
    const q = specificSearch.toLowerCase().trim();
    return sortedBeneficiaries.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.internalId && b.internalId.includes(q)) ||
        (b.nationalId && b.nationalId.includes(q))
    );
  }, [specificSearch, sortedBeneficiaries]);

  // Get filtered beneficiaries based on current mode
  const filteredList = useMemo((): BeneficiaryIdCardItem[] => {
    if (exportMode === "all") {
      return sortedBeneficiaries;
    }
    if (exportMode === "range") {
      const from = parseInt(rangeFrom, 10);
      const to = parseInt(rangeTo, 10);
      if (isNaN(from) || isNaN(to)) return sortedBeneficiaries;
      return sortedBeneficiaries.filter((b) => {
        const id = parseInt(b.internalId || "0", 10);
        return id >= from && id <= to;
      });
    }
    if (exportMode === "specific") {
      return sortedBeneficiaries.filter((b) => selectedIds.has(b._id));
    }
    return sortedBeneficiaries;
  }, [exportMode, sortedBeneficiaries, rangeFrom, rangeTo, selectedIds]);

  const exportCount = useMemo(() => {
    if (exportMode === "all") return sortedBeneficiaries.length;
    if (exportMode === "range") {
      const from = parseInt(rangeFrom, 10);
      const to = parseInt(rangeTo, 10);
      if (isNaN(from) || isNaN(to)) return 0;
      return sortedBeneficiaries.filter((b) => {
        const id = parseInt(b.internalId || "0", 10);
        return id >= from && id <= to;
      }).length;
    }
    if (exportMode === "specific") return selectedIds.size;
    return 0;
  }, [exportMode, sortedBeneficiaries, rangeFrom, rangeTo, selectedIds]);

  // Generate URL for the official Carnet printing page
  const carnetPageUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("mode", exportMode);
    if (exportMode === "range") {
      if (rangeFrom) params.set("from", rangeFrom);
      if (rangeTo) params.set("to", rangeTo);
    } else if (exportMode === "specific" && selectedIds.size > 0) {
      params.set("ids", Array.from(selectedIds).join(","));
    }
    return `/admin/beneficiaries/carnets?${params.toString()}`;
  }, [exportMode, rangeFrom, rangeTo, selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!isOpen) return null;

  const handleExportWord = async () => {
    let list: BeneficiaryIdCardItem[] = [];
    if (exportMode === "all") list = sortedBeneficiaries;
    else if (exportMode === "range") {
      const from = parseInt(rangeFrom, 10);
      const to = parseInt(rangeTo, 10);
      if (isNaN(from) || isNaN(to)) {
        alert("يرجى إدخال نطاق أرقام صالح");
        return;
      }
      list = sortedBeneficiaries.filter((b) => {
        const id = parseInt(b.internalId || "0", 10);
        return id >= from && id <= to;
      });
    } else if (exportMode === "specific") {
      list = sortedBeneficiaries.filter((b) => selectedIds.has(b._id));
    }

    if (list.length === 0) {
      alert("لا يوجد مستفيدين للتصدير. تأكد من اختيارك.");
      return;
    }

    setExporting(true);
    setExportProgress({ current: 0, total: list.length });
    try {
      await generateWordDocument(list, (current, total) => {
        setExportProgress({ current, total });
      });
    } catch (err) {
      console.error("Failed to export Barcode cards:", err);
      alert("فشل تصدير البطاقات");
    } finally {
      setExporting(false);
    }
  };

  const displayedList = filteredList.slice(0, renderLimit);
  const hasMore = filteredList.length > renderLimit;

  return (
    <>
      <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden beneficiary-id-print-root transition-all">
          {/* Header */}
          <div className="beneficiary-id-print-actions flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card/95 backdrop-blur z-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg">
                🪪
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  بطاقات تعريف المستفيدين (باركود)
                </h2>
                <p className="text-xs text-muted-foreground">
                  عرض وتصدير كروت الهوية بالباركود وQR المعتمد
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors"
                aria-label="إغلاق"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Export & Actions Controls */}
          <div className="beneficiary-id-print-actions border-b border-border px-5 py-4 space-y-4 bg-muted/20">
            {/* Mode Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground ml-2">نطاق الاختيار:</span>
              <button
                type="button"
                onClick={() => setExportMode("all")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                  exportMode === "all"
                    ? "bg-primary text-primary-foreground shadow-primary/20"
                    : "bg-background border border-border text-foreground hover:bg-muted"
                }`}
              >
                الكل ({sortedBeneficiaries.length})
              </button>
              <button
                type="button"
                onClick={() => setExportMode("range")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                  exportMode === "range"
                    ? "bg-primary text-primary-foreground shadow-primary/20"
                    : "bg-background border border-border text-foreground hover:bg-muted"
                }`}
              >
                من - إلى (نطاق أرقام)
              </button>
              <button
                type="button"
                onClick={() => setExportMode("specific")}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                  exportMode === "specific"
                    ? "bg-primary text-primary-foreground shadow-primary/20"
                    : "bg-background border border-border text-foreground hover:bg-muted"
                }`}
              >
                مستفيد معين {selectedIds.size > 0 && `(${selectedIds.size})`}
              </button>
            </div>

            {/* Range Inputs */}
            {exportMode === "range" && (
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-background border border-border shadow-sm">
                <label className="text-xs font-medium text-foreground">من رقم المستفيد:</label>
                <input
                  type="number"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  placeholder="مثال: 1"
                  className="w-24 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <label className="text-xs font-medium text-foreground">إلى رقم:</label>
                <input
                  type="number"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  placeholder="مثال: 50"
                  className="w-24 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <span className="text-xs font-semibold text-primary">
                  (سيتم استخراج {exportCount} مستفيد)
                </span>
              </div>
            )}

            {/* Specific Search */}
            {exportMode === "specific" && (
              <div className="space-y-3 p-3 rounded-xl bg-background border border-border shadow-sm">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={specificSearch}
                    onChange={(e) => setSpecificSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو رقم المستفيد أو الرقم القومي..."
                    className="w-full pr-10 pl-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                {/* Selected Count */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">
                      تم اختيار {selectedIds.size} مستفيد
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs text-destructive hover:underline font-semibold"
                    >
                      مسح الاختيار
                    </button>
                  </div>
                )}

                {/* Search Results */}
                {specificSearch.trim() && (
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border bg-card">
                    {searchResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                        لا توجد نتائج مطابقة
                      </div>
                    ) : (
                      searchResults.map((b) => (
                        <button
                          key={b._id}
                          type="button"
                          onClick={() => toggleSelect(b._id)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/70 transition-colors text-right ${
                            selectedIds.has(b._id) ? "bg-primary/10 font-bold" : ""
                          }`}
                        >
                          <span className="flex flex-col">
                            <span className="font-semibold text-foreground">{b.name}</span>
                            <span className="text-xs text-muted-foreground">
                              رقم: {b.internalId || "-"} | قومي: {b.nationalId || "-"}
                            </span>
                          </span>
                          <span
                            className={`w-5 h-5 rounded border flex items-center justify-center text-xs flex-shrink-0 ${
                              selectedIds.has(b._id)
                                ? "bg-primary border-primary text-primary-foreground font-bold"
                                : "border-border text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Show selected items chips */}
                {selectedIds.size > 0 && !specificSearch.trim() && (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                    {sortedBeneficiaries
                      .filter((b) => selectedIds.has(b._id))
                      .map((b) => (
                        <span
                          key={b._id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold"
                        >
                          {b.name}
                          <button
                            type="button"
                            onClick={() => toggleSelect(b._id)}
                            className="hover:text-destructive text-sm leading-none"
                            title="إزالة"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions Bar: Export Word + Navigate to Carnet Printing Page */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Word Export Button */}
              <button
                type="button"
                onClick={handleExportWord}
                disabled={exporting || exportCount === 0 || isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold shadow-md shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري التصدير ({exportProgress.current}/{exportProgress.total})
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    تصدير {exportCount > 0 ? `(${exportCount})` : ""} كملف Word
                  </>
                )}
              </button>

              {/* Dedicated Carnet Page Button (Directly next to Word button as requested) */}
              <Link
                href={carnetPageUrl}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md shadow-emerald-600/20 transition-all border border-emerald-500/30"
                title="فتح منظومة طباعة الكارنيهات الرسمية المعتمدة"
              >
                <CreditCard className="w-4 h-4" />
                <span>طباعة الكارنيهات الرسمية {exportCount > 0 ? `(${exportCount})` : ""}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </Link>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="p-4 sm:p-6 bg-muted/10 min-h-[300px]">
            {isLoading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>جاري تحميل بيانات المستفيدين...</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground space-y-2">
                <div className="text-4xl">🔍</div>
                <p className="font-semibold text-base text-foreground">لا توجد بيانات مطابقة للاختيار</p>
                <p className="text-xs">تأكد من شروط البحث أو تحديد نطاق المستفيدين.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4 text-xs font-medium text-muted-foreground">
                  <span>
                    يتم عرض {displayedList.length} من أصل {filteredList.length} بطاقة
                  </span>
                  {exportMode !== "all" && (
                    <span className="text-primary font-bold">
                      تم تطبيق فلتر: {exportMode === "range" ? "نطاق أرقام" : "مستفيدين محددين"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedList.map((beneficiary) => {
                    const primaryId =
                      beneficiary.internalId?.trim() ||
                      beneficiary.nationalId?.trim() ||
                      beneficiary._id;

                    return (
                      <div
                        key={beneficiary._id}
                        className="rounded-xl border border-border bg-card p-4 min-h-[220px] flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                      >
                        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div>
                          <p className="text-[11px] font-bold text-primary tracking-wide">
                            مؤسسة دعوة الحق الخيرية
                          </p>
                          <h3 className="text-base font-bold text-foreground mt-1 break-words">
                            {beneficiary.name}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-foreground border border-border font-medium">
                              رقم: {beneficiary.internalId || "-"}
                            </span>
                            {beneficiary.nationalId && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono text-[11px]">
                                {beneficiary.nationalId}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="p-1.5 rounded-lg bg-white border border-border flex items-center justify-center min-h-[65px] flex-1 shadow-sm">
                              <Barcode
                                value={formatBarcodeValue(beneficiary.internalId)}
                                width={1.2}
                                height={35}
                              />
                            </div>
                            <div className="p-1.5 rounded-lg bg-white border border-border flex items-center justify-center min-h-[65px] aspect-square shadow-sm">
                              <QRCodeSVG
                                value={JSON.stringify({
                                  beneficiaryId: beneficiary._id,
                                  internalId: beneficiary.internalId || null,
                                  nationalId: beneficiary.nationalId || null,
                                  id: primaryId,
                                  name: beneficiary.name,
                                })}
                                size={48}
                                level="M"
                              />
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex justify-between items-center px-1 font-mono">
                            <span>المعرّف: {primaryId}</span>
                            <span className="text-[10px] text-primary font-sans font-bold">
                              مسح سريع (باركود / QR)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Progressive load more button */}
                {hasMore && (
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => setRenderLimit((prev) => prev + 24)}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted text-sm font-bold shadow-sm transition-colors"
                    >
                      <ChevronDown className="w-4 h-4 text-primary" />
                      عرض المزيد ({filteredList.length - displayedList.length} متبقية)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenderLimit(filteredList.length)}
                      className="mr-3 text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      عرض الكل دفعة واحدة
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer note */}
          <div className="beneficiary-id-print-actions px-5 py-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <span>
                تتضمن كل بطاقة رمز باركود Code128 ورمز QR معتمد لعمليات التحقق والصرف الفوري.
              </span>
            </div>
            <span className="font-semibold text-foreground">
              الإجمالي: {sortedBeneficiaries.length} مستفيد
            </span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }

          .beneficiary-id-print-root,
          .beneficiary-id-print-root * {
            visibility: visible !important;
          }

          .beneficiary-id-print-root {
            position: absolute !important;
            inset: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: none !important;
          }

          .beneficiary-id-print-actions {
            display: none !important;
          }
        }
      ` }} />
    </>
  );
}
