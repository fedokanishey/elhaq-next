"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  User,
  Mail,
  Shield,
  Phone,
  Calendar,
  Building2,
  Crown,
  Loader2,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface BranchOption {
  _id: string;
  name: string;
  code?: string;
}

export default function ProfilePage() {
  const { user } = useUser();
  const [branchName, setBranchName] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingBranch, setSavingBranch] = useState(false);

  // Trigger sync with MongoDB and fetch branch info + active branches
  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingProfile(true);
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const resolvedName = data.user?.branchName || data.branch || null;
        setBranchName(resolvedName);
        if (Array.isArray(data.branches)) {
          setBranches(data.branches);
        }
        const rawBranch = data.user?.branch;
        if (rawBranch && typeof rawBranch === "object" && "_id" in rawBranch) {
          setSelectedBranchId(String(rawBranch._id));
        } else if (typeof rawBranch === "string") {
          setSelectedBranchId(rawBranch);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoadingProfile(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleSaveBranch = async () => {
    if (!selectedBranchId) {
      toast.error("يرجى اختيار الفرع أولاً");
      return;
    }
    setSavingBranch(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranchId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "تعذر حفظ الفرع");
      }
      setBranchName(json.branchName || null);
      toast.success("تم حفظ الفرع بنجاح — ستُوجّه طلباتك لإدارة هذا الفرع فقط");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل حفظ الفرع");
    } finally {
      setSavingBranch(false);
    }
  };

  const role = (user?.publicMetadata?.role || user?.unsafeMetadata?.role || "user") as "superadmin" | "admin" | "member" | "user";
  const roleDetails: Record<"superadmin" | "admin" | "member" | "user", { label: string; description: string; badgeClass: string }> = {
    superadmin: {
      label: "سوبر ادمن",
      description: "يمكنه إدارة جميع الفروع والمسؤولين وطلبات المساعدة",
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    },
    admin: {
      label: "مسؤول",
      description: "يمكنه إدارة لوحة التحكم وكافة البيانات وطلبات المساعدة الخاصة بالفرع",
      badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    },
    member: {
      label: "عضو",
      description: "يمكنه الاطلاع على بيانات المستفيدين وطلبات المساعدة وسجلات الفرع (عرض فقط بدون تعديل)",
      badgeClass: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
    },
    user: {
      label: "مستخدم",
      description: "يمكنه تحديد الفرع التابع له وتقديم استبيان طلب مساعدة واستعراض الصفحة الرئيسية",
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
                  {role === "superadmin" ? (
                    <Crown className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Shield className="h-5 w-5 text-primary" />
                  )}
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

              {/* Branch */}
              {role === "user" && (
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                  <div className="p-2 bg-primary/10 rounded-full shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <label htmlFor="profile-branch-select" className="block text-sm font-medium text-muted-foreground mb-1">
                        الفرع التابع له
                      </label>
                      <p className="text-base font-medium text-foreground flex items-center gap-1.5">
                        {loadingProfile ? (
                          <span className="text-sm text-muted-foreground">جاري تحميل بيانات الفرع...</span>
                        ) : branchName ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>{branchName}</span>
                          </>
                        ) : (
                          <span>لم يتم تعيين فرع بعد — يرجى اختيار فرعك</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        تُرسل طلبات المساعدة الخاصة بك مباشرة لإدارة الفرع الذي تحدده هنا فقط.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        id="profile-branch-select"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={loadingProfile || savingBranch || branches.length === 0}
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">-- اختر الفرع التابع له --</option>
                        {branches.map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleSaveBranch()}
                        disabled={savingBranch || !selectedBranchId || loadingProfile}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 text-sm font-medium transition-colors"
                      >
                        {savingBranch ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            جاري الحفظ...
                          </>
                        ) : (
                          "حفظ الفرع"
                        )}
                      </button>
                    </div>

                    <div className="pt-1">
                      <Link
                        href="/assistance-request"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        الانتقال إلى استبيان طلب مساعدة
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {(role === "admin" || role === "member") && (
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">الفرع</label>
                    <p className="text-lg font-medium text-foreground">
                      {branchName || "لم يتم تعيين فرع"}
                    </p>
                  </div>
                </div>
              )}
              
              {role === "superadmin" && (
                <div className="flex items-start gap-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/20">
                  <div className="p-2 bg-amber-100 dark:bg-amber-950/40 rounded-full">
                    <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">الفرع</label>
                    <p className="text-lg font-medium text-amber-700 dark:text-amber-300">
                      جميع الفروع
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      كسوبر ادمن، لديك صلاحية الوصول لجميع الفروع
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
