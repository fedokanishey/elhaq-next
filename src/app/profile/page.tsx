"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, User, Mail, Shield, Phone, Calendar } from "lucide-react";

export default function ProfilePage() {
  const { user } = useUser();

  // Trigger sync with MongoDB
  useEffect(() => {
    if (user) {
      fetch('/api/users').catch(console.error);
    }
  }, [user]);

  const role = (user?.publicMetadata?.role || user?.unsafeMetadata?.role || "user") as "admin" | "member" | "user";
  const roleDetails: Record<"admin" | "member" | "user", { label: string; description: string; badgeClass: string }> = {
    admin: {
      label: "مسؤول",
      description: "يمكنه إدارة لوحة التحكم وكافة البيانات",
      badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    },
    member: {
      label: "عضو",
      description: "يمكنه الوصول إلى بيانات المستفيدين فقط",
      badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    },
    user: {
      label: "مستخدم",
      description: "يمكنه استعراض الصفحة الرئيسية العامة والصور",
      badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    },
  };
  const activeRole = roleDetails[role] || roleDetails.user;

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors">
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة للرئيسية
          </Link>
        </div>

        <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-8 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">الملف الشخصي</h1>
                <p className="mt-2 text-muted-foreground">إدارة بيانات حسابك</p>
              </div>
              <div className="transform scale-125">
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Name */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                <div className="p-2 bg-primary/10 rounded-full">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">الاسم</label>
                  <p className="text-lg font-medium text-foreground">
                    {user?.firstName} {user?.lastName}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">البريد الإلكتروني</label>
                  <p className="text-lg font-medium text-foreground">
                    {user?.emailAddresses[0].emailAddress}
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">رقم الهاتف</label>
                  <p className="text-lg font-medium text-foreground">
                    {user?.phoneNumbers?.[0]?.phoneNumber || "لم يتم تعيين"}
                  </p>
                </div>
              </div>

              {/* Created At */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">تاريخ الإنشاء</label>
                  <p className="text-lg font-medium text-foreground">
                    {user?.createdAt?.toLocaleDateString("ar-EG")}
                  </p>
                </div>
              </div>

              {/* Role */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">الدور</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${activeRole.badgeClass}`}>
                      {activeRole.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{activeRole.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
