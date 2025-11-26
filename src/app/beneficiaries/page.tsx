"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import BeneficiaryCard from "@/components/BeneficiaryCard";

interface Beneficiary {
  _id: string;
  name: string;
  phone: string;
  address: string;
  familyMembers: number;
  priority: number;
  profileImage?: string;
}

export default function BeneficiariesPage() {
  const { user, isLoaded } = useUser();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchBeneficiaries = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/beneficiaries");
        const data = await res.json();

        if (res.ok) {
          setBeneficiaries(data.beneficiaries);
        } else {
          setError(data.error || "حدث خطأ");
        }
      } catch (err) {
        setError("فشل تحميل البيانات");
      } finally {
        setLoading(false);
      }
    };

    fetchBeneficiaries();
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  const isAdmin = user?.publicMetadata?.role === "admin" || user?.unsafeMetadata?.role === "admin";

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                المستفيدين
              </h1>
              <p className="mt-2 text-gray-600">
                إجمالي المستفيدين: {beneficiaries.length}
              </p>
            </div>

            {isAdmin && (
              <Link
                href="/admin/beneficiaries/add"
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
              >
                ➕ إضافة مستفيد
              </Link>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <p>جاري التحميل...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Beneficiaries Grid */}
        {!loading && beneficiaries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {beneficiaries.map((beneficiary) => (
              <Link
                key={beneficiary._id}
                href={`/beneficiaries/${beneficiary._id}`}
              >
                <div className="cursor-pointer">
                  <BeneficiaryCard
                    id={beneficiary._id}
                    name={beneficiary.name}
                    phone={beneficiary.phone}
                    address={beneficiary.address}
                    familyMembers={beneficiary.familyMembers}
                    priority={beneficiary.priority}
                    profileImage={beneficiary.profileImage}
                    isReadOnly={!isAdmin}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && beneficiaries.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 text-lg">لا توجد بيانات حالياً</p>
          </div>
        )}
      </div>
    </div>
  );
}
