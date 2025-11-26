"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function ProfilePage() {
  const { user } = useUser();

  // Trigger sync with MongoDB
  useEffect(() => {
    if (user) {
      fetch('/api/users').catch(console.error);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700">
            ← العودة للرئيسية
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-8 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">الملف الشخصي</h1>
                <p className="mt-2 text-gray-600">إدارة بيانات حسابك</p>
              </div>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">الاسم</label>
                <p className="mt-2 text-lg text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني</label>
                <p className="mt-2 text-lg text-gray-900">
                  {user?.emailAddresses[0].emailAddress}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">رقم الهاتف</label>
                <p className="mt-2 text-lg text-gray-900">
                  {user?.phoneNumbers?.[0]?.phoneNumber || "لم يتم تعيين"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">تاريخ الإنشاء</label>
                <p className="mt-2 text-lg text-gray-900">
                  {user?.createdAt?.toLocaleDateString("ar-SA")}
                </p>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">معلومات الصلاحيات (للمطورين)</label>
                <div className="bg-gray-100 p-4 rounded-md text-left" dir="ltr">
                  <p className="font-mono text-sm">
                    Role (Public): {user?.publicMetadata?.role as string || "None"}<br/>
                    Role (Unsafe): {user?.unsafeMetadata?.role as string || "None"}
                  </p>
                  <pre className="text-xs mt-2 overflow-auto">
                    Public: {JSON.stringify(user?.publicMetadata, null, 2)}
                    {"\n"}
                    Unsafe: {JSON.stringify(user?.unsafeMetadata, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
