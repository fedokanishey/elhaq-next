"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function InitiativesPage() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-primary hover:text-primary/80">
            ← العودة للرئيسية
          </Link>
        </div>

        <div className="bg-card rounded-lg shadow">
          <div className="px-6 py-4 border-b border-border">
            <h1 className="text-3xl font-bold text-foreground">إدارة المبادرات</h1>
            <p className="mt-2 text-muted-foreground">مرحباً {user?.firstName || "المستخدم"}</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-primary font-bold">إنشاء مبادرة جديدة</h3>
                <p className="mt-2 text-muted-foreground">قم بإنشاء مبادرة جديدة</p>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground font-bold">المبادرات النشطة</h3>
                <p className="mt-2 text-muted-foreground">عرض قائمة المبادرات النشطة</p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400 font-bold">التقدم والإحصائيات</h3>
                <p className="mt-2 text-muted-foreground">عرض تقدم المبادرات</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
