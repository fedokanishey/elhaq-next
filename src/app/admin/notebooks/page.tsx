"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Loader2, Trash2, Edit2, Plus, X, Check, BookOpen } from "lucide-react";
import { useBranchContext } from "@/contexts/BranchContext";

interface NotebookSummary {
  _id: string;
  name: string;
  transactionsCount: number;
  totalAmount: number;
  lastUsedDate?: string;
  notes?: string;
}

export default function NotebooksListPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");
  const [newNotebookNotes, setNewNotebookNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin" || isSuperAdmin;
  const canEdit = isAdmin;
  const canAccess = isAdmin || role === "member";
  
  const { selectedBranchId } = useBranchContext();
  const branchParam = selectedBranchId ? `&branchId=${selectedBranchId}` : "";

  // Fetch branch details if SuperAdmin has selected a branch
  const { data: branchesData } = useSWR(
    isSuperAdmin && selectedBranchId ? "/api/branches" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  
  const selectedBranch = branchesData?.branches?.find((b: { _id: string; name: string }) => b._id === selectedBranchId);

  const { data, isLoading, mutate } = useSWR(
    isLoaded && canAccess ? `/api/notebooks?limit=200${branchParam}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const notebooks = data?.notebooks || [];
  const loading = isLoading;

  useEffect(() => {
    if (isLoaded && !canAccess) router.push("/");
  }, [isLoaded, canAccess, router]);

  const handleDeleteNotebook = async (notebookId: string, notebookName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الدفتر "${notebookName}"؟\nسيتم فك ارتباط العمليات المرتبطة به.\nلا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    setDeleting(notebookId);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل حذف الدفتر");
      }

      setError("");
      mutate();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء حذف الدفتر");
    } finally {
      setDeleting(null);
    }
  };

  const handleStartEdit = (notebook: NotebookSummary) => {
    setEditing(notebook._id);
    setEditName(notebook.name);
    setEditNotes(notebook.notes || "");
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditName("");
    setEditNotes("");
  };

  const handleSaveEdit = async (notebookId: string) => {
    if (!editName.trim()) {
      setError("اسم الدفتر مطلوب");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          notes: editNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل تحديث الدفتر");
      }

      setError("");
      setEditing(null);
      setEditName("");
      setEditNotes("");
      mutate();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحديث الدفتر");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotebookName.trim()) {
      setError("اسم الدفتر مطلوب");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newNotebookName.trim(),
          notes: newNotebookNotes.trim() || undefined,
          // Include branch for SuperAdmin when a specific branch is selected
          ...(isSuperAdmin && selectedBranchId ? {
            branch: selectedBranchId,
            branchName: selectedBranch?.name || null,
          } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل إضافة الدفتر");
      }

      setError("");
      setNewNotebookName("");
      setNewNotebookNotes("");
      setShowAddForm(false);
      mutate();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء إضافة الدفتر");
    } finally {
      setAdding(false);
    }
  };

  // Calculate totals
  const totalTransactions = notebooks.reduce((sum: number, n: NotebookSummary) => sum + (n.transactionsCount || 0), 0);
  const totalAmount = notebooks.reduce((sum: number, n: NotebookSummary) => sum + (n.totalAmount || 0), 0);

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-amber-600" />
              الدفاتر
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              إجمالي العمليات: {totalTransactions.toLocaleString("ar-EG")} | 
              إجمالي المبالغ: {totalAmount.toLocaleString("ar-EG")} ج.م
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                type="button"
              >
                {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddForm ? "إلغاء" : "إضافة دفتر"}
              </button>
            )}
            <Link href="/admin/treasury" className="text-sm text-muted-foreground hover:text-primary">
              العودة للخزينة
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Add Form */}
        {showAddForm && canEdit && (
          <form onSubmit={handleAddNotebook} className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div>
              <label htmlFor="newNotebookName" className="block text-sm font-medium text-muted-foreground mb-1">
                اسم الدفتر <span className="text-red-500">*</span>
              </label>
              <input
                id="newNotebookName"
                type="text"
                value={newNotebookName}
                onChange={(e) => setNewNotebookName(e.target.value)}
                placeholder="مثل: دفتر يناير 2026"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                disabled={adding}
              />
            </div>
            <div>
              <label htmlFor="newNotebookNotes" className="block text-sm font-medium text-muted-foreground mb-1">
                ملاحظات <span className="text-xs text-muted-foreground">(اختياري)</span>
              </label>
              <textarea
                id="newNotebookNotes"
                value={newNotebookNotes}
                onChange={(e) => setNewNotebookNotes(e.target.value)}
                placeholder="ملاحظات إضافية..."
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                disabled={adding}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={adding}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                إضافة الدفتر
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : notebooks.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد دفاتر بعد</p>
            {canEdit && (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                type="button"
              >
                <Plus className="w-4 h-4" />
                إضافة أول دفتر
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {notebooks.map((n: NotebookSummary) => (
              <div 
                key={n._id} 
                className="border border-border rounded-lg p-4 bg-card hover:bg-muted/50 transition"
              >
                {editing === n._id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        disabled={saving}
                        placeholder="اسم الدفتر"
                      />
                    </div>
                    <div>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        disabled={saving}
                        placeholder="ملاحظات (اختياري)"
                        rows={2}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="px-3 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        type="button"
                        title="إلغاء"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSaveEdit(n._id)}
                        disabled={saving}
                        className="px-3 py-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition disabled:opacity-50"
                        type="button"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-medium text-foreground flex items-center gap-2">
                        📓 {n.name}
                      </div>
                      {n.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{n.notes}</div>
                      )}
                      <div className="text-sm text-muted-foreground mt-1">
                        عدد العمليات: {n.transactionsCount || 0}
                        {n.lastUsedDate && (
                          <span className="mr-2">
                            | آخر استخدام: {new Date(n.lastUsedDate).toLocaleDateString("ar-EG")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="font-semibold text-emerald-600">
                        {(n.totalAmount || 0).toLocaleString("ar-EG")} ج.م
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 mr-3">
                        <button
                          onClick={() => handleStartEdit(n)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded transition"
                          type="button"
                          title="تعديل الدفتر"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteNotebook(n._id, n.name)}
                          disabled={deleting === n._id}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-2 rounded transition flex items-center gap-1 disabled:opacity-50"
                          type="button"
                          title="حذف الدفتر"
                        >
                          {deleting === n._id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
