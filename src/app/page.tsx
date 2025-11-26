"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

export default function Home() {
  const { user, isLoaded } = useUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-blue-900">
            دعوة الحق
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-12">
            نظام إدارة العمل الخيري الشامل
          </p>

          {!isLoaded ? (
            <div className="text-gray-600">جاري التحميل...</div>
          ) : user ? (
            // Logged in users
            <div className="space-y-6">
              <p className="text-gray-700 mb-4">أهلاً {user.firstName || "بك"}</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                {(user?.publicMetadata?.role === "admin" || user?.unsafeMetadata?.role === "admin") && (
                  <Link
                    href="/admin/dashboard"
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition block"
                  >
                    لوحة التحكم
                  </Link>
                )}
                <Link
                  href="/beneficiaries"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition block"
                >
                  المستفيدين
                </Link>
                <Link
                  href="/profile"
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition block"
                >
                  الملف الشخصي
                </Link>
              </div>
            </div>
          ) : (
            // Not logged in
            <div className="space-y-6">
              <div className="flex gap-4 justify-center flex-col sm:flex-row">
                <Link
                  href="/sign-in"
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold transition"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href="/sign-up"
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-lg font-semibold transition"
                >
                  إنشاء حساب
                </Link>
              </div>

              <div className="mt-12 pt-8 border-t border-gray-300 max-w-md mx-auto">
                <p className="text-gray-600 mb-4">استعرض المستفيدين:</p>
                <Link
                  href="/beneficiaries"
                  className="inline-block px-6 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-200 transition"
                >
                  عرض المستفيدين
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
