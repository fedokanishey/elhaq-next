"use client";

import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, Download, Loader2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface ZkExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ZkExcelImportModal({
  isOpen,
  onClose,
  onSuccess,
}: ZkExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Blank template download
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["الاسم", "الهاتف", "المنطقة", "أفراد الأسرة", "الرقم القومي / إضافي", "ملاحظات"],
      ["محمد أحمد إبراهيم", "01012345678", "الزرقا - بجوار المسجد الكبير", "5", "29501011234567", "أسرة مستحقة"],
      ["سارة محمود حسن", "01234567890", "قرية ميت الخولي", "3", "", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المستفيدين");
    XLSX.writeFile(wb, "نموذج_استيراد_المستفيدين.xlsx");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setLoading(true);

    try {
      const data = await selected.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      if (json.length === 0) {
        toast.error("الملف فارغ أو لا يحتوي على صفوف بيانات");
        setLoading(false);
        return;
      }

      // Map Arabic or English columns
      const mapped = json.map((row) => {
        const getVal = (candidates: string[]) => {
          for (const c of candidates) {
            for (const key of Object.keys(row)) {
              if (key.trim().toLowerCase() === c.toLowerCase() || key.includes(c)) {
                return row[key];
              }
            }
          }
          return "";
        };

        return {
          name: getVal(["الاسم", "اسم المستفيد", "name"]),
          phone: getVal(["الهاتف", "التليفون", "الموبايل", "phone", "mobile"]),
          area: getVal(["المنطقة", "العنوان", "area", "address"]),
          family_size: getVal(["أفراد الأسرة", "العدد", "family_size", "count"]) || 1,
          extra: getVal(["الرقم القومي", "إضافي", "extra", "national_id"]),
          notes: getVal(["ملاحظات", "notes"]),
        };
      });

      setParsedRows(mapped);

      // Call dryRun API
      const res = await fetch("/api/zakat-rice/beneficiaries/import?dryRun=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: mapped }),
      });
      const result = await res.json();
      if (result.ok) {
        setPreviewData(result);
      } else {
        toast.error(result.error?.message || "فشل التحقق من الملف");
      }
    } catch (err: any) {
      toast.error("حدث خطأ أثناء قراءة ملف الإكسيل");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setImporting(true);

    try {
      const res = await fetch("/api/zakat-rice/beneficiaries/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const result = await res.json();
      if (result.ok) {
        toast.success(`تم استيراد ${result.summary?.importedCount || 0} مستفيد بنجاح!`);
        onSuccess();
        onClose();
      } else {
        toast.error(result.error?.message || "فشل الاستيراد");
      }
    } catch (err: any) {
      toast.error("حدث خطأ أثناء حفظ المستفيدين");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 text-slate-800 dir-rtl text-right my-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">استيراد المستفيدين من ملف Excel / CSV</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions and Download Template */}
        <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-900 mb-4">
          <div>
            <p className="font-semibold">قم برفع ملف Excel يحوي أعمدة: الاسم، الهاتف، المنطقة، أفراد الأسرة.</p>
            <p className="text-emerald-700 mt-0.5">النظام يفحص التكرارات آليًا لمنع تسجيل نفس الاسم أو الهاتف مرتين.</p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 font-semibold rounded-lg hover:bg-emerald-100/50 shadow-xs transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            تنزيل نموذج فارغ
          </button>
        </div>

        {/* File Dropzone */}
        {!previewData && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <span>جاري قراءة الملف والتحقق من الأسماء والتكرار...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-emerald-600 mb-1" />
                <span className="font-bold text-slate-700 text-base">انقر هنا لاختيار ملف Excel أو CSV</span>
                <span className="text-xs text-slate-400">يدعم صيغ .xlsx و .xls و .csv</span>
              </div>
            )}
          </div>
        )}

        {/* Verification Summary and Preview Table */}
        {previewData && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center text-xs">
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="text-slate-500 block">إجمالي الصفوف</span>
                <span className="text-lg font-black text-slate-800">{previewData.summary?.totalRows}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-700 block font-medium">جديد وصالح للاستيراد</span>
                <span className="text-lg font-black text-emerald-700">{previewData.summary?.validCount}</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-amber-700 block font-medium">مكرر (سيُتجاهل)</span>
                <span className="text-lg font-black text-amber-700">{previewData.summary?.duplicateCount}</span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-rose-700 block font-medium">غير صالح (فارغ)</span>
                <span className="text-lg font-black text-rose-700">{previewData.summary?.invalidCount}</span>
              </div>
            </div>

            {/* Preview Sample List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2 border-b">#</th>
                    <th className="p-2 border-b">الاسم</th>
                    <th className="p-2 border-b">الهاتف</th>
                    <th className="p-2 border-b">المنطقة</th>
                    <th className="p-2 border-b">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData.preview?.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2 text-slate-400">{p.row}</td>
                      <td className="p-2 font-bold text-slate-800">{p.name}</td>
                      <td className="p-2 text-slate-600">{p.phone || "—"}</td>
                      <td className="p-2 text-slate-600">{p.area || "—"}</td>
                      <td className="p-2">
                        {p.status === "valid" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle className="w-3 h-3" /> صالح
                          </span>
                        ) : p.status === "duplicate" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> مكرر
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3" /> غير صالح
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setPreviewData(null);
                  setFile(null);
                  setParsedRows([]);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                اختيار ملف آخر
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={importing || previewData.summary?.validCount === 0}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow transition-colors"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري حفظ البيانات...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      تأكيد استيراد ({previewData.summary?.validCount}) مستفيد جديد
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

