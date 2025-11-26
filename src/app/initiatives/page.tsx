"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function InitiativesPage() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700">
            ← العودة للرئيسية
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900">إدارة المبادرات</h1>
            <p className="mt-2 text-gray-600">مرحباً {user?.firstName || "المستخدم"}</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900">إنشاء مبادرة جديدة</h3>
                <p className="mt-2 text-blue-700">قم بإنشاء مبادرة جديدة</p>
              </div>

              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-900">المبادرات النشطة</h3>
                <p className="mt-2 text-green-700">عرض قائمة المبادرات النشطة</p>
              </div>

              <div className="bg-purple-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900">التقدم والإحصائيات</h3>
                <p className="mt-2 text-purple-700">عرض تقدم المبادرات</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
