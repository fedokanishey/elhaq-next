"use client";

import React from "react";
import Image from "next/image";
import { Printer, X, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatNumber, formatCurrency } from "@/lib/services/zakat-rice/utils";

interface ZkStatementPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  season?: string;
  orgName?: string;
  orgLogo?: string;
  headers: string[];
  rows: (string | number)[][];
  summaryCards?: Array<{ label: string; value: string | number; color?: string }>;
  notes?: string;
}

export default function ZkStatementPrintModal({
  isOpen,
  onClose,
  title,
  season,
  orgName = "دعوة الحق الزرقا",
  orgLogo = "/logos/شعار.png",
  headers,
  rows,
  summaryCards,
  notes,
}: ZkStatementPrintModalProps) {
  if (!isOpen) return null;

  const dateFormatted = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التقرير");
    XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}_${season || ""}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:p-0 print:bg-white backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl p-6 print:p-0 print:shadow-none print:w-full print:max-w-none text-slate-800 dir-rtl text-right my-auto">
        {/* Actions Bar - Hidden on print */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة الكشف (A4)
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              تصدير Excel
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Official Printable Sheet */}
        <div className="print:m-0 print:p-2">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-emerald-900/30">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16">
                <Image
                  src={orgLogo}
                  alt={orgName}
                  width={64}
                  height={64}
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div>
                <h1 className="text-xl font-black text-emerald-950">{orgName}</h1>
                <p className="text-xs font-semibold text-slate-600">لجنة الزكاة والمخازن — مشروع زكاة المحاصيل والأرز</p>
              </div>
            </div>

            <div className="text-left">
              <div className="text-sm font-black text-emerald-900">
                الموسم: {season || "الموسم الحالي"}
              </div>
              <div className="text-xs text-slate-500 mt-1">تاريخ الاستخراج: {dateFormatted}</div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-4">
            <h2 className="text-lg font-black text-emerald-950 inline-block px-8 py-1 rounded-full border border-emerald-300 bg-emerald-50">
              {title}
            </h2>
          </div>

          {/* Summary Cards */}
          {summaryCards && summaryCards.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
              {summaryCards.map((sc, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-center">
                  <span className="text-xs text-slate-500 font-semibold block">{sc.label}</span>
                  <span className="text-base font-black text-emerald-900 mt-0.5 block">{sc.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Data Table */}
          <div className="overflow-x-auto mt-4 border border-slate-300 rounded-xl">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-emerald-800 text-white font-bold">
                  {headers.map((h, i) => (
                    <th key={i} className="p-2.5 border-b border-emerald-900">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length} className="text-center py-6 text-slate-500">
                      لا توجد بيانات مسجلة
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2 text-slate-800 border-x border-slate-200">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {notes && (
            <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <strong>ملاحظات: </strong> {notes}
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-4 text-center text-xs mt-8 pt-4 border-t border-slate-300">
            <div>
              <span className="text-slate-600 block mb-8 font-semibold">إعداد أمين المخزن:</span>
              <span className="text-slate-400">التوقيع: .....................</span>
            </div>
            <div>
              <span className="text-slate-600 block mb-8 font-semibold">المحاسب المالي:</span>
              <span className="text-slate-400">التوقيع: .....................</span>
            </div>
            <div>
              <span className="text-slate-600 block mb-8 font-semibold">اعتماد رئيس مجلس الإدارة:</span>
              <span className="text-slate-400">الختم: .....................</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

