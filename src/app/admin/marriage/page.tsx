"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import BrandedLoader from "@/components/BrandedLoader";
import BranchSelector from "@/components/BranchSelector";
import ImageUpload from "@/components/ImageUpload";
import { useBranchContext } from "@/contexts/BranchContext";
import {
  Heart,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  PackageCheck,
  Coins,
  AlertCircle,
  Calendar,
  Phone,
  MapPin,
  ExternalLink,
  Edit3,
  Trash2,
  X,
  Loader2,
  FileImage,
  Tag,
  Sparkles,
  Info,
} from "lucide-react";

interface ProvidedItem {
  itemName: string;
  quantity: number;
  cost?: number;
  notes?: string;
  deliveredAt?: string;
}

interface MarriageCaseItem {
  _id: string;
  beneficiary: {
    _id: string;
    name: string;
    internalId?: string;
    phone?: string;
    nationalId?: string;
    address?: string;
    category?: string;
  } | null;
  beneficiaryName: string;
  beneficiaryNationalId?: string;
  beneficiaryPhone?: string;
  beneficiaryAddress?: string;
  personName: string;
  relationship: "daughter" | "son" | "self" | "other";
  nationalId?: string;
  phone?: string;
  spouseName?: string;
  marriageDate?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  itemsProvided: ProvidedItem[];
  cashAssistance?: number;
  totalCost: number;
  certificateImage?: string;
  notes?: string;
  branchName?: string;
  createdBy?: string;
  completedAt?: string;
  createdAt: string;
}

const COMMON_ITEMS = [
  "غسالة فول أوتوماتيك",
  "غسالة نص أوتوماتيك",
  "ثلاجة",
  "بوتاجاز 4 شعلة",
  "بوتاجاز 5 شعلة",
  "شاشة تلفزيون",
  "خلاط وعجان",
  "مطبخ ألوميتال",
  "مفرش وسجاد",
  "سخان مياه",
  "فرن كهربائي / ميكروويف",
  "مروحة سقف / عمود",
  "طقم حلل وأواني",
  "مكواة وترابيزة",
  "مساعدة مالية نقدية",
];

const RELATIONSHIP_LABELS: Record<string, string> = {
  daughter: "ابنة المستفيد",
  son: "ابن المستفيد",
  self: "المستفيد نفسه",
  other: "أخرى",
};

export default function MarriageAssistancePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { selectedBranchId, setSelectedBranchId, isSuperAdmin } = useBranchContext();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<MarriageCaseItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form states for Add / Edit
  const [beneficiarySearch, setBeneficiarySearch] = useState("");
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<any>(null);
  const [personName, setPersonName] = useState("");
  const [relationship, setRelationship] = useState<"daughter" | "son" | "self" | "other">("daughter");
  const [spouseName, setSpouseName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [marriageDate, setMarriageDate] = useState("");
  const [status, setStatus] = useState<"pending" | "in_progress" | "completed" | "cancelled">("pending");
  const [itemsProvided, setItemsProvided] = useState<ProvidedItem[]>([]);
  const [cashAssistance, setCashAssistance] = useState<number>(0);
  const [certificateImage, setCertificateImage] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isAdmin = role === "admin" || isSuperAdmin;
  const isMember = role === "member";
  const canAccess = isAdmin || isMember;

  // Build SWR query
  const branchParam = selectedBranchId ? `&branchId=${selectedBranchId}` : "";
  const casesUrl = isLoaded && canAccess
    ? `/api/marriage-cases?status=${statusFilter}${branchParam}`
    : null;

  const { data, isLoading, mutate } = useSWR(casesUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const cases: MarriageCaseItem[] = data?.cases || [];
  const stats = data?.stats || {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    totalCost: 0,
  };

  // Fast, dedicated lightweight search for autocomplete in Add Modal
  const trimmedBeneficiarySearch = beneficiarySearch.trim();
  const searchUrl = isAddModalOpen
    ? `/api/beneficiaries/search?q=${encodeURIComponent(trimmedBeneficiarySearch)}&limit=30${selectedBranchId ? `&branchId=${selectedBranchId}` : ""}`
    : null;

  const { data: searchData, isLoading: isLoadingBeneficiaries } = useSWR(
    searchUrl,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const filteredBeneficiaries = useMemo(() => searchData?.beneficiaries || [], [searchData]);

  // Filter cases by search on page
  const filteredCases = useMemo(() => {
    if (!searchTerm.trim()) return cases;
    const q = searchTerm.trim().toLowerCase();
    return cases.filter(
      (c) =>
        c.beneficiaryName?.toLowerCase().includes(q) ||
        c.personName?.toLowerCase().includes(q) ||
        c.beneficiaryNationalId?.includes(q) ||
        c.beneficiaryPhone?.includes(q) ||
        c.spouseName?.toLowerCase().includes(q) ||
        c.itemsProvided?.some((i) => i.itemName.toLowerCase().includes(q))
    );
  }, [cases, searchTerm]);

  // Calculate live total cost in form
  const formCalculatedTotal = useMemo(() => {
    const itemsTotal = itemsProvided.reduce(
      (sum, item) => sum + (Number(item.cost || 0) * Number(item.quantity || 1)),
      0
    );
    return itemsTotal + Number(cashAssistance || 0);
  }, [itemsProvided, cashAssistance]);

  // Reset form
  const resetForm = () => {
    setSelectedBeneficiary(null);
    setBeneficiarySearch("");
    setPersonName("");
    setRelationship("daughter");
    setSpouseName("");
    setPhone("");
    setNationalId("");
    setMarriageDate("");
    setStatus("pending");
    setItemsProvided([]);
    setCashAssistance(0);
    setCertificateImage("");
    setNotes("");
    setFormError("");
    setEditingCase(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (c: MarriageCaseItem) => {
    setEditingCase(c);
    setSelectedBeneficiary(c.beneficiary);
    setPersonName(c.personName || "");
    setRelationship(c.relationship || "daughter");
    setSpouseName(c.spouseName || "");
    setPhone(c.phone || "");
    setNationalId(c.nationalId || "");
    setMarriageDate(c.marriageDate ? c.marriageDate.substring(0, 10) : "");
    setStatus(c.status || "pending");
    setItemsProvided(c.itemsProvided ? [...c.itemsProvided] : []);
    setCashAssistance(c.cashAssistance || 0);
    setCertificateImage(c.certificateImage || "");
    setNotes(c.notes || "");
    setFormError("");
  };

  // Add Item to list
  const handleAddItem = (itemName = "") => {
    setItemsProvided((prev) => [
      ...prev,
      { itemName, quantity: 1, cost: 0, notes: "" },
    ]);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    setItemsProvided((prev) => prev.filter((_, i) => i !== index));
  };

  // Update item field
  const handleUpdateItem = (index: number, field: keyof ProvidedItem, value: any) => {
    setItemsProvided((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Save new case
  const handleSaveNewCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBeneficiary) {
      setFormError("يرجى تحديد المستفيد أولاً");
      return;
    }
    if (!personName.trim()) {
      setFormError("يرجى كتابة اسم الشخص المقبل على الزواج");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const res = await fetch("/api/marriage-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: selectedBeneficiary._id,
          personName,
          relationship,
          spouseName,
          phone,
          nationalId,
          marriageDate: marriageDate || undefined,
          status,
          itemsProvided,
          cashAssistance: Number(cashAssistance || 0),
          certificateImage,
          notes,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "فشل حفظ الحالة");
      }

      setIsAddModalOpen(false);
      resetForm();
      mutate();
    } catch (err: any) {
      setFormError(err.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  // Save updated case
  const handleSaveEditCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;
    if (!personName.trim()) {
      setFormError("يرجى كتابة اسم الشخص المقبل على الزواج");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const res = await fetch(`/api/marriage-cases/${editingCase._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName,
          relationship,
          spouseName,
          phone,
          nationalId,
          marriageDate: marriageDate || null,
          status,
          itemsProvided,
          cashAssistance: Number(cashAssistance || 0),
          certificateImage,
          notes,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "فشل تحديث الحالة");
      }

      setEditingCase(null);
      resetForm();
      mutate();
    } catch (err: any) {
      setFormError(err.message || "حدث خطأ أثناء التحديث");
    } finally {
      setSaving(false);
    }
  };

  // Delete case
  const handleDeleteCase = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حالة تيسير الزواج الخاصة بـ "${name}"؟\nلا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/marriage-cases/${id}`, { method: "DELETE" });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "فشل حذف الحالة");
      }
      mutate();
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء الحذف");
    } finally {
      setDeletingId(null);
    }
  };

  // Fast quick status update
  const handleQuickStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/marriage-cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        mutate();
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (!isLoaded) {
    return <BrandedLoader fullScreen />;
  }

  if (!canAccess) {
    router.push("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl">
                <Heart className="w-7 h-7 fill-rose-500/20" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  نظام تيسير الزواج
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  متابعة وتجهيز المقبلين على الزواج وتوفير الأجهزة والمساعدات لكل حالة
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isSuperAdmin && (
              <BranchSelector
                selectedBranchId={selectedBranchId}
                onBranchChange={setSelectedBranchId}
              />
            )}
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90 transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>تسجيل حالة زواج جديدة</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Cases */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">إجمالي الحالات</span>
              <Heart className="w-5 h-5 text-rose-500" />
            </div>
            <div className="text-3xl font-extrabold text-foreground">
              {stats.total}
            </div>
            <div className="text-xs text-muted-foreground">حالة مسجلة بالفرع</div>
          </div>

          {/* In Progress */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">جاري تجهيزها ومساعدتها</span>
              <PackageCheck className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
              {stats.inProgress}
            </div>
            <div className="text-xs text-blue-600/80 dark:text-blue-400/80 font-medium">
              قيد شراء وتجهيز المستلزمات
            </div>
          </div>

          {/* Completed */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">تمت المساعدة بنجاح</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {stats.completed}
            </div>
            <div className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-medium">
              تم تسليم المساعدات بالكامل
            </div>
          </div>

          {/* Pending */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">في الانتظار والدراسة</span>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {stats.pending}
            </div>
            <div className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium">
              قيد فحص ومطابقة الشروط
            </div>
          </div>

          {/* Total Cost */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-card border border-border rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">إجمالي التكلفة</span>
              <Coins className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
              {stats.totalCost.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">ج.م</span>
            </div>
            <div className="text-xs text-muted-foreground">تكلفة الأجهزة والمساعدات</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم المستفيد، اسم العريس/العروسة، الرقم القومي..."
              className="w-full pr-10 pl-4 py-2.5 text-sm bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            {[
              { id: "all", label: "الكل", count: stats.total },
              { id: "in_progress", label: "جاري تجهيزها", count: stats.inProgress, color: "text-blue-600 dark:text-blue-400" },
              { id: "completed", label: "تمت المساعدة", count: stats.completed, color: "text-emerald-600 dark:text-emerald-400" },
              { id: "pending", label: "في الانتظار", count: stats.pending, color: "text-amber-600 dark:text-amber-400" },
              { id: "cancelled", label: "ملغي", count: stats.cancelled, color: "text-rose-500" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  statusFilter === tab.id ? "bg-white/20 text-white" : "bg-background/80"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Heart className="w-8 h-8 stroke-1" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">لا توجد حالات زواج مطابقة</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {searchTerm
                  ? "لم يتم العثور على أي حالة مطابقة لكلمات البحث الحالية."
                  : "لم يتم تسجيل أي حالات زواج في هذا الفرع أو هذا القسم حتى الآن."}
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition shadow cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              تسجيل أول حالة زواج
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCases.map((c) => {
              const weddingDateObj = c.marriageDate ? new Date(c.marriageDate) : null;
              const isPastWedding = weddingDateObj ? weddingDateObj < new Date() : false;

              return (
                <div
                  key={c._id}
                  className="bg-card border border-border hover:border-primary/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Card Top: Person & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-foreground">
                            {c.personName}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                            {RELATIONSHIP_LABELS[c.relationship] || c.relationship}
                          </span>
                        </div>
                        {c.spouseName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            الطرف الآخر: <span className="text-foreground font-medium">{c.spouseName}</span>
                          </p>
                        )}
                      </div>

                      {/* Status Dropdown Badge */}
                      <div className="relative group">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                            c.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : c.status === "in_progress"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              : c.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {c.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {c.status === "in_progress" && <PackageCheck className="w-3.5 h-3.5" />}
                          {c.status === "pending" && <Clock className="w-3.5 h-3.5" />}
                          {c.status === "completed"
                            ? "تمت المساعدة"
                            : c.status === "in_progress"
                            ? "جاري التجهيز"
                            : c.status === "pending"
                            ? "في الانتظار"
                            : "ملغي"}
                        </span>
                      </div>
                    </div>

                    {/* Beneficiary Info */}
                    <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs text-muted-foreground border border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">رب الأسرة / المستفيد:</span>
                        <Link
                          href={`/admin/beneficiaries/${c.beneficiary?._id || ""}`}
                          className="font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <span>{c.beneficiaryName}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>

                      {c.beneficiaryPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{c.beneficiaryPhone}</span>
                        </div>
                      )}

                      {c.beneficiaryAddress && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="line-clamp-1">{c.beneficiaryAddress}</span>
                        </div>
                      )}
                    </div>

                    {/* Wedding Date */}
                    {weddingDateObj && (
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground">موعد الزفاف:</span>
                        <span className="font-semibold text-foreground">
                          {weddingDateObj.toLocaleDateString("ar-EG", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                        {isPastWedding ? (
                          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            تم في الموعد
                          </span>
                        ) : (
                          <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                            قادم قريباً
                          </span>
                        )}
                      </div>
                    )}

                    {/* Items Provided / Goods */}
                    <div className="space-y-2 pt-1 border-t border-border/60">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span className="flex items-center gap-1.5">
                          <PackageCheck className="w-4 h-4 text-primary" />
                          الأجهزة والمنتجات المقدمة ({c.itemsProvided?.length || 0}):
                        </span>
                        <span className="text-primary font-bold">
                          {c.totalCost > 0 ? `${c.totalCost.toLocaleString()} ج.م` : "بدون تكلفة مسجلة"}
                        </span>
                      </div>

                      {c.itemsProvided && c.itemsProvided.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {c.itemsProvided.map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-muted border border-border/60 text-foreground font-medium"
                              title={item.notes ? `${item.itemName}: ${item.notes}` : item.itemName}
                            >
                              <span>{item.itemName}</span>
                              {item.quantity > 1 && (
                                <span className="bg-primary/20 text-primary px-1.5 py-0.2 rounded-full text-[10px]">
                                  ×{item.quantity}
                                </span>
                              )}
                              {item.cost ? (
                                <span className="text-muted-foreground text-[10px]">
                                  ({item.cost * item.quantity} ج.م)
                                </span>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          لم يتم إدراج أجهزة أو منتجات بعد
                        </p>
                      )}

                      {c.cashAssistance && c.cashAssistance > 0 ? (
                        <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800">
                          <Coins className="w-3.5 h-3.5" />
                          <span>مساعدة مالية نقدية: {c.cashAssistance.toLocaleString()} ج.م</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Marriage Certificate & Notes */}
                    {(c.certificateImage || c.notes) && (
                      <div className="pt-2 border-t border-border/60 space-y-1.5 text-xs">
                        {c.certificateImage && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(c.certificateImage || null)}
                            className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium cursor-pointer"
                          >
                            <FileImage className="w-3.5 h-3.5" />
                            <span>معاينة وثيقة / قسيمة الزواج</span>
                          </button>
                        )}
                        {c.notes && (
                          <p className="text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded-lg text-[11px]">
                            {c.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Fast status buttons */}
                      {c.status !== "completed" && (
                        <button
                          onClick={() => handleQuickStatusChange(c._id, "completed")}
                          className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                          title="تحديد كـ تمت المساعدة"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تمت المساعدة</span>
                        </button>
                      )}
                      {c.status !== "in_progress" && c.status !== "completed" && (
                        <button
                          onClick={() => handleQuickStatusChange(c._id, "in_progress")}
                          className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                          title="بدء التجهيز والمساعدة"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>بدء التجهيز</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(c)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition cursor-pointer"
                        title="تعديل الحالة والأجهزة"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCase(c._id, c.personName)}
                        disabled={deletingId === c._id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
                        title="حذف الحالة"
                      >
                        {deletingId === c._id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Add New Marriage Case */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 my-8">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Heart className="w-5 h-5 fill-primary/20" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      تسجيل حالة زواج ومساعدة جديدة
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      إدخال بيانات المقبل على الزواج وتحديد الأجهزة والمستلزمات المقدمة
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl text-sm flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveNewCase} className="space-y-5">
                {/* Beneficiary Picker */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">
                    المستفيد (رب الأسرة) <span className="text-rose-500">*</span>
                  </label>
                  {selectedBeneficiary ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-foreground">{selectedBeneficiary.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {selectedBeneficiary.nationalId && `الرقم القومي: ${selectedBeneficiary.nationalId} | `}
                            {selectedBeneficiary.phone && `الهاتف: ${selectedBeneficiary.phone}`}
                            {selectedBeneficiary.address && ` | العنوان: ${selectedBeneficiary.address}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedBeneficiary(null)}
                          className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
                        >
                          تغيير المستفيد
                        </button>
                      </div>

                      {/* Quick Children Select if available */}
                      {selectedBeneficiary.children && selectedBeneficiary.children.length > 0 && (
                        <div className="p-2.5 bg-muted/40 rounded-xl border border-border/60 space-y-1.5">
                          <span className="text-xs font-semibold text-foreground block">
                            اختيار سريع من أبناء المستفيد:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedBeneficiary.children.map((child: any, idx: number) => (
                              <button
                                key={child._id || idx}
                                type="button"
                                onClick={() => {
                                  setPersonName(child.name || "");
                                  setRelationship(child.gender === "female" ? "daughter" : "son");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-background border border-border text-xs text-foreground hover:border-primary hover:text-primary transition font-medium cursor-pointer"
                              >
                                {child.name} ({child.gender === "female" ? "ابنة" : "ابن"})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={beneficiarySearch}
                          onChange={(e) => setBeneficiarySearch(e.target.value)}
                          placeholder="ابحث باسم المستفيد، الهاتف، أو الرقم القومي..."
                          className="w-full pr-10 pl-4 py-2.5 text-sm bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-background">
                        {isLoadingBeneficiaries && filteredBeneficiaries.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span>جاري البحث في قاعدة البيانات...</span>
                          </div>
                        ) : filteredBeneficiaries.length > 0 ? (
                          filteredBeneficiaries.map((b: any) => (
                            <button
                              key={b._id}
                              type="button"
                              onClick={() => {
                                setSelectedBeneficiary(b);
                                setBeneficiarySearch("");
                              }}
                              className="w-full p-2.5 text-right text-xs hover:bg-muted/70 flex items-center justify-between transition cursor-pointer"
                            >
                              <div>
                                <span className="font-bold text-foreground">{b.name}</span>
                                <span className="text-muted-foreground mr-2 font-normal">
                                  ({b.nationalId || b.phone || "بدون رقم قومي"})
                                </span>
                                {b.address && (
                                  <span className="text-[11px] text-muted-foreground block truncate max-w-sm">
                                    {b.address}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-primary font-medium px-2 py-0.5 rounded bg-primary/10">
                                اختيار
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-muted-foreground">
                            {beneficiarySearch.trim()
                              ? `لا يوجد مستفيد مطابق للبحث "${beneficiarySearch}"`
                              : "لا يوجد مستفيدين مسجلين"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Person details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      اسم المقبل على الزواج <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="اسم العريس / العروسة"
                      required
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      صلة القرابة بالمستفيد
                    </label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                    >
                      <option value="daughter">ابنة المستفيد</option>
                      <option value="son">ابن المستفيد</option>
                      <option value="self">المستفيد نفسه</option>
                      <option value="other">أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      اسم الطرف الآخر (الزوج / الزوجة)
                    </label>
                    <input
                      type="text"
                      value={spouseName}
                      onChange={(e) => setSpouseName(e.target.value)}
                      placeholder="اختياري"
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      موعد الزفاف المتوقع
                    </label>
                    <input
                      type="date"
                      value={marriageDate}
                      onChange={(e) => setMarriageDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      رقم هاتف العريس / العروسة
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="اختياري"
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      حالة المساعدة الحالية
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                    >
                      <option value="pending">في الانتظار والدراسة</option>
                      <option value="in_progress">جاري التجهيز والمساعدة</option>
                      <option value="completed">تمت المساعدة وتجهيز الحالة</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </div>
                </div>

                {/* Goods & Products Section */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <PackageCheck className="w-4 h-4 text-primary" />
                        الأجهزة والمنتجات المقدمة للحالة
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        اختر من الأجهزة السريعة أو أضف جهازاً مخصصاً مع الكمية والتكلفة
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddItem("")}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة جهاز مخصص
                    </button>
                  </div>

                  {/* Common item chips */}
                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-muted/40 rounded-xl border border-border/60">
                    <span className="text-[11px] text-muted-foreground self-center ml-1">إضافة سريعة:</span>
                    {COMMON_ITEMS.map((ci) => (
                      <button
                        key={ci}
                        type="button"
                        onClick={() => handleAddItem(ci)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-background border border-border/80 text-foreground hover:border-primary hover:text-primary transition font-medium cursor-pointer"
                      >
                        + {ci}
                      </button>
                    ))}
                  </div>

                  {/* Items List Rows */}
                  {itemsProvided.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {itemsProvided.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-muted/30 border border-border rounded-xl grid grid-cols-12 gap-2 items-center"
                        >
                          <div className="col-span-5 sm:col-span-5">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleUpdateItem(idx, "itemName", e.target.value)}
                              placeholder="اسم الجهاز / المنتج"
                              required
                              className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                            />
                          </div>

                          <div className="col-span-3 sm:col-span-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, "quantity", Number(e.target.value))}
                              placeholder="الكمية"
                              title="الكمية"
                              className="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none text-center"
                            />
                          </div>

                          <div className="col-span-3 sm:col-span-2">
                            <input
                              type="number"
                              min="0"
                              value={item.cost || ""}
                              onChange={(e) => handleUpdateItem(idx, "cost", Number(e.target.value))}
                              placeholder="السعر ج.م"
                              title="التكلفة بالجنيه"
                              className="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none text-center"
                            />
                          </div>

                          <div className="col-span-11 sm:col-span-2">
                            <input
                              type="text"
                              value={item.notes || ""}
                              onChange={(e) => handleUpdateItem(idx, "notes", e.target.value)}
                              placeholder="ماركة / ملاحظة"
                              className="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg text-foreground focus:ring-1 focus:ring-primary outline-none"
                            />
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-muted-foreground hover:text-rose-600 p-1 transition cursor-pointer"
                              title="حذف"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cash assistance & total */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        مساعدة نقدية إضافية (إن وجدت)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={cashAssistance || ""}
                        onChange={(e) => setCashAssistance(Number(e.target.value))}
                        placeholder="0 ج.م"
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>

                    <div className="p-3 bg-muted/50 rounded-xl border border-border flex items-center justify-between self-end">
                      <span className="text-xs text-muted-foreground font-semibold">إجمالي التكلفة المحسوبة:</span>
                      <span className="text-base font-extrabold text-primary">
                        {formCalculatedTotal.toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>
                </div>

                {/* Certificate & Notes */}
                <div className="space-y-4 pt-3 border-t border-border">
                  <ImageUpload
                    label="صورة وثيقة / قسيمة الزواج (اختياري)"
                    onImageUpload={(url) => setCertificateImage(url)}
                    currentImage={certificateImage}
                  />

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      ملاحظات إضافية حول الحالة أو الأجهزة
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="أية تفاصيل إضافية حول وضع الأسرة أو مواعيد التسليم..."
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Submit buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-xl transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    حفظ حالة الزواج
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Marriage Case */}
        {editingCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 my-8">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      تعديل ومتابعة حالة الزواج
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      المستفيد: {editingCase.beneficiaryName} | الحالة: {editingCase.personName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingCase(null)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl text-sm flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEditCase} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      اسم المقبل على الزواج <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      صلة القرابة
                    </label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                    >
                      <option value="daughter">ابنة المستفيد</option>
                      <option value="son">ابن المستفيد</option>
                      <option value="self">المستفيد نفسه</option>
                      <option value="other">أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      اسم الطرف الآخر (الزوج / الزوجة)
                    </label>
                    <input
                      type="text"
                      value={spouseName}
                      onChange={(e) => setSpouseName(e.target.value)}
                      placeholder="اختياري"
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
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
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      رقم الهاتف
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      حالة المساعدة
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground focus:ring-2 focus:ring-primary outline-none cursor-pointer font-semibold"
                    >
                      <option value="pending">في الانتظار والدراسة</option>
                      <option value="in_progress">جاري التجهيز والمساعدة</option>
                      <option value="completed">تمت المساعدة وتجهيز الحالة</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </div>
                </div>

                {/* Goods list */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <PackageCheck className="w-4 h-4 text-primary" />
                        الأجهزة والمنتجات المقدمة
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddItem("")}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة جهاز مخصص
                    </button>
                  </div>

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1.5 p-2 bg-muted/40 rounded-xl border border-border/60">
                    <span className="text-[11px] text-muted-foreground self-center ml-1">إضافة سريعة:</span>
                    {COMMON_ITEMS.map((ci) => (
                      <button
                        key={ci}
                        type="button"
                        onClick={() => handleAddItem(ci)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-background border border-border text-foreground hover:border-primary hover:text-primary transition font-medium cursor-pointer"
                      >
                        + {ci}
                      </button>
                    ))}
                  </div>

                  {/* Rows */}
                  {itemsProvided.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {itemsProvided.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-muted/30 border border-border rounded-xl grid grid-cols-12 gap-2 items-center"
                        >
                          <div className="col-span-5">
                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleUpdateItem(idx, "itemName", e.target.value)}
                              placeholder="اسم الجهاز"
                              required
                              className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded-lg text-foreground outline-none"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, "quantity", Number(e.target.value))}
                              className="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg text-foreground text-center"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              min="0"
                              value={item.cost || ""}
                              onChange={(e) => handleUpdateItem(idx, "cost", Number(e.target.value))}
                              placeholder="السعر"
                              className="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg text-foreground text-center"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="text"
                              value={item.notes || ""}
                              onChange={(e) => handleUpdateItem(idx, "notes", e.target.value)}
                              placeholder="ملاحظات"
                              className="w-full px-2 py-1.5 text-xs bg-background border border-input rounded-lg text-foreground"
                            />
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-muted-foreground hover:text-rose-600 transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cash assistance & total */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        مساعدة مالية نقدية إضافية
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={cashAssistance || ""}
                        onChange={(e) => setCashAssistance(Number(e.target.value))}
                        placeholder="0 ج.م"
                        className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground outline-none"
                      />
                    </div>

                    <div className="p-3 bg-muted/50 rounded-xl border border-border flex items-center justify-between self-end">
                      <span className="text-xs text-muted-foreground font-semibold">إجمالي التكلفة:</span>
                      <span className="text-base font-extrabold text-primary">
                        {formCalculatedTotal.toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>
                </div>

                {/* Certificate & Notes */}
                <div className="space-y-4 pt-3 border-t border-border">
                  <ImageUpload
                    label="صورة وثيقة / قسيمة الزواج"
                    onImageUpload={(url) => setCertificateImage(url)}
                    currentImage={certificateImage}
                  />

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      ملاحظات حول الحالة
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm bg-background border border-input rounded-xl text-foreground outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Submit buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditingCase(null)}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-xl transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Preview Certificate Image */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="relative max-w-3xl max-h-[90vh] bg-card rounded-2xl overflow-hidden shadow-2xl p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition"
              >
                <X className="w-5 h-5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="وثيقة الزواج"
                className="max-h-[85vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

