"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface ReportsStats {
  totalInitiatives: number;
  totalBeneficiaries: number;
  totalAmountSpent: number;
  initiativesByStatus: {
    planned: number;
    active: number;
    completed: number;
    cancelled: number;
  };
}

export default function AdminReports() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<ReportsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch("/api/reports");
        const data = await res.json();
        if (res.ok) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded) {
      fetchReports();
    }
  }, [isLoaded]);

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/admin/dashboard" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← العودة للوحة التحكم
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">التقارير والإحصائيات</h1>
        </div>

        {loading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6 border-r-4 border-blue-500">
                <h3 className="text-gray-500 text-sm font-medium">إجمالي المبادرات</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalInitiatives}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border-r-4 border-green-500">
                <h3 className="text-gray-500 text-sm font-medium">إجمالي المستفيدين</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalBeneficiaries}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border-r-4 border-purple-500">
                <h3 className="text-gray-500 text-sm font-medium">إجمالي المصروفات</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalAmountSpent.toLocaleString()} ج.م</p>
              </div>
            </div>

            {/* Initiatives Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">حالة المبادرات</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <span className="block text-2xl font-bold text-gray-700">{stats.initiativesByStatus.planned}</span>
                  <span className="text-sm text-gray-500">مخططة</span>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <span className="block text-2xl font-bold text-green-700">{stats.initiativesByStatus.active}</span>
                  <span className="text-sm text-green-600">نشطة</span>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <span className="block text-2xl font-bold text-blue-700">{stats.initiativesByStatus.completed}</span>
                  <span className="text-sm text-blue-600">مكتملة</span>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <span className="block text-2xl font-bold text-red-700">{stats.initiativesByStatus.cancelled}</span>
                  <span className="text-sm text-red-600">ملغاة</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-red-600">فشل تحميل البيانات</div>
        )}
      </div>
    </div>
  );
}
