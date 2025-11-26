"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import BeneficiaryCard from "@/components/BeneficiaryCard";
import { useState } from "react";

interface Beneficiary {
  _id: string;
  name: string;
  phone: string;
  address: string;
  familyMembers: number;
  priority: number;
  profileImage?: string;
}

export default function AdminBeneficiaries() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    const fetchBeneficiaries = async () => {
      try {
        const res = await fetch("/api/beneficiaries");
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
      <div className="flex justify-center items-center min-h-screen">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link
              href="/admin/dashboard"
              className="text-blue-600 hover:text-blue-700 mb-4 inline-block"
            >
              ← العودة للوحة التحكم
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              إدارة المستفيدين
            </h1>
          </div>

          <Link
            href="/admin/beneficiaries/add"
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
          >
            ➕ إضافة مستفيد جديد
          </Link>
        </div>

        {/* Beneficiaries Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <p>جاري التحميل...</p>
          </div>
        ) : beneficiaries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {beneficiaries.map((beneficiary) => (
              <div key={beneficiary._id}>
                <BeneficiaryCard
                  id={beneficiary._id}
                  name={beneficiary.name}
                  phone={beneficiary.phone}
                  address={beneficiary.address}
                  familyMembers={beneficiary.familyMembers}
                  priority={beneficiary.priority}
                  profileImage={beneficiary.profileImage}
                  onEdit={() =>
                    router.push(`/admin/beneficiaries/${beneficiary._id}/edit`)
                  }
                  onDelete={() => handleDelete(beneficiary._id)}
                  isReadOnly={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 text-lg">لا توجد مستفيدين حالياً</p>
            <Link
              href="/admin/beneficiaries/add"
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              إضافة الأول
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
