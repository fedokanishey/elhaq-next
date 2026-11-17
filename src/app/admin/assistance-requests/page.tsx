"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  Filter,
  Inbox,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
} from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import BranchSelector from "@/components/BranchSelector";
import { useBranchContext } from "@/contexts/BranchContext";
import {
  APPLICANT_RELATIONSHIP_TYPES,
  type ApplicantRelationshipType,
  ASSISTANCE_CATEGORY_LABELS,
  type AssistanceCategory,
  RELATIONSHIP_TYPE_LABELS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  type RequestStatus,
  VERIFICATION_STATUSES,
  VERIFICATION_STATUS_LABELS,
  type VerificationStatus,
} from "@/lib/assistance/types";

interface AssistanceRequestRow {
  _id: string;
  fullName: string;
  nationalIdMasked: string;
  phone: string;
  assistanceCategory: AssistanceCategory;
  verificationStatus: VerificationStatus;
  relationshipType: ApplicantRelationshipType;
  beneficiarySnapshot?: {
    name: string;
    internalId?: string;
    status?: string;
  } | null;
  matchedPerson?: {
    name?: string;
    personType: string;
  } | null;
  verificationWarnings?: string[];
  status: RequestStatus;
  assignedReviewerId?: string | null;
  assignedReviewerName?: string | null;
  branchName?: string | null;
  createdAt: string;
}

interface ReviewerOption {
  clerkId: string;
  name: string;
  role: string;
}

interface AdminListResponse {
  requests: AssistanceRequestRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    newCount: number;
    underReviewCount: number;
    manualReviewCount: number;
    totalCount: number;
  };
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

const VERIFICATION_STATUS_STYLES: Record<VerificationStatus, string> = {
  matched_primary_beneficiary:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  matched_spouse:
    "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  matched_child:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  matched_other_dependent:
    "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  not_matched:
    "bg-muted text-muted-foreground border border-border",
  manual_review:
    "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700",
};

function formatDateTime(iso: string): string {
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

export default function AdminAssistanceRequestsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { selectedBranchId, setSelectedBranchId } = useBranchContext();

  const effectiveRole = (user?.publicMetadata?.role ||
    user?.unsafeMetadata?.role ||
    "user") as string;
  const isSuperAdmin = effectiveRole === "superadmin";
  const isAdmin = effectiveRole === "admin" || isSuperAdmin;
  const isMember = effectiveRole === "member";
  const canView = isAdmin || isMember;
  const canManage = isAdmin;

  // Filter inputs
  const [searchName, setSearchName] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [searchNationalId, setSearchNationalId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState("");
  const [reviewerFilter, setReviewerFilter] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AssistanceRequestRow | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isLoaded && !canView) {
      router.replace("/");
    }
  }, [isLoaded, canView, router]);

  const fetchRequests = useCallback(async () => {
    if (!isLoaded || !canView) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/assistance-requests/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page,
          limit: 20,
          branchId: isSuperAdmin ? selectedBranchId : undefined,
          searchName: searchName || undefined,
          searchPhone: searchPhone || undefined,
          searchNationalId: searchNationalId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          status: statusFilter || undefined,
          verificationStatus: verificationFilter || undefined,
          relationshipType: relationshipFilter || undefined,
          assignedReviewerId: reviewerFilter || undefined,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error || "تعذر تحميل طلبات المساعدة");
      }
      setData(json as AdminListResponse);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ أثناء تحميل البيانات"
      );
    } finally {
      setLoading(false);
    }
  }, [
    isLoaded,
    canView,
    page,
    isSuperAdmin,
    selectedBranchId,
    searchName,
    searchPhone,
    searchNationalId,
    dateFrom,
    dateTo,
    statusFilter,
    verificationFilter,
    relationshipFilter,
    reviewerFilter,
  ]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const handleClearFilters = () => {
    setSearchName("");
    setSearchPhone("");
    setSearchNationalId("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("");
    setVerificationFilter("");
    setRelationshipFilter("");
    setReviewerFilter("");
    setPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/assistance-requests/${deleteTarget._id}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "تعذر حذف طلب المساعدة");
      }
      toast.success("تم حذف طلب المساعدة نهائياً");
      setDeleteTarget(null);
      if (requests.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await fetchRequests();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل حذف الطلب");
    } finally {
      setDeleting(false);
    }
  };

  if (!isLoaded) {
    return <BrandedLoader fullScreen />;
  }

  if (!canView) {
    return null;
  }

  const requests = data?.requests || [];
  const stats = data?.stats || {
    newCount: 0,
    underReviewCount: 0,
    manualReviewCount: 0,
    totalCount: 0,
  };
  const pagination = data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };
  const reviewers = data?.reviewers || [];

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <Link
              href={canManage ? "/admin/dashboard" : "/"}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
              {canManage ? "العودة للوحة التحكم" : "العودة للرئيسية"}
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2.5">
                <ClipboardList className="w-7 h-7 text-primary" aria-hidden="true" />
                طلبات المساعدة
              </h1>
              {isMember && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  وضع العرض فقط (عضو)
                </span>
              )}
              {isSuperAdmin && (
                <BranchSelector
                  selectedBranchId={selectedBranchId}
                  onBranchChange={(b) => {
                    setSelectedBranchId(b);
                    setPage(1);
                  }}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              مراجعة الطلبات الواردة، التحقق التلقائي من صلة القرابة بملفات المستفيدين، وسجل المساعدات السابقة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchRequests()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-input bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors self-start sm:self-auto"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            تحديث القائمة
          </button>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <Inbox className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">أولوية أولى</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.newCount}</div>
            <p className="text-xs text-muted-foreground mt-0.5">طلبات جديدة غير مراجعة</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">متابعة</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats.underReviewCount}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">طلبات قيد المراجعة</p>
          </div>

          <div className="bg-card border border-amber-200 dark:border-amber-800/70 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span className="text-xs text-amber-700 dark:text-amber-300">تنبيه تحقق</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats.manualReviewCount}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">تحتاج مراجعة يدوية</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <UserCheck className="w-5 h-5 text-primary" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">الإجمالي</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.totalCount}</div>
            <p className="text-xs text-muted-foreground mt-0.5">إجمالي طلبات الفرع</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" aria-hidden="true" />
              بحث وتصفية الطلبات
            </h2>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              إعادة تعيين الفلاتر
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="flt-name" className="block text-xs font-medium text-muted-foreground mb-1">
                اسم المتقدم
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="flt-name"
                  type="text"
                  value={searchName}
                  onChange={(e) => {
                    setSearchName(e.target.value);
                    setPage(1);
                  }}
                  placeholder="ابحث بالاسم..."
                  className="w-full pr-9 pl-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="flt-nid" className="block text-xs font-medium text-muted-foreground mb-1">
                الرقم القومي (مطابقة تامة آمنة)
              </label>
              <input
                id="flt-nid"
                type="text"
                inputMode="numeric"
                maxLength={14}
                dir="ltr"
                value={searchNationalId}
                onChange={(e) => {
                  setSearchNationalId(e.target.value.replace(/\s+/g, ""));
                  setPage(1);
                }}
                placeholder="14 رقماً..."
                className="w-full px-3 py-2 text-sm text-left font-mono rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="flt-phone" className="block text-xs font-medium text-muted-foreground mb-1">
                رقم الهاتف
              </label>
              <input
                id="flt-phone"
                type="text"
                dir="ltr"
                value={searchPhone}
                onChange={(e) => {
                  setSearchPhone(e.target.value);
                  setPage(1);
                }}
                placeholder="010..."
                className="w-full px-3 py-2 text-sm text-left font-mono rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="flt-status" className="block text-xs font-medium text-muted-foreground mb-1">
                حالة الطلب
              </label>
              <select
                id="flt-status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">كل الحالات</option>
                {REQUEST_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {REQUEST_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="flt-verif" className="block text-xs font-medium text-muted-foreground mb-1">
                نتيجة التحقق من المستفيد
              </label>
              <select
                id="flt-verif"
                value={verificationFilter}
                onChange={(e) => {
                  setVerificationFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">كل نتائج التحقق</option>
                {VERIFICATION_STATUSES.map((vs) => (
                  <option key={vs} value={vs}>
                    {VERIFICATION_STATUS_LABELS[vs]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="flt-rel" className="block text-xs font-medium text-muted-foreground mb-1">
                نوع الصلة بالمستفيد
              </label>
              <select
                id="flt-rel"
                value={relationshipFilter}
                onChange={(e) => {
                  setRelationshipFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">الكل</option>
                {APPLICANT_RELATIONSHIP_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {RELATIONSHIP_TYPE_LABELS[rt]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="flt-reviewer" className="block text-xs font-medium text-muted-foreground mb-1">
                المراجع المعين
              </label>
              <select
                id="flt-reviewer"
                value={reviewerFilter}
                onChange={(e) => {
                  setReviewerFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">الكل</option>
                <option value="__unassigned__">غير معين لمراجع</option>
                {reviewers.map((rev) => (
                  <option key={rev.clerkId} value={rev.clerkId}>
                    {rev.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="flt-from" className="block text-xs font-medium text-muted-foreground mb-1">
                  من تاريخ
                </label>
                <input
                  id="flt-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="flt-to" className="block text-xs font-medium text-muted-foreground mb-1">
                  إلى تاريخ
                </label>
                <input
                  id="flt-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive text-sm flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {loading && !data ? (
          <div className="py-12">
            <BrandedLoader />
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center space-y-2">
            <Inbox className="w-10 h-10 text-muted-foreground mx-auto" aria-hidden="true" />
            <h3 className="text-base font-semibold text-foreground">
              لا توجد طلبات مساعدة مطابقة لخيارات البحث
            </h3>
            <p className="text-sm text-muted-foreground">
              تظهر الطلبات الجديدة فور إرسالها عبر صفحة استبيان طلب المساعدة.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block bg-card border border-border rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">مقدم الطلب / النوع</th>
                    <th className="px-4 py-3 font-semibold">تاريخ التقديم</th>
                    <th className="px-4 py-3 font-semibold">الهاتف والقومي</th>
                    <th className="px-4 py-3 font-semibold">نتيجة التحقق</th>
                    <th className="px-4 py-3 font-semibold">الصلة بملف المستفيد</th>
                    <th className="px-4 py-3 font-semibold">حالة الطلب</th>
                    <th className="px-4 py-3 font-semibold">المراجع</th>
                    <th className="px-4 py-3 font-semibold text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((req) => (
                    <tr
                      key={req._id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {req.fullName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {ASSISTANCE_CATEGORY_LABELS[req.assistanceCategory] ||
                            req.assistanceCategory}
                          {req.branchName ? ` • ${req.branchName}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(req.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-mono text-foreground" dir="ltr">
                          {req.phone}
                        </div>
                        <div
                          className="text-xs font-mono text-muted-foreground mt-0.5"
                          dir="ltr"
                        >
                          {req.nationalIdMasked}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            VERIFICATION_STATUS_STYLES[req.verificationStatus]
                          }`}
                        >
                          {req.verificationStatus === "manual_review" && (
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                          )}
                          {VERIFICATION_STATUS_LABELS[req.verificationStatus]}
                        </span>
                        {(req.verificationWarnings?.length || 0) > 0 && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                            {req.verificationWarnings?.length} تنبيه تحقق
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium text-foreground">
                          {RELATIONSHIP_TYPE_LABELS[req.relationshipType]}
                        </div>
                        {req.beneficiarySnapshot?.name && (
                          <div className="text-muted-foreground mt-0.5">
                            الأساسي: {req.beneficiarySnapshot.name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            REQUEST_STATUS_STYLES[req.status]
                          }`}
                        >
                          {REQUEST_STATUS_LABELS[req.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {req.assignedReviewerName || "غير معين"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <Link
                            href={`/admin/assistance-requests/${req._id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                            {canManage ? "مراجعة الطلب" : "عرض التفاصيل"}
                          </Link>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(req)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs font-medium transition-colors"
                              title="حذف الطلب نهائياً"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              حذف
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards */}
            <div className="lg:hidden space-y-3">
              {requests.map((req) => (
                <div
                  key={req._id}
                  className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-foreground">{req.fullName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {ASSISTANCE_CATEGORY_LABELS[req.assistanceCategory]} •{" "}
                        {formatDateTime(req.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                        REQUEST_STATUS_STYLES[req.status]
                      }`}
                    >
                      {REQUEST_STATUS_LABELS[req.status]}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        VERIFICATION_STATUS_STYLES[req.verificationStatus]
                      }`}
                    >
                      {VERIFICATION_STATUS_LABELS[req.verificationStatus]}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-muted text-foreground">
                      {RELATIONSHIP_TYPE_LABELS[req.relationshipType]}
                    </span>
                  </div>

                  {req.beneficiarySnapshot?.name && (
                    <p className="text-xs text-muted-foreground">
                      ملف المستفيد الأساسي:{" "}
                      <span className="text-foreground font-medium">
                        {req.beneficiarySnapshot.name}
                      </span>
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border text-xs gap-2">
                    <span className="font-mono text-muted-foreground" dir="ltr">
                      {req.phone} • {req.nationalIdMasked}
                    </span>
                    <div className="inline-flex items-center gap-2 shrink-0">
                      <Link
                        href={`/admin/assistance-requests/${req._id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        {canManage ? "مراجعة الطلب" : "عرض التفاصيل"}
                      </Link>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(req)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground font-medium transition-colors"
                          title="حذف الطلب نهائياً"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground">
                عرض صفحة {pagination.page} من {pagination.totalPages} (إجمالي النتائج:{" "}
                {pagination.total})
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-input bg-background text-xs font-medium disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  السابقة
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-input bg-background text-xs font-medium disabled:opacity-50"
                >
                  التالية
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Permanent Delete Confirmation Modal */}
      {canManage && deleteTarget && (
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
              <strong className="text-foreground">{deleteTarget.fullName}</strong>{" "}
              نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء وسيتم إزالة سجل التدقيق المرتبط به.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-input bg-background text-sm font-medium text-foreground"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm font-semibold disabled:opacity-60"
              >
                {deleting ? (
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
