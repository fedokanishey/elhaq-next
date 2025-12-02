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

  const handleExport = async () => {
    if (beneficiaries.length === 0) {
      alert("لا يوجد مستفيدون للتصدير");
      return;
    }

    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      // Prepare table headers
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

      // Build table rows HTML
      let tableRows = "";
      beneficiaries.forEach((beneficiary, index) => {
        let rowHtml = "<tr>";
        columnHeaders.forEach((col) => {
          let cellValue = "-";
          if (col.key === "index") {
            cellValue = String(index + 1);
          } else if (col.key === "spouse") {
            cellValue = beneficiary.spouse?.name || "-";
          } else if (col.key === "income" || col.key === "rentalCost") {
            const value = beneficiary[col.key as keyof Beneficiary];
            cellValue = value ? String(value) : "-";
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
          const isIndex = col.key === "index" ? 'class="row-index"' : "";
          rowHtml += `<td ${isIndex}>${cellValue}</td>`;
        });
        rowHtml += "</tr>";
        tableRows += rowHtml;
      });

      // Build table headers HTML
      let headerHtml = "";
      columnHeaders.forEach((h) => {
        headerHtml += `<th>${h.label}</th>`;
      });

      // Create HTML content
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { margin: 0; padding: 0; }
              body {
                font-family: Arial, sans-serif;
                direction: rtl;
                text-align: right;
                padding: 20px;
                color: #000000;
                margin-bottom: 30px;
              }
              .header {
                text-align: center;
                margin-bottom: 20px;
              }
              .header h1 {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 5px;
                color: #000000;
              }
              .header h2 {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 10px;
                color: #000000;
              }
              .info {
                margin-bottom: 20px;
              }
              .info h3 {
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 8px;
                text-decoration: underline;
                color: #000000;
              }
              .info p {
                font-size: 11px;
                line-height: 1.6;
                color: #000000;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }
              thead {
                background-color: #d0d0d0;
              }
              th {
                border: 1px solid #333;
                padding: 8px;
                font-size: 10px;
                font-weight: bold;
                text-align: center;
                color: #000000;
              }
              td {
                border: 1px solid #666;
                padding: 6px;
                font-size: 10px;
                text-align: right;
                color: #000000;
              }
              .row-index {
                text-align: center;
                width: 30px;
                color: #000000;
              }
              .footer {
                text-align: center;
                font-size: 9px;
                color: #000000;
                margin-top: 30px;
                padding: 15px;
                border-top: 1px solid #ccc;
              }
              h3 {
                color: #000000;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>مؤسسة دعوة الحق</h1>
              <h2>${title}</h2>
            </div>

            <h3 style="margin-bottom: 10px;">قائمة المستفيدين (${beneficiaries.length} مستفيد)</h3>

            <table>
              <thead>
                <tr>
                  ${headerHtml}
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <div class="footer">
              <p>تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </body>
        </html>
      `;

      // Create PDF from HTML
      const element = document.createElement("div");
      element.innerHTML = htmlContent;
      document.body.appendChild(element);

      const opt = {
        margin: 10,
        filename: `تقرير_${title}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: "landscape" as const, unit: "mm" as const, format: "a4" },
      };

      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(element);
      onClose();
    } catch (err) {
      console.error("PDF export error:", err);
      alert("فشل تصدير ملف PDF");
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
                تصدير PDF
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
