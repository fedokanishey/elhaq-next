"use client";

import { useUser, UserProfile } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function AdminSettings() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/admin/dashboard" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← العودة للوحة التحكم
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">إعدادات النظام</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6 border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">إعدادات الحساب</h2>
            <p className="text-gray-600">إدارة بيانات حسابك الشخصي والأمان.</p>
          </div>
          
          <div className="flex justify-center">
            <UserProfile routing="hash" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <div className="mb-6 border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">إعدادات التطبيق</h2>
            <p className="text-gray-600">إعدادات عامة للنظام (قريباً).</p>
          </div>
          <div className="text-center py-8 text-gray-500">
            سيتم إضافة إعدادات المظهر والإشعارات هنا قريباً.
          </div>
        </div>
      </div>
    </div>
  );
}
