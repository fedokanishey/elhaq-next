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

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/admin/dashboard" className="text-muted-foreground hover:text-primary mb-4 inline-flex items-center gap-2 transition-colors">
            ← العودة للوحة التحكم
          </Link>
          <h1 className="text-3xl font-bold text-foreground">التقارير والإحصائيات</h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="relative bg-card border border-border rounded-lg shadow-sm p-6 overflow-hidden">
                <span aria-hidden="true" className="absolute top-4 bottom-4 right-0 w-1 rounded-full bg-blue-500"></span>
                <h3 className="text-muted-foreground text-sm font-medium">إجمالي المبادرات</h3>
                <p className="text-3xl font-bold text-foreground mt-2">{stats.totalInitiatives}</p>
              </div>
              <div className="relative bg-card border border-border rounded-lg shadow-sm p-6 overflow-hidden">
                <span aria-hidden="true" className="absolute top-4 bottom-4 right-0 w-1 rounded-full bg-green-500"></span>
                <h3 className="text-muted-foreground text-sm font-medium">إجمالي المستفيدين</h3>
                <p className="text-3xl font-bold text-foreground mt-2">{stats.totalBeneficiaries}</p>
              </div>
              <div className="relative bg-card border border-border rounded-lg shadow-sm p-6 overflow-hidden">
                <span aria-hidden="true" className="absolute top-4 bottom-4 right-0 w-1 rounded-full bg-purple-500"></span>
                <h3 className="text-muted-foreground text-sm font-medium">إجمالي المصروفات</h3>
                <p className="text-3xl font-bold text-foreground mt-2">{stats.totalAmountSpent.toLocaleString()} ج.م</p>
              </div>
            </div>

            {/* Initiatives Status */}
            <div className="bg-card border border-border rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">حالة المبادرات</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <span className="block text-2xl font-bold text-foreground">{stats.initiativesByStatus.planned}</span>
                  <span className="text-sm text-muted-foreground">مخططة</span>
                </div>
                <div className="text-center p-4 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <span className="block text-2xl font-bold text-green-700 dark:text-green-300">{stats.initiativesByStatus.active}</span>
                  <span className="text-sm text-green-600 dark:text-green-300/90">نشطة</span>
                </div>
                <div className="text-center p-4 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <span className="block text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.initiativesByStatus.completed}</span>
                  <span className="text-sm text-blue-600 dark:text-blue-300/90">مكتملة</span>
                </div>
                <div className="text-center p-4 bg-red-100 dark:bg-red-900/20 rounded-lg">
                  <span className="block text-2xl font-bold text-red-700 dark:text-red-300">{stats.initiativesByStatus.cancelled}</span>
                  <span className="text-sm text-red-600 dark:text-red-300/90">ملغاة</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-destructive">فشل تحميل البيانات</div>
        )}
      </div>
    </div>
  );
}
