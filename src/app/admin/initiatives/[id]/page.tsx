"use client";
/* eslint-disable @next/next/no-img-element */

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Image as ImageIcon,
  Users,
  Download,
  X,
  ZoomIn,
} from "lucide-react";

interface BeneficiarySummary {
  _id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  healthStatus?: string;
  housingType?: string;
  employment?: string;
  priority?: number;
  children?: Array<{ _id?: string; name?: string }>;
  profileImage?: string;
  spouse?: {
    name?: string;
    nationalId?: string;
    phone?: string;
    whatsapp?: string;
  };
  familyMembers?: number;
  maritalStatus?: string;
  income?: number;
  rentalCost?: number;
  notes?: string;
}

interface InitiativeDetails {
  _id?: string;
  name?: string;
  description?: string;
  date?: string;
  totalAmount?: number;
  status?: "planned" | "active" | "completed" | "cancelled";
  images?: string[];
  beneficiaries?: BeneficiarySummary[];
}

const STATUS_LABELS: Record<string, string> = {
  planned: "مخططة",
  active: "نشطة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
};

export default function ViewInitiativePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const initiativeId = useMemo(() => {
    if (!params?.id) return "";
    return Array.isArray(params.id) ? params.id[0] : params.id;
  }, [params]);

  const [initiative, setInitiative] = useState<InitiativeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("جاري تحميل بيانات المبادرة...");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportColumns, setExportColumns] = useState({
    name: true,
    phone: true,
    whatsapp: false,
    address: false,
    healthStatus: false,
    housingType: false,
    employment: false,
    priority: false,
    spouse: false,
    familyMembers: false,
    maritalStatus: false,
    income: false,
    rentalCost: false,
    notes: false,
  });

  // Check authorization
  useEffect(() => {
    if (!isLoaded) return;
    
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (role !== "admin") {
      // Only redirect once
      const timer = setTimeout(() => router.push("/"), 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  useEffect(() => {
    if (!initiativeId) {
      setLoading(false);
      setError("لم يتم العثور على معرف المبادرة");
      return;
    }

    const fetchInitiative = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/initiatives/${initiativeId}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("فشل تحميل بيانات المبادرة");
        }
        const data: InitiativeDetails & { error?: string } = await res.json();
        if (data?.error) {
          throw new Error(data.error);
        }
        setInitiative({
          ...data,
          date: data?.date ? new Date(data.date).toISOString() : undefined,
          images: Array.isArray(data?.images) ? data.images : [],
          beneficiaries: Array.isArray(data?.beneficiaries) ? data.beneficiaries : [],
        });
        setError("");
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "فشل تحميل بيانات المبادرة");
      } finally {
        setLoading(false);
      }
    };

    fetchInitiative();
  }, [initiativeId]);

  const exportToPDF = async () => {
    if (!initiative || !initiative.beneficiaries || initiative.beneficiaries.length === 0) {
      alert("لا يوجد مستفيدون للتصدير");
      return;
    }

    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      // Prepare table headers - add index/row number column first
      const columnHeaders: Array<{ key: string; label: string }> = [
        { key: "index", label: "#" }
      ];
      if (exportColumns.name) columnHeaders.push({ key: "name", label: "الاسم" });
      if (exportColumns.phone) columnHeaders.push({ key: "phone", label: "الرقم القومى" });
      if (exportColumns.whatsapp) columnHeaders.push({ key: "whatsapp", label: "الهاتف" });
      if (exportColumns.address) columnHeaders.push({ key: "address", label: "العنوان" });
      if (exportColumns.healthStatus) columnHeaders.push({ key: "healthStatus", label: "الصحة" });
      if (exportColumns.housingType) columnHeaders.push({ key: "housingType", label: "السكن" });
      if (exportColumns.employment) columnHeaders.push({ key: "employment", label: "التوظيف" });
      if (exportColumns.priority) columnHeaders.push({ key: "priority", label: "الأولوية" });
      if (exportColumns.spouse) columnHeaders.push({ key: "spouse", label: "الزوج/الزوجة" });
      if (exportColumns.familyMembers) columnHeaders.push({ key: "familyMembers", label: "الأسرة" });
      if (exportColumns.maritalStatus) columnHeaders.push({ key: "maritalStatus", label: "الحالة" });
      if (exportColumns.income) columnHeaders.push({ key: "income", label: "الدخل" });
      if (exportColumns.rentalCost) columnHeaders.push({ key: "rentalCost", label: "الإيجار" });
      if (exportColumns.notes) columnHeaders.push({ key: "notes", label: "ملاحظات" });

      const formattedDate = initiative.date
        ? new Date(initiative.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : "Not specified";

      // Build table rows HTML
      let tableRows = "";
      initiative.beneficiaries.forEach((beneficiary, index) => {
        let rowHtml = "<tr>";
        columnHeaders.forEach((col) => {
          let cellValue = "-";
          if (col.key === "index") {
            cellValue = String(index + 1);
          } else if (col.key === "spouse") {
            cellValue = beneficiary.spouse?.name || "-";
          } else if (col.key === "income" || col.key === "rentalCost") {
            const value = beneficiary[col.key as keyof BeneficiarySummary];
            cellValue = value ? String(value) : "-";
          } else {
            const value = beneficiary[col.key as keyof BeneficiarySummary];
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
              <h2>تقرير المستفيدين من المبادرة</h2>
            </div>

            <div class="info">
              <h3>معلومات المبادرة:</h3>
              <p><strong>اسم المبادرة:</strong> ${initiative.name || "بدون اسم"}</p>
              <p><strong>الحالة:</strong> ${STATUS_LABELS[initiative.status || "planned"]}</p>
              <p><strong>التاريخ:</strong> ${formattedDate}</p>
              <p><strong>إجمالي التمويل:</strong> ${initiative.totalAmount?.toLocaleString("ar-EG") || 0} ج.م</p>
            </div>

            <h3 style="margin-bottom: 10px;">قائمة المستفيدين (${initiative.beneficiaries.length} مستفيد)</h3>

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
              <p>Report Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
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
        filename: `تقرير_مستفيدي_${initiative.name || "المبادرة"}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: "landscape" as const, unit: "mm" as const, format: "a4" }
      };

      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(element);
      setShowExportModal(false);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("فشل تصدير ملف PDF");
    } finally {
      setExporting(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        <p>{error}</p>
      </div>
    );
  }

  if (error && !initiative) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-destructive text-lg font-semibold">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/admin/initiatives")}
          className="px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          العودة لقائمة المبادرات
        </button>
      </div>
    );
  }

  if (!initiative) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-destructive">
        <p>بيانات المبادرة غير متاحة</p>
      </div>
    );
  }

  const formattedDate = initiative.date
    ? new Date(initiative.date).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : "غير محدد";
  const beneficiaries = initiative.beneficiaries || [];

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/admin/initiatives"
              className="text-muted-foreground hover:text-primary inline-flex items-center gap-2"
            >
              ← العودة لقائمة المبادرات
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-foreground">{initiative.name}</h1>
            <p className="text-muted-foreground">تفاصيل كاملة عن المبادرة والمستفيدين المرتبطين بها</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/admin/initiatives/${initiativeId}/edit`}
              className="inline-flex items-center justify-center px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              ✏️ تعديل المبادرة
            </Link>
            <button
              onClick={() => setShowExportModal(true)}
              disabled={exporting}
              className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-primary text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? "جاري التصدير..." : "تصدير المستفيدين"}
            </button>
            <Link
              href="/admin/initiatives/add"
              className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-border text-foreground hover:bg-muted"
            >
              ➕ إنشاء مبادرة جديدة
            </Link>
          </div>
        </div>

        <section className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[initiative.status || "planned"]}`}>
              {STATUS_LABELS[initiative.status || "planned"]}
            </span>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CalendarDays className="w-4 h-4" />
              {formattedDate}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CircleDollarSign className="w-4 h-4" />
              إجمالي التمويل: {initiative.totalAmount?.toLocaleString("ar-EG") || 0} ج.م
            </div>
          </div>

          <p className="text-foreground leading-7">{initiative.description || "لا يوجد وصف للمبادرة."}</p>

          {initiative.images && initiative.images.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {initiative.images.map((image) => (
                <div
                  key={image}
                  className="relative rounded-lg overflow-hidden border border-border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setSelectedImage(image)}
                >
                  <img src={image} alt={initiative.name} className="w-full h-64 object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 hover:opacity-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground text-sm">
              <ImageIcon className="w-4 h-4" aria-hidden="true" />
              لا توجد صور مرفوعة لهذه المبادرة
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">المستفيدون ({beneficiaries.length})</h2>
          </div>

          {beneficiaries.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {beneficiaries.map((beneficiary) => (
                <div key={beneficiary._id} className="border border-border rounded-lg p-4 flex gap-4 items-center">
                  <div className="w-14 h-14 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center text-lg font-semibold text-primary">
                    {beneficiary.profileImage ? (
                      <img src={beneficiary.profileImage} alt={beneficiary.name} className="w-full h-full object-cover" />
                    ) : (
                      beneficiary.name?.charAt(0) || "م"
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground font-medium">{beneficiary.name}</p>
                    <p className="text-muted-foreground text-sm">{beneficiary.phone || "لا يوجد رقم"}</p>
                  </div>
                  <Link
                    href={`/admin/beneficiaries/${beneficiary._id}`}
                    className="inline-flex items-center gap-1 text-primary text-sm hover:text-primary/80"
                  >
                    فتح الملف
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">لا توجد أسماء مستفيدين مرتبطة حالياً بهذه المبادرة.</p>
          )}
        </section>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage}
              alt="صورة بحجم كامل"
              className="w-full h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowExportModal(false)}
        >
          <div className="relative bg-card rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground">اختر البيانات المطلوب تصديرها</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-muted-foreground hover:text-foreground"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
              {Object.entries({
                name: "الاسم",
                phone: "الرقم القومى",
                whatsapp: "واتس آب",
                address: "العنوان",
                healthStatus: "الحالة الصحية",
                housingType: "نوع السكن",
                employment: "التوظيف",
                priority: "الأولوية",
                spouse: "الزوج/الزوجة",
                familyMembers: "عدد أفراد الأسرة",
                maritalStatus: "الحالة الاجتماعية",
                income: "الدخل الشهري",
                rentalCost: "تكلفة الإيجار",
                notes: "ملاحظات",
              }).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportColumns[key as keyof typeof exportColumns]}
                    onChange={(e) =>
                      setExportColumns({
                        ...exportColumns,
                        [key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-foreground">{label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={exportToPDF}
                disabled={exporting || !Object.values(exportColumns).some(Boolean)}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {exporting ? "جاري التصدير..." : "تصدير"}
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
