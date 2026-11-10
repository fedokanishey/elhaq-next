"use client";
import BrandedLoader from "@/components/BrandedLoader";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Hash,
  Home,
  MapPin,
  MessageCircle,
  NotebookPen,
  Phone,
  CalendarCheck,
  Wallet,
  User,
  Users,
  X,
  Loader2,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Barcode as BarcodeIcon,
  FileText,
  Printer,
  Heart,
  PackageCheck,
  CheckCircle2,
  Clock,
  Plus,
  Coins,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import Barcode from "@/components/Barcode";
import { QRCodeSVG } from "qrcode.react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import CloudinaryImage from "@/components/CloudinaryImage";
import ImageUpload from "@/components/ImageUpload";

interface Child {
  _id?: string;
  name?: string;
  gender?: "male" | "female" | string;
  nationalId?: string;
  school?: string;
  educationStage?: string;
  maritalStatus?: string;
  spouse?: SpouseDetails;
  healthStatus?: "healthy" | "sick";
  healthCertificationImage?: string;
}

interface SpouseDetails {
  name?: string;
  nationalId?: string;
  phone?: string;
  whatsapp?: string;
}

type RelationshipType =
  | "father"
  | "mother"
  | "son"
  | "daughter"
  | "brother"
  | "sister"
  | "spouse"
  | "grandfather"
  | "grandmother"
  | "other";

interface RelationshipEntry {
  relation: RelationshipType;
  relativeName: string;
  relativeNationalId?: string;
  relative?: {
    _id: string;
    name?: string;
    nationalId?: string;
    phone?: string;
    whatsapp?: string;
  };
}

interface Beneficiary {
  _id: string;
  name: string;
  internalId?: string;
  nationalId: string;
  phone: string;
  whatsapp: string;
  address: string;
  familyMembers: number;
  maritalStatus: string;
  income?: number;
  priority: number;
  profileImage?: string;
  idImage?: string;
  notes?: string;
  healthStatus?: "healthy" | "sick";
  healthCertificationImage?: string;
  housingType?: "owned" | "rented";
  rentalCost?: number;
  employment?: string;
  acceptsMarriage?: boolean;
  marriageDetails?: string;
  marriageCertificateImage?: string;
  status?: "active" | "cancelled" | "pending";
  statusReason?: string;
  statusDate?: string;
  listName?: string;
  receivesMonthlyAllowance?: boolean;
  monthlyAllowanceAmount?: number;
  category?: "A" | "B" | "C" | "D";
  spouse?: SpouseDetails;
  children?: Child[];
  relationships?: RelationshipEntry[];
}

interface InitiativeSummary {
  _id: string;
  name: string;
  status: "planned" | "active" | "completed" | "cancelled";
  date: string;
  totalAmount?: number;
  received?: boolean;
}

interface TreasuryTransactionSummary {
  _id: string;
  amount: number;
  description: string;
  category: string;
  transactionDate: string;
  beneficiaryCount: number;
  shareAmount: number;
  isMonthly?: boolean;
}

interface ProvidedItemSummary {
  itemName: string;
  quantity: number;
  cost?: number;
  notes?: string;
  deliveredAt?: string;
}

interface MarriageCaseSummary {
  _id: string;
  personName: string;
  relationship: "daughter" | "son" | "self" | "other";
  spouseName?: string;
  phone?: string;
  nationalId?: string;
  marriageDate?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  itemsProvided: ProvidedItemSummary[];
  cashAssistance?: number;
  totalCost: number;
  certificateImage?: string;
  notes?: string;
  createdAt: string;
}

const EDUCATION_STAGE_LABELS: Record<string, string> = {
  kindergarten: "حضانه",
  primary: "ابتدائي",
  preparatory: "إعدادي",
  secondary: "ثانوي",
  university: "جامعي",
  other: "أخرى",
};

const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: "أعزب",
  married: "متزوج",
  divorced: "مطلق",
  widowed: "أرمل",
};

const BENEFICIARY_STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  cancelled: "ملغى",
  pending: "انتظار",
};

const BENEFICIARY_STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200",
};

const INITIATIVE_STATUS_LABELS: Record<string, string> = {
  planned: "مخططة",
  active: "نشطة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  father: "الأب",
  mother: "الأم",
  son: "الابن",
  daughter: "الابنة",
  brother: "الأخ",
  sister: "الأخت",
  spouse: "الزوج/الزوجة",
  grandfather: "الجد",
  grandmother: "الجدة",
  other: "أخرى",
};

const INITIATIVE_STATUS_STYLES: Record<string, string> = {
  planned: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200",
};

const TRANSACTION_CATEGORY_LABELS: Record<string, string> = {
  general: "عام",
  aid: "مساعدة",
  food: "طعام",
  medical: "طبي",
  education: "تعليم",
  clothing: "ملابس",
  housing: "سكن",
  monthly: "شهرية",
  seasonal: "موسمية",
  emergency: "طوارئ",
};

interface BeneficiaryDetailsViewProps {
  beneficiaryId: string;
  isModal?: boolean;
  onEdit?: () => void;
  onClose?: () => void;
}

const formatBarcodeValue = (internalId?: string | number) => {
  const idStr = String(internalId || "0").trim();
  return `DHZ${idStr.padStart(5, "0")}`;
};

export default function BeneficiaryDetailsView({
  beneficiaryId,
  isModal = false,
  onEdit,
  onClose,
}: BeneficiaryDetailsViewProps) {
  const { user, isLoaded } = useUser();
  const [healthModalImage, setHealthModalImage] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data, error: swrError, isLoading, mutate } = useSWR(
    beneficiaryId ? `/api/beneficiaries/${beneficiaryId}?year=${selectedYear}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const beneficiary = data?.beneficiary || data || null;
  const initiatives = useMemo(
    () => (data?.initiatives || []).filter((i: InitiativeSummary) => i.received),
    [data?.initiatives]
  );
  const treasuryTransactions: TreasuryTransactionSummary[] = data?.treasuryTransactions || [];
  const totalReceivedThisYear = data?.totalReceivedThisYear || 0;
  const transactionYear = data?.transactionYear || selectedYear;
  const error = swrError ? "فشل تحميل بيانات المستفيد" : "";

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin" || isSuperAdmin;

  const whatsappLink = useMemo(() => {
    const normalized = beneficiary?.whatsapp?.replace(/\D/g, "");
    if (!normalized) return null;
    const formatted = normalized.startsWith("0")
      ? "20" + normalized.slice(1)
          : normalized;
    return `https://wa.me/${formatted}`;
    
  }, [beneficiary?.whatsapp]);

  const marriageCases: MarriageCaseSummary[] = data?.marriageCases || [];

  // Marriage modal states
  const [isAddMarriageModalOpen, setIsAddMarriageModalOpen] = useState(false);
  const [marriagePersonName, setMarriagePersonName] = useState("");
  const [marriageRelationship, setMarriageRelationship] = useState<"daughter" | "son" | "self" | "other">("daughter");
  const [marriageSpouseName, setMarriageSpouseName] = useState("");
  const [marriagePhone, setMarriagePhone] = useState("");
  const [marriageDate, setMarriageDate] = useState("");
  const [marriageStatus, setMarriageStatus] = useState<"pending" | "in_progress" | "completed" | "cancelled">("pending");
  const [marriageItems, setMarriageItems] = useState<ProvidedItemSummary[]>([]);
  const [marriageCash, setMarriageCash] = useState<number>(0);
  const [marriageCertImage, setMarriageCertImage] = useState("");
  const [marriageNotes, setMarriageNotes] = useState("");
  const [isSavingMarriage, setIsSavingMarriage] = useState(false);
  const [marriageFormError, setMarriageFormError] = useState("");
  const [previewMarriageImage, setPreviewMarriageImage] = useState<string | null>(null);

  const marriageFormTotal = useMemo(() => {
    const itemsTotal = marriageItems.reduce(
      (sum, item) => sum + (Number(item.cost || 0) * Number(item.quantity || 1)),
      0
    );
    return itemsTotal + Number(marriageCash || 0);
  }, [marriageItems, marriageCash]);

  const handleSaveMarriageCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marriagePersonName.trim()) {
      setMarriageFormError("يرجى إدخال اسم المقبل على الزواج");
      return;
    }

    try {
      setIsSavingMarriage(true);
      setMarriageFormError("");

      const res = await fetch("/api/marriage-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: beneficiary._id,
          personName: marriagePersonName,
          relationship: marriageRelationship,
          spouseName: marriageSpouseName,
          phone: marriagePhone,
          marriageDate: marriageDate || undefined,
          status: marriageStatus,
          itemsProvided: marriageItems,
          cashAssistance: Number(marriageCash || 0),
          certificateImage: marriageCertImage,
          notes: marriageNotes,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "فشل تسجيل حالة الزواج");
      }

      toast.success("تم تسجيل حالة تيسير الزواج بنجاح");
      setIsAddMarriageModalOpen(false);
      setMarriagePersonName("");
      setMarriageSpouseName("");
      setMarriagePhone("");
      setMarriageDate("");
      setMarriageItems([]);
      setMarriageCash(0);
      setMarriageCertImage("");
      setMarriageNotes("");
      mutate();
    } catch (err: any) {
      setMarriageFormError(err.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setIsSavingMarriage(false);
    }
  };

  // Handle year change for treasury transactions
  const handleYearChange = (direction: 'prev' | 'next') => {
    setSelectedYear(prev => direction === 'prev' ? prev - 1 : prev + 1);
  };

  const handlePrint = () => {
    const el = document.getElementById("beneficiary-details-printable");
    if (!el) return;

    // Clone the content so we don't mutate the DOM
    const clone = el.cloneNode(true) as HTMLElement;

    // Remove elements marked as print-ignore
    clone.querySelectorAll("[data-print-ignore]").forEach((n) => n.remove());

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("لم يتمكن المتصفح من فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.");
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>بيانات المستفيد</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { direction: rtl; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; background: #fff; }
    body { padding: 16px; }
    h1, h2, h3 { color: #1a1a1a; }
    .bg-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .border { border: 1px solid #e2e8f0; }
    .rounded-lg { border-radius: 8px; }
    .p-6 { padding: 16px; }
    .p-3 { padding: 8px; }
    .mb-4 { margin-bottom: 12px; }
    .text-sm { font-size: 12px; }
    .text-muted-foreground { color: #64748b; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .text-lg { font-size: 15px; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-cols-3 { grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .gap-2 { gap: 8px; }
    .gap-4 { gap: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: right; }
    thead { background: #f1f5f9; }
    .bg-green-100 { background: #dcfce7; color: #15803d; border-radius: 4px; padding: 2px 8px; display: inline-block; }
    .bg-yellow-100 { background: #fef9c3; color: #a16207; border-radius: 4px; padding: 2px 8px; display: inline-block; }
    .bg-red-100 { background: #fee2e2; color: #b91c1c; border-radius: 4px; padding: 2px 8px; display: inline-block; }
    .bg-amber-100 { background: #fef3c7; color: #92400e; border-radius: 4px; padding: 2px 8px; display: inline-block; }
    svg { display: none !important; }
    a { color: inherit; text-decoration: none; }
    button { display: none !important; }
    @media print {
      html, body { margin: 0; padding: 8px; }
      .bg-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
${clone.innerHTML}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    // Wait for the page to render then trigger print dialog
    // Do NOT close automatically — let the user close after printing
    setTimeout(() => {
      printWindow.print();
    }, 600);
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh] bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p>جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh] bg-background text-destructive">
        <p>فشل تحميل بيانات المستفيد</p>
      </div>
    );
  }

  if (!beneficiary) {
    return (
      <div className={isModal ? "p-4" : "min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8"}>
        <div className="max-w-3xl mx-auto bg-card border border-border rounded-lg p-8 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-4" />
          <p className="text-foreground text-lg">لم يتم العثور على المستفيد المطلوب</p>
          {!isModal && (
            <Link
              href="/admin/beneficiaries"
              className="inline-flex mt-6 px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              العودة لإدارة المستفيدين
            </Link>
          )}
        </div>
      </div>
    );
  }

  const spouse = beneficiary.spouse;
  const children = beneficiary.children || [];
  const relationships = beneficiary.relationships || [];

  return (
    <div
      id="beneficiary-details-printable"
      className={isModal ? "bg-background transition-colors" : "min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors"}
    >
      <div className={isModal ? "space-y-6" : "max-w-5xl mx-auto space-y-8"}>
        {!isModal && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                href="/admin/beneficiaries"
                className="text-muted-foreground hover:text-primary inline-flex items-center gap-2"
                data-html2canvas-ignore="true"
              >
                ← العودة لإدارة المستفيدين
              </Link>
              <h1 className="mt-3 text-3xl font-bold text-foreground">{beneficiary.name}</h1>
              {beneficiary.internalId && (
                <p className="text-muted-foreground">
                  رقم المستفيد: {beneficiary.internalId}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-center" data-print-ignore="true">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-sm transition-colors shadow-sm cursor-pointer"
                title="طباعة / حفظ كـ PDF"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة / PDF</span>
              </button>
              {isAdmin && (
                <Link
                  href={`/admin/beneficiaries/${beneficiary._id}/edit`}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md"
                >
                  تعديل مستفيد
                </Link>
              )}
              <Link
                href={`tel:${beneficiary.whatsapp}`}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted text-sm"
              >
                ☎️ اتصال سريع
              </Link>
            </div>
          </div>
        )}

        {isModal && (
          <div className="flex justify-between items-start mb-4">
             <div>
                <h2 className="text-2xl font-bold text-foreground">{beneficiary.name}</h2>
                {beneficiary.internalId && (
                  <p className="text-muted-foreground">رقم المستفيد: {beneficiary.internalId}</p>
                )}
             </div>
             <div className="flex gap-2 items-center" data-print-ignore="true">
                 <button
                   type="button"
                   onClick={handlePrint}
                   className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-sm transition-colors shadow-sm cursor-pointer"
                   title="طباعة / حفظ كـ PDF"
                 >
                   <Printer className="w-4 h-4" />
                   <span>طباعة / PDF</span>
                 </button>
                 {isAdmin && onEdit && (
                   <button
                     onClick={onEdit}
                     className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium text-sm"
                   >
                     تعديل
                   </button>
                 )}
                 <Link
                    href={`tel:${beneficiary.whatsapp}`}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted text-sm"
                 >
                    ☎️ اتصال
                 </Link>
             </div>
          </div>
        )}

        {/* Barcode Section */}
        <div className="beneficiary-qr-section bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarcodeIcon className="w-5 h-5 text-primary" />
            بطاقة تعريف باركود (Barcode)
          </h2>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
              <div id="beneficiary-qr-code" className="p-3 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center min-w-[180px]">
                <Barcode value={formatBarcodeValue(beneficiary.internalId)} height={60} />
              </div>
              <div className="p-3 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center">
                <QRCodeSVG
                  value={JSON.stringify({
                    beneficiaryId: beneficiary._id,
                    internalId: beneficiary.internalId || null,
                    nationalId: beneficiary.nationalId || null,
                    id: beneficiary.internalId?.trim() || beneficiary.nationalId?.trim() || beneficiary._id,
                    name: beneficiary.name,
                  })}
                  size={84}
                  level="M"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 text-center sm:text-right">
              <div>
                <p className="text-xs text-muted-foreground">مؤسسة دعوة الحق</p>
                <p className="text-lg font-bold text-foreground">{beneficiary.name}</p>
                <p className="text-sm text-muted-foreground">
                  رقم المستفيد الداخلي: <span className="text-foreground font-medium">{beneficiary.internalId || "-"}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } = await import("docx");
                    const { saveAs } = await import("file-saver");

                    // Convert QR SVG to PNG via canvas
                    const svgEl = document.querySelector('#beneficiary-qr-code svg') as SVGElement;
                    if (!svgEl) {
                      alert('لم يتم العثور على رمز QR');
                      return;
                    }

                    const svgData = new XMLSerializer().serializeToString(svgEl);
                    const canvas = document.createElement('canvas');
                    canvas.width = 300;
                    canvas.height = 300;
                    const ctx = canvas.getContext('2d')!;
                    const img = new Image();
                    img.onload = async () => {
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, 300, 300);
                      ctx.drawImage(img, 0, 0, 300, 300);

                      const pngBlob = await new Promise<Blob>((resolve) =>
                        canvas.toBlob((blob) => resolve(blob!), 'image/png')
                      );
                      const pngBuffer = await pngBlob.arrayBuffer();

                      const doc = new Document({
                        sections: [{
                          properties: {},
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              spacing: { after: 200 },
                              children: [
                                new TextRun({ text: "مؤسسة دعوة الحق", bold: true, size: 28, font: "Arial" }),
                              ],
                            }),
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              spacing: { after: 100 },
                              children: [
                                new TextRun({ text: beneficiary.name, bold: true, size: 36, font: "Arial" }),
                              ],
                            }),
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              spacing: { after: 200 },
                              children: [
                                new TextRun({ text: `رقم المستفيد الداخلي: ${beneficiary.internalId || "-"}`, size: 22, font: "Arial" }),
                              ],
                            }),
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              spacing: { after: 200 },
                              children: [
                                new ImageRun({
                                  data: pngBuffer,
                                  transformation: { width: 200, height: 200 },
                                  type: "png",
                                }),
                              ],
                            }),
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              children: [
                                new TextRun({ text: `المعرّف: ${beneficiary.internalId || beneficiary._id}`, size: 18, font: "Arial", color: "666666" }),
                              ],
                            }),
                          ],
                        }],
                      });

                      const blob = await Packer.toBlob(doc);
                      saveAs(blob, `QR_${beneficiary.name.replace(/\s+/g, '_')}.docx`);
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                  } catch (err) {
                    console.error('Failed to export QR to Word:', err);
                    alert('فشل تصدير بطاقة QR');
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm transition-colors"
                data-html2canvas-ignore="true"
              >
                <FileText className="w-4 h-4" />
                تصدير بطاقة QR كملف Word
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center gap-4">
            <div className="flex gap-4">
              <div className="w-28 h-28 rounded-lg overflow-hidden border border-border bg-muted">
                {beneficiary.profileImage ? (
                  <CloudinaryImage
                    src={beneficiary.profileImage}
                    alt={beneficiary.name}
                    width="card"
                    height={112}
                    layout="card"
                    crop="fill"
                    gravity="face"
                    quality="auto:good"
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-primary">
                    {beneficiary.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="w-28 h-28 rounded-lg overflow-hidden border border-border bg-muted">
                {beneficiary.idImage ? (
                  <CloudinaryImage
                    src={beneficiary.idImage}
                    alt={spouse?.name || "صورة الزوج/الزوجة"}
                    width="card"
                    height={112}
                    layout="card"
                    crop="fill"
                    gravity="face"
                    quality="auto:good"
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground text-center px-2">
                    لا توجد صورة للزوج/الزوجة
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              صور الهوية المسجلة للمستفيد والزوج/الزوجة
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              بيانات أساسية
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">الرقم القومي</dt>
                <dd className="mt-1 flex items-center gap-2 text-foreground">
                  {beneficiary.nationalId}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">رقم الواتساب</dt>
                <dd className="mt-1 flex items-center gap-2 text-foreground">
                  <MessageCircle className="w-4 h-4" />
                  {beneficiary.whatsapp}
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-sm"
                    >
                      فتح المحادثة
                    </a>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">العنوان</dt>
                <dd className="mt-1 flex items-center gap-2 text-foreground">
                  <MapPin className="w-4 h-4" />
                  {beneficiary.address}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">عدد أفراد الأسرة</dt>
                <dd className="mt-1 flex items-center gap-2 text-foreground">
                  <Users className="w-4 h-4" />
                  {beneficiary.familyMembers} أفراد
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">الحالة الاجتماعية</dt>
                <dd className="mt-1 flex items-center gap-2 text-foreground">
                  <Home className="w-4 h-4" />
                  {MARITAL_STATUS_LABELS[beneficiary.maritalStatus] || "غير محدد"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">الأولوية</dt>
                <dd className="mt-1 flex items-center gap-2 text-foreground">
                  <AlertCircle className="w-4 h-4" />
                  {beneficiary.priority} / 10
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">حالة المستفيد</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    BENEFICIARY_STATUS_STYLES[beneficiary.status || "active"]
                  }`}>
                    {BENEFICIARY_STATUS_LABELS[beneficiary.status || "active"]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">فئة المستفيد</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">
                    فئة {beneficiary.category || "C"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">الحالة الصحية</dt>
                <dd className="mt-1 flex items-center gap-2 text-foreground">
                  {beneficiary.healthStatus === "sick" ? (
                    beneficiary.healthCertificationImage ? (
                      <button
                        onClick={() => setHealthModalImage(beneficiary.healthCertificationImage || null)}
                        className="text-destructive hover:text-destructive/80 cursor-pointer underline font-medium"
                      >
                        🏥 مريض/مريضة
                      </button>
                    ) : (
                      <span>🏥 مريض/مريضة</span>
                    )
                  ) : (
                    <span>💚 سليم/سليمة</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">نوع السكن</dt>
                <dd className="mt-1 flex items-center gap-2 text-foreground">
                  {beneficiary.housingType === "rented" ? "🏢 مستأجر" : "🏠 مملوك"}
                </dd>
              </div>
              {beneficiary.housingType === "rented" && beneficiary.rentalCost && (
                <div>
                  <dt className="text-sm text-muted-foreground">تكلفة الإيجار الشهرية</dt>
                  <dd className="mt-1 flex items-center gap-2 text-foreground">
                    <Wallet className="w-4 h-4" />
                    {beneficiary.rentalCost} ج.م
                  </dd>
                </div>
              )}
              {beneficiary.employment && (
                <div>
                  <dt className="text-sm text-muted-foreground">الحالة الوظيفية</dt>
                  <dd className="mt-1 flex items-center gap-2 text-foreground">
                    {beneficiary.employment}
                  </dd>
                </div>
              )}
              {beneficiary.acceptsMarriage && (
                <div>
                  <dt className="text-sm text-muted-foreground">💍لديه ابن/ابنه مقبل على الزواج</dt>
                  <dd className="mt-1 flex items-center gap-2 text-foreground">
                    <span className="px-3 py-1 bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary rounded-full text-sm">
                      نعم
                    </span>
                  </dd>
                </div>
              )}
              {beneficiary.acceptsMarriage && beneficiary.marriageDetails && (
                <div>
                  <dt className="text-sm text-muted-foreground">تفاصيل مستلزمات الزواج</dt>
                  <dd className="mt-1 text-foreground">
                    {beneficiary.marriageDetails}
                  </dd>
                </div>
              )}
              {beneficiary.income && (
                <div>
                  <dt className="text-sm text-muted-foreground">الدخل الشهري</dt>
                  <dd className="mt-1 flex items-center gap-2 text-foreground">
                    <Wallet className="w-4 h-4" />
                    {beneficiary.income} ج.م
                  </dd>
                </div>
              )}
              {beneficiary.statusDate && (
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {beneficiary.status === "active" ? "تاريخ التفعيل" : beneficiary.status === "cancelled" ? "تاريخ الإلغاء" : "تاريخ الإضافة"}
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-foreground">
                    <CalendarCheck className="w-4 h-4" />
                    {new Date(beneficiary.statusDate).toLocaleDateString("ar-EG")}
                  </dd>
                </div>
              )}
              {beneficiary.statusReason && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">
                    {beneficiary.status === "active" ? "سبب التفعيل" : beneficiary.status === "cancelled" ? "سبب الإلغاء" : "سبب الإضافة"}
                  </dt>
                  <dd className="mt-1 text-foreground">
                    {beneficiary.statusReason}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-muted-foreground">اسم الكشف</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 text-foreground">
                  <NotebookPen className="w-4 h-4 shrink-0" />
                  {(beneficiary.listNames && beneficiary.listNames.length > 0
                    ? beneficiary.listNames
                    : [beneficiary.listName || "الكشف العام"]
                  ).map((ln: string, idx: number) => (
                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                      {ln}
                    </span>
                  ))}
                </dd>
              </div>
              {beneficiary.receivesMonthlyAllowance && (
                <div>
                  <dt className="text-sm text-muted-foreground">يتقاضى شهرية</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary rounded-full text-sm">
                      نعم
                    </span>
                  </dd>
                </div>
              )}
              {beneficiary.receivesMonthlyAllowance && beneficiary.monthlyAllowanceAmount && (
                <div>
                  <dt className="text-sm text-muted-foreground">قيمة الشهرية</dt>
                  <dd className="mt-1 flex items-center gap-2 text-foreground">
                    <Wallet className="w-4 h-4" />
                    {beneficiary.monthlyAllowanceAmount} ج.م
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {(beneficiary.healthCertificationImage || beneficiary.marriageCertificateImage || beneficiary.income || beneficiary.rentalCost) && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">مستندات ومعلومات إضافية</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {beneficiary.healthCertificationImage && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">الشهادة الطبية</p>
                  <div className="w-full h-40 rounded-lg overflow-hidden border border-border bg-muted">
                    <CloudinaryImage
                      src={beneficiary.healthCertificationImage}
                      alt="الشهادة الطبية"
                      width="detail"
                      layout="detail"
                      crop="limit"
                      quality="auto:good"
                      className="w-full h-full"
                    />
                  </div>
                </div>
              )}
              {beneficiary.marriageCertificateImage && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">💍 صورة قسيمة الزواج</p>
                  <div className="w-full h-40 rounded-lg overflow-hidden border border-border bg-muted">
                    <CloudinaryImage
                      src={beneficiary.marriageCertificateImage}
                      alt="قسيمة الزواج"
                      width="detail"
                      layout="detail"
                      crop="limit"
                      quality="auto:good"
                      className="w-full h-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {spouse && (spouse.name || spouse.phone || spouse.whatsapp) && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              بيانات الزوج/الزوجة
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              {spouse.name && (
                <div>
                  <dt className="text-sm text-muted-foreground">الاسم</dt>
                  <dd className="mt-1 flex items-center gap-2 text-foreground">
                    <User className="w-4 h-4" />
                    {spouse.name}
                  </dd>
                </div>
              )}
              {spouse.nationalId && (
                <div>
                  <dt className="text-sm text-muted-foreground">الرقم القومي</dt>
                  <dd className="mt-1 flex items-center gap-2 text-foreground">
                    <Hash className="w-4 h-4" />
                    {spouse.nationalId}
                  </dd>
                </div>
              )}
              {spouse.phone && (
                <div>
                  <dt className="text-sm text-muted-foreground">الهاتف</dt>
                  <dd className="mt-1 flex items-center gap-2 text-foreground">
                    <Phone className="w-4 h-4" />
                    {spouse.phone}
                  </dd>
                </div>
              )}
              {spouse.whatsapp && (
                <div>
                  <dt className="text-sm text-muted-foreground">الواتساب</dt>
                  <dd className="mt-1 flex items-center gap-2 text-foreground">
                    <MessageCircle className="w-4 h-4" />
                    {spouse.whatsapp}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Marriage Assistance Section */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Heart className="w-5 h-5 fill-rose-500/20" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">
                    مساعدات المقبلين على الزواج (تيسير الزواج)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                    {marriageCases.length} {marriageCases.length === 1 ? "حالة" : "حالات"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  متابعة الأجهزة والمنتجات المقدمة للمقبلين على الزواج من الأسرة
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMarriagePersonName("");
                  setMarriageRelationship("daughter");
                  setMarriageSpouseName("");
                  setMarriagePhone("");
                  setMarriageDate("");
                  setMarriageStatus("pending");
                  setMarriageItems([]);
                  setMarriageCash(0);
                  setMarriageCertImage("");
                  setMarriageNotes("");
                  setMarriageFormError("");
                  setIsAddMarriageModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>تسجيل حالة زواج جديدة</span>
              </button>

              <Link
                href="/admin/marriage"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition cursor-pointer"
              >
                <span>نظام تيسير الزواج</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Cases List */}
          {marriageCases.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {marriageCases.map((mc, idx) => {
                const weddingDateObj = mc.marriageDate ? new Date(mc.marriageDate) : null;
                const relLabel =
                  mc.relationship === "daughter"
                    ? "ابنة المستفيد"
                    : mc.relationship === "son"
                    ? "ابن المستفيد"
                    : mc.relationship === "self"
                    ? "المستفيد نفسه"
                    : "أخرى";

                return (
                  <div
                    key={`${mc._id}-${idx}`}
                    className="p-4 rounded-xl border border-border/80 bg-muted/20 hover:border-primary/40 transition space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-base">
                            {mc.personName}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40">
                            {relLabel}
                          </span>
                        </div>
                        {mc.spouseName && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            الطرف الآخر: <span className="text-foreground">{mc.spouseName}</span>
                          </div>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          mc.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : mc.status === "in_progress"
                            ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                            : mc.status === "pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {mc.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                        {mc.status === "in_progress" && <PackageCheck className="w-3 h-3" />}
                        {mc.status === "pending" && <Clock className="w-3 h-3" />}
                        {mc.status === "completed"
                          ? "تمت المساعدة"
                          : mc.status === "in_progress"
                          ? "جاري التجهيز"
                          : mc.status === "pending"
                          ? "في الانتظار"
                          : "ملغي"}
                      </span>
                    </div>

                    {weddingDateObj && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>موعد الزفاف:</span>
                        <span className="font-semibold text-foreground">
                          {weddingDateObj.toLocaleDateString("ar-EG", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}

                    {/* Items Delivered */}
                    <div className="space-y-1.5 pt-2 border-t border-border/50 text-xs">
                      <div className="flex items-center justify-between font-semibold text-foreground">
                        <span className="flex items-center gap-1">
                          <PackageCheck className="w-3.5 h-3.5 text-primary" />
                          الأجهزة والمنتجات ({mc.itemsProvided?.length || 0}):
                        </span>
                        {mc.totalCost > 0 && (
                          <span className="text-primary font-bold">
                            {mc.totalCost.toLocaleString()} ج.م
                          </span>
                        )}
                      </div>

                      {mc.itemsProvided && mc.itemsProvided.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {mc.itemsProvided.map((item, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-background border border-border/80 text-[11px] text-foreground font-medium"
                            >
                              {item.itemName} {item.quantity > 1 ? `(×${item.quantity})` : ""}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          لم يتم تحديد أجهزة بعد
                        </p>
                      )}

                      {mc.cashAssistance && mc.cashAssistance > 0 ? (
                        <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                          + مساعدة مالية: {mc.cashAssistance.toLocaleString()} ج.م
                        </div>
                      ) : null}
                    </div>

                    {/* Certificate & Notes */}
                    {(mc.certificateImage || mc.notes) && (
                      <div className="pt-2 border-t border-border/50 text-xs space-y-1">
                        {mc.certificateImage && (
                          <button
                            type="button"
                            onClick={() => setPreviewMarriageImage(mc.certificateImage || null)}
                            className="text-primary text-[11px] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            <span>معاينة وثيقة الزواج</span>
                          </button>
                        )}
                        {mc.notes && (
                          <p className="text-[11px] text-muted-foreground bg-background/60 p-1.5 rounded-md">
                            {mc.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5 bg-muted/20 border border-border/70 rounded-xl text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {beneficiary.marriageDetails
                  ? `تفاصيل سابقة مسجلة: ${beneficiary.marriageDetails}`
                  : "لم يتم تسجيل أي حالات تيسير زواج بعد لهذا المستفيد."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMarriagePersonName("");
                  setMarriageRelationship("daughter");
                  setMarriageSpouseName("");
                  setMarriagePhone("");
                  setMarriageDate("");
                  setMarriageStatus("pending");
                  setMarriageItems([]);
                  setMarriageCash(0);
                  setMarriageCertImage(beneficiary.marriageCertificateImage || "");
                  setMarriageNotes(beneficiary.marriageDetails || "");
                  setMarriageFormError("");
                  setIsAddMarriageModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>تسجيل وتحديد الأجهزة للحالة الآن</span>
              </button>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-primary" />
            الأبناء
          </h2>
          {children.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">الاسم</th>
                    <th className="px-4 py-3 text-right font-medium">الرقم القومي</th>
                    <th className="px-4 py-3 text-right font-medium">المدرسة</th>
                    <th className="px-4 py-3 text-right font-medium">المرحلة التعليمية</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة الاجتماعية</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة الصحية</th>
                  </tr>
                </thead>
                <tbody>
                  {children.map((child: Child, index: number) => (
                    <tr
                      key={`${child._id || child.nationalId || child.name}-${index}`}
                      className={`${index % 2 === 0 ? "bg-background" : "bg-muted/10"} border-t border-border/60`}
                    >
                      <td className="px-4 py-3 text-foreground font-medium">{child.name || "-"}</td>
                      <td className="px-4 py-3 text-foreground">{child.nationalId || "-"}</td>
                      <td className="px-4 py-3 text-foreground">{child.school || "-"}</td>
                      <td className="px-4 py-3 text-foreground">
                        {child.educationStage
                          ? EDUCATION_STAGE_LABELS[child.educationStage] || child.educationStage
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {child.maritalStatus
                          ? MARITAL_STATUS_LABELS[child.maritalStatus] || child.maritalStatus
                          : "-"}
                      </td>
                          <td className="px-4 py-3 text-foreground">
                            {child.healthStatus === "sick" ? (
                              <div className="flex items-center gap-2">
                                {child.healthCertificationImage ? (
                                  <button
                                    onClick={() => setHealthModalImage(child.healthCertificationImage || null)}
                                    className="text-destructive hover:text-destructive/80 cursor-pointer underline font-medium"
                                  >
                                    مريض
                                  </button>
                                ) : (
                                  <span className="text-destructive">مريض</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-green-600">سليم</span>
                            )}
                          </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد بيانات أبناء مسجلة</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            العلاقات العائلية
          </h2>
          {relationships.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">نوع العلاقة</th>
                    <th className="px-4 py-3 text-right font-medium">الاسم</th>
                    <th className="px-4 py-3 text-right font-medium">الرقم القومي</th>
                    <th className="px-4 py-3 text-right font-medium">مستفيد مرتبط</th>
                  </tr>
                </thead>
                <tbody>
                  {relationships.map((relationship: RelationshipEntry, index: number) => (
                    <tr
                      key={`${relationship.relative?._id || relationship.relativeNationalId || relationship.relativeName}-${index}`}
                      className={`${index % 2 === 0 ? "bg-background" : "bg-muted/10"} border-t border-border/60`}
                    >
                      <td className="px-4 py-3 text-foreground font-medium">
                        {RELATIONSHIP_LABELS[relationship.relation] || relationship.relation}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {relationship.relative?.name || relationship.relativeName}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {relationship.relative?.nationalId || relationship.relativeNationalId || "-"}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {relationship.relative ? (
                          <Link
                            href={`/admin/beneficiaries/${relationship.relative._id}`}
                            className="text-primary hover:underline"
                          >
                            عرض الملف
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">لا توجد علاقات مسجلة لهذا المستفيد</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            المبادرات المستفيد منها
          </h2>
          {initiatives.length > 0 ? (
            <ul className="space-y-3">
              {initiatives.map((initiative: InitiativeSummary) => (
                <li
                  key={initiative._id}
                  className="border border-border/60 rounded-lg p-4 bg-background/80"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">{initiative.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <CalendarCheck className="w-4 h-4" />
                        {formatInitiativeDate(initiative.date)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full ${
                        INITIATIVE_STATUS_STYLES[initiative.status] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {translateInitiativeStatus(initiative.status)}
                    </span>
                  </div>
                  {typeof initiative.totalAmount === "number" && initiative.totalAmount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                      <Wallet className="w-4 h-4" />
                      إجمالي الدعم: {formatCurrency(initiative.totalAmount)} ج.م
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              لم يتم ربط هذا المستفيد بأي مبادرات حتى الآن.
            </p>
          )}
        </div>

        {/* Treasury Transactions Section - Yearly Record */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              سجل المساعدات من الخزنة
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleYearChange('prev')}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                title="السنة السابقة"
                data-html2canvas-ignore="true"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <span className="font-semibold text-foreground min-w-[60px] text-center">
                {transactionYear}
              </span>
              <button
                onClick={() => handleYearChange('next')}
                disabled={selectedYear >= new Date().getFullYear()}
                className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="السنة التالية"
                data-html2canvas-ignore="true"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Total Summary */}
          {totalReceivedThisYear > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Wallet className="w-5 h-5" />
                <span className="font-semibold">
                  إجمالي المساعدات في {transactionYear}: {formatCurrency(totalReceivedThisYear)} ج.م
                </span>
              </div>
            </div>
          )}

          {treasuryTransactions.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                    <th className="px-4 py-3 text-right font-medium">الوصف</th>
                    <th className="px-4 py-3 text-right font-medium">التصنيف</th>
                    <th className="px-4 py-3 text-right font-medium">الحصة</th>
                    <th className="px-4 py-3 text-right font-medium">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {treasuryTransactions.map((tx: TreasuryTransactionSummary, index: number) => (
                    <tr
                      key={`${tx._id}-${index}`}
                      className={`${index % 2 === 0 ? "bg-background" : "bg-muted/10"} border-t border-border/60`}
                    >
                      <td className="px-4 py-3 text-foreground">
                        {new Intl.DateTimeFormat("ar-EG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }).format(new Date(tx.transactionDate))}
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">
                        {tx.description}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                          {TRANSACTION_CATEGORY_LABELS[tx.category] || tx.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(tx.shareAmount)} ج.م
                        </span>
                        {tx.isMonthly ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-medium">
                            شهرية مستحقة
                          </span>
                        ) : (
                          tx.beneficiaryCount > 1 && (
                            <span className="text-xs text-muted-foreground block">
                              (1/{tx.beneficiaryCount})
                            </span>
                          )
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatCurrency(tx.amount)} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              لا توجد مساعدات مسجلة من الخزنة لهذا المستفيد في عام {transactionYear}.
            </p>
          )}
        </div>



        {beneficiary.notes && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <NotebookPen className="w-5 h-5 text-primary" />
              ملاحظات إضافية
            </h2>
            <p className="whitespace-pre-line text-foreground leading-relaxed">
              {beneficiary.notes}
            </p>
          </div>
        )}

        {/* Health Certification Modal */}
        {healthModalImage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto relative">
              <button
                onClick={() => setHealthModalImage(null)}
                title="إغلاق"
                className="absolute top-4 left-4 p-2 hover:bg-muted rounded-lg transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">الشهادة الطبية</h3>
                <CloudinaryImage
                  src={healthModalImage}
                  alt="الشهادة الطبية"
                  width="full"
                  layout="full"
                  crop="limit"
                  quality="auto:good"
                  className="w-full h-auto rounded-lg border border-border"
                />
              </div>
            </div>
          </div>
        )}

        {/* Marriage Certificate Preview Modal */}
        {previewMarriageImage && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewMarriageImage(null)}
          >
            <div
              className="bg-card rounded-xl max-w-2xl w-full max-h-[85vh] overflow-auto relative p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold">وثيقة / قسيمة الزواج</h3>
                <button
                  onClick={() => setPreviewMarriageImage(null)}
                  className="p-1 rounded-lg hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative rounded-lg overflow-hidden border border-border flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewMarriageImage}
                  alt="قسيمة الزواج"
                  className="max-h-[70vh] object-contain"
                />
              </div>
            </div>
          </div>
        )}

        {/* Add Marriage Case Modal */}
        {isAddMarriageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <Heart className="w-5 h-5 fill-rose-500/20" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      تسجيل حالة تيسير زواج للمستفيد ({beneficiary.name})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      تحديد المستلزمات والأجهزة المقدمة وموعد الزفاف
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddMarriageModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {marriageFormError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{marriageFormError}</span>
                </div>
              )}

              <form onSubmit={handleSaveMarriageCase} className="space-y-4">
                {/* Quick Children Select */}
                {children.length > 0 && (
                  <div className="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-2">
                    <span className="text-xs font-semibold text-foreground block">
                      اختيار سريع من أبناء المستفيد المسجلين:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {children.map((child: Child, idx: number) => (
                        <button
                          key={`${child._id || idx}`}
                          type="button"
                          onClick={() => {
                            setMarriagePersonName(child.name || "");
                            setMarriageRelationship(
                              child.gender === "female" ? "daughter" : "son"
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-background border border-border text-xs text-foreground hover:border-primary hover:text-primary transition font-medium cursor-pointer"
                        >
                          {child.name} ({child.gender === "female" ? "ابنة" : "ابن"})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      اسم الشخص المقبل على الزواج <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={marriagePersonName}
                      onChange={(e) => setMarriagePersonName(e.target.value)}
                      placeholder="اسم العريس / العروسة"
                      required
                      className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl text-foreground focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      صلة القرابة
                    </label>
                    <select
                      value={marriageRelationship}
                      onChange={(e) => setMarriageRelationship(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                    >
                      <option value="daughter">ابنة المستفيد</option>
                      <option value="son">ابن المستفيد</option>
                      <option value="self">المستفيد نفسه</option>
                      <option value="other">أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      اسم الطرف الآخر (اختياري)
                    </label>
                    <input
                      type="text"
                      value={marriageSpouseName}
                      onChange={(e) => setMarriageSpouseName(e.target.value)}
                      placeholder="اسم العريس / العروسة"
                      className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl text-foreground focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      موعد الزفاف
                    </label>
                    <input
                      type="date"
                      value={marriageDate}
                      onChange={(e) => setMarriageDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl text-foreground focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      رقم الهاتف
                    </label>
                    <input
                      type="text"
                      value={marriagePhone}
                      onChange={(e) => setMarriagePhone(e.target.value)}
                      placeholder="اختياري"
                      className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl text-foreground focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      حالة المساعدة
                    </label>
                    <select
                      value={marriageStatus}
                      onChange={(e) => setMarriageStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-background border border-input rounded-xl text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer font-semibold"
                    >
                      <option value="pending">في الانتظار والدراسة</option>
                      <option value="in_progress">جاري التجهيز والمساعدة</option>
                      <option value="completed">تمت المساعدة وتجهيز الحالة</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </div>
                </div>

                {/* Items & Goods */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <PackageCheck className="w-3.5 h-3.5 text-primary" />
                      الأجهزة والمستلزمات المقدمة:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMarriageItems((prev) => [
                          ...prev,
                          { itemName: "", quantity: 1, cost: 0, notes: "" },
                        ])
                      }
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      إضافة جهاز مخصص
                    </button>
                  </div>

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-xl border border-border/50">
                    <span className="text-[10px] text-muted-foreground self-center ml-1">إضافة سريعة:</span>
                    {[
                      "غسالة",
                      "ثلاجة",
                      "بوتاجاز",
                      "شاشة تلفزيون",
                      "خلاط وعجان",
                      "مطبخ ألوميتال",
                      "سخان مياه",
                      "مفرش وسجاد",
                      "طقم أواني",
                      "مساعدة مالية",
                    ].map((ci) => (
                      <button
                        key={ci}
                        type="button"
                        onClick={() =>
                          setMarriageItems((prev) => [
                            ...prev,
                            { itemName: ci, quantity: 1, cost: 0, notes: "" },
                          ])
                        }
                        className="px-2 py-0.5 text-xs rounded-md bg-background border border-border text-foreground hover:border-primary hover:text-primary transition font-medium cursor-pointer"
                      >
                        + {ci}
                      </button>
                    ))}
                  </div>

                  {marriageItems.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {marriageItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-muted/20 border border-border rounded-lg grid grid-cols-12 gap-2 items-center text-xs"
                        >
                          <div className="col-span-5">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => {
                                const copy = [...marriageItems];
                                copy[idx] = { ...copy[idx], itemName: e.target.value };
                                setMarriageItems(copy);
                              }}
                              placeholder="اسم الجهاز"
                              required
                              className="w-full px-2 py-1 text-xs bg-background border border-input rounded-md text-foreground"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const copy = [...marriageItems];
                                copy[idx] = { ...copy[idx], quantity: Number(e.target.value) };
                                setMarriageItems(copy);
                              }}
                              title="الكمية"
                              className="w-full px-2 py-1 text-xs bg-background border border-input rounded-md text-foreground text-center"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              min="0"
                              value={item.cost || ""}
                              onChange={(e) => {
                                const copy = [...marriageItems];
                                copy[idx] = { ...copy[idx], cost: Number(e.target.value) };
                                setMarriageItems(copy);
                              }}
                              placeholder="السعر"
                              title="التكلفة ج.م"
                              className="w-full px-2 py-1 text-xs bg-background border border-input rounded-md text-foreground text-center"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="text"
                              value={item.notes || ""}
                              onChange={(e) => {
                                const copy = [...marriageItems];
                                copy[idx] = { ...copy[idx], notes: e.target.value };
                                setMarriageItems(copy);
                              }}
                              placeholder="ملاحظات"
                              className="w-full px-2 py-1 text-xs bg-background border border-input rounded-md text-foreground"
                            />
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setMarriageItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-muted-foreground hover:text-rose-600 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cash assistance & total */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        مساعدة مالية نقدية إضافية
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={marriageCash || ""}
                        onChange={(e) => setMarriageCash(Number(e.target.value))}
                        placeholder="0 ج.م"
                        className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-xl text-foreground outline-none"
                      />
                    </div>

                    <div className="p-2.5 bg-muted/40 rounded-xl border border-border flex items-center justify-between self-end">
                      <span className="text-xs text-muted-foreground font-semibold">إجمالي التكلفة:</span>
                      <span className="text-sm font-extrabold text-primary">
                        {marriageFormTotal.toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>
                </div>

                {/* Certificate & Notes */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <ImageUpload
                    label="صورة وثيقة / قسيمة الزواج (اختياري)"
                    onImageUpload={(url) => setMarriageCertImage(url)}
                    currentImage={marriageCertImage}
                  />

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      ملاحظات إضافية
                    </label>
                    <textarea
                      value={marriageNotes}
                      onChange={(e) => setMarriageNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-xl text-foreground outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsAddMarriageModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-xl transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingMarriage}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingMarriage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    حفظ حالة الزواج
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function translateInitiativeStatus(status?: string) {
  if (!status) return "غير محدد";
  return INITIATIVE_STATUS_LABELS[status] || "غير محدد";
}

function formatInitiativeDate(value?: string) {
  if (!value) return "غير محدد";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 0,
  }).format(value);
}
