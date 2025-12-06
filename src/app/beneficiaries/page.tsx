"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import BeneficiaryCard from "@/components/BeneficiaryCard";
import BeneficiaryFilterPanel, { BeneficiaryFilterCriteria } from "@/components/BeneficiaryFilterPanel";
import SearchFilterBar from "@/components/SearchFilterBar";
import { Loader2, Plus, Users, AlertCircle, ArrowDownUp } from "lucide-react";
import { useRouter } from "next/navigation";

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
}

export default function BeneficiariesPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<BeneficiaryFilterCriteria>({});
  const [sortByNationalId, setSortByNationalId] = useState(true);

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const canAccessBeneficiaries = role === "admin" || role === "member";
  const isAdmin = role === "admin";

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

  useEffect(() => {
    if (!isLoaded || !canAccessBeneficiaries) {
      return;
    }

    const fetchBeneficiaries = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/beneficiaries", { cache: "no-store" });
        const data = await res.json();

        if (res.ok) {
          setBeneficiaries(data.beneficiaries);
        } else {
          setError(data.error || "حدث خطأ");
        }
      } catch (err) {
        console.error(err);
        setError("فشل تحميل البيانات");
      } finally {
        setLoading(false);
      }
    };

    fetchBeneficiaries();
  }, [isLoaded, canAccessBeneficiaries]);

  const filteredBeneficiaries = useMemo(() => {
    let result = beneficiaries;

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

    // Sort by nationalId
    result.sort((a, b) => {
      const aId = parseInt(a.nationalId || "0", 10);
      const bId = parseInt(b.nationalId || "0", 10);
      return sortByNationalId ? aId - bId : bId - aId;
    });

    return result;
  }, [beneficiaries, debouncedSearch, filters, sortByNationalId]);

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
              إجمالي المستفيدين: {filteredBeneficiaries.length} {debouncedSearch || Object.keys(filters).length > 0 ? `من ${beneficiaries.length}` : ""}
            </p>
          </div>

          {isAdmin && (
            <Link
              href="/admin/beneficiaries/add"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md"
            >
              <Plus className="ml-2 h-5 w-5" />
              إضافة مستفيد
            </Link>
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
                placeholder="ابحث بالاسم، الهاتف، العنوان، رقم المستفيد، أو الواتساب"
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
            {filteredBeneficiaries.map((beneficiary) => (
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
                  onView={() => router.push(`/beneficiaries/${beneficiary._id}`)}
                  isReadOnly={!isAdmin}
                  onEdit={isAdmin ? () => router.push(`/admin/beneficiaries/${beneficiary._id}/edit`) : undefined}
                />
              </div>
            ))}
          </div>
        )}

        {/* No Results State */}
        {!loading && filteredBeneficiaries.length === 0 && beneficiaries.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-12 text-center shadow-sm">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">لم يتم العثور على نتائج</h3>
            <p className="text-muted-foreground mt-2">
              حاول تغيير معايير البحث أو الفلترة
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && beneficiaries.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-12 text-center shadow-sm">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">لا توجد بيانات حالياً</h3>
            <p className="text-muted-foreground mt-2">
              لم يتم إضافة أي مستفيدين بعد
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
