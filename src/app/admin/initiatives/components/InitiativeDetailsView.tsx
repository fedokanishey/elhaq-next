"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Loader2,
} from "lucide-react";
import CloudinaryImage from "@/components/CloudinaryImage";

interface BeneficiarySummary {
  _id: string;
  name: string;
  nationalId?: string;
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

interface InitiativeDetailsViewProps {
  initiativeId: string;
  isModal?: boolean;
  onEdit?: () => void;
  onClose?: () => void;
}

export default function InitiativeDetailsView({
  initiativeId,
  isModal = false,
  onEdit,
  onClose,
}: InitiativeDetailsViewProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [initiative, setInitiative] = useState<InitiativeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("جاري تحميل بيانات المبادرة...");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Check authorization - handled by parent or page usually, but good to check role for showing actions
  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin" || isSuperAdmin;

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

  const exportToWord = async () => {
    if (!initiative || !initiative.beneficiaries || initiative.beneficiaries.length === 0) {
      alert("لا يوجد مستفيدون للتصدير");
      return;
    }

    setExporting(true);
    try {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, TextRun } = await import("docx");
      const { saveAs } = await import("file-saver");

      // تقسيم المستفيدين إلى صفحات - 25 مستفيد في كل صفحة
      const BENEFICIARIES_PER_PAGE = 25;
      const totalBeneficiaries = initiative.beneficiaries.length;
      const totalPages = Math.ceil(totalBeneficiaries / BENEFICIARIES_PER_PAGE);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sections: any[] = [];

      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const startIndex = pageNum * BENEFICIARIES_PER_PAGE;
        const endIndex = Math.min(startIndex + BENEFICIARIES_PER_PAGE, totalBeneficiaries);
        const pageBeneficiaries = initiative.beneficiaries.slice(startIndex, endIndex);

        // إنشاء صفوف الجدول
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tableRows: any[] = [];

        // Header row
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({ 
                children: [new Paragraph({ text: "التوقيع باستلام", alignment: AlignmentType.CENTER, bidirectional: true })], 
                width: { size: 1900, type: WidthType.DXA },
                shading: { fill: "d0d0d0" },
                verticalAlign: AlignmentType.CENTER
              }),
              new TableCell({ 
                children: [new Paragraph({ text: "النسبة", alignment: AlignmentType.CENTER, bidirectional: true })], 
                width: { size: 1425, type: WidthType.DXA },
                shading: { fill: "d0d0d0" },
                verticalAlign: AlignmentType.CENTER
              }),
              new TableCell({ 
                children: [new Paragraph({ text: "المستحقات", alignment: AlignmentType.CENTER, bidirectional: true })], 
                width: { size: 1425, type: WidthType.DXA },
                shading: { fill: "d0d0d0" },
                verticalAlign: AlignmentType.CENTER
              }),
              new TableCell({ 
                children: [new Paragraph({ text: "عدد مرفقات", alignment: AlignmentType.CENTER, bidirectional: true })], 
                width: { size: 1425, type: WidthType.DXA },
                shading: { fill: "d0d0d0" },
                verticalAlign: AlignmentType.CENTER
              }),
              new TableCell({ 
                children: [new Paragraph({ text: "اسم المستفيد", alignment: AlignmentType.CENTER, bidirectional: true })], 
                width: { size: 2660, type: WidthType.DXA },
                shading: { fill: "d0d0d0" },
                verticalAlign: AlignmentType.CENTER
              }),
              new TableCell({ 
                children: [new Paragraph({ text: "م", alignment: AlignmentType.CENTER, bidirectional: true })], 
                width: { size: 665, type: WidthType.DXA },
                shading: { fill: "d0d0d0" },
                verticalAlign: AlignmentType.CENTER
              }),
            ],
          })
        );

        // Data rows
        pageBeneficiaries.forEach((beneficiary, index) => {
          const globalIndex = startIndex + index + 1;
          tableRows.push(
            new TableRow({
              children: [
                new TableCell({ 
                  children: [new Paragraph({ text: "", alignment: AlignmentType.CENTER, bidirectional: true })],
                  verticalAlign: AlignmentType.CENTER
                }),
                new TableCell({ 
                  children: [new Paragraph({ text: "", alignment: AlignmentType.CENTER, bidirectional: true })],
                  verticalAlign: AlignmentType.CENTER
                }),
                new TableCell({ 
                  children: [new Paragraph({ text: "", alignment: AlignmentType.CENTER, bidirectional: true })],
                  verticalAlign: AlignmentType.CENTER
                }),
                new TableCell({ 
                  children: [new Paragraph({ text: "", alignment: AlignmentType.CENTER, bidirectional: true })],
                  verticalAlign: AlignmentType.CENTER
                }),
                new TableCell({ 
                  children: [new Paragraph({ text: beneficiary.name || "-", alignment: AlignmentType.CENTER, bidirectional: true })],
                  verticalAlign: AlignmentType.CENTER
                }),
                new TableCell({ 
                  children: [new Paragraph({ text: String(globalIndex), alignment: AlignmentType.CENTER, bidirectional: true })],
                  verticalAlign: AlignmentType.CENTER
                }),
              ],
            })
          );
        });

        // إنشاء الجدول
        const table = new Table({
          rows: tableRows,
          width: { size: 9500, type: WidthType.DXA },
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

        // إنشاء محتوى الصفحة: الهيدر + الجدول + الفوتر
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pageContent: any[] = [];

        // الهيدر
        pageContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "جمعية  دعوة الحق  الإسلامية بدمياط",
                bold: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "المشهرة  برقم  131  لسنة  1984م",
                bold: true,
                size: 24,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "لمنطقة / ...........................                          شهر/ ......... 2025 م",
                bold: true,
                size: 22,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "كشف توزيع التبرعات العينية",
                bold: true,
                size: 26,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );

        // الجدول
        pageContent.push(table);

        // الفوتر
        pageContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "تم التوزيع بمعرفة مسؤول المنطقة                                                                           توقيع:  أمين الصندوق",
                bold: true,
                size: 22,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "...............................................الاسم",
                bold: true,
                size: 22,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 50 },
          })
        );

        // إضافة Section
        sections.push({
          children: pageContent,
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
              pageNumbers: {
                start: 1,
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
      saveAs(blob, `كشف_المبادرة_${initiative.name || "المبادرة"}.docx`);

    } catch (err) {
      console.error("Word export error:", err);
      alert("فشل تصدير ملف Word");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh] bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p>جاري تحميل بيانات المبادرة...</p>
      </div>
    );
  }

  if (error && !initiative) {
    return (
      <div className={isModal ? "p-4" : "min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-6"}>
        <p className="text-destructive text-lg font-semibold">{error}</p>
        {!isModal && (
          <Link
            href="/admin/initiatives"
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            العودة لقائمة المبادرات
          </Link>
        )}
      </div>
    );
  }

  if (!initiative) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh] bg-background text-destructive">
        <p>بيانات المبادرة غير متاحة</p>
      </div>
    );
  }

  const formattedDate = initiative.date
    ? new Date(initiative.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Not specified";
  const beneficiaries = initiative.beneficiaries || [];

  return (
    <div className={isModal ? "bg-background transition-colors" : "min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors"}>
      <div className={isModal ? "space-y-6" : "max-w-5xl mx-auto space-y-8"}>
        {!isModal && (
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
                onClick={exportToWord}
                disabled={exporting}
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-primary text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                {exporting ? "جاري التصدير..." : "تصدير الكشف"}
              </button>
              <Link
                href="/admin/initiatives/add"
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-border text-foreground hover:bg-muted"
              >
                ➕ إنشاء مبادرة جديدة
              </Link>
            </div>
          </div>
        )}

        {isModal && (
           <div className="flex justify-between items-start mb-4">
               <div>
                  <h2 className="text-2xl font-bold text-foreground">{initiative.name}</h2>
                  <p className="text-muted-foreground">{initiative.description}</p>
               </div>
               <div className="flex gap-2">
                   {isAdmin && onEdit && (
                     <button
                       onClick={onEdit}
                       className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
                     >
                       ✏️ تعديل
                     </button>
                   )}
                   <button
                    onClick={exportToWord}
                    disabled={exporting}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-primary text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {exporting ? "..." : "تصدير"}
                  </button>
               </div>
           </div>
        )}

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
                  <CloudinaryImage
                    src={image}
                    alt={initiative.name || "صورة المبادرة"}
                    width="detail"
                    height={256}
                    layout="detail"
                    crop="fill"
                    quality="auto"
                    className="w-full h-64"
                  />
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
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {beneficiaries.map((beneficiary) => (
                <div key={beneficiary._id} className="border border-border rounded-lg p-4 flex flex-col items-center text-center gap-3 hover:bg-muted/50 transition-colors">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center text-2xl font-semibold text-primary">
                    {beneficiary.profileImage ? (
                      <CloudinaryImage
                        src={beneficiary.profileImage}
                        alt={beneficiary.name || "صورة المستفيد"}
                        width="thumbnail"
                        height={80}
                        layout="thumbnail"
                        crop="fill"
                        gravity="face"
                        quality="auto"
                        className="w-full h-full"
                      />
                    ) : (
                      beneficiary.name?.charAt(0) || "م"
                    )}
                  </div>
                  <div className="flex-1 w-full space-y-1">
                    <p className="text-foreground font-bold text-base">{beneficiary.name}</p>
                    {beneficiary._id && (
                      <p className="text-muted-foreground text-xs">رقم المستفيد الداخلى : {beneficiary.nationalId}</p>
                    )}
                    {beneficiary.spouse?.name && (
                      <p className="text-muted-foreground text-xs">الزوج/الزوجة: {beneficiary.spouse.name}</p>
                    )}
                  </div>
                  
                  {/* Since this is a view inside a view, navigation should be handled carefully. 
                      Ideally, open BeneficiaryModal for this beneficiary. 
                      But for now let's keep it as Link or button. 
                      If we are in a Modal, we cannot easily stack modals without management.
                      So let's just make it a Link for now, or just show info.
                  */}
                  <Link
                    href={`/admin/beneficiaries/${beneficiary._id}`}
                    target="_blank" 
                    className="w-full inline-flex items-center justify-center gap-1 text-primary text-sm hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded transition-colors"
                  >
                    فتح الملف
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">لا توجد أسماء مستفيدين مرتبطة حالياً بهذه المبادرة.</p>
          )}
        </section>
      </div>

      {/* Image Modal - Local to this view */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <CloudinaryImage
              src={selectedImage}
              alt="صورة بحجم كامل"
              width="full"
              layout="full"
              crop="limit"
              quality="auto:good"
              className="w-full h-full rounded-lg"
              priority
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
    </div>
  );
}
