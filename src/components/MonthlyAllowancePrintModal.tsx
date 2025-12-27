"use client";

import { useState, useMemo } from "react";
import { X, Loader2, Printer } from "lucide-react";

type ReportType = "monthly" | "hospital" | "sheikh_ibrahim";

interface AllowanceBeneficiary {
  _id: string;
  name: string;
  nationalId?: string;
  monthlyAllowanceAmount?: number;
  listName?: string;
  listNames?: string[];
  receivesMonthlyAllowance?: boolean;
}

interface MonthlyAllowancePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  beneficiaries: AllowanceBeneficiary[];
}

const REPORT_TYPES: { value: ReportType; label: string; listMatch: string }[] = [
  { value: "monthly", label: "كشف الشهرية", listMatch: "كشف الشهرية" },
  { value: "hospital", label: "كشف المستشفى", listMatch: "كشف المستشفى" },
  { value: "sheikh_ibrahim", label: "كشف الشيخ ابراهيم", listMatch: "كشف الشيخ ابراهيم" },
];

export default function MonthlyAllowancePrintModal({
  isOpen,
  onClose,
  beneficiaries,
}: MonthlyAllowancePrintModalProps) {
  const [printing, setPrinting] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("monthly");
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});

  const selectedReport = REPORT_TYPES.find((r) => r.value === selectedReportType) || REPORT_TYPES[0];

  // Filter beneficiaries based on selected report type
  const filteredBeneficiaries = useMemo(() => {
    if (selectedReportType === "monthly") {
      // For monthly, filter by receivesMonthlyAllowance OR by listNames containing monthly-related lists
      return beneficiaries.filter((b) => {
        if (b.receivesMonthlyAllowance) return true;
        const lists = b.listNames?.length ? b.listNames : (b.listName ? [b.listName] : []);
        // Match both "كشف الشهرية" and "شهرية عادية" for backward compatibility
        return lists.some((name: string) => name.includes("شهرية"));
      });
    } else {
      // For other reports, filter by listNames matching the report type
      return beneficiaries.filter((b) => {
        const lists = b.listNames?.length ? b.listNames : (b.listName ? [b.listName] : []);
        return lists.some((name: string) => name.includes(selectedReport.listMatch));
      });
    }
  }, [beneficiaries, selectedReportType, selectedReport.listMatch]);

  // Sort by nationalId (internal beneficiary number)
  const sortedBeneficiaries = useMemo(() => {
    return [...filteredBeneficiaries].sort((a, b) => {
      const idA = parseInt(a.nationalId || "0", 10);
      const idB = parseInt(b.nationalId || "0", 10);
      return idA - idB;
    });
  }, [filteredBeneficiaries]);

  if (!isOpen) return null;

  // Calculate total for all reports
  const totalAllowance = selectedReportType === "monthly"
    ? sortedBeneficiaries.reduce((sum, b) => sum + (b.monthlyAllowanceAmount || 0), 0)
    : sortedBeneficiaries.reduce((sum, b) => sum + (customAmounts[b._id] || 0), 0);

  const BENEFICIARIES_PER_COLUMN = 16;
  const BENEFICIARIES_PER_PAGE = 32;
  const pages: AllowanceBeneficiary[][] = [];
  
  for (let i = 0; i < sortedBeneficiaries.length; i += BENEFICIARIES_PER_PAGE) {
    pages.push(sortedBeneficiaries.slice(i, i + BENEFICIARIES_PER_PAGE));
  }

  const handlePrint = async () => {
    if (beneficiaries.length === 0) {
      alert("لا يوجد مستفيدين يتقاضون شهريات");
      return;
    }
    
    setPrinting(true);
    try {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, Media, ImageRun } = await import("docx");
      const { saveAs } = await import("file-saver");

      // تحميل صورة الهيدر
      const headerImageResponse = await fetch('/image.png');
      const headerImageBlob = await headerImageResponse.blob();
      const headerImageArrayBuffer = await headerImageBlob.arrayBuffer();

      const sections: any[] = [];

      // إنشاء صفحة لكل مجموعة
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const pageBeneficiaries = pages[pageIndex];
        const isLastPage = pageIndex === pages.length - 1;
        
        // تقسيم المستفيدين إلى نصفين
        const leftColumn = pageBeneficiaries.slice(0, BENEFICIARIES_PER_COLUMN);
        const rightColumn = pageBeneficiaries.slice(BENEFICIARIES_PER_COLUMN, BENEFICIARIES_PER_PAGE);

        const children: any[] = [];

        // Header Image
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: headerImageArrayBuffer,
                transformation: {
                  width: 700,
                  height: 150,
                },
                type: "png",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );

        // إنشاء جدول موحد بأربعة أعمدة مكررة
        const tableRows: any[] = [];

        // Header row
        tableRows.push(
          new TableRow({
            children: [
              // Right table headers (first because RTL)
            new TableCell({ children: [new Paragraph({ text: "التوقيع", alignment: AlignmentType.CENTER, bidirectional: true })], width: { size: 28, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: "المبلغ", alignment: AlignmentType.CENTER, bidirectional: true })], width: { size: 22, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: "الاسم", alignment: AlignmentType.CENTER, bidirectional: true })], width: { size: 42, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: "م", alignment: AlignmentType.CENTER, bidirectional: true })], width: { size: 8, type: WidthType.PERCENTAGE } }),
              // Left table headers (second because RTL)
            new TableCell({ children: [new Paragraph({ text: "التوقيع", alignment: AlignmentType.CENTER, bidirectional: true })], width: { size: 28, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: "المبلغ", alignment: AlignmentType.CENTER, bidirectional: true })], width: { size: 22, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: "الاسم", alignment: AlignmentType.CENTER, bidirectional: true })], width: { size: 42, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ text: "م", alignment: AlignmentType.CENTER, bidirectional: true })], width: { size: 8, type: WidthType.PERCENTAGE } }),
            ],
        })
        );

        // Data rows
        for (let i = 0; i < BENEFICIARIES_PER_COLUMN; i++) {
        const leftBen = leftColumn[i];
        const rightBen = rightColumn[i];
          const leftRowNum = pageIndex * BENEFICIARIES_PER_PAGE + i + 1;
          const rightRowNum = pageIndex * BENEFICIARIES_PER_PAGE + BENEFICIARIES_PER_COLUMN + i + 1;

          // For non-monthly reports, use custom amounts if entered
          const getAmountText = (ben?: AllowanceBeneficiary) => {
            if (!ben) return "";
            if (selectedReportType === "monthly") {
              return ben.monthlyAllowanceAmount?.toString() || "";
            }
            // Use custom amount for non-monthly reports
            return customAmounts[ben._id]?.toString() || "";
          };

        tableRows.push(
            new TableRow({
            children: [
                // Right side (first because RTL)
                new TableCell({ children: [new Paragraph({ text: "", bidirectional: true })] }),
                new TableCell({ children: [new Paragraph({ text: getAmountText(rightBen), alignment: AlignmentType.CENTER, bidirectional: true })] }),
                new TableCell({ children: [new Paragraph({ text: rightBen?.name || "", alignment: AlignmentType.CENTER, bidirectional: true })] }),
                new TableCell({ children: [new Paragraph({ text: rightRowNum.toString(), alignment: AlignmentType.CENTER, bidirectional: true })] }),
                // Left side (second because RTL)
                new TableCell({ children: [new Paragraph({ text: "", bidirectional: true })] }),
                new TableCell({ children: [new Paragraph({ text: getAmountText(leftBen), alignment: AlignmentType.CENTER, bidirectional: true })] }),
                new TableCell({ children: [new Paragraph({ text: leftBen?.name || "", alignment: AlignmentType.CENTER, bidirectional: true })] }),
                new TableCell({ children: [new Paragraph({ text: leftRowNum.toString(), alignment: AlignmentType.CENTER, bidirectional: true })] }),
              ],
            })
          );
        }

        children.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );

        // Footer
        children.push(
          new Paragraph({
            text: "تـم الـصـرف بـمـعـرفـتـي و عـلـى مـسـؤولـيـتـي                          امـيـن الـصـنـدوق",
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 100 },
            bidirectional: true,
          }),
          new Paragraph({
            text: ".............................",
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            bidirectional: true,
          })
        );

        sections.push({
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          children,
        });
      }

      const doc = new Document({
        sections,
      });

      const blob = await Packer.toBlob(doc);
      const reportName = selectedReport.label.replace(/\s+/g, "_");
      saveAs(blob, `${reportName}_${new Date().toISOString().split("T")[0]}.docx`);

      // إغلاق المودال بعد الطباعة
      onClose();
    } catch (error) {
      console.error("فشل في تصدير PDF:", error);
      alert("حدث خطأ أثناء إنشاء ملف PDF");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">طباعة الكشف</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
            type="button"
            disabled={printing}
            title="إغلاق"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Report Type Selector */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h3 className="font-semibold text-foreground mb-3">اختر نوع الكشف:</h3>
            <div className="flex flex-wrap gap-2">
              {REPORT_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  type="button"
                  onClick={() => setSelectedReportType(rt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedReportType === rt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border text-foreground hover:border-primary"
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
            {selectedReportType !== "monthly" && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                ملاحظة: حقل المبلغ سيكون فارغاً للكتابة يدوياً
              </p>
            )}
          </div>

          {sortedBeneficiaries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-red-600 dark:text-red-400 text-lg font-semibold">
                تنبيه: لا يوجد مستفيدين في هذا الكشف
              </p>
              <p className="text-muted-foreground mt-2">
                تأكد من أن هناك مستفيدين مسجلين في &quot;{selectedReport.label}&quot;
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-3">معلومات الطباعة:</h3>
                <ul className="space-y-2 text-sm text-foreground">
                  <li className="flex items-center gap-2">
                    <span className="font-medium">نوع الكشف:</span>
                    <span className="text-primary font-bold">{selectedReport.label}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-medium">عدد المستفيدين:</span>
                    <span className="text-primary font-bold">{sortedBeneficiaries.length} مستفيد</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-medium">إجمالي المبالغ:</span>
                    <span className="text-primary font-bold">{totalAllowance.toLocaleString()} ج.م</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-medium">عدد الصفحات:</span>
                    <span>{pages.length} صفحة</span>
                  </li>
                </ul>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-2">ملاحظات:</h3>
                <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                  <li>سيتم طباعة 32 اسم في كل صفحة (16 في كل جانب)</li>
                  <li>التوقيع يترك فارغاً ليتم التوقيع يدوياً</li>
                  <li>سيظهر المجموع الإجمالي في نهاية الكشف</li>
                  <li>التوقيعات (أمين الصندوق، المراجع، المدير) في الصفحة الأخيرة</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 max-h-64 overflow-y-auto">
                <h3 className="font-semibold text-foreground mb-3">قائمة المستفيدين:</h3>
                <ul className="space-y-2 text-sm">
                  {sortedBeneficiaries.map((b, index) => (
                    <li key={b._id} className="flex items-center justify-between gap-2 p-2 hover:bg-green-100 dark:hover:bg-green-900/20 rounded">
                      <span className="font-medium flex-1">
                        {index + 1}. {b.name}
                      </span>
                      {selectedReportType === "monthly" ? (
                        <span className="text-green-600 dark:text-green-400 font-bold">
                          {b.monthlyAllowanceAmount || 0} ج.م
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={customAmounts[b._id] || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCustomAmounts((prev) => ({
                                ...prev,
                                [b._id]: value ? Number(value) : 0,
                              }));
                            }}
                            placeholder="0"
                            className="w-20 px-2 py-1 text-sm border border-border rounded bg-background text-foreground text-center"
                          />
                          <span className="text-muted-foreground text-xs">ج.م</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-border bg-muted/30">
          <button
            onClick={handlePrint}
            disabled={printing || beneficiaries.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            type="button"
          >
            {printing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري إنشاء PDF...
              </>
            ) : (
              <>
                <Printer className="w-5 h-5" />
                طباعة {selectedReport.label}
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={printing}
            className="px-6 py-3 bg-background border border-border text-foreground rounded-lg hover:bg-muted disabled:opacity-50 font-medium transition-colors"
            type="button"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
