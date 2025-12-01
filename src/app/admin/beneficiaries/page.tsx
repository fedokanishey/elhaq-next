"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BeneficiaryCard from "@/components/BeneficiaryCard";
import BeneficiaryFilterPanel, { BeneficiaryFilterCriteria } from "@/components/BeneficiaryFilterPanel";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

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
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<BeneficiaryFilterCriteria>({});

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    const fetchBeneficiaries = async () => {
      try {
        const res = await fetch("/api/beneficiaries", { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setBeneficiaries(data.beneficiaries);
        }
      } catch (error) {
        console.error("Error fetching beneficiaries:", error);
      } finally {
        setLoading(false);
      }
    };

    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role === "admin") {
      fetchBeneficiaries();
    }
  }, [isLoaded, user]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

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

    return result;
  }, [beneficiaries, debouncedSearch, filters]);

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستفيد؟")) return;

    try {
      const res = await fetch(`/api/beneficiaries/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setBeneficiaries((prev) => prev.filter((b) => b._id !== id));
      } else {
        alert("فشل حذف المستفيد");
      }
    } catch (error) {
      console.error("Error deleting beneficiary:", error);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        <p>جاري التحميل...</p>
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

          <Link
            href="/admin/beneficiaries/add"
            className="w-full sm:w-auto px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium text-center transition-colors"
          >
            ➕ إضافة مستفيد جديد
          </Link>
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="beneficiaries-search"
                  type="text"
                  placeholder="ابحث بالاسم، الهاتف، العنوان، رقم المستفيد، أو الواتساب"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-10 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <BeneficiaryFilterPanel onFilterChange={setFilters} variant="dropdown" />
          </div>
          {(debouncedSearch || Object.values(filters).some(Boolean)) && (
            <p className="text-xs text-muted-foreground">
              النتائج المطابقة: {filteredBeneficiaries.length}
            </p>
          )}
        </div>

        {/* Beneficiaries Grid */}
        {loading ? (
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
                  onView={() => router.push(`/admin/beneficiaries/${beneficiary._id}`)}
                  onEdit={() =>
                    router.push(`/admin/beneficiaries/${beneficiary._id}/edit`)
                  }
                  onDelete={() => handleDelete(beneficiary._id)}
                  isReadOnly={false}
                />
              </div>
            ))}
          </div>
        ) : beneficiaries.length > 0 ? (
          <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
            <p className="text-muted-foreground text-lg">
              لا توجد نتائج مطابقة للبحث الحالي
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
            <p className="text-muted-foreground text-lg">لا توجد مستفيدين حالياً</p>
            <Link
              href="/admin/beneficiaries/add"
              className="inline-block mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              إضافة الأول
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
