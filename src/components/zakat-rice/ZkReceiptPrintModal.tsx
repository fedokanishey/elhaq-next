"use client";

import React from "react";
import Image from "next/image";
import { Printer, X } from "lucide-react";
import { formatNumber, formatCurrency } from "@/lib/services/zakat-rice/utils";

interface ZkReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    type: "receipt" | "distribution";
    operationType?: "donation" | "purchase" | "sale";
    no: string;
    date: string | Date;
    partyName: string;
    partyDetails?: string;
    itemTitle: string;
    quantity: number;
    unit: string;
    bags?: number;
    bagKg?: number;
    amount?: number;
    paymentMethod?: string;
    purpose?: string;
    storeLabel?: string;
    place?: string;
    notes?: string;
    createdByName?: string;
    orgName?: string;
    orgLogo?: string;
  } | null;
}

export default function ZkReceiptPrintModal({
  isOpen,
  onClose,
  data,
}: ZkReceiptPrintModalProps) {
  if (!isOpen || !data) return null;

  const isReceipt = data.type === "receipt";
  const op = data.operationType || "donation";
  
  let title = isReceipt ? "إيصال استلام تبرع / محصول" : "إذن صرف وتوزيع أرز";
  let partyLabel = isReceipt ? "اسم المتبرع الكريم:" : "اسم المستفيد المستحق:";
  let itemLabel = isReceipt ? "نوع الصنف المستلَم:" : "المقر / موقع الصرف:";
  let amountLabel = "المبلغ النقدي:";

  if (isReceipt && op === "purchase") {
    title = "إذن شراء وتوريد محاصيل (خصماً من التبرعات النقدية للأرز)";
    partyLabel = "التاجر / المورد:";
    itemLabel = "نوع المحصول المشترى:";
    amountLabel = "المبلغ المدفوع (خصماً من التبرعات):";
  } else if (isReceipt && op === "sale") {
    title = "إيصال بيع مخرجات / رجيع (إيداع بصندوق تبرعات الأرز)";
    partyLabel = "المشتري / التاجر:";
    itemLabel = "نوع الصنف المباع:";
    amountLabel = "المبلغ المحصل (توريد لصندوق الأرز):";
  }
  const orgName = data.orgName || "دعوة الحق الزرقا";
  const dateFormatted = new Date(data.date).toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:p-0 print:bg-white backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 print:p-0 print:shadow-none print:w-full print:max-w-none text-slate-800 dir-rtl text-right">
        {/* Controls - Hidden during print */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة الإيصال
            </button>
            <span className="text-xs text-slate-500">جاهز للطباعة بحجم A4 أو إيصال رسمي</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Card */}
        <div className="border-2 border-emerald-800/80 rounded-xl p-6 bg-slate-50/50 print:bg-white print:border-emerald-900 print:m-0">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-emerald-800/30">
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16">
                <Image
                  src={data.orgLogo || "/logos/شعار.png"}
                  alt={orgName}
                  width={64}
                  height={64}
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div>
                <h1 className="text-xl font-black text-emerald-900">{orgName}</h1>
                <p className="text-xs font-semibold text-slate-600">لجنة الزكاة والمخازن — مشروع زكاة المحاصيل والأرز</p>
              </div>
            </div>

            <div className="text-left">
              <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 font-black rounded-lg text-sm border border-emerald-300">
                رقم: {data.no}
              </div>
              <p className="text-xs text-slate-500 mt-1">{dateFormatted}</p>
            </div>
          </div>

          {/* Title Banner */}
          <div className="text-center my-4">
            <h2 className="text-lg font-bold text-emerald-950 bg-emerald-50/80 inline-block px-6 py-1.5 rounded-full border border-emerald-200">
              {title}
            </h2>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm mt-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">
                {partyLabel}
              </span>
              <span className="text-base font-bold text-slate-900">{data.partyName}</span>
              {data.partyDetails && (
                <span className="text-xs text-slate-600 block mt-0.5">{data.partyDetails}</span>
              )}
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 block">
                {itemLabel}
              </span>
              <span className="text-base font-bold text-emerald-800">
                {isReceipt ? data.itemTitle : (data.place || "المقر الرئيسي للجمعية")}
              </span>
            </div>

            <div className="col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">الكمية المسجلة:</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">
                    {formatNumber(data.quantity)}
                  </span>
                  <span className="text-sm font-bold text-emerald-700">{data.unit}</span>
                  {data.bags && data.bags > 0 && (
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      ({data.bags} شيكارة {data.bagKg ? `× ${data.bagKg}كجم` : ""})
                    </span>
                  )}
                </div>
              </div>

              {data.amount && data.amount > 0 && (
                <div className="text-left">
                  <span className="text-xs font-semibold text-slate-500 block">{amountLabel}</span>
                  <span className="text-xl font-black text-emerald-700">
                    {formatCurrency(data.amount)}
                  </span>
                  {data.paymentMethod && (
                    <span className="text-xs text-slate-500 block">({data.paymentMethod})</span>
                  )}
                </div>
              )}
            </div>

            {data.notes && (
              <div className="col-span-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-500 block">ملاحظات:</span>
                <p className="text-xs text-slate-700">{data.notes}</p>
              </div>
            )}
          </div>

          {/* Footer & Signatures */}
          <div className="grid grid-cols-3 gap-4 text-center text-xs mt-6 pt-4 border-t border-dashed border-slate-300">
            <div>
              <span className="text-slate-500 block mb-6">الموظف المسجل:</span>
              <span className="font-semibold text-slate-800">{data.createdByName || "أمين المخزن"}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-6">
                {isReceipt ? "المتبرع / المورد:" : "المستلم:"}
              </span>
              <span className="text-slate-400">التوقيع: .....................</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-6">اعتماد الجمعية:</span>
              <span className="text-slate-400">الختم: .....................</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-400 mt-4 border-t border-slate-100 pt-2">
            تم استخراج هذا الإيصال آليًا من منظومة إدارة المخازن وزكاة الأرز — دعوة الحق الزرقا
          </div>
        </div>
      </div>
    </div>
  );
}

