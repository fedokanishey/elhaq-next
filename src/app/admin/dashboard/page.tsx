"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DashboardStats {
  totalInitiatives: number;
  totalBeneficiaries: number;
  totalAmountSpent: number;
  initiativesByStatus: {
    planned: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  totalUsers: number;
  activeCases: number;
}

export default function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/reports");
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    if (isLoaded) {
      fetchStats();
    }
  }, [isLoaded]);

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
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            لوحة التحكم - إدارة النظام
          </h1>
          <p className="text-gray-600">مرحباً بك {user?.firstName || "المسؤول"}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-blue-600">{stats?.totalBeneficiaries || 0}</div>
            <p className="text-gray-600 mt-2">إجمالي المستفيدين</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-green-600">{stats?.activeCases || 0}</div>
            <p className="text-gray-600 mt-2">الحالات النشطة</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-purple-600">{stats?.totalUsers || 0}</div>
            <p className="text-gray-600 mt-2">المستخدمين</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-orange-600">{stats?.totalInitiatives || 0}</div>
            <p className="text-gray-600 mt-2">المبادرات</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/admin/beneficiaries"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="text-2xl mb-2">👥</div>
            <h3 className="text-lg font-bold text-gray-900">إدارة المستفيدين</h3>
            <p className="text-gray-600 mt-2">إضافة وتعديل وحذف المستفيدين</p>
          </Link>

          <Link
            href="/admin/beneficiaries/add"
            className="bg-blue-50 rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="text-2xl mb-2">➕</div>
            <h3 className="text-lg font-bold text-blue-900">إضافة مستفيد جديد</h3>
            <p className="text-blue-700 mt-2">إضافة حالة جديدة إلى النظام</p>
          </Link>

          <Link
            href="/admin/initiatives"
            className="bg-green-50 rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="text-lg font-bold text-green-900">المبادرات</h3>
            <p className="text-green-700 mt-2">إدارة المبادرات والمشاريع</p>
          </Link>

          <Link
            href="/admin/users"
            className="bg-purple-50 rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="text-2xl mb-2">👤</div>
            <h3 className="text-lg font-bold text-purple-900">المستخدمين</h3>
            <p className="text-purple-700 mt-2">إدارة صلاحيات المستخدمين</p>
          </Link>

          <Link
            href="/admin/settings"
            className="bg-orange-50 rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="text-2xl mb-2">⚙️</div>
            <h3 className="text-lg font-bold text-orange-900">الإعدادات</h3>
            <p className="text-orange-700 mt-2">إعدادات النظام والتكوينات</p>
          </Link>

          <Link
            href="/admin/reports"
            className="bg-red-50 rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="text-2xl mb-2">📊</div>
            <h3 className="text-lg font-bold text-red-900">التقارير</h3>
            <p className="text-red-700 mt-2">عرض التقارير والإحصائيات</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
