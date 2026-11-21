"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import ImageUpload from "@/components/ImageUpload";
import SearchableSelect from "@/components/SearchableSelect";
import {
  ASSISTANCE_CATEGORIES,
  ASSISTANCE_CATEGORY_LABELS,
  type AssistanceCategory,
  MARITAL_STATUS_LABELS,
  MARITAL_STATUS_VALUES,
} from "@/lib/assistance/types";

interface BranchOption {
  _id: string;
  name: string;
  code?: string;
}

interface FieldErrors {
  fullName?: string;
  nationalId?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  assistanceCategory?: string;
  description?: string;
  familyMembersCount?: string;
  monthlyIncome?: string;
  branchId?: string;
}

const FULL_NAME_REGEX =
  /^(?:[\u0600-\u06FFa-zA-Z]{2,})(?:[\s'-][\u0600-\u06FFa-zA-Z]+)+$/;
const NATIONAL_ID_REGEX = /^\d{14}$/;
const PHONE_REGEX = /^\+?\d{10,13}$/;

const ASSISTANCE_CATEGORY_OPTIONS = ASSISTANCE_CATEGORIES.map((value) => ({
  value,
  label: ASSISTANCE_CATEGORY_LABELS[value],
}));

function normalizeDigits(input: string): string {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const easternArabic = "۰۱۲۳۴۵۶۷۸۹";
  return input
    .replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(easternArabic.indexOf(d)))
    .replace(/\s+/g, "");
}

export default function AssistanceRequestFormPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [profileBranchName, setProfileBranchName] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [branchId, setBranchId] = useState("");
  const [assistanceCategory, setAssistanceCategory] =
    useState<AssistanceCategory>("financial_aid");
  const [customCategory, setCustomCategory] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [familyMembersCount, setFamilyMembersCount] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionConfirmation, setSubmissionConfirmation] = useState<{
    message: string;
    submittedAt: string;
  } | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const cloudinaryEnabled = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace("/sign-in");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    let active = true;
    fetch("/api/assistance-requests")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const list: BranchOption[] = Array.isArray(data.branches)
          ? data.branches
          : [];
        setBranches(list);
        if (typeof data.userBranchId === "string" && data.userBranchId) {
          setBranchId(data.userBranchId);
          setProfileBranchName(
            typeof data.userBranchName === "string" ? data.userBranchName : null
          );
        } else {
          setBranchId("");
          setProfileBranchName(null);
        }
      })
      .catch(() => {
        // Branch selector degrades gracefully when metadata fetch fails
      })
      .finally(() => {
        if (active) setMetadataLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [isLoaded, user]);

  const handleCategoryChange = (value: string, customValue?: string) => {
    setAssistanceCategory(value as AssistanceCategory);
    setCustomCategory(value === "other" && customValue ? customValue : "");
  };

  const validateClient = (): FieldErrors => {
    const errors: FieldErrors = {};
    const cleanName = fullName.trim().replace(/\s+/g, " ");
    const cleanNid = nationalId.trim();
    const cleanPhone = phone.trim();
    const cleanWa = sameAsPhone ? cleanPhone : whatsapp.trim();
    const cleanAddr = address.trim();
    const cleanDesc = description.trim();

    if (cleanName.length < 3 || !FULL_NAME_REGEX.test(cleanName)) {
      errors.fullName = "يرجى إدخال الاسم الكامل ثنائياً على الأقل بأحرف صحيحة";
    }
    if (!NATIONAL_ID_REGEX.test(cleanNid)) {
      errors.nationalId = "الرقم القومي يجب أن يتكون من 14 رقماً بالضبط";
    }
    if (!PHONE_REGEX.test(cleanPhone)) {
      errors.phone = "يرجى إدخال رقم موبايل صحيح (من 10 إلى 13 رقماً)";
    }
    if (!sameAsPhone && cleanWa && !PHONE_REGEX.test(cleanWa)) {
      errors.whatsapp = "رقم الواتساب يجب أن يكون من 10 إلى 13 رقماً";
    }
    if (cleanAddr.length < 5) {
      errors.address = "يرجى إدخال العنوان بالتفصيل (5 أحرف على الأقل)";
    }
    if (!branchId) {
      errors.branchId = "يرجى تحديد الفرع التابع له قبل إرسال الطلب";
    }
    if (!assistanceCategory) {
      errors.assistanceCategory = "يرجى اختيار أو كتابة نوع المساعدة المطلوبة";
    } else if (
      assistanceCategory === "other" &&
      customCategory.trim() &&
      customCategory.trim().length < 2
    ) {
      errors.assistanceCategory = "نوع المساعدة المكتوب قصير جداً";
    }
    if (cleanDesc.length < 10) {
      errors.description = "يرجى كتابة شرح للحالة والاحتياج (10 أحرف على الأقل)";
    }
    if (familyMembersCount) {
      const n = Number(familyMembersCount);
      if (!Number.isInteger(n) || n < 1 || n > 30) {
        errors.familyMembersCount = "عدد أفراد الأسرة يجب أن يكون بين 1 و 30";
      }
    }
    if (monthlyIncome) {
      const m = Number(monthlyIncome);
      if (!Number.isFinite(m) || m < 0) {
        errors.monthlyIncome = "قيمة الدخل الشهري يجب أن تكون رقماً موجباً";
      }
    }

    return errors;
  };

  const handleResetForNewRequest = () => {
    setSubmissionConfirmation(null);
    setFullName("");
    setNationalId("");
    setPhone("");
    setWhatsapp("");
    setSameAsPhone(true);
    setAddress("");
    setAssistanceCategory("financial_aid");
    setCustomCategory("");
    setMaritalStatus("");
    setFamilyMembersCount("");
    setMonthlyIncome("");
    setDescription("");
    setAttachments([]);
    setFieldErrors({});
    setSubmitError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    const errors = validateClient();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/assistance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim().replace(/\s+/g, " "),
          nationalId: nationalId.trim(),
          phone: phone.trim(),
          whatsapp: sameAsPhone
            ? phone.trim()
            : whatsapp.trim() || undefined,
          address: address.trim(),
          branchId: branchId || undefined,
          assistanceCategory,
          assistanceCategoryCustom:
            assistanceCategory === "other" && customCategory.trim()
              ? customCategory.trim()
              : undefined,
          maritalStatus: maritalStatus || undefined,
          familyMembersCount: familyMembersCount
            ? Number(familyMembersCount)
            : undefined,
          monthlyIncome: monthlyIncome ? Number(monthlyIncome) : undefined,
          description: description.trim(),
          attachments,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.field && typeof data.field === "string") {
          setFieldErrors((prev) => ({
            ...prev,
            [data.field]: data.error || "بيانات غير صالحة",
          }));
        }
        setSubmitError(
          data.error || "تعذر إرسال الطلب، يرجى مراجعة البيانات والمحاولة مرة أخرى"
        );
        requestAnimationFrame(() => errorSummaryRef.current?.focus());
        return;
      }

      const chosenBranch = branches.find((b) => b._id === branchId);
      if (chosenBranch) {
        setProfileBranchName(chosenBranch.name);
      }

      setSubmissionConfirmation({
        message:
          typeof data.message === "string"
            ? data.message
            : "تم استلام طلب المساعدة بنجاح. ستقوم إدارة الجمعية بمراجعة الطلب والتواصل معكم عند الحاجة.",
        submittedAt:
          typeof data.submittedAt === "string"
            ? data.submittedAt
            : new Date().toISOString(),
      });
    } catch {
      setSubmitError("تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى");
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded || !user) {
    return <BrandedLoader fullScreen />;
  }

  if (submissionConfirmation) {
    return (
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto">
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 sm:p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                تم استلام طلب المساعدة بنجاح
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {submissionConfirmation.message}
              </p>
            </div>

            <div className="rounded-xl bg-muted/40 border border-border p-4 text-sm text-muted-foreground space-y-1">
              <p>
                تاريخ ووقت التسجيل:{" "}
                <span className="font-medium text-foreground">
                  {new Intl.DateTimeFormat("ar-EG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(submissionConfirmation.submittedAt))}
                </span>
              </p>
              <p className="text-xs">
                يتم التعامل مع جميع البيانات والمستندات بسرية تامة داخل إدارة جمعية دعوة الحق.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetForNewRequest}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                تقديم طلب آخر
              </button>
              <Link
                href="/"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-input bg-background text-foreground hover:bg-muted font-medium transition-colors"
              >
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
                العودة للرئيسية
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const errorList = Object.values(fieldErrors).filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-background py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
            العودة للرئيسية
          </Link>

          <div className="flex items-start gap-3 pt-2">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              <FileText className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                استبيان طلب مساعدة
              </h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                يرجى ملء البيانات التالية بدقة ليتمكن فريق البحث الاجتماعي بالجمعية من دراسة الطلب والتواصل معكم.
              </p>
            </div>
          </div>
        </div>

        {(submitError || errorList.length > 0) && (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive space-y-2 focus:outline-none focus:ring-2 focus:ring-destructive"
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>{submitError || "يرجى تصحيح الأخطاء التالية قبل إرسال الطلب:"}</span>
            </div>
            {errorList.length > 0 && (
              <ul className="list-disc list-inside text-xs sm:text-sm space-y-1 pr-1">
                {errorList.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-card border border-border rounded-2xl shadow-sm p-5 sm:p-8 space-y-6"
        >
          {/* Branch Routing Section (strict per-branch isolation) */}
          <div
            className={`rounded-xl border p-4 space-y-3 ${
              fieldErrors.branchId
                ? "border-destructive/60 bg-destructive/5"
                : !profileBranchName && metadataLoaded
                ? "border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/20"
                : "border-primary/25 bg-primary/5"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Building2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                <span>الفرع الموجّه إليه الطلب <span className="text-destructive">*</span></span>
              </div>
              <Link
                href="/profile"
                className="text-xs font-medium text-primary hover:underline"
              >
                {profileBranchName ? "تعديل الفرع من الملف الشخصي" : "تحديد الفرع في الملف الشخصي"}
              </Link>
            </div>

            {profileBranchName ? (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                سيتم إرسال هذا الطلب مباشرة إلى إدارة فرع:{" "}
                <strong className="text-foreground">
                  {branches.find((b) => b._id === branchId)?.name || profileBranchName}
                </strong>
                . يمكنك تغييره مؤقتاً من القائمة أدناه أو من ملفك الشخصي.
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                لم يتم تحديد فرعك في الملف الشخصي بعد — يرجى اختيار الفرع القريب منك ليصل طلبك إلى مسؤول هذا الفرع فقط (وسيتم حفظه في ملفك الشخصي تلقائياً).
              </p>
            )}

            <div>
              <select
                id="f-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={!metadataLoaded}
                aria-invalid={Boolean(fieldErrors.branchId)}
                aria-describedby={fieldErrors.branchId ? "err-branchId" : undefined}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- اختر الفرع التابع له --</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              {fieldErrors.branchId && (
                <p id="err-branchId" className="mt-1 text-xs text-destructive">
                  {fieldErrors.branchId}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div className="sm:col-span-2">
              <label
                htmlFor="req-full-name"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                الاسم الكامل لمقدم الطلب <span className="text-destructive">*</span>
              </label>
              <input
                id="req-full-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={Boolean(fieldErrors.fullName)}
                aria-describedby={fieldErrors.fullName ? "err-fullName" : undefined}
                placeholder="مثال: محمد أحمد علي حسن"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              {fieldErrors.fullName && (
                <p id="err-fullName" className="mt-1 text-xs text-destructive">
                  {fieldErrors.fullName}
                </p>
              )}
            </div>

            {/* National ID - string preserving leading zeros */}
            <div>
              <label
                htmlFor="req-national-id"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                الرقم القومي (14 رقماً) <span className="text-destructive">*</span>
              </label>
              <input
                id="req-national-id"
                type="text"
                inputMode="numeric"
                maxLength={14}
                dir="ltr"
                value={nationalId}
                onChange={(e) => setNationalId(normalizeDigits(e.target.value))}
                aria-invalid={Boolean(fieldErrors.nationalId)}
                aria-describedby="hint-nationalId err-nationalId"
                placeholder="29001011100123"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-left font-mono tracking-wider placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p id="hint-nationalId" className="mt-1 text-xs text-muted-foreground">
                أدخل الـ 14 رقماً بالكامل كما في البطاقة (بما في ذلك الصفر إن وُجد).
              </p>
              {fieldErrors.nationalId && (
                <p id="err-nationalId" className="mt-1 text-xs text-destructive">
                  {fieldErrors.nationalId}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="req-phone"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                رقم الموبايل <span className="text-destructive">*</span>
              </label>
              <input
                id="req-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(normalizeDigits(e.target.value))}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? "err-phone" : undefined}
                placeholder="01012345678"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-left font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              {fieldErrors.phone && (
                <p id="err-phone" className="mt-1 text-xs text-destructive">
                  {fieldErrors.phone}
                </p>
              )}
            </div>

            {/* WhatsApp */}
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="req-same-wa"
                  type="checkbox"
                  checked={sameAsPhone}
                  onChange={(e) => setSameAsPhone(e.target.checked)}
                  className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
                />
                <label
                  htmlFor="req-same-wa"
                  className="text-sm text-foreground cursor-pointer"
                >
                  رقم الواتساب هو نفس رقم الموبايل
                </label>
              </div>

              {!sameAsPhone && (
                <div>
                  <label
                    htmlFor="req-whatsapp"
                    className="block text-sm font-medium text-foreground mb-1.5"
                  >
                    رقم الواتساب (اختياري)
                  </label>
                  <input
                    id="req-whatsapp"
                    type="tel"
                    inputMode="numeric"
                    dir="ltr"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(normalizeDigits(e.target.value))}
                    aria-invalid={Boolean(fieldErrors.whatsapp)}
                    aria-describedby={fieldErrors.whatsapp ? "err-whatsapp" : undefined}
                    placeholder="01012345678"
                    className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-left font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {fieldErrors.whatsapp && (
                    <p id="err-whatsapp" className="mt-1 text-xs text-destructive">
                      {fieldErrors.whatsapp}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label
                htmlFor="req-address"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                العنوان بالتفصيل <span className="text-destructive">*</span>
              </label>
              <input
                id="req-address"
                type="text"
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                aria-invalid={Boolean(fieldErrors.address)}
                aria-describedby={fieldErrors.address ? "err-address" : undefined}
                placeholder="المركز / القرية / الشارع / علامة مميزة"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              {fieldErrors.address && (
                <p id="err-address" className="mt-1 text-xs text-destructive">
                  {fieldErrors.address}
                </p>
              )}
            </div>

            {/* Assistance Category */}
            <div>
              <label
                htmlFor="req-category"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                نوع المساعدة المطلوبة <span className="text-destructive">*</span>
              </label>
              <SearchableSelect
                id="req-category"
                options={ASSISTANCE_CATEGORY_OPTIONS}
                value={assistanceCategory}
                customValue={customCategory}
                onChange={handleCategoryChange}
                placeholder="اختر نوع المساعدة أو اكتب نوعاً جديداً"
                searchPlaceholder="ابحث أو اكتب نوعاً جديداً..."
                allowCustom
                createLabel={(query) => `إضافة نوع جديد: ${query}`}
                required
                invalid={Boolean(fieldErrors.assistanceCategory)}
                describedBy={
                  fieldErrors.assistanceCategory ? "err-category" : undefined
                }
              />
              {fieldErrors.assistanceCategory && (
                <p id="err-category" className="mt-1 text-xs text-destructive">
                  {fieldErrors.assistanceCategory}
                </p>
              )}
            </div>

            {/* Marital Status */}
            <div>
              <label
                htmlFor="req-marital"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                الحالة الاجتماعية (اختياري)
              </label>
              <select
                id="req-marital"
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— اختر —</option>
                {MARITAL_STATUS_VALUES.map((ms) => (
                  <option key={ms} value={ms}>
                    {MARITAL_STATUS_LABELS[ms]}
                  </option>
                ))}
              </select>
            </div>

            {/* Family Members */}
            <div>
              <label
                htmlFor="req-family-count"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                عدد أفراد الأسرة (اختياري)
              </label>
              <input
                id="req-family-count"
                type="number"
                min={1}
                max={30}
                value={familyMembersCount}
                onChange={(e) => setFamilyMembersCount(e.target.value)}
                aria-invalid={Boolean(fieldErrors.familyMembersCount)}
                placeholder="مثال: 4"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {fieldErrors.familyMembersCount && (
                <p className="mt-1 text-xs text-destructive">
                  {fieldErrors.familyMembersCount}
                </p>
              )}
            </div>

            {/* Monthly Income */}
            <div>
              <label
                htmlFor="req-income"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                الدخل الشهري التقريبي بالجنيه (اختياري)
              </label>
              <input
                id="req-income"
                type="number"
                min={0}
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                aria-invalid={Boolean(fieldErrors.monthlyIncome)}
                placeholder="0"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {fieldErrors.monthlyIncome && (
                <p className="mt-1 text-xs text-destructive">
                  {fieldErrors.monthlyIncome}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label
                htmlFor="req-description"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                تفاصيل الحالة وشرح الاحتياج <span className="text-destructive">*</span>
              </label>
              <textarea
                id="req-description"
                rows={4}
                maxLength={3000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby="hint-description err-description"
                placeholder="اشرح ظروف الأسرة والاحتياج المطلوب بوضوح..."
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                required
              />
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span id="hint-description">الحد الأدنى 10 أحرف.</span>
                <span>{description.length} / 3000</span>
              </div>
              {fieldErrors.description && (
                <p id="err-description" className="mt-1 text-xs text-destructive">
                  {fieldErrors.description}
                </p>
              )}
            </div>
          </div>

          {/* Optional Attachments when Cloudinary is configured */}
          {cloudinaryEnabled && (
            <div className="border-t border-border pt-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Paperclip className="w-4 h-4 text-primary" aria-hidden="true" />
                <span>مستندات أو صور داعمة (اختياري — بحد أقصى 3 ملفات)</span>
              </div>

              {attachments.length > 0 && (
                <ul className="space-y-2">
                  {attachments.map((url, idx) => (
                    <li
                      key={url + idx}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-muted/40 border border-border text-xs"
                    >
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        مستند داعم #{idx + 1}
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="inline-flex items-center gap-1 text-destructive hover:text-destructive/80 px-2 py-1 rounded"
                        aria-label={`حذف المرفق ${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {attachments.length < 3 && (
                <ImageUpload
                  label="إرفاق صورة مستند أو تقرير طبي"
                  onImageUpload={(url) => {
                    if (url) {
                      setAttachments((prev) =>
                        prev.length < 3 ? [...prev, url] : prev
                      );
                    }
                  }}
                />
              )}
            </div>
          )}

          {/* Privacy Note */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              تخضع كافة المعلومات والرقم القومي والمستندات المقدمة في هذا الاستبيان للسرية التامة وتُراجع حصراً من قِبل الإدارة المختصة بجمعية دعوة الحق.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 font-semibold transition-colors shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                جاري إرسال الطلب...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" aria-hidden="true" />
                إرسال طلب المساعدة
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
