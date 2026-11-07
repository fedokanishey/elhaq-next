"use client";

import React from "react";
import { X, History, ArrowLeft, ShieldAlert } from "lucide-react";

interface ZkAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditItem: any | null;
}

export default function ZkAuditModal({
  isOpen,
  onClose,
  auditItem,
}: ZkAuditModalProps) {
  if (!isOpen || !auditItem) return null;

  const diffs = auditItem.diff || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 text-slate-800 dir-rtl text-right my-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-900">تفاصيل العملية وسجل المراجعة</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Operation Info Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs mb-4">
          <div>
            <span className="text-slate-400 block">الإجراء:</span>
            <span className="font-bold text-slate-800">{auditItem.action}</span>
          </div>
          <div>
            <span className="text-slate-400 block">الكيان:</span>
            <span className="font-bold text-emerald-800">{auditItem.entity}</span>
          </div>
          <div>
            <span className="text-slate-400 block">المستخدم:</span>
            <span className="font-bold text-slate-800">{auditItem.user_name || "—"}</span>
          </div>
          <div>
            <span className="text-slate-400 block">الوقت:</span>
            <span className="font-medium text-slate-600">
              {new Date(auditItem.ts).toLocaleString("ar-EG")}
            </span>
          </div>
        </div>

        {auditItem.override && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl mb-4">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">تنبيه: تمت هذه العملية بتجاوز صريح للرصيد بموافقة المدير.</span>
          </div>
        )}

        {auditItem.notes && (
          <div className="text-xs text-slate-700 bg-slate-100 p-3 rounded-xl mb-4">
            <strong>البيان: </strong> {auditItem.notes}
          </div>
        )}

        {/* Changes Diff Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-100 p-2.5 font-bold text-xs text-slate-700 border-b">
            الحقول والتغييرات التي طرأت على السجل:
          </div>
          {diffs.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              {auditItem.action === "إضافة" ? "سجل جديد بالكامل" : "لا توجد تعديلات تفصيلية مسجلة"}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {diffs.map((d: any, idx: number) => (
                <div key={idx} className="p-3 text-xs grid grid-cols-3 items-center gap-2 hover:bg-slate-50">
                  <span className="font-bold text-slate-800">{d.label || d.field}</span>
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-1.5 rounded text-center truncate">
                    <span className="text-[10px] text-rose-500 block">قبل:</span>
                    {typeof d.before === "object" ? JSON.stringify(d.before) : String(d.before || "—")}
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-1.5 rounded text-center truncate flex items-center justify-between gap-1">
                    <ArrowLeft className="w-3 h-3 text-emerald-600 shrink-0" />
                    <div className="w-full">
                      <span className="text-[10px] text-emerald-500 block">بعد:</span>
                      {typeof d.after === "object" ? JSON.stringify(d.after) : String(d.after || "—")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-left">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

