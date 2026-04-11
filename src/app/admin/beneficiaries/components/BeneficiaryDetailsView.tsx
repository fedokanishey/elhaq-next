"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import CloudinaryImage from "@/components/CloudinaryImage";

interface Child {
  _id?: string;
  name?: string;
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
}

interface TreasuryTransactionSummary {
  _id: string;
  amount: number;
  description: string;
  category: string;
  transactionDate: string;
  beneficiaryCount: number;
  shareAmount: number;
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
  planned: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
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
  const initiatives = data?.initiatives || [];
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

  // Handle year change for treasury transactions
  const handleYearChange = (direction: 'prev' | 'next') => {
    setSelectedYear(prev => direction === 'prev' ? prev - 1 : prev + 1);
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
    <div className={isModal ? "bg-background transition-colors" : "min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors"}>
      <div className={isModal ? "space-y-6" : "max-w-5xl mx-auto space-y-8"}>
        {!isModal && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                href="/admin/beneficiaries"
                className="text-muted-foreground hover:text-primary inline-flex items-center gap-2"
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
            <div className="flex flex-col sm:flex-row gap-3">
              {isAdmin && (
                <Link
                  href={`/admin/beneficiaries/${beneficiary._id}/edit`}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md"
                >
                  تعديل مستفيد
                </Link>
              )}
              <Link
                href={`tel:${beneficiary.whatsapp}`}
                className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-border text-foreground hover:bg-muted"
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
             <div className="flex gap-2">
                 {isAdmin && onEdit && (
                   <button
                     onClick={onEdit}
                     className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
                   >
                     تعديل
                   </button>
                 )}
                 <Link
                    href={`tel:${beneficiary.whatsapp}`}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted"
                 >
                    ☎️ اتصال
                 </Link>
             </div>
          </div>
        )}

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
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
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
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-sm">
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
                <dd className="mt-1 flex items-center gap-2 text-foreground">
                  <NotebookPen className="w-4 h-4" />
                  {beneficiary.listName || "الكشف العام"}
                </dd>
              </div>
              {beneficiary.receivesMonthlyAllowance && (
                <div>
                  <dt className="text-sm text-muted-foreground">يتقاضى شهرية</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-sm">
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

        {beneficiary.acceptsMarriage && beneficiary.marriageDetails && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              💍 تفاصيل مستلزمات الزواج
            </h2>
            <p className="text-foreground whitespace-pre-wrap">{beneficiary.marriageDetails}</p>
          </div>
        )}

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
                      key={child._id || `${child.name}-${child.nationalId}`}
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
                      key={
                        relationship.relative?._id || relationship.relativeNationalId || `${relationship.relativeName}-${index}`
                      }
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
                      key={tx._id}
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
                        {tx.beneficiaryCount > 1 && (
                          <span className="text-xs text-muted-foreground block">
                            (1/{tx.beneficiaryCount})
                          </span>
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
