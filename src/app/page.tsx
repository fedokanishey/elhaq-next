"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { ArrowRight, Heart, Shield, Users, LayoutDashboard, UserCircle, Image as ImageIcon, Wallet } from "lucide-react";

interface InitiativePreview {
  _id: string;
  name: string;
  description?: string;
  status?: string;
  images?: string[];
}

interface TreasuryTransaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  description?: string;
  transactionDate: string;
  category?: string;
  beneficiaryIds?: string[];
  beneficiaryNamesSnapshot?: string[];
}

interface TreasurySummary {
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
  transactions: TreasuryTransaction[];
}

const normalizeInitiativeId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "object") {
    const possibleOid = (value as { $oid?: string }).$oid;
    if (typeof possibleOid === "string") {
      return possibleOid;
    }

    if ("toString" in value && typeof value.toString === "function") {
      const coerced = value.toString();
      return typeof coerced === "string" && coerced !== "[object Object]" ? coerced : null;
    }
  }

  return null;
};

export default function Home() {
  const { user, isLoaded } = useUser();
  const [initiatives, setInitiatives] = useState<InitiativePreview[]>([]);
  const [initiativesLoading, setInitiativesLoading] = useState(true);
  const [initiativesError, setInitiativesError] = useState<string | null>(null);
  const [treasury, setTreasury] = useState<TreasurySummary | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(true);
  const [treasuryError, setTreasuryError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitiatives = async () => {
      try {
        setInitiativesLoading(true);
        const res = await fetch("/api/initiatives", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch initiatives");
        }
        const data = await res.json();
        const parsed = Array.isArray(data.initiatives)
          ? data.initiatives
              .map((item: InitiativePreview) => {
                const rawId = (item as { _id?: unknown; id?: unknown })._id ?? (item as { id?: unknown }).id;
                const normalizedId = normalizeInitiativeId(rawId);
                if (!normalizedId) {
                  return null;
                }

                return {
                  _id: normalizedId,
                  name: item.name,
                  description: item.description,
                  status: item.status,
                  images: Array.isArray(item.images) ? item.images : [],
                };
              })
              .filter((item: InitiativePreview | null): item is InitiativePreview => Boolean(item))
          : [];
        setInitiatives(parsed);
        setInitiativesError(null);
      } catch (error) {
        console.error("Error loading initiatives", error);
        setInitiativesError("تعذر تحميل المبادرات حالياً");
      } finally {
        setInitiativesLoading(false);
      }
    };

    fetchInitiatives();
  }, []);

  useEffect(() => {
    const role = user ? (user.publicMetadata?.role || user.unsafeMetadata?.role) : undefined;
    const canViewTreasury = role === "admin" || role === "member";

    if (!canViewTreasury) {
      setTreasuryLoading(false);
      return;
    }

    const fetchTreasury = async () => {
      try {
        setTreasuryLoading(true);
        const res = await fetch("/api/treasury?limit=10", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch treasury");
        }
        const data = await res.json();
        setTreasury({
          incomeTotal: data.totals.incomeTotal,
          expenseTotal: data.totals.expenseTotal,
          balance: data.totals.balance,
          transactions: data.transactions || [],
        });
        setTreasuryError(null);
      } catch (error) {
        console.error("Error loading treasury", error);
        setTreasuryError("تعذر تحميل بيانات الخزينة");
      } finally {
        setTreasuryLoading(false);
      }
    };

    fetchTreasury();
  }, [user]);

  const statusLabels: Record<string, string> = {
    planned: "مخططة",
    active: "نشطة",
    completed: "مكتملة",
    cancelled: "ملغاة",
  };

  const role = user ? (user.publicMetadata?.role || user.unsafeMetadata?.role) : undefined;
  const canAccessDashboard = role === "admin";
  const canViewBeneficiaries = role === "admin" || role === "member";

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24 text-center">
        <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full mb-4">
            <Heart className="w-6 h-6 text-primary animate-pulse" />
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground">
            دعوة <span className="text-primary">الحق</span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            نظام إدارة العمل الخيري الشامل. نساعدك في تنظيم وإدارة المبادرات الخيرية بكفاءة وشفافية.
          </p>

          {!isLoaded ? (
            <div className="flex items-center justify-center h-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : user ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              {canAccessDashboard && (
                <Link
                  href="/admin/dashboard"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
                >
                  <LayoutDashboard className="ml-2 h-5 w-5" />
                  لوحة التحكم
                </Link>
              )}
              
              {canViewBeneficiaries && (
                <Link
                  href="/beneficiaries"
                  className={`w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md transition-colors shadow-md hover:shadow-lg ${
                    canAccessDashboard
                      ? "text-secondary-foreground bg-secondary hover:bg-secondary/80"
                      : "text-primary-foreground bg-primary hover:bg-primary/90"
                  }`}
                >
                  <Users className="ml-2 h-5 w-5" />
                  المستفيدين
                </Link>
              )}

              <Link
                href="/profile"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground text-base font-medium rounded-md transition-colors"
              >
                <UserCircle className="ml-2 h-5 w-5" />
                الملف الشخصي
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Link
                href="/sign-in"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
              >
                تسجيل الدخول
                <ArrowRight className="mr-2 h-5 w-5" />
              </Link>
              <Link
                href="/sign-up"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground text-base font-medium rounded-md transition-colors"
              >
                إنشاء حساب جديد
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Initiatives Gallery */}
      <div className="py-16 px-4 sm:px-6 lg:px-8 bg-card/10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-widest text-primary">مبادرات حديثة</p>
            <h2 className="text-3xl font-bold text-foreground">صور من أرض الواقع</h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              تعرف على المبادرات الجارية من خلال صورها وآخر تحديثاتها، يتم رفع الصور مباشرة بعد اعتماد المبادرة.
            </p>
          </div>

          {initiativesLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : initiativesError ? (
            <div className="text-center py-8 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              {initiativesError}
            </div>
          ) : initiatives.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground flex flex-col items-center gap-3 bg-card border border-border rounded-xl">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              لا توجد صور مضافة للمبادرات بعد
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {initiatives.map((initiative) => {
                const mainImage = initiative.images?.[0];
                const extraImages = initiative.images?.slice(1, 4) || [];
                const status = initiative.status ? statusLabels[initiative.status] || initiative.status : "";

                return (
                  <Link
                    key={initiative._id}
                    href={`/initiatives/${initiative._id}`}
                    className="group bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="relative aspect-video bg-muted">
                      {mainImage ? (
                        <img
                          src={mainImage}
                          alt={`صورة رئيسية لمبادرة ${initiative.name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-8 w-8 mb-2" />
                          <span className="text-sm">لم يتم رفع صورة بعد</span>
                        </div>
                      )}
                    </div>

                    <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-3">
                      <h3 className="text-xl font-semibold text-foreground line-clamp-1">
                        {initiative.name}
                      </h3>
                      {status && (
                        <span className="text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                          {status}
                        </span>
                      )}
                    </div>

                    {extraImages.length > 0 && (
                      <div className="flex gap-2 px-5 pb-3 overflow-x-auto">
                        {extraImages.map((image, index) => (
                          <img
                            key={`${image}-${index}`}
                            src={image}
                            alt={`صورة إضافية ${index + 1} لمبادرة ${initiative.name}`}
                            className="h-16 w-20 rounded-md object-cover border border-border"
                          />
                        ))}
                      </div>
                    )}

                    <div className="px-5 pb-5 space-y-3 text-sm text-muted-foreground">
                      <p className="line-clamp-3">
                        {initiative.description || "لا يوجد وصف متاح لهذه المبادرة حالياً."}
                      </p>
                      <span className="inline-flex items-center gap-2 text-primary font-medium">
                        استعرض التفاصيل
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Treasury Section for Members/Admin ONLY */}
      {user && (user.publicMetadata?.role === "admin" || user.publicMetadata?.role === "member") && (
        <div className="py-16 px-4 sm:px-6 lg:px-8 bg-linear-to-b from-background to-card/20">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col gap-3">
              <p className="text-sm uppercase tracking-widest text-primary">شفافية العمل</p>
              <h2 className="text-3xl font-bold text-foreground">عمليات الخزينة</h2>
              <p className="text-muted-foreground max-w-3xl">
                تابع آخر العمليات المالية في الخزينة وحالة الرصيد الحالي
              </p>
            </div>

            {treasuryLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : treasuryError ? (
              <div className="text-center py-8 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                {treasuryError}
              </div>
            ) : treasury ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">إجمالي الإيرادات</p>
                        <p className="text-2xl font-bold text-green-600">
                          {new Intl.NumberFormat("ar-EG").format(treasury.incomeTotal)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <Wallet className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">إجمالي المصروفات</p>
                        <p className="text-2xl font-bold text-red-600">
                          {new Intl.NumberFormat("ar-EG").format(treasury.expenseTotal)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                        <Wallet className="h-6 w-6 text-red-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">الرصيد الحالي</p>
                        <p className="text-2xl font-bold text-primary">
                          {new Intl.NumberFormat("ar-EG").format(treasury.balance)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Wallet className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transactions Table */}
                {treasury.transactions.length > 0 && (
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-6 py-3 text-right font-medium">البيان</th>
                            <th className="px-6 py-3 text-right font-medium">النوع</th>
                            <th className="px-6 py-3 text-right font-medium">المبلغ</th>
                            <th className="px-6 py-3 text-right font-medium">عدد المستفيدين</th>
                            <th className="px-6 py-3 text-right font-medium">التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {treasury.transactions.map((transaction, index) => (
                            <tr
                              key={transaction._id}
                              className={`${
                                index % 2 === 0 ? "bg-background" : "bg-muted/10"
                              } border-t border-border/60 hover:bg-muted/20 transition-colors`}
                            >
                              <td className="px-6 py-3 text-foreground">
                                {transaction.description || "عملية مالية"}
                              </td>
                              <td className="px-6 py-3">
                                <span
                                  className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                                    transaction.type === "income"
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  }`}
                                >
                                  {transaction.type === "income" ? "إيراد" : "مصروف"}
                                </span>
                              </td>
                              <td className="px-6 py-3 font-medium">
                                <span
                                  className={
                                    transaction.type === "income" ? "text-green-600" : "text-red-600"
                                  }
                                >
                                  {transaction.type === "income" ? "+" : "-"}
                                  {new Intl.NumberFormat("ar-EG").format(transaction.amount)}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-muted-foreground">
                                {transaction.type === "expense" && transaction.beneficiaryIds ? (
                                  <span className="inline-flex items-center justify-center px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-sm font-medium">
                                    {transaction.beneficiaryIds.length}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-muted-foreground text-sm">
                                {new Date(transaction.transactionDate).toLocaleDateString("ar-EG")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className="bg-muted/30 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="bg-card p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">إدارة المستفيدين</h3>
              <p className="text-muted-foreground">
                قاعدة بيانات شاملة للمستفيدين مع تتبع دقيق للمساعدات المقدمة وحالتهم الاجتماعية.
              </p>
            </div>
            
            <div className="bg-card p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                <Heart className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">المبادرات الخيرية</h3>
              <p className="text-muted-foreground">
                تنظيم وإطلاق المبادرات الخيرية ومتابعة تنفيذها وقياس أثرها المجتمعي.
              </p>
            </div>
            
            <div className="bg-card p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">نظام آمن</h3>
              <p className="text-muted-foreground">
                صلاحيات محددة للمستخدمين وحماية كاملة للبيانات لضمان الخصوصية والأمان.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
