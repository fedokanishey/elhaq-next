"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface BranchData {
  _id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export default function BranchesPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchData | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; branch: BranchData | null; password: string }>({
    isOpen: false,
    branch: null,
    password: "",
  });

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "superadmin" && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (res.ok && data.branches) {
        setBranches(data.branches);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("حدث خطأ أثناء جلب الفروع");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      fetchBranches();
    }
  }, [isLoaded]);

  const openAddModal = () => {
    setEditingBranch(null);
    setFormData({ name: "", code: "", address: "", phone: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (branch: BranchData) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || "",
      phone: branch.phone || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingBranch
        ? `/api/branches/${editingBranch._id}`
        : "/api/branches";
      const method = editingBranch ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(editingBranch ? "تم تحديث الفرع بنجاح" : "تم إضافة الفرع بنجاح");
        setIsModalOpen(false);
        fetchBranches();
      } else {
        const data = await res.json();
        toast.error(data.error || "حدث خطأ");
      }
    } catch (error) {
      console.error("Error saving branch:", error);
      toast.error("حدث خطأ أثناء حفظ الفرع");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (branch: BranchData) => {
    // Open password confirmation modal
    setDeleteModal({ isOpen: true, branch, password: "" });
  };

  const confirmDelete = async () => {
    if (deleteModal.password !== "admin") {
      toast.error("كلمة السر غير صحيحة");
      return;
    }

    const branch = deleteModal.branch;
    if (!branch) return;

    try {
      console.log("Deleting branch:", branch._id);
      const res = await fetch(`/api/branches/${branch._id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      console.log("Delete response:", data);

      if (res.ok) {
        toast.success("تم حذف الفرع بنجاح");
        setDeleteModal({ isOpen: false, branch: null, password: "" });
        fetchBranches();
      } else {
        toast.error(data.error || "حدث خطأ أثناء حذف الفرع");
      }
    } catch (error) {
      console.error("Error deleting branch:", error);
      toast.error("حدث خطأ أثناء حذف الفرع");
    }
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
            <h1 className="text-3xl font-bold text-foreground">إدارة الفروع</h1>
            <p className="text-muted-foreground mt-1">
              إدارة فروع الجمعية - متاح للسوبر ادمن فقط
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5 ml-2" />
            إضافة فرع جديد
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : branches.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center shadow-sm">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">لا يوجد فروع</h3>
            <p className="text-muted-foreground mt-2">
              قم بإضافة أول فرع للجمعية
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <div
                key={branch._id}
                className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{branch.name}</h3>
                      <p className="text-sm text-muted-foreground">كود: {branch.code}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      branch.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    {branch.isActive ? "نشط" : "غير نشط"}
                  </span>
                </div>

                {branch.address && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    العنوان: {branch.address}
                  </p>
                )}

                {branch.phone && (
                  <p className="text-sm text-muted-foreground">
                    الهاتف: {branch.phone}
                  </p>
                )}

                <p className="mt-2 text-xs text-muted-foreground">
                  تاريخ الإنشاء: {new Date(branch.createdAt).toLocaleDateString("ar-EG")}
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => openEditModal(branch)}
                    aria-label="تعديل الفرع"
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4 ml-1" />
                    تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(branch)}
                    aria-label="حذف الفرع"
                    className="inline-flex items-center justify-center px-3 py-2 text-sm bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground">
                  {editingBranch ? "تعديل الفرع" : "إضافة فرع جديد"}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  aria-label="إغلاق"
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    اسم الفرع *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="مثال: فرع الزرقا"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    كود الفرع *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary uppercase"
                    placeholder="مثال: ZARQA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    العنوان
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="العنوان التفصيلي"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="رقم التواصل"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : editingBranch ? (
                      "تحديث"
                    ) : (
                      "إضافة"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal with Password */}
        {deleteModal.isOpen && deleteModal.branch && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">تأكيد الحذف</h2>
                <button
                  onClick={() => setDeleteModal({ isOpen: false, branch: null, password: "" })}
                  className="p-2 hover:bg-muted rounded-full"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-foreground">
                  هل أنت متأكد من حذف فرع <strong>&quot;{deleteModal.branch.name}&quot;</strong>؟
                </p>
                <p className="text-sm text-muted-foreground">
                  هذا الإجراء لا يمكن التراجع عنه. أدخل كلمة السر للتأكيد.
                </p>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    كلمة السر <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={deleteModal.password}
                    onChange={(e) => setDeleteModal({ ...deleteModal, password: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                    placeholder="أدخل كلمة السر"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setDeleteModal({ isOpen: false, branch: null, password: "" })}
                    className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    تأكيد الحذف
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
