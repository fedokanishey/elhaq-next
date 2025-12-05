"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import BeneficiaryCard from "@/components/BeneficiaryCard";
import { Loader2, Plus, Users, AlertCircle } from "lucide-react";
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
  spouse?: {
    name?: string;
    nationalId?: string;
    phone?: string;
    whatsapp?: string;
  };
}

export default function BeneficiariesPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const canAccessBeneficiaries = role === "admin" || role === "member";

  useEffect(() => {
    if (!isLoaded) return;
    if (!canAccessBeneficiaries) {
      router.replace("/");
    }
  }, [isLoaded, canAccessBeneficiaries, router]);

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

  const isAdmin = role === "admin";

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
              إجمالي المستفيدين المسجلين: {beneficiaries.length}
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
        {!loading && beneficiaries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {beneficiaries.map((beneficiary) => (
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
