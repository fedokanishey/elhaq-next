"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Loader2, Search, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface BeneficiaryIdCardItem {
  _id: string;
  name: string;
  internalId?: string;
  nationalId?: string;
}

interface BeneficiaryIdCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  beneficiaries: BeneficiaryIdCardItem[];
}

type ExportMode = "all" | "range" | "specific";

const buildQrPayload = (beneficiary: BeneficiaryIdCardItem) => {
  const identifier =
    beneficiary.internalId?.trim() ||
    beneficiary.nationalId?.trim() ||
    beneficiary._id;

  return JSON.stringify({
    beneficiaryId: beneficiary._id,
    internalId: beneficiary.internalId || null,
    nationalId: beneficiary.nationalId || null,
    id: identifier,
    name: beneficiary.name,
  });
};

// Convert an SVG element to a PNG ArrayBuffer
async function svgToPngBuffer(svgEl: SVGElement, size: number): Promise<ArrayBuffer> {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
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
  const QR_RENDER_SIZE = 300;
  const QR_DOC_SIZE = 150;

  // Create a temporary container for rendering QR codes one batch at a time
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

      // Render QR SVGs for this batch
      const { createRoot } = await import("react-dom/client");
      const React = await import("react");

      const batchResults: ArrayBuffer[] = [];

      for (const beneficiary of batch) {
        const qrDiv = document.createElement("div");
        container.appendChild(qrDiv);

        const root = createRoot(qrDiv);
        root.render(
          React.createElement(QRCodeSVG, {
            value: buildQrPayload(beneficiary),
            size: 200,
            includeMargin: true,
            level: "M",
          })
        );

        await new Promise((r) => setTimeout(r, 50));

        const svgEl = qrDiv.querySelector("svg") as SVGElement;
        if (svgEl) {
          const pngBuffer = await svgToPngBuffer(svgEl, QR_RENDER_SIZE);
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
        const primaryId =
          beneficiary.internalId?.trim() ||
          beneficiary.nationalId?.trim() ||
          beneficiary._id;

        if (allChildren.length > 0) {
          allChildren.push(
            new Paragraph({
              spacing: { before: 200, after: 200 },
              children: [],
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC", space: 1 },
              },
            })
          );
        }

        allChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "مؤسسة دعوة الحق", bold: true, size: 24, font: "Arial" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({ text: beneficiary.name, bold: true, size: 32, font: "Arial" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `رقم المستفيد الداخلي: ${beneficiary.internalId || "-"}`,
                size: 20,
                font: "Arial",
              }),
            ],
          })
        );

        if (pngBuffer.byteLength > 0) {
          allChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
              children: [
                new ImageRun({
                  data: pngBuffer,
                  transformation: { width: QR_DOC_SIZE, height: QR_DOC_SIZE },
                  type: "png",
                }),
              ],
            })
          );
        }

        allChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `المعرّف: ${primaryId}`, size: 16, font: "Arial", color: "666666" }),
            ],
          })
        );
      }

      batchResults.length = 0;
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
  saveAs(blob, `QR_Cards_${new Date().toISOString().slice(0, 10)}.docx`);
}

export default function BeneficiaryIdCardsModal({
  isOpen,
  onClose,
  beneficiaries,
}: BeneficiaryIdCardsModalProps) {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

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

  // Filter beneficiaries for the specific search
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

  // Get the beneficiaries to export based on mode
  const getExportList = (): BeneficiaryIdCardItem[] => {
    if (exportMode === "all") {
      return sortedBeneficiaries;
    }
    if (exportMode === "range") {
      const from = parseInt(rangeFrom, 10);
      const to = parseInt(rangeTo, 10);
      if (isNaN(from) || isNaN(to)) return [];
      return sortedBeneficiaries.filter((b) => {
        const id = parseInt(b.internalId || "0", 10);
        return id >= from && id <= to;
      });
    }
    if (exportMode === "specific") {
      return sortedBeneficiaries.filter((b) => selectedIds.has(b._id));
    }
    return [];
  };

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
    const list = getExportList();
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
      console.error("Failed to export QR cards:", err);
      alert("فشل تصدير البطاقات");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[65] bg-black/60 p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto bg-background border border-border rounded-xl shadow-2xl overflow-hidden beneficiary-id-print-root">
          {/* Header */}
          <div className="beneficiary-id-print-actions flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
            <h2 className="text-lg font-semibold text-foreground">
              بطاقات تعريف المستفيدين (QR)
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-border hover:bg-muted"
                aria-label="إغلاق"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Export Controls */}
          <div className="beneficiary-id-print-actions border-b border-border px-4 py-4 space-y-4">
            {/* Mode Selector */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setExportMode("all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  exportMode === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                الكل ({sortedBeneficiaries.length})
              </button>
              <button
                type="button"
                onClick={() => setExportMode("range")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  exportMode === "range"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                من - إلى
              </button>
              <button
                type="button"
                onClick={() => setExportMode("specific")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  exportMode === "specific"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                مستفيد معين
              </button>
            </div>

            {/* Range Inputs */}
            {exportMode === "range" && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-muted-foreground">من رقم:</label>
                <input
                  type="number"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  placeholder="مثال: 1"
                  className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <label className="text-sm text-muted-foreground">إلى رقم:</label>
                <input
                  type="number"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  placeholder="مثال: 10"
                  className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {rangeFrom && rangeTo && (
                  <span className="text-xs text-muted-foreground">
                    ({exportCount} مستفيد)
                  </span>
                )}
              </div>
            )}

            {/* Specific Search */}
            {exportMode === "specific" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={specificSearch}
                    onChange={(e) => setSpecificSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو رقم المستفيد..."
                    className="w-full pr-10 pl-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                {/* Selected Count */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary font-medium">
                      تم اختيار {selectedIds.size} مستفيد
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs text-destructive hover:underline"
                    >
                      مسح الاختيار
                    </button>
                  </div>
                )}

                {/* Search Results */}
                {specificSearch.trim() && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {searchResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                        لا توجد نتائج
                      </div>
                    ) : (
                      searchResults.map((b) => (
                        <button
                          key={b._id}
                          type="button"
                          onClick={() => toggleSelect(b._id)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-right ${
                            selectedIds.has(b._id)
                              ? "bg-primary/10"
                              : ""
                          }`}
                        >
                          <span className="flex flex-col">
                            <span className="font-medium text-foreground">{b.name}</span>
                            <span className="text-xs text-muted-foreground">
                              رقم: {b.internalId || "-"}
                            </span>
                          </span>
                          <span
                            className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                              selectedIds.has(b._id)
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-border"
                            }`}
                          >
                            {selectedIds.has(b._id) && "✓"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Show selected items */}
                {selectedIds.size > 0 && !specificSearch.trim() && (
                  <div className="flex flex-wrap gap-2">
                    {sortedBeneficiaries
                      .filter((b) => selectedIds.has(b._id))
                      .map((b) => (
                        <span
                          key={b._id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                        >
                          {b.name}
                          <button
                            type="button"
                            onClick={() => toggleSelect(b._id)}
                            className="hover:text-destructive"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExportWord}
              disabled={exporting || exportCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          </div>

          {/* Cards Grid */}
          <div className="p-4 sm:p-6">
            {beneficiaries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                لا توجد بيانات لطباعة البطاقات.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedBeneficiaries.map((beneficiary) => {
                  const primaryId =
                    beneficiary.internalId?.trim() ||
                    beneficiary.nationalId?.trim() ||
                    beneficiary._id;

                  return (
                    <div
                      key={beneficiary._id}
                      className="rounded-xl border border-border bg-card p-4 min-h-[220px] flex flex-col justify-between"
                    >
                      <div>
                        <p className="text-xs text-muted-foreground">مؤسسة دعوة الحق</p>
                        <h3 className="text-base font-semibold text-foreground mt-1 break-words">
                          {beneficiary.name}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          رقم المستفيد الداخلي:
                          <span className="text-foreground font-medium mr-1">
                            {beneficiary.internalId || "-"}
                          </span>
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="p-2 rounded-lg bg-white border border-border">
                          <QRCodeSVG
                            value={buildQrPayload(beneficiary)}
                            size={94}
                            includeMargin
                            level="M"
                          />
                        </div>
                        <div className="text-xs text-muted-foreground leading-5">
                          <p>المعرّف:</p>
                          <p className="font-medium text-foreground break-all">{primaryId}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="beneficiary-id-print-actions px-4 py-3 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
            <Download className="w-4 h-4" />
            تحتوي كل بطاقة على اسم المستفيد ورمز QR يتضمن بيانات التعريف.
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
