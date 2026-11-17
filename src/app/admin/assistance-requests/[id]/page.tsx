"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  History,
  Info,
  Loader2,
  Lock,
  MapPin,
  MessageSquarePlus,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import {
  ASSISTANCE_CATEGORY_LABELS,
  type AssistanceCategory,
  MARITAL_STATUS_LABELS,
  type ApplicantMaritalStatus,
  type ApplicantRelationshipType,
  RELATIONSHIP_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  type RequestStatus,
  VERIFICATION_STATUS_LABELS,
  type VerificationStatus,
  VERIFICATION_WARNING_LABELS,
  type VerificationWarningCode,
  type MatchedPersonInfo,
  type CandidateMatchSummary,
  type BeneficiarySnapshot,
} from "@/lib/assistance/types";
import type {
  AssistanceHistoryReport,
  HistoryEntry,
} from "@/lib/assistance/history";

interface AdminNoteItem {
  _id?: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface StatusHistoryItem {
  _id?: string;
  previousStatus: RequestStatus | null;
  newStatus: RequestStatus;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  note?: string;
}

interface ManualResolutionItem {
  resolvedBy: string;
  resolvedByName: string;
  resolvedAt: string;
  decisionNote: string;
  chosenBeneficiaryId?: string | null;
  chosenVerificationStatus: VerificationStatus;
  chosenRelationshipType: ApplicantRelationshipType;
}

interface AssistanceRequestDetail {
  _id: string;
  fullName: string;
  nationalIdMasked: string;
  phone: string;
  whatsapp?: string;
  address: string;
  familyMembersCount?: number;
  maritalStatus?: ApplicantMaritalStatus;
  monthlyIncome?: number;
  assistanceCategory: AssistanceCategory;
  description: string;
  attachments: string[];
  verificationStatus: VerificationStatus;
  relationshipType: ApplicantRelationshipType;
  beneficiary?: string | null;
  beneficiarySnapshot?: BeneficiarySnapshot | null;
  matchedPerson?: MatchedPersonInfo | null;
  verificationWarnings: VerificationWarningCode[];
  candidateMatches: CandidateMatchSummary[];
  verifiedAt?: string;
  manualResolution?: ManualResolutionItem | null;
  status: RequestStatus;
  assignedReviewerId?: string | null;
  assignedReviewerName?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  adminNotes: AdminNoteItem[];
  statusHistory: StatusHistoryItem[];
  branch?: string | null;
  branchName?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface SanitizedFamilyContext {
  _id: string;
  internalId?: string;
  name: string;
  nationalIdMasked: string;
  phone?: string;
  maritalStatus?: string;
  status: string;
  category?: string;
  familyMembers: number;
  housingType?: string;
  receivesMonthlyAllowance: boolean;
  monthlyAllowanceAmount?: number;
  branchName?: string;
  spouse: {
    name: string;
    nationalIdMasked: string;
    hasNationalId: boolean;
    phone?: string;
  } | null;
  children: Array<{
    subId: string;
    name: string;
    gender?: string;
    maritalStatus?: string;
    educationStage?: string;
    nationalIdMasked: string;
    hasNationalId: boolean;
    spouse: {
      name?: string;
      nationalIdMasked: string;
      hasNationalId: boolean;
    } | null;
  }>;
  relationshipsCount: number;
}

interface AuditLogItem {
  _id: string;
  action: string;
  actorId: string;
  actorName: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

interface ReviewerOption {
  clerkId: string;
  name: string;
  role: string;
}

interface DetailApiResponse {
  request: AssistanceRequestDetail;
  familyContext: SanitizedFamilyContext | null;
  assistanceHistory: AssistanceHistoryReport;
  auditLogs: AuditLogItem[];
  reviewers: ReviewerOption[];
}

const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  under_review:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  reviewed:
    "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
  approved:
    "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  rejected:
    "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  completed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
};

const VERIFICATION_BANNER_STYLES: Record<VerificationStatus, string> = {
  matched_primary_beneficiary:
    "border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/25",
  matched_spouse:
    "border-sky-300 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/25",
  matched_child:
    "border-indigo-300 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/25",
  matched_other_dependent:
    "border-violet-300 dark:border-violet-800 bg-violet-50/70 dark:bg-violet-950/25",
  not_matched: "border-border bg-muted/40",
  manual_review:
    "border-amber-400 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/30",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  status_changed: "تغيير حالة الطلب",
  note_added: "إضافة ملاحظة داخلية",
  national_id_revealed: "كشف الرقم القومي الكامل",
  manual_verification_resolved: "حسم التحقق يدوياً",
  verification_rerun: "إعادة تشغيل محرك التحقق",
  reviewer_assigned: "تعيين مراجع للطلب",
};

const SPECIFIC_RELATION_LABELS: Record<string, string> = {
  primary_beneficiary: "المستفيد الأساسي",
  spouse: "الزوج / الزوجة",
  son: "ابن",
  daughter: "ابنة",
  child: "ابن / ابنة",
  child_spouse: "زوج/زوجة ابن المستفيد",
  father: "الأب",
  mother: "الأم",
  brother: "الأخ",
  sister: "الأخت",
  grandfather: "الجد",
  grandmother: "الجدة",
  other: "قريب مسجل بالملف",
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function HistoryEntryCard({ entry }: { entry: HistoryEntry }) {
  const isFamily = entry.scope === "family_level";
  return (
    <div className="p-3.5 rounded-xl border border-border bg-background/70 space-y-1.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="font-semibold text-sm text-foreground">{entry.title}</div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
            isFamily
              ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          }`}
        >
          {entry.scopeLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{formatDateTime(entry.date)}</span>
        {entry.category && <span>التصنيف: {entry.category}</span>}
        {typeof entry.amount === "number" && (
          <span className="font-semibold text-foreground">
            المبلغ: {entry.amount.toLocaleString("ar-EG")} ج.م
          </span>
        )}
        {entry.status && <span>الحالة: {entry.status}</span>}
      </div>
      {entry.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {entry.description}
        </p>
      )}
      {entry.recipientNote && (
        <p className="text-xs text-primary/90 font-medium">{entry.recipientNote}</p>
      )}
    </div>
  );
}

export default function AdminAssistanceRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const effectiveRole = (user?.publicMetadata?.role ||
    user?.unsafeMetadata?.role ||
    "user") as string;
  const isSuperAdmin = effectiveRole === "superadmin";
  const isAdmin = effectiveRole === "admin" || isSuperAdmin;
  const isMember = effectiveRole === "member";
  const canView = isAdmin || isMember;
  const canManage = isAdmin;

  const [data, setData] = useState<DetailApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Revealed National IDs (held strictly in transient client state, toggled on demand)
  const [revealedIds, setRevealedIds] = useState<{
    applicant?: string;
    matched_person?: string;
    primary_beneficiary?: string;
  }>({});
  const [revealingTarget, setRevealingTarget] = useState<string | null>(null);

  // Workflow states
  const [statusModalTarget, setStatusModalTarget] = useState<RequestStatus | null>(
    null
  );
  const [statusNote, setStatusNote] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [savingReviewer, setSavingReviewer] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Verification / Manual Review states
  const [rerunningVerification, setRerunningVerification] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualVerifStatus, setManualVerifStatus] = useState<
    Exclude<VerificationStatus, "manual_review">
  >("matched_primary_beneficiary");
  const [manualRelType, setManualRelType] =
    useState<ApplicantRelationshipType>("primary_beneficiary");
  const [manualBeneficiaryId, setManualBeneficiaryId] = useState("");
  const [manualBeneficiaryLabel, setManualBeneficiaryLabel] = useState("");
  const [manualMatchedPersonName, setManualMatchedPersonName] = useState("");
  const [manualDecisionNote, setManualDecisionNote] = useState("");
  const [confirmManualOpen, setConfirmManualOpen] = useState(false);
  const [savingManual, setSavingManual] = useState(false);

  // Beneficiary lookup for manual linking
  const [benSearchTerm, setBenSearchTerm] = useState("");
  const [benSearchResults, setBenSearchResults] = useState<
    Array<{ _id: string; name: string; internalId?: string; nationalId?: string }>
  >([]);
  const [benSearching, setBenSearching] = useState(false);

  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState(false);

  useEffect(() => {
    if (isLoaded && !canView) {
      router.replace("/");
    }
  }, [isLoaded, canView, router]);

  const loadDetail = useCallback(async () => {
    if (!isLoaded || !canView || !id) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/assistance-requests/${id}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error || "تعذر تحميل تفاصيل الطلب");
      }
      const typed = json as DetailApiResponse;
      setData(typed);
      setSelectedReviewerId(typed.request.assignedReviewerId || "");
      setShowManualForm(isAdmin && typed.request.verificationStatus === "manual_review");
      if (typed.request.beneficiary && typed.request.beneficiarySnapshot) {
        setManualBeneficiaryId(String(typed.request.beneficiary));
        setManualBeneficiaryLabel(typed.request.beneficiarySnapshot.name);
      }
      if (typed.request.matchedPerson?.name) {
        setManualMatchedPersonName(typed.request.matchedPerson.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, canView, isAdmin, id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleToggleReveal = async (
    target: "applicant" | "matched_person" | "primary_beneficiary"
  ) => {
    if (revealedIds[target]) {
      setRevealedIds((prev) => {
        const next = { ...prev };
        delete next[target];
        return next;
      });
      return;
    }

    setRevealingTarget(target);
    try {
      const res = await fetch(
        `/api/admin/assistance-requests/${id}/reveal-national-id`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "تعذر كشف الرقم القومي");
      }
      setRevealedIds((prev) => ({ ...prev, [target]: json.nationalId }));
      toast.success("تم إظهار الرقم القومي وتسجيل العملية في سجل المراجعة الأمنية");
      void loadDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setRevealingTarget(null);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusModalTarget || !data) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/assistance-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusModalTarget,
          statusNote: statusNote.trim() || undefined,
          expectedVersion: data.request.version,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "تعذر تحديث حالة الطلب");
      }
      toast.success(`تم تحديث الحالة إلى: ${REQUEST_STATUS_LABELS[statusModalTarget]}`);
      setStatusModalTarget(null);
      setStatusNote("");
      await loadDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تحديث الحالة");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveReviewer = async () => {
    if (!data) return;
    setSavingReviewer(true);
    const chosen = data.reviewers.find((r) => r.clerkId === selectedReviewerId);
    try {
      const res = await fetch(`/api/admin/assistance-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedReviewerId: selectedReviewerId || null,
          assignedReviewerName: chosen ? chosen.name : null,
          expectedVersion: data.request.version,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "تعذر تعيين المراجع");
      }
      toast.success("تم تحديث المراجع المعيّن بنجاح");
      await loadDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تعيين المراجع");
    } finally {
      setSavingReviewer(false);
    }
  };

  const handleDeleteRequest = async () => {
    setDeletingRequest(true);
    try {
      const res = await fetch(`/api/admin/assistance-requests/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "تعذر حذف طلب المساعدة");
      }
      toast.success("تم حذف طلب المساعدة نهائياً");
      router.push("/admin/assistance-requests");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل حذف الطلب");
    } finally {
      setDeletingRequest(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/admin/assistance-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newNote: newNote.trim(),
          expectedVersion: data.request.version,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "تعذر حفظ الملاحظة");
      }
      setNewNote("");
      toast.success("تمت إضافة الملاحظة الداخلية");
      await loadDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل حفظ الملاحظة");
    } finally {
      setSavingNote(false);
    }
  };

  const handleRerunVerification = async () => {
    if (!data) return;
    setRerunningVerification(true);
    try {
      const res = await fetch(
        `/api/admin/assistance-requests/${id}/resolve-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "rerun",
            expectedVersion: data.request.version,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "تعذر إعادة التحقق");
      }
      toast.success("تمت إعادة الفحص والتطابق بنجاح");
      setRevealedIds({});
      await loadDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل إعادة الفحص");
    } finally {
      setRerunningVerification(false);
    }
  };

  const handleSearchBeneficiaries = async (term: string) => {
    setBenSearchTerm(term);
    if (term.trim().length < 2) {
      setBenSearchResults([]);
      return;
    }
    setBenSearching(true);
    try {
      const branchQuery = data?.request.branch
        ? `&branchId=${encodeURIComponent(data.request.branch)}`
        : "";
      const res = await fetch(
        `/api/beneficiaries/search?q=${encodeURIComponent(term.trim())}${branchQuery}`
      );
      if (res.ok) {
        const json = await res.json();
        setBenSearchResults(Array.isArray(json.beneficiaries) ? json.beneficiaries : []);
      }
    } catch {
      setBenSearchResults([]);
    } finally {
      setBenSearching(false);
    }
  };

  const handlePickCandidate = (c: CandidateMatchSummary) => {
    setManualVerifStatus(c.verificationType);
    setManualRelType(c.relationshipType);
    setManualBeneficiaryId(c.beneficiaryId);
    setManualBeneficiaryLabel(
      `${c.beneficiaryName}${c.beneficiaryInternalId ? ` (#${c.beneficiaryInternalId})` : ""}`
    );
    setManualMatchedPersonName(c.matchedPerson.name || c.beneficiaryName);
  };

  const handleSubmitManualResolution = async () => {
    if (!data) return;
    if (manualDecisionNote.trim().length < 3) {
      toast.error("يرجى إدخال سبب القرار اليدوي");
      return;
    }
    if (manualVerifStatus !== "not_matched" && !manualBeneficiaryId) {
      toast.error("يرجى اختيار ملف المستفيد المرتبط");
      return;
    }

    setSavingManual(true);
    try {
      const res = await fetch(
        `/api/admin/assistance-requests/${id}/resolve-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "manual",
            chosenVerificationStatus: manualVerifStatus,
            chosenRelationshipType:
              manualVerifStatus === "not_matched" ? "unknown" : manualRelType,
            chosenBeneficiaryId:
              manualVerifStatus === "not_matched" ? null : manualBeneficiaryId,
            matchedPersonName: manualMatchedPersonName.trim() || undefined,
            decisionNote: manualDecisionNote.trim(),
            expectedVersion: data.request.version,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "تعذر حفظ القرار اليدوي");
      }
      toast.success("تم حسم حالة التحقق بنجاح");
      setConfirmManualOpen(false);
      setManualDecisionNote("");
      setRevealedIds({});
      await loadDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل حفظ القرار");
    } finally {
      setSavingManual(false);
    }
  };

  if (!isLoaded || (loading && !data)) {
    return <BrandedLoader fullScreen />;
  }

  if (!canView) {
    return null;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto bg-card border border-destructive/40 rounded-xl p-6 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" aria-hidden="true" />
          <h1 className="text-lg font-bold text-foreground">
            {error || "تعذر عرض الطلب"}
          </h1>
          <Link
            href="/admin/assistance-requests"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
            العودة لقائمة الطلبات
          </Link>
        </div>
      </div>
    );
  }

  const { request: req, familyContext, assistanceHistory, auditLogs, reviewers } =
    data;
  const isFamilyMemberRelation =
    req.relationshipType === "beneficiary_spouse" ||
    req.relationshipType === "beneficiary_child" ||
    req.relationshipType === "other_dependent";

  const maskOrPlaintext = (
    target: "applicant" | "matched_person" | "primary_beneficiary",
    maskedFallback?: string | null
  ) => revealedIds[target] || maskedFallback || "—";

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Bar & Status Actions */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/admin/assistance-requests"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
              العودة لقائمة طلبات المساعدة
            </Link>

            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              تاريخ التقديم: {formatDateTime(req.createdAt)}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {req.fullName}
                </h1>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    REQUEST_STATUS_STYLES[req.status]
                  }`}
                >
                  {REQUEST_STATUS_LABELS[req.status]}
                </span>
                {isMember && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    وضع العرض فقط — التعديل والحذف متاح للمسؤولين فقط
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                نوع الطلب:{" "}
                <span className="text-foreground font-medium">
                  {ASSISTANCE_CATEGORY_LABELS[req.assistanceCategory]}
                </span>
                {req.branchName ? ` • الفرع: ${req.branchName}` : ""}
              </p>
            </div>

            {/* Workflow Status Transition Buttons (Admins & SuperAdmins only) */}
            {canManage && (
              <div className="flex flex-wrap gap-2">
                {req.status !== "under_review" && (
                  <button
                    type="button"
                    onClick={() => setStatusModalTarget("under_review")}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-200 transition-colors"
                  >
                    وضع قيد المراجعة
                  </button>
                )}
                {req.status !== "reviewed" && (
                  <button
                    type="button"
                    onClick={() => setStatusModalTarget("reviewed")}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-purple-100 text-purple-900 hover:bg-purple-200 dark:bg-purple-950/60 dark:text-purple-200 transition-colors"
                  >
                    تمت المراجعة
                  </button>
                )}
                {req.status !== "approved" && (
                  <button
                    type="button"
                    onClick={() => setStatusModalTarget("approved")}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    قبول الطلب
                  </button>
                )}
                {req.status !== "rejected" && (
                  <button
                    type="button"
                    onClick={() => setStatusModalTarget("rejected")}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    رفض الطلب
                  </button>
                )}
                {req.status !== "completed" && (
                  <button
                    type="button"
                    onClick={() => setStatusModalTarget("completed")}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
                  >
                    تعيين كمكتمل
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-semibold border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  title="حذف الطلب نهائياً"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  حذف الطلب نهائياً
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section A: Applicant Information */}
            <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <FileText className="w-5 h-5 text-primary" aria-hidden="true" />
                بيانات مقدم الطلب
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    الاسم الكامل
                  </span>
                  <span className="font-semibold text-foreground">
                    {req.fullName}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">
                    الرقم القومي لمقدم الطلب
                  </span>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span
                      className="font-mono font-semibold text-foreground px-2.5 py-0.5 rounded bg-muted border border-border"
                      dir="ltr"
                    >
                      {maskOrPlaintext("applicant", req.nationalIdMasked)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleToggleReveal("applicant")}
                      disabled={revealingTarget === "applicant"}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                    >
                      {revealingTarget === "applicant" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : revealedIds.applicant ? (
                        <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {revealedIds.applicant ? "إخفاء" : "إظهار الكامل"}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">
                    رقم الموبايل
                  </span>
                  <span
                    className="font-mono text-foreground inline-flex items-center gap-1.5"
                    dir="ltr"
                  >
                    <Phone className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                    {req.phone}
                  </span>
                </div>

                {req.whatsapp && (
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      رقم الواتساب
                    </span>
                    <span className="font-mono text-foreground" dir="ltr">
                      {req.whatsapp}
                    </span>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <span className="text-xs text-muted-foreground block">
                    العنوان
                  </span>
                  <span className="text-foreground inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                    {req.address}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">
                    الحالة الاجتماعية
                  </span>
                  <span className="text-foreground">
                    {req.maritalStatus
                      ? MARITAL_STATUS_LABELS[req.maritalStatus]
                      : "غير محدد"}
                  </span>
                </div>

                <div className="flex gap-6">
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      عدد أفراد الأسرة
                    </span>
                    <span className="text-foreground">
                      {req.familyMembersCount ?? "غير محدد"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      الدخل الشهري المذكور
                    </span>
                    <span className="text-foreground">
                      {typeof req.monthlyIncome === "number"
                        ? `${req.monthlyIncome.toLocaleString("ar-EG")} ج.م`
                        : "غير محدد"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground block mb-1.5">
                  تفاصيل وشرح الحالة
                </span>
                <p className="text-sm text-foreground bg-muted/30 border border-border rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
                  {req.description}
                </p>
              </div>

              {req.attachments && req.attachments.length > 0 && (
                <div className="pt-2 border-t border-border space-y-2">
                  <span className="text-xs font-medium text-muted-foreground block">
                    المرفقات ({req.attachments.length})
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {req.attachments.map((url, idx) => (
                      <a
                        key={url + idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-primary"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        عرض المرفق #{idx + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Section B: Beneficiary Verification Result */}
            <section
              className={`border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 ${
                VERIFICATION_BANNER_STYLES[req.verificationStatus]
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
                  التحقق من الارتباط بسجلات المستفيدين
                </h2>

                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRerunVerification()}
                      disabled={rerunningVerification}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input bg-background hover:bg-muted text-xs font-medium text-foreground"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          rerunningVerification ? "animate-spin" : ""
                        }`}
                        aria-hidden="true"
                      />
                      إعادة الفحص التلقائي
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualForm((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium"
                    >
                      {showManualForm ? "إخفاء المراجعة اليدوية" : "تعديل التحقق يدوياً"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-background/80 border border-border rounded-xl p-4 space-y-1">
                  <span className="text-xs text-muted-foreground block">
                    نتيجة التحقق الحالية
                  </span>
                  <p className="text-base font-bold text-foreground">
                    {VERIFICATION_STATUS_LABELS[req.verificationStatus]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    صلة القرابة: {RELATIONSHIP_TYPE_LABELS[req.relationshipType]}
                  </p>
                </div>

                <div className="bg-background/80 border border-border rounded-xl p-4 space-y-1">
                  <span className="text-xs text-muted-foreground block">
                    آخر فحص تلقائي / يدوي
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {formatDateTime(req.verifiedAt)}
                  </p>
                  {req.manualResolution && (
                    <p className="text-xs text-primary">
                      حُسم يدوياً بواسطة: {req.manualResolution.resolvedByName}
                    </p>
                  )}
                </div>
              </div>

              {/* Primary Beneficiary & Matched Family Member Distinction */}
              {req.beneficiary && req.beneficiarySnapshot && (
                <div className="bg-background border border-border rounded-xl p-4 space-y-4">
                  {isFamilyMemberRelation && (
                    <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        <strong>تنبيه علاقة أسرية:</strong> مقدم الطلب مطابق كفرد من أسرة المستفيد (
                        {RELATIONSHIP_TYPE_LABELS[req.relationshipType]}) وليس هو المستفيد الأساسي نفسه. تم ربط الطلب بملف الأسرة أدناه دون دمج الهويتين.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Matched Person */}
                    {req.matchedPerson && (
                      <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1.5">
                        <span className="text-xs text-muted-foreground block">
                          الشخص المطابق بالرقم القومي
                        </span>
                        <div className="font-bold text-foreground">
                          {req.matchedPerson.name || "غير مسمى بالملف"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          الصفة المسجلة:{" "}
                          {SPECIFIC_RELATION_LABELS[
                            req.matchedPerson.specificRelation || ""
                          ] || req.matchedPerson.personType}
                          {req.matchedPerson.relatedViaName
                            ? ` (عن طريق: ${req.matchedPerson.relatedViaName})`
                            : ""}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs font-mono text-foreground" dir="ltr">
                            {maskOrPlaintext("matched_person", req.nationalIdMasked)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleToggleReveal("matched_person")}
                            disabled={revealingTarget === "matched_person"}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            {revealedIds.matched_person ? "إخفاء" : "كشف"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Primary Beneficiary Record */}
                    <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/20 space-y-1.5">
                      <span className="text-xs text-muted-foreground block">
                        ملف المستفيد الأساسي (صاحب ملف الأسرة)
                      </span>
                      <div className="font-bold text-foreground flex items-center justify-between gap-2">
                        <span>{req.beneficiarySnapshot.name}</span>
                        {req.beneficiarySnapshot.internalId && (
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">
                            #{req.beneficiarySnapshot.internalId}
                          </span>
                        )}
                      </div>
                      {familyContext && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-foreground" dir="ltr">
                            {maskOrPlaintext(
                              "primary_beneficiary",
                              familyContext.nationalIdMasked
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void handleToggleReveal("primary_beneficiary")
                            }
                            disabled={revealingTarget === "primary_beneficiary"}
                            className="text-primary hover:underline font-medium"
                          >
                            {revealedIds.primary_beneficiary ? "إخفاء" : "كشف"}
                          </button>
                        </div>
                      )}
                      <div className="pt-1">
                        <Link
                          href={`/admin/beneficiaries/${req.beneficiary}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          فتح ملف المستفيد الأساسي
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {req.verificationWarnings && req.verificationWarnings.length > 0 && (
                <div className="space-y-2 pt-1">
                  <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                    تحذيرات التحقق والتطابق ({req.verificationWarnings.length})
                  </h3>
                  <ul className="space-y-1.5">
                    {req.verificationWarnings.map((code) => (
                      <li
                        key={code}
                        className="text-xs px-3 py-2 rounded-lg bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex items-center gap-2"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {VERIFICATION_WARNING_LABELS[code] || code}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Manual Resolution Workflow */}
              {canManage && showManualForm && (
                <div className="bg-background border border-border rounded-xl p-4 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">
                    المراجعة اليدوية وحسم الارتباط
                  </h3>

                  {req.candidateMatches && req.candidateMatches.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-muted-foreground block">
                        التطابقات المحتملة المكتشفة ({req.candidateMatches.length}) — اضغط لاختيار سجل:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {req.candidateMatches.map((c, idx) => (
                          <button
                            type="button"
                            key={c.beneficiaryId + idx}
                            onClick={() => handlePickCandidate(c)}
                            className={`text-right p-3 rounded-lg border transition-colors ${
                              manualBeneficiaryId === c.beneficiaryId &&
                              manualRelType === c.relationshipType
                                ? "border-primary bg-primary/10"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <div className="font-semibold text-xs text-foreground">
                              {c.beneficiaryName}
                              {c.beneficiaryInternalId
                                ? ` (#${c.beneficiaryInternalId})`
                                : ""}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {VERIFICATION_STATUS_LABELS[c.verificationType]} —{" "}
                              {c.matchedPerson.name || "بدون اسم"}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        نتيجة التحقق المعتمدة
                      </label>
                      <select
                        value={manualVerifStatus}
                        onChange={(e) => {
                          const v = e.target.value as Exclude<
                            VerificationStatus,
                            "manual_review"
                          >;
                          setManualVerifStatus(v);
                          if (v === "matched_primary_beneficiary") {
                            setManualRelType("primary_beneficiary");
                          } else if (v === "matched_spouse") {
                            setManualRelType("beneficiary_spouse");
                          } else if (v === "matched_child") {
                            setManualRelType("beneficiary_child");
                          } else if (v === "matched_other_dependent") {
                            setManualRelType("other_dependent");
                          } else {
                            setManualRelType("unknown");
                            setManualBeneficiaryId("");
                            setManualBeneficiaryLabel("");
                          }
                        }}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground"
                      >
                        <option value="matched_primary_beneficiary">
                          {VERIFICATION_STATUS_LABELS.matched_primary_beneficiary}
                        </option>
                        <option value="matched_spouse">
                          {VERIFICATION_STATUS_LABELS.matched_spouse}
                        </option>
                        <option value="matched_child">
                          {VERIFICATION_STATUS_LABELS.matched_child}
                        </option>
                        <option value="matched_other_dependent">
                          {VERIFICATION_STATUS_LABELS.matched_other_dependent}
                        </option>
                        <option value="not_matched">
                          {VERIFICATION_STATUS_LABELS.not_matched}
                        </option>
                      </select>
                    </div>

                    {manualVerifStatus !== "not_matched" && (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          اسم الفرد المطابق بالملف
                        </label>
                        <input
                          type="text"
                          value={manualMatchedPersonName}
                          onChange={(e) => setManualMatchedPersonName(e.target.value)}
                          placeholder="اسم الشخص المرتبط..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground"
                        />
                      </div>
                    )}
                  </div>

                  {manualVerifStatus !== "not_matched" && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-muted-foreground">
                        اختيار / البحث عن ملف المستفيد الأساسي
                      </label>
                      {manualBeneficiaryLabel && (
                        <div className="text-xs px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium">
                          المحدد حالياً: {manualBeneficiaryLabel}
                        </div>
                      )}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                          type="text"
                          value={benSearchTerm}
                          onChange={(e) => void handleSearchBeneficiaries(e.target.value)}
                          placeholder="ابحث باسم المستفيد أو رقم الملف الداخلي..."
                          className="w-full pr-8 pl-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground"
                        />
                        {benSearching && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        )}
                      </div>
                      {benSearchResults.length > 0 && (
                        <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border bg-card">
                          {benSearchResults.map((b) => (
                            <button
                              type="button"
                              key={b._id}
                              onClick={() => {
                                setManualBeneficiaryId(b._id);
                                setManualBeneficiaryLabel(
                                  `${b.name}${b.internalId ? ` (#${b.internalId})` : ""}`
                                );
                                setBenSearchResults([]);
                              }}
                              className="w-full text-right px-3 py-2 text-xs hover:bg-muted flex items-center justify-between"
                            >
                              <span className="font-medium text-foreground">{b.name}</span>
                              <span className="text-muted-foreground font-mono">
                                {b.internalId ? `#${b.internalId}` : ""}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      سبب القرار الإداري اليدوي (إلزامي)
                    </label>
                    <textarea
                      rows={2}
                      value={manualDecisionNote}
                      onChange={(e) => setManualDecisionNote(e.target.value)}
                      placeholder="اكتب توضيحاً لسبب الاعتماد اليدوي..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmManualOpen(true)}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
                  >
                    اعتماد نتيجة التحقق اليدوية
                  </button>
                </div>
              )}
            </section>

            {/* Section C: Concise Family Context */}
            {familyContext && (
              <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" aria-hidden="true" />
                    السياق العائلي لملف المستفيد الأساسي
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-foreground">
                    فئة {familyContext.category || "C"} • {familyContext.familyMembers} أفراد
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                    <span className="text-muted-foreground block">
                      الزوج / الزوجة المسجل بالملف
                    </span>
                    {familyContext.spouse ? (
                      <>
                        <div className="font-semibold text-foreground">
                          {familyContext.spouse.name}
                        </div>
                        <div className="font-mono text-muted-foreground" dir="ltr">
                          {familyContext.spouse.nationalIdMasked}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">غير مسجل</span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                    <span className="text-muted-foreground block">
                      حالة الملف والشهرية
                    </span>
                    <div className="font-semibold text-foreground">
                      الحالة: {familyContext.status === "active" ? "نشط" : familyContext.status === "pending" ? "انتظار" : "ملغى"}
                    </div>
                    <div className="text-muted-foreground">
                      {familyContext.receivesMonthlyAllowance
                        ? `يتقاضى شهرية (${familyContext.monthlyAllowanceAmount || 0} ج.م)`
                        : "لا يتقاضى شهرية ثابتة"}
                    </div>
                  </div>
                </div>

                {familyContext.children.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      الأبناء المسجلون ({familyContext.children.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {familyContext.children.map((child) => {
                        const isMatchedChild =
                          req.matchedPerson?.personType === "child" &&
                          req.matchedPerson.subId === child.subId;
                        return (
                          <div
                            key={child.subId}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                              isMatchedChild
                                ? "border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30"
                                : "border-border bg-background"
                            }`}
                          >
                            <div>
                              <span className="font-semibold text-foreground">
                                {child.name}
                              </span>
                              {isMatchedChild && (
                                <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                                  مقدم الطلب
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-muted-foreground" dir="ltr">
                              {child.nationalIdMasked}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Section E: Previous Assistance History (Strictly Separating Individual vs Family-Level) */}
            <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" aria-hidden="true" />
                  سجل المساعدات السابقة
                </h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-medium">
                    فردية مباشرة: {assistanceHistory.summary.individualCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 font-medium">
                    على مستوى الأسرة: {assistanceHistory.summary.familyCount}
                  </span>
                </div>
              </div>

              {assistanceHistory.mode === "family_member" && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="leading-relaxed">
                    نظراً لأن مقدم الطلب هو <strong>{RELATIONSHIP_TYPE_LABELS[req.relationshipType]}</strong>، تم فصل المساعدات المسجلة باسمه شخصياً عن المساعدات المسجلة على مستوى ملف الأسرة. <strong>المساعدات العائلية لا تعني أن المتقدم استلمها شخصياً.</strong>
                  </p>
                </div>
              )}

              {/* Category 1: Individual Assistance */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  {assistanceHistory.mode === "primary"
                    ? "مساعدات مسجلة بالرقم القومي الشخصي (قروض / زواج / طلبات سابقة)"
                    : "1. مساعدات مسجلة باسم المتقدم شخصياً"}
                </h3>
                {assistanceHistory.individualAssistance.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3.5 rounded-xl bg-muted/30 border border-border">
                    لا توجد مساعدات سابقة مسجلة تحديداً بالرقم القومي الشخصي لمقدم الطلب.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {assistanceHistory.individualAssistance.map((entry) => (
                      <HistoryEntryCard key={`${entry.source}-${entry.id}`} entry={entry} />
                    ))}
                  </div>
                )}
              </div>

              {/* Category 2: Family-Level Assistance */}
              {req.beneficiary && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-600" aria-hidden="true" />
                    {assistanceHistory.mode === "primary"
                      ? "مساعدات ومبادرات وصرفيات الخزينة المرتبطة بملف الأسرة"
                      : "2. مساعدات على مستوى الأسرة (ملف المستفيد الأساسي)"}
                  </h3>
                  {assistanceHistory.familyAssistance.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3.5 rounded-xl bg-muted/30 border border-border">
                      لا توجد مصروفات خزينة أو مبادرات أو مساعدات أسرية سابقة مسجلة لهذا الملف.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {assistanceHistory.familyAssistance.map((entry) => (
                        <HistoryEntryCard
                          key={`${entry.source}-${entry.id}`}
                          entry={entry}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Historical Data Limitations */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1.5">
                <span className="font-semibold text-foreground block">
                  ملاحظات دقة البيانات التاريخية:
                </span>
                <ul className="list-disc list-inside space-y-1">
                  {assistanceHistory.limitationsNotice.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          {/* Right Column: Reviewer, Internal Notes, Status History, Security Audit */}
          <div className="space-y-6">
            {/* Reviewer Assignment */}
            <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-foreground">
                تعيين المسؤول المراجع
              </h2>
              {canManage ? (
                <div className="space-y-2.5">
                  <select
                    value={selectedReviewerId}
                    onChange={(e) => setSelectedReviewerId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground"
                  >
                    <option value="">غير معين</option>
                    {reviewers.map((rev) => (
                      <option key={rev.clerkId} value={rev.clerkId}>
                        {rev.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleSaveReviewer()}
                    disabled={savingReviewer}
                    className="w-full px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 text-xs font-semibold disabled:opacity-60"
                  >
                    {savingReviewer ? "جاري الحفظ..." : "حفظ المراجع المعيّن"}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {req.assignedReviewerName || "غير معين"}
                </p>
              )}
            </section>

            {/* Internal Notes */}
            <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-primary" aria-hidden="true" />
                  ملاحظات إدارية داخلية
                </h2>
                <span className="text-[11px] text-muted-foreground">
                  داخلي (لا يظهر لمقدم الطلب)
                </span>
              </div>

              {canManage && (
                <form onSubmit={handleAddNote} className="space-y-2.5">
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="أضف ملاحظة داخلية أو نتيجة بحث اجتماعي (لا تظهر أبداً لمقدم الطلب)..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  />
                  <button
                    type="submit"
                    disabled={savingNote || !newNote.trim()}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 text-xs font-semibold"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
                    {savingNote ? "جاري الإضافة..." : "إضافة ملاحظة"}
                  </button>
                </form>
              )}

              <div className="space-y-2.5 max-h-72 overflow-y-auto pt-1">
                {req.adminNotes && req.adminNotes.length > 0 ? (
                  [...req.adminNotes].reverse().map((note, idx) => (
                    <div
                      key={note._id || idx}
                      className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1"
                    >
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span>{note.authorName}</span>
                        <span>{formatDateTime(note.createdAt)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    لا توجد ملاحظات داخلية مسجلة بعد.
                  </p>
                )}
              </div>
            </section>

            {/* Immutable Status History */}
            <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
                سجل تغييرات الحالة (غير قابل للتعديل)
              </h2>

              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {[...(req.statusHistory || [])].reverse().map((h, idx) => (
                  <div
                    key={h._id || idx}
                    className="p-3 rounded-xl bg-background border border-border text-xs space-y-1"
                  >
                    <div className="font-semibold text-foreground">
                      {h.previousStatus
                        ? `${REQUEST_STATUS_LABELS[h.previousStatus]} ← ${REQUEST_STATUS_LABELS[h.newStatus]}`
                        : `تسجيل أولي: ${REQUEST_STATUS_LABELS[h.newStatus]}`}
                    </div>
                    {h.note && (
                      <p className="text-muted-foreground">ملاحظة: {h.note}</p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{h.changedByName}</span>
                      <span>{formatDateTime(h.changedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Security Audit Log */}
            <section className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
              <button
                type="button"
                onClick={() => setShowAuditLogs((prev) => !prev)}
                className="w-full flex items-center justify-between text-sm font-bold text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
                  سجل المراجعة الأمنية ({auditLogs.length})
                </span>
                {showAuditLogs ? (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                )}
              </button>

              {showAuditLogs && (
                <div className="space-y-2 max-h-64 overflow-y-auto pt-2 border-t border-border">
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      لا توجد أحداث مسجلة بعد.
                    </p>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log._id}
                        className="p-2.5 rounded-lg bg-muted/30 border border-border text-xs space-y-0.5"
                      >
                        <div className="font-semibold text-foreground">
                          {AUDIT_ACTION_LABELS[log.action] || log.action}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{log.actorName}</span>
                          <span>{formatDateTime(log.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Status Transition */}
      {canManage && statusModalTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">
              تأكيد تغيير حالة الطلب
            </h3>
            <p className="text-sm text-muted-foreground">
              هل تريد تغيير حالة طلب{" "}
              <strong className="text-foreground">{req.fullName}</strong> إلى{" "}
              <strong className="text-primary">
                {REQUEST_STATUS_LABELS[statusModalTarget]}
              </strong>
              ؟ يتم تسجيل هذا التغيير بشكل دائم في سجل الحالات.
            </p>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                سبب التغيير أو ملاحظة (اختياري)
              </label>
              <textarea
                rows={3}
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="أدخل سبباً أو توصية إدارية..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => {
                  setStatusModalTarget(null);
                  setStatusNote("");
                }}
                className="px-4 py-2 rounded-lg border border-input bg-background text-sm font-medium text-foreground"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => void handleConfirmStatusChange()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold disabled:opacity-60"
              >
                {updatingStatus ? "جاري الحفظ..." : "تأكيد التحديث"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Manual Verification Resolution */}
      {canManage && confirmManualOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">
              تأكيد اعتماد المراجعة اليدوية للتحقق
            </h3>
            <div className="text-sm text-muted-foreground space-y-1.5">
              <p>
                النتيجة الجديدة:{" "}
                <strong className="text-foreground">
                  {VERIFICATION_STATUS_LABELS[manualVerifStatus]}
                </strong>
              </p>
              {manualVerifStatus !== "not_matched" && (
                <p>
                  المستفيد الأساسي:{" "}
                  <strong className="text-foreground">
                    {manualBeneficiaryLabel || "غير محدد"}
                  </strong>
                </p>
              )}
              <p>
                السبب المسجل: <span className="text-foreground">{manualDecisionNote}</span>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={savingManual}
                onClick={() => setConfirmManualOpen(false)}
                className="px-4 py-2 rounded-lg border border-input bg-background text-sm font-medium text-foreground"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={savingManual}
                onClick={() => void handleSubmitManualResolution()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold disabled:opacity-60"
              >
                {savingManual ? "جاري الاعتماد..." : "تأكيد الاعتماد"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Permanent Delete */}
      {canManage && confirmDeleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-destructive">
              <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <h3 className="text-lg font-bold">تأكيد حذف طلب المساعدة نهائياً</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              هل أنت متأكد من حذف طلب{" "}
              <strong className="text-foreground">{req.fullName}</strong> نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletingRequest}
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-4 py-2 rounded-lg border border-input bg-background text-sm font-medium text-foreground"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={deletingRequest}
                onClick={() => void handleDeleteRequest()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm font-semibold disabled:opacity-60"
              >
                {deletingRequest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    حذف نهائي
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
