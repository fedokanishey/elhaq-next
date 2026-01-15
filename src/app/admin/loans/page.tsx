"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Loader2, PiggyBank, Briefcase, CheckCircle, AlertCircle, Plus, Search, Calendar, ChevronRight, X, Trash2, Edit } from "lucide-react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import SearchFilterBar from "@/components/SearchFilterBar";
import { useBranchContext } from "@/contexts/BranchContext";

// --- Types ---
interface Repayment {
  amount: number;
  date: string;
  notes?: string;
}

interface Loan {
  _id: string;
  beneficiaryName: string;
  nationalId?: string;
  phone: string;
  amount: number;
  amountPaid: number;
  remainingAmount?: number; // Virtual or calculated
  status: "active" | "completed" | "defaulted";
  startDate: string;
  dueDate?: string;
  repayments: Repayment[];
  notes?: string;
  createdAt: string;
}

interface LoanStats {
  totalFund: number;
  totalDisbursed: number;
  totalRepaid: number;
  availableFund: number;
}

// --- Components ---


function AddLoanModal({ isOpen, onClose, onSuccess, maxAmount, branchId = null, branchName = null }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; maxAmount: number; branchId?: string | null; branchName?: string | null }) {
  const [formData, setFormData] = useState({
    beneficiaryName: "",
    nationalId: "",
    phone: "",
    amount: "",
    startDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fetch beneficiaries for autocomplete
  const { data: beneficiariesData } = useSWR(
    searchTerm.length >= 2 ? `/api/beneficiaries/search?q=${encodeURIComponent(searchTerm)}&limit=5` : null,
    fetcher
  );

  const suggestions = beneficiariesData?.beneficiaries || [];

  // Close dropdown when closing modal
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setIsDropdownOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    if (Number(formData.amount) > maxAmount) {
      setError("المبلغ المطلوب أكبر من الرصيد المتاح");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...formData, 
          amount: Number(formData.amount),
          // Include branch for SuperAdmin when a specific branch is selected
          ...(branchId ? {
            branch: branchId,
            branchName: branchName || null,
          } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل تسجيل القرض");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">تسجيل قرض جديد</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">اسم المستفيد</label>
            <div className="relative">
              <input
                required
                className="w-full border rounded p-2 bg-background"
                value={formData.beneficiaryName}
                onChange={(e) => {
                  setFormData({ ...formData, beneficiaryName: e.target.value });
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="ابحث عن اسم المستفيد..."
              />
              {isDropdownOpen && searchTerm.length >= 2 && suggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-background border border-border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                   {suggestions.map((b: any) => (
                    <button
                      key={b._id}
                      type="button"
                      className="w-full text-right px-3 py-2 hover:bg-muted text-sm border-b last:border-0 border-border"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          beneficiaryName: b.name,
                          nationalId: b.nationalId || formData.nationalId,
                          phone: b.phone || formData.phone,
                        });
                        setSearchTerm("");
                        setIsDropdownOpen(false);
                      }}
                    >
                      <div className="font-semibold">{b.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.nationalId ? `رقم المستفيد: ${b.nationalId}` : ""} {b.phone ? `- ${b.phone}` : ""}
                      </div>
                    </button>
                   ))}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">رقم الهاتف</label>
              <input
                required
                className="w-full border rounded p-2 bg-background"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الرقم القومي (اختياري)</label>
              <input
                className="w-full border rounded p-2 bg-background"
                value={formData.nationalId}
                onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">مبلغ القرض</label>
            <input
              type="number"
              required
              min="1"
              className="w-full border rounded p-2 bg-background"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">المتاح: {maxAmount.toLocaleString()} ج.م</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ البدء</label>
              <input
                type="date"
                required
                className="w-full border rounded p-2 bg-background"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ الاستحقاق</label>
              <input
                type="date"
                className="w-full border rounded p-2 bg-background"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea
              className="w-full border rounded p-2 bg-background"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border bg-muted hover:bg-muted/80">إلغاء</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {submitting ? "جاري الحفظ..." : "حفظ القرض"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditLoanModal({ isOpen, onClose, onSuccess, loan }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; loan: Loan | null }) {
  const [formData, setFormData] = useState({
    beneficiaryName: "",
    nationalId: "",
    phone: "",
    amount: "",
    startDate: "",
    dueDate: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loan && isOpen) {
      setFormData({
        beneficiaryName: loan.beneficiaryName,
        nationalId: loan.nationalId || "",
        phone: loan.phone,
        amount: String(loan.amount),
        startDate: loan.startDate ? new Date(loan.startDate).toISOString().split("T")[0] : "",
        dueDate: loan.dueDate ? new Date(loan.dueDate).toISOString().split("T")[0] : "",
        notes: loan.notes || "",
      });
    }
  }, [loan, isOpen]);

  if (!isOpen || !loan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/loans/${loan._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, amount: Number(formData.amount) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل تحديث القرض");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">تعديل القرض</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">اسم المستفيد</label>
            <input
              required
              className="w-full border rounded p-2 bg-background"
              value={formData.beneficiaryName}
              onChange={(e) => setFormData({ ...formData, beneficiaryName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">رقم الهاتف</label>
              <input
                required
                className="w-full border rounded p-2 bg-background"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الرقم القومي (اختياري)</label>
              <input
                className="w-full border rounded p-2 bg-background"
                value={formData.nationalId}
                onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">مبلغ القرض</label>
            <input
              type="number"
              required
              min="1"
              className="w-full border rounded p-2 bg-background"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ البدء</label>
              <input
                type="date"
                required
                className="w-full border rounded p-2 bg-background"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ الاستحقاق</label>
              <input
                type="date"
                className="w-full border rounded p-2 bg-background"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea
              className="w-full border rounded p-2 bg-background"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border bg-muted hover:bg-muted/80">إلغاء</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {submitting ? "جاري التحديث..." : "تحديث القرض"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function AddCapitalModal({ isOpen, onClose, onSuccess, branchId, branchName }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  branchId?: string | null;
  branchName?: string | null;
}) {
  const [formData, setFormData] = useState({ amount: "", source: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/loans/capital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...formData, 
          amount: Number(formData.amount),
          ...(branchId && { branch: branchId, branchName })
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل إضافة الرصيد");
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">إضافة رصيد للصندوق</h2>
        {branchName && (
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-2 rounded mb-3 text-sm">
            سيتم إضافة الرصيد لفرع: <strong>{branchName}</strong>
          </div>
        )}
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">المبلغ</label>
            <input required type="number" min="1" className="w-full border rounded p-2 bg-background" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">المصدر</label>
            <input required className="w-full border rounded p-2 bg-background" placeholder="مثال: تبرع فاعل خير" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea className="w-full border rounded p-2 bg-background" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">إلغاء</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">إضافة</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddRepaymentModal({ isOpen, onClose, onSuccess, loan }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; loan: Loan }) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const remaining = loan.amount - loan.amountPaid;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(amount) > remaining) {
      alert("المبلغ المدخل أكبر من المتبقي");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/loans/${loan._id}/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), notes }),
      });
      if (!res.ok) throw new Error("فشل تسجيل السداد");
      onSuccess();
      onClose();
    } catch {
      alert("حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-sm p-6">
        <h2 className="text-xl font-bold mb-2">تسجيل سداد</h2>
        <p className="text-sm text-muted-foreground mb-4">للمستفيد: {loan.beneficiaryName} <br/> المتبقي: {remaining.toLocaleString()} ج.م</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">المبلغ المدفوع</label>
            <input required type="number" max={remaining} min="1" className="w-full border rounded p-2 bg-background" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea className="w-full border rounded p-2 bg-background" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">إلغاء</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">حفظ</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CapitalHistoryModal({ isOpen, onClose, branchId }: { isOpen: boolean; onClose: () => void; branchId?: string | null }) {
  const branchParam = branchId ? `?branchId=${branchId}` : "";
  const { data, mutate, error } = useSWR(isOpen ? `/api/loans/capital${branchParam}` : null, fetcher);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ amount: "", source: "", notes: "" });

  if (!isOpen) return null;

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await fetch(`/api/loans/capital/${id}`, { method: "DELETE" });
      mutate();
    } catch {
      alert("فشل الحذف");
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item._id);
    setFormData({ amount: item.amount, source: item.source, notes: item.notes || "" });
  };

  const handleSave = async () => {
    try {
      await fetch(`/api/loans/capital/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setEditingId(null);
      mutate();
    } catch {
      alert("فشل التحديث");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">سجل إضافات الرصيد</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        
        {!data ? <Loader2 className="animate-spin mx-auto" /> : (
          <div className="space-y-4">
            {data.capitals?.length === 0 ? <p className="text-center text-muted-foreground">لا توجد سجلات</p> : (
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-2 text-right">المبلغ</th>
                    <th className="p-2 text-right">المصدر</th>
                    <th className="p-2 text-right">التاريخ</th>
                    <th className="p-2 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.capitals.map((item: any) => (
                    <tr key={item._id}>
                      <td className="p-2 font-bold">
                        {editingId === item._id ? (
                          <input type="number" className="w-full border rounded p-1" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                        ) : `${item.amount.toLocaleString()} ج.م`}
                      </td>
                      <td className="p-2">
                        {editingId === item._id ? (
                          <input className="w-full border rounded p-1" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} />
                        ) : item.source}
                      </td>
                      <td className="p-2 text-muted-foreground">{new Date(item.date).toLocaleDateString("ar-EG")}</td>
                      <td className="p-2 text-center gap-2 flex justify-center">
                        {editingId === item._id ? (
                          <>
                            <button onClick={handleSave} className="text-green-600 font-bold text-xs">حفظ</button>
                            <button onClick={() => setEditingId(null)} className="text-gray-500 text-xs">إلغاء</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(item)} className="text-blue-600 hover:underline">تعديل</button>
                            <button onClick={() => handleDelete(item._id)} className="text-red-500 hover:underline">حذف</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function GoodLoansPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { selectedBranchId } = useBranchContext();
  const branchParam = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
  
  // Fetch branch details if SuperAdmin has selected a branch
  const { data: branchesData } = useSWR(
    selectedBranchId ? "/api/branches" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  
  const selectedBranch = branchesData?.branches?.find((b: { _id: string; name: string }) => b._id === selectedBranchId);
  
  const { data, error, mutate } = useSWR(isLoaded ? `/api/loans${branchParam}` : null, fetcher);
  
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [isAddCapitalOpen, setIsAddCapitalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [repaymentLoan, setRepaymentLoan] = useState<Loan | null>(null);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === 'admin' || isSuperAdmin;
  const isMember = role === 'member';
  const isAuthorized = isAdmin || isMember;

  // Redirect unauthorized users
  useEffect(() => {
    if (isLoaded && !isAuthorized) {
      router.push("/unauthorized");
    }
  }, [isLoaded, isAuthorized, router]);

  const loans: Loan[] = data?.loans || [];
  const stats: LoanStats = data?.stats || { totalFund: 0, totalDisbursed: 0, totalRepaid: 0, availableFund: 0 };

  const filteredLoans = useMemo(() => {
    return loans.filter(l => 
      l.beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      l.phone.includes(searchTerm)
    );
  }, [loans, searchTerm]);

  // Show loading while checking auth
  if (!isLoaded || (!isAuthorized && isLoaded)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا القرض؟ سيتم إلغاء جميع العمليات المرتبطة به.")) return;
    try {
      const res = await fetch(`/api/loans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      mutate();
    } catch (err) {
      alert("حدث خطأ أثناء الحذف");
    }
  };

  if (!isLoaded) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <Link href="/admin/dashboard" className="text-muted-foreground hover:text-primary inline-flex items-center gap-2 w-fit">
            ← العودة للوحة التحكم
          </Link>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <img src="/handshake.png" alt="" className="w-8 h-8 hidden" /> {/* Placeholder if needed */}
                🤝 القرض الحسن
              </h1>
              <p className="text-muted-foreground mt-1">إدارة القروض الميسرة ومتابعة السداد</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <button onClick={() => setIsHistoryOpen(true)} className="px-3 py-2 border border-border bg-background rounded-md hover:bg-muted text-muted-foreground hover:text-foreground text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> سجل الرصيد
                </button>
                <button onClick={() => setIsAddCapitalOpen(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-2">
                  <PiggyBank className="w-4 h-4" /> إضافة رصيد
                </button>
                <button onClick={() => setIsAddLoanOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> قرض جديد
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="رصيد الصندوق الكلي" value={`${stats.totalFund.toLocaleString()} ج.م`} icon={<PiggyBank className="w-6 h-6" />} colorClass="bg-emerald-50 text-emerald-700 border-emerald-200" />
          <StatCard title="إجمالي القروض المنصرفة" value={`${stats.totalDisbursed.toLocaleString()} ج.م`} icon={<Briefcase className="w-6 h-6" />} colorClass="bg-blue-50 text-blue-700 border-blue-200" />
          <StatCard title="إجمالي المبالغ المسددة" value={`${stats.totalRepaid.toLocaleString()} ج.م`} icon={<CheckCircle className="w-6 h-6" />} colorClass="bg-indigo-50 text-indigo-700 border-indigo-200" />
          <StatCard title="المتاح حالياً للإقراض" value={`${stats.availableFund.toLocaleString()} ج.م`} icon={<AlertCircle className="w-6 h-6" />} colorClass="bg-amber-50 text-amber-700 border-amber-200" />
        </div>

        {/* Search */}
        <div className="max-w-md">
          <SearchFilterBar 
            searchTerm={searchTerm} 
            onSearchChange={setSearchTerm} 
            placeholder="بحث باسم المستفيد أو رقم الهاتف..." 
          />
        </div>

        {/* Loans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLoans.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">لا توجد قروض مطابقة للبحث</div>
          ) : (
            filteredLoans.map((loan) => {
              const total = loan.amount;
              const paid = loan.amountPaid || 0;
              const progress = Math.min((paid / total) * 100, 100);
              const remaining = total - paid;
              
              return (
                <div key={loan._id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg">{loan.beneficiaryName}</h3>
                        <p className="text-sm text-muted-foreground">{loan.phone}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${loan.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {loan.status === 'completed' ? 'تم السداد' : 'نشط'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">المدفوع: {paid.toLocaleString()}</span>
                        <span className="font-semibold">{total.toLocaleString()} ج.م</span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-right text-muted-foreground">المتبقي: {remaining.toLocaleString()} ج.م</p>
                    </div>

                    <div className="pt-2 flex justify-between items-center text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(loan.startDate).toLocaleDateString("ar-EG")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-3 border-t border-border flex gap-2">
                    {loan.status !== 'completed' && isAdmin && (
                      <button 
                        onClick={() => setRepaymentLoan(loan)}
                        className="flex-1 bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        سداد دفعة
                      </button>
                    )}
                    <button className="px-3 py-2 border border-border bg-background rounded-md hover:bg-muted transition-colors">
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </button>
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => setEditLoan(loan)}
                          className="px-3 py-2 border border-border bg-background rounded-md hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                          title="تعديل القرض"
                        >
                          <Edit className="w-5 h-5 text-muted-foreground group-hover:text-blue-600" />
                        </button>
                        <button 
                          onClick={() => handleDelete(loan._id)}
                          className="px-3 py-2 border border-border bg-background rounded-md hover:bg-red-50 hover:border-red-200 transition-colors group"
                          title="حذف القرض"
                        >
                          <Trash2 className="w-5 h-5 text-muted-foreground group-hover:text-red-600" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      <AddLoanModal 
        isOpen={isAddLoanOpen} 
        onClose={() => setIsAddLoanOpen(false)} 
        onSuccess={() => mutate()} 
        maxAmount={stats.availableFund}
        branchId={isSuperAdmin ? selectedBranchId : null}
        branchName={isSuperAdmin ? selectedBranch?.name : null}
      />
      <AddCapitalModal 
        isOpen={isAddCapitalOpen} 
        onClose={() => setIsAddCapitalOpen(false)} 
        onSuccess={() => mutate()}
        branchId={isSuperAdmin ? selectedBranchId : null}
        branchName={isSuperAdmin ? selectedBranch?.name : null}
      />
      {repaymentLoan && (
        <AddRepaymentModal 
          isOpen={!!repaymentLoan} 
          onClose={() => setRepaymentLoan(null)} 
          onSuccess={() => mutate()} 
          loan={repaymentLoan} 
        />
      )}
      <EditLoanModal 
        isOpen={!!editLoan}
        onClose={() => setEditLoan(null)}
        onSuccess={() => mutate()}
        loan={editLoan}
      />
      <CapitalHistoryModal 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)}
        branchId={isSuperAdmin ? selectedBranchId : null}
      />
    </div>
  );
}
