"use client";

import { X, Download, Loader2 } from "lucide-react";
import { useState } from "react";

interface Beneficiary {
  _id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  nationalId?: string;
  healthStatus?: "healthy" | "sick";
  housingType?: "owned" | "rented";
  employment?: string;
  priority?: number;
  familyMembers?: number;
  maritalStatus?: string;
  income?: number;
  rentalCost?: number;
  notes?: string;
  spouse?: {
    name?: string;
    nationalId?: string;
    phone?: string;
    whatsapp?: string;
  };
  children?: Array<{ name?: string; nationalId?: string }>;
}

interface BeneficiariesPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  beneficiaries: Beneficiary[];
  title?: string;
}

export default function BeneficiariesPrintModal({
  isOpen,
  onClose,
  beneficiaries,
  title = "تقرير المستفيدين",
}: BeneficiariesPrintModalProps) {
  const [exporting, setExporting] = useState(false);
  const [exportColumns, setExportColumns] = useState({
    name: true,
    nationalId: true,
    phone: true,
    whatsapp: false,
    address: false,
    healthStatus: false,
    housingType: false,
    employment: false,
    priority: false,
    familyMembers: false,
    maritalStatus: false,
    income: false,
    rentalCost: false,
    notes: false,
  });

  const handleColumnChange = (column: string) => {
    setExportColumns((prev) => ({
      ...prev,
      [column]: !prev[column as keyof typeof prev],
    }));
  };

  // Translation helper function
  const getArabicLabel = (field: string, value: string | number | undefined): string => {
    if (!value && value !== 0) return "-";
    const valueStr = String(value);
    const translations: Record<string, Record<string, string>> = {
      healthStatus: {
        "healthy": "صحي",
        "sick": "مريض",
      },
      housingType: {
        "owned": "مملوك",
        "rented": "مستأجر",
      },
      maritalStatus: {
        "single": "أعزب/عزباء",
        "married": "متزوج/متزوجة",
        "divorced": "مطلق/مطلقة",
        "widowed": "أرمل/أرملة",
      },
      employment: {
        "employed": "موظف",
        "self-employed": "عامل حر",
        "unemployed": "عاطل",
        "student": "طالب",
        "retired": "متقاعد",
      },
    };
    return translations[field]?.[valueStr] || valueStr;
  };

  const handleExport = async () => {
    if (beneficiaries.length === 0) {
      alert("لا يوجد مستفيدون للتصدير");
      return;
    }

    setExporting(true);
    try {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, TextRun } = await import("docx");
      const { saveAs } = await import("file-saver");

      // Build column headers based on selection
      const columnHeaders: Array<{ key: string; label: string }> = [
        { key: "index", label: "#" },
      ];
      if (exportColumns.name) columnHeaders.push({ key: "name", label: "الاسم" });
      if (exportColumns.nationalId) columnHeaders.push({ key: "nationalId", label: "رقم المستفيد" });
      if (exportColumns.phone) columnHeaders.push({ key: "phone", label: "الرقم القومى" });
      if (exportColumns.whatsapp) columnHeaders.push({ key: "whatsapp", label: "الواتساب" });
      if (exportColumns.address) columnHeaders.push({ key: "address", label: "العنوان" });
      if (exportColumns.healthStatus) columnHeaders.push({ key: "healthStatus", label: "الصحة" });
      if (exportColumns.housingType) columnHeaders.push({ key: "housingType", label: "السكن" });
      if (exportColumns.employment) columnHeaders.push({ key: "employment", label: "التوظيف" });
      if (exportColumns.priority) columnHeaders.push({ key: "priority", label: "الأولوية" });
      if (exportColumns.familyMembers) columnHeaders.push({ key: "familyMembers", label: "الأسرة" });
      if (exportColumns.maritalStatus) columnHeaders.push({ key: "maritalStatus", label: "الحالة" });
      if (exportColumns.income) columnHeaders.push({ key: "income", label: "الدخل" });
      if (exportColumns.rentalCost) columnHeaders.push({ key: "rentalCost", label: "الإيجار" });
      if (exportColumns.notes) columnHeaders.push({ key: "notes", label: "ملاحظات" });

      // Pagination: 30 beneficiaries per page for Word
      const BENEFICIARIES_PER_PAGE = 30;
      const totalBeneficiaries = beneficiaries.length;
      const totalPages = Math.ceil(totalBeneficiaries / BENEFICIARIES_PER_PAGE);

      // Calculate column width based on number of columns
      const totalWidth = 9500; // Total table width in DXA
      const colWidth = Math.floor(totalWidth / columnHeaders.length);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sections: any[] = [];

      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const startIndex = pageNum * BENEFICIARIES_PER_PAGE;
        const endIndex = Math.min(startIndex + BENEFICIARIES_PER_PAGE, totalBeneficiaries);
        const pageBeneficiaries = beneficiaries.slice(startIndex, endIndex);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tableRows: any[] = [];

        // Header row
        tableRows.push(
          new TableRow({
            children: columnHeaders.map((col) =>
              new TableCell({
                children: [new Paragraph({ text: col.label, alignment: AlignmentType.CENTER, bidirectional: true })],
                width: { size: colWidth, type: WidthType.DXA },
                shading: { fill: "d0d0d0" },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                verticalAlign: AlignmentType.CENTER as any,
              })
            ),
          })
        );

        // Data rows
        pageBeneficiaries.forEach((beneficiary, index) => {
          const globalIndex = startIndex + index + 1;
          tableRows.push(
            new TableRow({
              children: columnHeaders.map((col) => {
                let cellValue = "-";
                if (col.key === "index") {
                  cellValue = String(globalIndex);
                } else if (col.key === "income" || col.key === "rentalCost" || col.key === "priority" || col.key === "familyMembers") {
                  const value = beneficiary[col.key as keyof Beneficiary];
                  cellValue = value !== undefined && value !== null ? String(value) : "-";
                } else if (
                  col.key === "healthStatus" ||
                  col.key === "housingType" ||
                  col.key === "maritalStatus" ||
                  col.key === "employment"
                ) {
                  const value = beneficiary[col.key as keyof Beneficiary];
                  cellValue = getArabicLabel(col.key, value as string | number | undefined);
                } else {
                  const value = beneficiary[col.key as keyof Beneficiary];
                  cellValue = String(value || "-");
                }

                return new TableCell({
                  children: [new Paragraph({ 
                    text: cellValue, 
                    alignment: col.key === "index" ? AlignmentType.CENTER : AlignmentType.RIGHT, 
                    bidirectional: true 
                  })],
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  verticalAlign: AlignmentType.CENTER as any,
                });
              }),
            })
          );
        });

        // Create table
        const table = new Table({
          rows: tableRows,
          width: { size: totalWidth, type: WidthType.DXA },
          alignment: AlignmentType.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "666666" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "666666" },
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pageContent: any[] = [];

        // Header
        pageContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "مؤسسة دعوة الحق",
                bold: true,
                size: 32,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `قائمة المستفيدين (${totalBeneficiaries} مستفيد) - صفحة ${pageNum + 1} من ${totalPages}`,
                bold: true,
                size: 22,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );

        // Table
        pageContent.push(table);

        // Footer
        const reportDate = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
        pageContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `تاريخ التقرير: ${reportDate}`,
                size: 18,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 300 },
          })
        );

        // Add section
        sections.push({
          children: pageContent,
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            textDirection: "rightToLeft" as any,
            bidi: true,
          },
        });
      }

      const doc = new Document({
        sections,
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${title}.docx`);
      onClose();
    } catch (err) {
      console.error("Word export error:", err);
      alert("فشل تصدير ملف Word");
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background">
          <h2 className="text-lg font-semibold text-foreground">تصدير المستفيدين</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
            type="button"
            aria-label="إغلاق"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Column Selection */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">اختر الحقول المراد تصديرها:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(exportColumns).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded transition-colors">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() => handleColumnChange(key)}
                    className="w-4 h-4 rounded border border-input"
                  />
                  <span className="text-sm text-foreground">
                    {key === "name" && "الاسم"}
                    {key === "nationalId" && "رقم المستفيد"}
                    {key === "phone" && "الرقم القومى"}
                    {key === "whatsapp" && "الواتساب"}
                    {key === "address" && "العنوان"}
                    {key === "healthStatus" && "الصحة"}
                    {key === "housingType" && "السكن"}
                    {key === "employment" && "التوظيف"}
                    {key === "priority" && "الأولوية"}
                    {key === "familyMembers" && "عدد الأسرة"}
                    {key === "maritalStatus" && "الحالة الاجتماعية"}
                    {key === "income" && "الدخل"}
                    {key === "rentalCost" && "الإيجار"}
                    {key === "notes" && "ملاحظات"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview Info */}
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm text-muted-foreground">
            <p>سيتم تصدير {beneficiaries.length} مستفيد مع الحقول المختارة أعلاه</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-border sticky bottom-0 bg-background">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium transition-colors"
            type="button"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري التصدير...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                تصدير Word
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-foreground font-medium"
            type="button"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
