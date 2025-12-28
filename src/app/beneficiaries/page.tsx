"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import Link from "next/link";
import BeneficiaryCard from "@/components/BeneficiaryCard";
import BeneficiaryFilterPanel, { BeneficiaryFilterCriteria } from "@/components/BeneficiaryFilterPanel";
import SearchFilterBar from "@/components/SearchFilterBar";
import { Loader2, Plus, Users, AlertCircle, ArrowDownUp, Printer, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import MonthlyAllowancePrintModal from "@/components/MonthlyAllowancePrintModal";
import BeneficiariesPrintModal from "@/components/BeneficiariesPrintModal";
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
  spouse?: {
    name?: string;
    nationalId?: string;
    phone?: string;
    whatsapp?: string;
  };
  children?: Array<{ name?: string; nationalId?: string; school?: string; educationStage?: string }>;
  notes?: string;
  status?: "active" | "cancelled" | "pending";
  listName?: string;
  listNames?: string[];
  receivesMonthlyAllowance?: boolean;
  monthlyAllowanceAmount?: number;
  statusDate?: string;
  createdAt?: string;
  loanDetails?: {
    loanId: string;
    amount: number;
    startDate: string;
    status: "active" | "completed" | "defaulted";
  };
}

export default function BeneficiariesPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<BeneficiaryFilterCriteria>({});
  const [sortByNationalId, setSortByNationalId] = useState(true);
  const [showMonthlyAllowancePrint, setShowMonthlyAllowancePrint] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Modal State
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
    setSelectedBeneficiaryId(undefined); // Create mode
    setModalMode("create");
    setIsModalOpen(true);
  };

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const canAccessBeneficiaries = role === "admin" || role === "member";
  const isAdmin = role === "admin";

  const { data, error: swrError, isLoading, mutate } = useSWR(
    isLoaded && canAccessBeneficiaries ? "/api/beneficiaries" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const loading = isLoading;
  const error = swrError ? "فشل تحميل البيانات" : "";

  useEffect(() => {
    if (!isLoaded) return;
    if (!canAccessBeneficiaries) {
      router.replace("/");
    }
  }, [isLoaded, canAccessBeneficiaries, router]);

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

      result = result.filter((beneficiary: Beneficiary) => {
        const spouseName = normalize(beneficiary.spouse?.name);
        const childrenText = (beneficiary.children ?? [])
          .map((child: { name?: string; nationalId?: string; school?: string }) =>
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
      result = result.filter((b: Beneficiary) =>
        b.address?.toLowerCase().includes(normalizedCity)
      );
    }

    if (filters.healthStatus) {
      result = result.filter((b: Beneficiary) => b.healthStatus === filters.healthStatus);
    }

    if (filters.housingType) {
      result = result.filter((b: Beneficiary) => b.housingType === filters.housingType);
    }

    if (filters.employment) {
      const normalizedEmployment = filters.employment.toLowerCase().trim();
      result = result.filter((b: Beneficiary) =>
        b.employment?.toLowerCase().includes(normalizedEmployment)
      );
    }

    if (filters.priorityMin !== undefined || filters.priorityMax !== undefined) {
      result = result.filter((b: Beneficiary) => {
        const min = filters.priorityMin ?? 1;
        const max = filters.priorityMax ?? 10;
        return b.priority >= min && b.priority <= max;
      });
    }

    if (filters.acceptsMarriage) {
      result = result.filter((b: Beneficiary) => b.acceptsMarriage === true);
    }

    if (filters.receivesMonthlyAllowance) {
      result = result.filter((b: Beneficiary) => b.receivesMonthlyAllowance === true);
    }

    if (filters.status) {
      result = result.filter((b: Beneficiary) => (b.status || "active") === filters.status);
    }

    if (filters.listName) {
      const normalizedListName = filters.listName.toLowerCase().trim();
      result = result.filter((b: Beneficiary) =>
        (b.listName || "الكشف العام").toLowerCase().includes(normalizedListName)
      );
    }

    // Sort by date (oldest first) if filtering by pending status, otherwise sort by nationalId
    if (filters.status === "pending") {
      result = [...result].sort((a: Beneficiary, b: Beneficiary) => {
        const dateA = new Date(a.statusDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.statusDate || b.createdAt || 0).getTime();
        return dateA - dateB; // Oldest first
      });
    } else {
      // Sort by nationalId
      result = [...result].sort((a: Beneficiary, b: Beneficiary) => {
        const aId = parseInt(a.nationalId || "0", 10);
        const bId = parseInt(b.nationalId || "0", 10);
        return sortByNationalId ? aId - bId : bId - aId;
      });
    }

    return result;
  }, [data?.beneficiaries, debouncedSearch, filters, sortByNationalId]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccessBeneficiaries) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        جاري تحويلك للصفحة الرئيسية...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              المستفيدين
            </h1>
            <p className="mt-2 text-muted-foreground">
              إجمالي المستفيدين: {filteredBeneficiaries.length} {debouncedSearch || Object.keys(filters).length > 0 ? `من ${(data?.beneficiaries || []).length}` : ""}
            </p>
          </div>

          {isAdmin && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowMonthlyAllowancePrint(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md"
              >
                <Printer className="ml-2 h-5 w-5" />
                طباعة الكشوف
              </button>
              <button
                onClick={handleOpenCreate}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md"
              >
                <Plus className="ml-2 h-5 w-5" />
                إضافة مستفيد
              </button>
            </div>
          )}
        </div>

        {/* Search & Filter Bar */}
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
              title={sortByNationalId ? "ترتيب تصاعدي حسب رقم المستفيد" : "ترتيب تنازلي حسب رقم المستفيد"}
            >
              <ArrowDownUp className="w-4 h-4" />
              <span className="text-sm">{sortByNationalId ? "↑" : "↓"}</span>
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
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Beneficiaries Grid */}
        {!loading && filteredBeneficiaries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredBeneficiaries.map((beneficiary: Beneficiary) => (
              <div key={beneficiary._id} className="h-full">
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
                  listName={beneficiary.listName}
                  listNames={beneficiary.listNames}
                  loanDetails={beneficiary.loanDetails as any}
                  onView={() => handleOpenView(beneficiary._id)}
                  isReadOnly={!isAdmin}
                  onEdit={isAdmin ? () => handleOpenEdit(beneficiary._id) : undefined}
                />
              </div>
            ))}
          </div>
        )}

        {/* ... (Empty States) ... */}
        
        {/* No Results State */}
        {!loading && filteredBeneficiaries.length === 0 && (data?.beneficiaries || []).length > 0 && (
          <div className="bg-card border border-border rounded-lg p-12 text-center shadow-sm">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">لم يتم العثور على نتائج</h3>
            <p className="text-muted-foreground mt-2">
              حاول تغيير معايير البحث أو الفلترة
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && (data?.beneficiaries || []).length === 0 && (
          <div className="bg-card border border-border rounded-lg p-12 text-center shadow-sm">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">لا توجد بيانات حالياً</h3>
            <p className="text-muted-foreground mt-2">
              لم يتم إضافة أي مستفيدين بعد
            </p>
          </div>
        )}
        
        {/* Print Modal */}
        {showMonthlyAllowancePrint && (
          <MonthlyAllowancePrintModal
            isOpen={showMonthlyAllowancePrint}
            onClose={() => setShowMonthlyAllowancePrint(false)}
            beneficiaries={(data?.beneficiaries || []).map((b: Beneficiary) => ({
              _id: b._id,
              name: b.name,
              nationalId: b.nationalId,
              monthlyAllowanceAmount: b.monthlyAllowanceAmount,
              receivesMonthlyAllowance: b.receivesMonthlyAllowance,
              listName: b.listName,
              listNames: b.listNames,
            }))}
          />
        )}

        {/* General Print Modal */}
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
          onSuccess={() => mutate()}
        />
      </div>
    </div>
  );
}
