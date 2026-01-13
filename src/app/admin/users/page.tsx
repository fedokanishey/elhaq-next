"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldAlert, User, Loader2, Search, Users as UsersIcon, Crown, Building2 } from "lucide-react";
import { toast } from "sonner";

interface BranchData {
  _id: string;
  name: string;
  code: string;
}

interface UserData {
  _id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  branch?: BranchData | string;
  branchName?: string;
  createdAt: string;
}

export default function AdminUsers() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin" && role !== "superadmin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (res.ok && data.users) {
          setUsers(data.users);
          if (data.branches) {
            setBranches(data.branches);
          }
          if (data.role) {
            setCurrentUserRole(data.role);
          }
        }
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("حدث خطأ أثناء جلب المستخدمين");
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded) {
      fetchUsers();
    }
  }, [isLoaded]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const password = window.prompt("من فضلك أدخل كلمة مرور المسؤول لتأكيد التعديل")?.trim();

    if (!password) {
      toast.warning("تم إلغاء التعديل");
      return;
    }

    if (password !== "admin") {
      toast.error("كلمة المرور غير صحيحة");
      return;
    }

    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u._id === userId ? { ...u, role: newRole } : u
          )
        );
        toast.success("تم تحديث دور المستخدم بنجاح");
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "فشل تحديث الدور");
      }
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("حدث خطأ أثناء تحديث الدور");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBranchChange = async (userId: string, branchId: string) => {
    if (currentUserRole !== "superadmin") {
      toast.error("فقط السوبر ادمن يمكنه تغيير الفرع");
      return;
    }

    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branch: branchId || null }),
      });

      if (res.ok) {
        const data = await res.json();
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u._id === userId ? { ...u, branch: data.user.branch, branchName: data.user.branchName } : u
          )
        );
        toast.success("تم تحديث فرع المستخدم بنجاح");
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "فشل تحديث الفرع");
      }
    } catch (error) {
      console.error("Error updating branch:", error);
      toast.error("حدث خطأ أثناء تحديث الفرع");
    } finally {
      setUpdatingId(null);
    }
  };

  const getAvailableRoles = () => {
    if (currentUserRole === "superadmin") {
      return ["superadmin", "admin", "member", "user"];
    }
    return ["member", "user"];
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUserBranchId = (u: UserData): string => {
    if (typeof u.branch === 'object' && u.branch?._id) {
      return u.branch._id;
    }
    return typeof u.branch === 'string' ? u.branch : '';
  };

  const getUserBranchName = (u: UserData): string => {
    if (typeof u.branch === 'object' && u.branch?.name) {
      return u.branch.name;
    }
    return u.branchName || 'بدون فرع';
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-2"
            >
              <ArrowRight className="ml-2 h-4 w-4" />
              العودة للوحة التحكم
            </Link>
            <h1 className="text-3xl font-bold text-foreground">إدارة المستخدمين</h1>
            <p className="text-muted-foreground mt-1">
              {currentUserRole === "superadmin" 
                ? "عرض وإدارة جميع المستخدمين والمسؤولين في النظام"
                : "عرض وإدارة الأعضاء والمستخدمين في فرعك"}
            </p>
          </div>
          
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="بحث بالاسم أو البريد..."
              className="block w-full pr-10 pl-3 py-2 border border-input rounded-md leading-5 bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center shadow-sm">
            <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">لا يوجد مستخدمين</h3>
            <p className="text-muted-foreground mt-2">
              {searchTerm ? "لا توجد نتائج مطابقة للبحث" : "لم يتم تسجيل أي مستخدمين بعد"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {filteredUsers.map((u) => (
                <div
                  key={u._id}
                  className="bg-card border border-border rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                        {u.firstName?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-foreground">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground break-all">{u.email}</p>
                      </div>
                    </div>
                    <RoleBadge role={u.role} />
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                    <span>تاريخ التسجيل:</span>
                    <span className="text-foreground">
                      {new Date(u.createdAt).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                  
                  {/* Branch Badge */}
                  <div className="mt-2 flex items-center gap-2">
                    <Building2 className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {getUserBranchName(u)}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor={`role-${u._id}`}>
                        تغيير الدور
                      </label>
                      <select
                        id={`role-${u._id}`}
                        aria-label="تغيير دور المستخدم"
                        disabled={updatingId === u._id || u.clerkId === user?.id}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {getAvailableRoles().map((role) => (
                          <option key={role} value={role}>
                            {getRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Branch Selection - SuperAdmin only */}
                    {currentUserRole === "superadmin" && branches.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground" htmlFor={`branch-${u._id}`}>
                          تغيير الفرع
                        </label>
                        <select
                          id={`branch-${u._id}`}
                          aria-label="تغيير فرع المستخدم"
                          disabled={updatingId === u._id || u.role === "superadmin"}
                          value={getUserBranchId(u)}
                          onChange={(e) => handleBranchChange(u._id, e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">بدون فرع</option>
                          {branches.map((branch) => (
                            <option key={branch._id} value={branch._id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {updatingId === u._id && (
                      <span className="inline-flex items-center text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin ml-1" />
                        جاري التحديث...
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card border border-border rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        المستخدم
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        البريد الإلكتروني
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        الدور الحالي
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        الفرع
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        تاريخ التسجيل
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        تغيير الدور
                      </th>
                      {currentUserRole === "superadmin" && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          تغيير الفرع
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filteredUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                              {u.firstName?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div className="mr-4">
                              <div className="text-sm font-medium text-foreground">
                                {u.firstName} {u.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground sm:hidden">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          <div className="text-sm text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center text-sm text-muted-foreground">
                            <Building2 className="w-4 h-4 ml-1" />
                            {getUserBranchName(u)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <select
                            aria-label="تغيير دور المستخدم"
                            disabled={updatingId === u._id || u.clerkId === user?.id}
                            value={u.role}
                            onChange={(e) => handleRoleChange(u._id, e.target.value)}
                            className="block w-full pl-3 pr-10 py-2 text-base border-input bg-background text-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed border"
                          >
                            {getAvailableRoles().map((role) => (
                              <option key={role} value={role}>
                                {getRoleLabel(role)}
                              </option>
                            ))}
                          </select>
                          {updatingId === u._id && (
                            <span className="mr-2 inline-flex items-center text-xs text-muted-foreground">
                              <Loader2 className="w-3 h-3 animate-spin ml-1" />
                            </span>
                          )}
                        </td>
                        {currentUserRole === "superadmin" && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <select
                              aria-label="تغيير فرع المستخدم"
                              disabled={updatingId === u._id || u.role === "superadmin"}
                              value={getUserBranchId(u)}
                              onChange={(e) => handleBranchChange(u._id, e.target.value)}
                              className="block w-full pl-3 pr-10 py-2 text-base border-input bg-background text-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed border"
                            >
                              <option value="">بدون فرع</option>
                              {branches.map((branch) => (
                                <option key={branch._id} value={branch._id}>
                                  {branch.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    superadmin: "سوبر ادمن",
    admin: "مسؤول",
    member: "عضو",
    user: "مستخدم",
  };
  return labels[role] || role;
}

function RoleBadge({ role }: { role: string }) {
  const roleConfig: Record<string, { label: string; classes: string; Icon: typeof ShieldAlert }> = {
    superadmin: {
      label: "سوبر ادمن",
      classes: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      Icon: Crown,
    },
    admin: {
      label: "مسؤول",
      classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      Icon: ShieldAlert,
    },
    member: {
      label: "عضو",
      classes: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      Icon: UsersIcon,
    },
    user: {
      label: "مستخدم",
      classes: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      Icon: User,
    },
  };

  const fallback = roleConfig.user;
  const config = roleConfig[role] || fallback;
  const Icon = config.Icon;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}>
      <Icon className="w-3 h-3 ml-1" />
      {config.label}
    </span>
  );
}
