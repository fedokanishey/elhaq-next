"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowRight, Heart, Shield, Users, LayoutDashboard, UserCircle } from "lucide-react";

export default function Home() {
  const { user, isLoaded } = useUser();

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
              {(user?.publicMetadata?.role === "admin" || user?.unsafeMetadata?.role === "admin") && (
                <Link
                  href="/admin/dashboard"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
                >
                  <LayoutDashboard className="ml-2 h-5 w-5" />
                  لوحة التحكم
                </Link>
              )}
              
              <Link
                href="/beneficiaries"
                className={`w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md transition-colors shadow-md hover:shadow-lg ${
                  (user?.publicMetadata?.role === "admin" || user?.unsafeMetadata?.role === "admin")
                    ? "text-secondary-foreground bg-secondary hover:bg-secondary/80"
                    : "text-primary-foreground bg-primary hover:bg-primary/90"
                }`}
              >
                <Users className="ml-2 h-5 w-5" />
                المستفيدين
              </Link>
              
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
