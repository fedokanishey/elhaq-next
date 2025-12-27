"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BeneficiaryCard from "@/components/BeneficiaryCard";
import BeneficiaryFilterPanel, { BeneficiaryFilterCriteria } from "@/components/BeneficiaryFilterPanel";
import SearchFilterBar from "@/components/SearchFilterBar";
import { useEffect, useMemo, useState } from "react";
import { Search, ArrowDownUp, Download } from "lucide-react";
import BeneficiariesPrintModal from "@/components/BeneficiariesPrintModal";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import BeneficiaryModal from "@/components/BeneficiaryModal";

interface Beneficiary {
  _id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  address: string;
  nationalId?: string;
  familyMembers: number;
  priority: number;
  profileImage?: string;
  idImage?: string;
  maritalStatus?: string;
  healthStatus?: "healthy" | "sick";
  housingType?: "owned" | "rented";
  employment?: string;
  acceptsMarriage?: boolean;
  marriageDetails?: string;
  status?: "active" | "cancelled" | "pending";
  statusDate?: string;
  createdAt?: string;
  listName?: string; // Deprecated: kept for backward compatibility
  listNames?: string[]; // New: supports multiple lists
  receivesMonthlyAllowance?: boolean;
  monthlyAllowanceAmount?: number;
  spouse?: {
    name?: string;
    nationalId?: string;
    phone?: string;
    whatsapp?: string;
  };
  children?: Array<{ name?: string; nationalId?: string; school?: string; educationStage?: string }>;
  notes?: string;
}

export default function AdminBeneficiaries() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<BeneficiaryFilterCriteria>({});
  const [sortByNationalId, setSortByNationalId] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | undefined>(undefined);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");

  const handleOpenEdit = (id: string) => {
    setSelectedBeneficiaryId(id);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const handleOpenView = (id: string) => {
    setSelectedBeneficiaryId(id);
    setModalMode("view");
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setSelectedBeneficiaryId(undefined);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isAdmin = role === "admin";

  // Fetch beneficiaries with SWR
  const { data, error, isLoading, mutate } = useSWR<{ beneficiaries: Beneficiary[] }>(
    isLoaded && isAdmin ? "/api/beneficiaries" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  useEffect(() => {
    if (isLoaded && !isAdmin) {
      router.push("/");
    }
  }, [isLoaded, isAdmin, router]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const filteredBeneficiaries = useMemo(() => {
    let result = data?.beneficiaries || [];

    // Apply text search filter
    if (debouncedSearch) {
      const normalize = (value?: string | number) =>
        typeof value === "number"
          ? value.toString()
          : (value || "")
              .toString()
              .toLowerCase()
              .normalize("NFKD")
              .replace(/[\u064B-\u065F]/g, "");

      const query = normalize(debouncedSearch);

      result = result.filter((beneficiary) => {
        const spouseName = normalize(beneficiary.spouse?.name);
        const childrenText = (beneficiary.children ?? [])
          .map((child) =>
            normalize(`${child.name ?? ""} ${child.nationalId ?? ""} ${child.school ?? ""}`)
          )
          .join(" ");

        // If searchByBeneficiaryId is enabled, only search by nationalId
        if (filters.searchByBeneficiaryId) {
          return normalize(beneficiary.nationalId).includes(query);
        }

        const searchableText = [
          normalize(beneficiary.name),
          normalize(beneficiary.phone),
          normalize(beneficiary.whatsapp),
          normalize(beneficiary.address),
          normalize(beneficiary.nationalId),
          normalize(beneficiary.maritalStatus),
          normalize(beneficiary.priority),
          normalize(beneficiary.familyMembers),
          spouseName,
          normalize(beneficiary.spouse?.phone),
          normalize(beneficiary.spouse?.whatsapp),
          normalize(beneficiary.notes),
          childrenText,
        ]
          .filter(Boolean)
          .join(" ");

        return spouseName.includes(query) || searchableText.includes(query);
      });
    }

    // Apply filter criteria
    if (filters.city) {
      const normalizedCity = filters.city.toLowerCase().trim();
      result = result.filter((b) =>
        b.address?.toLowerCase().includes(normalizedCity)
      );
    }

    if (filters.healthStatus) {
      result = result.filter((b) => b.healthStatus === filters.healthStatus);
    }

    if (filters.housingType) {
      result = result.filter((b) => b.housingType === filters.housingType);
    }

    if (filters.employment) {
      const normalizedEmployment = filters.employment.toLowerCase().trim();
      result = result.filter((b) =>
        b.employment?.toLowerCase().includes(normalizedEmployment)
      );
    }

    if (filters.priorityMin !== undefined || filters.priorityMax !== undefined) {
      result = result.filter((b) => {
        const min = filters.priorityMin ?? 1;
        const max = filters.priorityMax ?? 10;
        return b.priority >= min && b.priority <= max;
      });
    }

    if (filters.acceptsMarriage) {
      result = result.filter((b) => b.acceptsMarriage === true);
    }

    if (filters.receivesMonthlyAllowance) {
      result = result.filter((b) => b.receivesMonthlyAllowance === true);
    }

    if (filters.status) {
      result = result.filter((b) => (b.status || "active") === filters.status);
    }

    if (filters.listName) {
      const normalizedListName = filters.listName.toLowerCase().trim();
      result = result.filter((b) => {
        // Support both old listName and new listNames
        const lists = b.listNames?.length ? b.listNames : (b.listName ? [b.listName] : ["الكشف العام"]);
        return lists.some((name: string) => name.toLowerCase().includes(normalizedListName));
      });
    }

    // Sort by date (oldest first) if filtering by pending status, otherwise sort by nationalId
    if (filters.status === "pending") {
      result = [...result].sort((a, b) => {
        const dateA = new Date(a.statusDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.statusDate || b.createdAt || 0).getTime();
        return dateA - dateB; // Oldest first
      });
    } else {
      // Sort by nationalId
      result = [...result].sort((a, b) => {
        const aId = parseInt(a.nationalId || "0", 10);
        const bId = parseInt(b.nationalId || "0", 10);
        return sortByNationalId ? aId - bId : bId - aId;
      });
    }

    return result;
  }, [data?.beneficiaries, debouncedSearch, filters, sortByNationalId]);

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستفيد؟")) return;

    try {
      const res = await fetch(`/api/beneficiaries/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Trigger revalidation after delete
        window.location.reload();
      } else {
        alert("فشل حذف المستفيد");
      }
    } catch (error) {
      console.error("Error deleting beneficiary:", error);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-destructive">
        <p>حدث خطأ أثناء تحميل البيانات</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link
              href="/admin/dashboard"
              className="text-muted-foreground hover:text-primary mb-4 inline-flex items-center gap-2 transition-colors"
            >
              ← العودة للوحة التحكم
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              إدارة المستفيدين
            </h1>
          </div>

          <button
            onClick={handleOpenCreate}
            className="w-full sm:w-auto px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium text-center transition-colors"
          >
            ➕ إضافة مستفيد جديد
          </button>
        </div>

        {/* Search & Filter Bar */}
        {/* ... (keep existing search logic, just replacing the block to fit context if needed, but here I'll try to target specific blocks or use larger replacement if safer) */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full">
              <label
                htmlFor="beneficiaries-search"
                className="block text-sm font-medium text-muted-foreground mb-2"
              >
                ابحث عن مستفيد
              </label>
              <SearchFilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder={filters.searchByBeneficiaryId ? "ابحث برقم المستفيد..." : "ابحث بالاسم، الهاتف، العنوان، رقم المستفيد، أو الواتساب"}
                onClearSearch={() => setSearchTerm("")}
              />
            </div>
            <BeneficiaryFilterPanel onFilterChange={setFilters} variant="dropdown" />
            <button
              onClick={() => setSortByNationalId(!sortByNationalId)}
              className="px-4 py-3 bg-card border border-border rounded-lg text-foreground hover:bg-muted transition-colors inline-flex items-center gap-2"
              type="button"
              title={sortByNationalId ? "ترتيب تصاعدي - انقر للتبديل إلى تنازلي" : "ترتيب تنازلي - انقر للتبديل إلى تصاعدي"}
            >
              <span className="text-sm">{sortByNationalId ? "↑" : "↓"}</span>
              رقم المستفيد
            </button>
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2 font-medium"
              type="button"
              title="تصدير PDF"
            >
              <Download className="w-4 h-4" />
              طباعة
            </button>
          </div>
          {(debouncedSearch || Object.values(filters).some(Boolean)) && (
            <p className="text-xs text-muted-foreground">
              النتائج المطابقة: {filteredBeneficiaries.length}
            </p>
          )}
        </div>

        {/* Beneficiaries Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <p>جاري التحميل...</p>
          </div>
        ) : filteredBeneficiaries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredBeneficiaries.map((beneficiary) => (
              <div key={beneficiary._id}>
                <BeneficiaryCard
                  id={beneficiary._id}
                  name={beneficiary.name}
                  phone={beneficiary.phone}
                  whatsapp={beneficiary.whatsapp}
                  address={beneficiary.address}
                  nationalId={beneficiary.nationalId}
                  familyMembers={beneficiary.familyMembers}
                  priority={beneficiary.priority}
                  profileImage={beneficiary.profileImage}
                  idImage={beneficiary.idImage}
                  maritalStatus={beneficiary.maritalStatus}
                  spouseName={beneficiary.spouse?.name}
                  receivesMonthlyAllowance={beneficiary.receivesMonthlyAllowance}
                  monthlyAllowanceAmount={beneficiary.monthlyAllowanceAmount}
                  onView={() => handleOpenView(beneficiary._id)}
                  onEdit={() => handleOpenEdit(beneficiary._id)}
                  onDelete={() => handleDelete(beneficiary._id)}
                  isReadOnly={false}
                />
              </div>
            ))}
          </div>
        ) : (data?.beneficiaries || []).length > 0 ? (
          <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
            <p className="text-muted-foreground text-lg">
              لا توجد نتائج مطابقة للبحث الحالي
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
            <p className="text-muted-foreground text-lg">لا توجد مستفيدين حالياً</p>
            <button
              onClick={handleOpenCreate}
              className="inline-block mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              إضافة الأول
            </button>
          </div>
        )}

        {/* Print Modal */}
        <BeneficiariesPrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          beneficiaries={filteredBeneficiaries}
          title="تقرير المستفيدين"
        />

        {/* Edit/Create Modal */}
        <BeneficiaryModal 
          isOpen={isModalOpen}
          initialMode={modalMode}
          onClose={() => setIsModalOpen(false)}
          beneficiaryId={selectedBeneficiaryId}
          onSuccess={() => mutate()} // Use mutate from useSWR
        />
      </div>
    </div>
  );
}
