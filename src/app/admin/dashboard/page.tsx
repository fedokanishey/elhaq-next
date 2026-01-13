"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { 
  Users, 
  Activity, 
  Target, 
  UserPlus,  
  BarChart3, 
  Shield,
  Loader2,
  Wallet,
  Archive,
  HandCoins,
  Building2,
  Crown
} from "lucide-react";
import { useBranchContext } from "@/contexts/BranchContext";
import BranchSelector from "@/components/BranchSelector";

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
  remainingBalance: number;
}

export default function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [branchName, setBranchName] = useState<string | null>(null);
  const { selectedBranchId, setSelectedBranchId, isSuperAdmin: contextIsSuperAdmin } = useBranchContext();

  // Build API URL with branch filter
  const apiUrl = selectedBranchId 
    ? `/api/reports?branchId=${selectedBranchId}` 
    : "/api/reports";

  const { data } = useSWR(
    isLoaded ? apiUrl : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const stats = data?.stats || null;
  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isSuperAdmin = role === "superadmin";

  useEffect(() => {
    if (isLoaded && role !== "admin" && role !== "superadmin") {
      router.push("/");
    }
  }, [isLoaded, user, router, role]);

  // Fetch branch info
  useEffect(() => {
    if (isLoaded && !isSuperAdmin) {
      fetch("/api/users")
        .then(res => res.json())
        .then(data => {
          if (data.branch) {
            setBranchName(data.branch);
          }
        })
        .catch(console.error);
    }
  }, [isLoaded, isSuperAdmin]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-foreground">
              لوحة التحكم
            </h1>
            {isSuperAdmin && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                <Crown className="w-4 h-4 ml-1" />
                سوبر ادمن
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>مرحباً بك {user?.firstName || "المسؤول"}، إليك نظرة عامة على النظام</span>
            {branchName && !isSuperAdmin && (
              <span className="inline-flex items-center text-primary">
                <Building2 className="w-4 h-4 ml-1" />
                فرع {branchName}
              </span>
            )}
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
                -
                <BranchSelector
                  selectedBranchId={selectedBranchId}
                  onBranchChange={setSelectedBranchId}
                />
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">الإجمالي</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{stats?.totalBeneficiaries || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">إجمالي المستفيدين</p>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Wallet className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">الرصيد</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{(stats?.remainingBalance || 0).toLocaleString('ar-SA')} ج.م</div>
            <p className="text-sm text-muted-foreground mt-1">الرصيد المتبقى في الخزينة</p>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">المستخدمين</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{stats?.totalUsers || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">المستخدمين المسجلين</p>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Target className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">المبادرات</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{stats?.totalInitiatives || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">المبادرات الكلية</p>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">إجراءات سريعة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/admin/beneficiaries"
            className="group bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">إدارة المستفيدين</h3>
            </div>
            <p className="text-muted-foreground text-sm">إضافة وتعديل وحذف المستفيدين من النظام</p>
          </Link>

          <Link
            href="/admin/beneficiaries/add"
            className="group bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">إضافة مستفيد</h3>
            </div>
            <p className="text-muted-foreground text-sm">تسجيل حالة جديدة وإضافتها لقاعدة البيانات</p>
          </Link>

          <Link
            href="/admin/initiatives"
            className="group bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">المبادرات</h3>
            </div>
            <p className="text-muted-foreground text-sm">إدارة المبادرات والمشاريع الخيرية</p>
          </Link>

          <Link
            href="/admin/users"
            className="group bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">المستخدمين</h3>
            </div>
            <p className="text-muted-foreground text-sm">إدارة صلاحيات المستخدمين والمسؤولين</p>
          </Link>

        

          <Link
            href="/admin/reports"
            className="group bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">التقارير</h3>
            </div>
            <p className="text-muted-foreground text-sm">عرض التقارير والإحصائيات التفصيلية</p>
          </Link>

          <Link
            href="/admin/treasury"
            className="group bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">الخزينة</h3>
            </div>
            <p className="text-muted-foreground text-sm">تسجيل الوارد والصادر ومراجعة الرصيد المتبقي</p>
          </Link>

          <Link
            href="/admin/loans"
            className="group bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                <HandCoins className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">القرض الحسن</h3>
            </div>
            <p className="text-muted-foreground text-sm">إدارة القروض وسداد الأقساط</p>
          </Link>

          <Link
            href="/admin/warehouse"
            className="group bg-card border border-border rounded-xl shadow-sm p-6 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                <Archive className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">المخزن</h3>
            </div>
            <p className="text-muted-foreground text-sm">تتبع حركة المخزن الواردة والصادرة</p>
          </Link>

          {/* Branches Management - SuperAdmin only */}
          {isSuperAdmin && (
            <Link
              href="/admin/branches"
              className="group bg-card border border-purple-200 dark:border-purple-800 rounded-xl shadow-sm p-6 hover:shadow-md hover:border-purple-400 dark:hover:border-purple-600 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                  <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-foreground">إدارة الفروع</h3>
              </div>
              <p className="text-muted-foreground text-sm">إضافة وإدارة فروع الجمعية (سوبر ادمن فقط)</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
