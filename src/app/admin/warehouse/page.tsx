"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { 
  Loader2, Archive, Package, DollarSign, Trash2, Edit, Plus, 
  ShoppingCart, TrendingUp, TrendingDown, Eye, X, ArrowDownCircle,
  ArrowUpCircle, RefreshCw, Calculator, ChevronRight
} from "lucide-react";
import StatCard from "@/components/StatCard";
import SearchFilterBar from "@/components/SearchFilterBar";
import { useBranchContext } from "@/contexts/BranchContext";

// --- Types ---
interface Product {
  _id: string;
  name: string;
  category: "raw" | "finished" | "byproduct";
  unit: string;
  currentQuantity: number;
  totalCost: number;
  totalRevenue: number;
  status: "active" | "depleted" | "archived";
  notes?: string;
  branchName?: string;
  createdAt: string;
}

interface ProductOperation {
  _id: string;
  product: string;
  type: "purchase" | "expense" | "sale" | "transform" | "donation";
  description: string;
  quantity?: number;
  amount: number;
  amountType: "cost" | "revenue";
  date: string;
  byproductName?: string;
  byproductQuantity?: number;
}

// --- Add Product Modal ---
function AddProductModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  branchId,
  branchName,
  allBranches = [],
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  branchId?: string | null;
  branchName?: string | null;
  allBranches?: { _id: string; name: string }[];
}) {
  const [formData, setFormData] = useState({
    name: "",
    category: "raw" as "raw" | "finished" | "byproduct",
    unit: "كيلو",
    notes: "",
    initialQuantity: "",
    initialCost: "",
    branch: branchId || "",
    branchName: branchName || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: "",
        category: "raw",
        unit: "كيلو",
        notes: "",
        initialQuantity: "",
        initialCost: "",
        branch: branchId || "",
        branchName: branchName || "",
      });
      setError("");
    }
  }, [isOpen, branchId, branchName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          initialQuantity: formData.initialQuantity ? Number(formData.initialQuantity) : 0,
          initialCost: formData.initialCost ? Number(formData.initialCost) : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إضافة المنتج");

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
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">إضافة منتج جديد</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        
        {error && <div className="text-red-500 mb-3 text-sm bg-red-50 p-2 rounded">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">اسم المنتج *</label>
            <input 
              required
              className="w-full border rounded p-2 bg-background"
              placeholder="مثال: شعير، رز، سكر..."
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          {allBranches.length > 0 && !branchId && (
            <div>
              <label className="block text-sm font-medium mb-1">الفرع *</label>
              <select 
                required
                className="w-full border rounded p-2 bg-background"
                value={formData.branch}
                onChange={e => {
                  const selected = allBranches.find(b => b._id === e.target.value);
                  setFormData({...formData, branch: e.target.value, branchName: selected?.name || ""});
                }}
              >
                <option value="">اختر الفرع...</option>
                {allBranches.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">النوع</label>
              <select 
                className="w-full border rounded p-2 bg-background"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value as any})}
              >
                <option value="raw">خام</option>
                <option value="finished">جاهز</option>
                <option value="byproduct">منتج فرعي</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الوحدة</label>
              <select 
                className="w-full border rounded p-2 bg-background"
                value={formData.unit}
                onChange={e => setFormData({...formData, unit: e.target.value})}
              >
                <option value="كيلو">كيلو</option>
                <option value="طن">طن</option>
                <option value="كرتونة">كرتونة</option>
                <option value="شكارة">شكارة</option>
                <option value="قطعة">قطعة</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">رصيد افتتاحي (اختياري)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">الكمية</label>
                <input 
                  type="number"
                  min="0"
                  className="w-full border rounded p-2 bg-background"
                  value={formData.initialQuantity}
                  onChange={e => setFormData({...formData, initialQuantity: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">التكلفة</label>
                <input 
                  type="number"
                  min="0"
                  className="w-full border rounded p-2 bg-background"
                  value={formData.initialCost}
                  onChange={e => setFormData({...formData, initialCost: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea 
              className="w-full border rounded p-2 bg-background"
              rows={2}
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">إلغاء</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
              {submitting ? "جاري الحفظ..." : "إضافة المنتج"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Add Operation Modal ---
function AddOperationModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  product,
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  product: Product | null;
}) {
  const [formData, setFormData] = useState({
    type: "purchase" as "purchase" | "expense" | "sale" | "donation",
    description: "",
    quantity: "",
    amount: "",
    date: new Date().toISOString().split('T')[0],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFormData({
        type: "purchase",
        description: "",
        quantity: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
      });
      setError("");
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/products/${product._id}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          quantity: formData.quantity ? Number(formData.quantity) : 0,
          amount: formData.amount ? Number(formData.amount) : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إضافة العملية");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "purchase": return "شراء";
      case "expense": return "مصروف";
      case "sale": return "بيع";
      case "donation": return "تبرع";
      default: return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "purchase": return <ShoppingCart className="w-4 h-4" />;
      case "expense": return <ArrowUpCircle className="w-4 h-4" />;
      case "sale": return <DollarSign className="w-4 h-4" />;
      case "donation": return <Package className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">إضافة عملية على {product.name}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm">
          <div className="flex justify-between">
            <span>الكمية الحالية:</span>
            <span className="font-bold">{product.currentQuantity} {product.unit}</span>
          </div>
        </div>

        {error && <div className="text-red-500 mb-3 text-sm bg-red-50 p-2 rounded">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">نوع العملية</label>
            <div className="grid grid-cols-4 gap-2">
              {(["purchase", "expense", "sale", "donation"] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({...formData, type})}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    formData.type === type 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {getTypeIcon(type)}
                    <span className="text-xs">{getTypeLabel(type)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">البيان *</label>
            <input 
              required
              className="w-full border rounded p-2 bg-background"
              placeholder="وصف العملية..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">التاريخ</label>
              <input 
                type="date"
                className="w-full border rounded p-2 bg-background"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>
            {(formData.type === "purchase" || formData.type === "sale" || formData.type === "donation") && (
              <div>
                <label className="block text-sm font-medium mb-1">الكمية</label>
                <input 
                  type="number"
                  min="0"
                  className="w-full border rounded p-2 bg-background"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: e.target.value})}
                />
              </div>
            )}
          </div>

          {formData.type !== "donation" && (
            <div>
              <label className="block text-sm font-medium mb-1">
                {formData.type === "sale" ? "الإيراد" : "المبلغ"}
              </label>
              <input 
                type="number"
                min="0"
                className="w-full border rounded p-2 bg-background"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">إلغاء</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
              {submitting ? "جاري الحفظ..." : "حفظ العملية"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Product Details Modal ---
function ProductDetailsModal({ 
  isOpen, 
  onClose, 
  productId,
  onAddOperation,
  onRefresh,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  productId: string | null;
  onAddOperation: () => void;
  onRefresh: () => void;
}) {
  const { data, mutate } = useSWR(
    isOpen && productId ? `/api/products/${productId}` : null, 
    fetcher
  );
  const [editingOp, setEditingOp] = useState<ProductOperation | null>(null);
  const [editForm, setEditForm] = useState({ description: "", quantity: "", amount: "", date: "" });
  const [deleting, setDeleting] = useState<string | null>(null);

  if (!isOpen || !productId) return null;

  const product: Product | null = data?.product;
  const operations: ProductOperation[] = data?.operations || [];

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "purchase": return "شراء";
      case "expense": return "مصروف";
      case "sale": return "بيع";
      case "transform": return "تحويل";
      case "donation": return "تبرع";
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "purchase": return "bg-emerald-100 text-emerald-700";
      case "expense": return "bg-rose-100 text-rose-700";
      case "sale": return "bg-blue-100 text-blue-700";
      case "transform": return "bg-purple-100 text-purple-700";
      case "donation": return "bg-amber-100 text-amber-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const handleDeleteOperation = async (opId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه العملية؟ سيتم عكس تأثيرها على المنتج.")) return;
    setDeleting(opId);
    try {
      const res = await fetch(`/api/products/${productId}/operations/${opId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "فشل الحذف");
        return;
      }
      mutate();
      onRefresh();
    } catch {
      alert("فشل الحذف");
    } finally {
      setDeleting(null);
    }
  };

  const startEditOperation = (op: ProductOperation) => {
    setEditingOp(op);
    setEditForm({
      description: op.description,
      quantity: String(op.quantity || ""),
      amount: String(op.amount || ""),
      date: op.date.split("T")[0],
    });
  };

  const handleSaveEdit = async () => {
    if (!editingOp) return;
    try {
      const res = await fetch(`/api/products/${productId}/operations/${editingOp._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editForm.description,
          quantity: editForm.quantity ? Number(editForm.quantity) : 0,
          amount: editForm.amount ? Number(editForm.amount) : 0,
          date: editForm.date,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "فشل التعديل");
        return;
      }
      setEditingOp(null);
      mutate();
      onRefresh();
    } catch {
      alert("فشل التعديل");
    }
  };

  if (!product) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl p-6 flex items-center justify-center">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      </div>
    );
  }

  const netProfit = product.totalRevenue - product.totalCost;
  const unitCost = product.currentQuantity > 0 ? product.totalCost / product.currentQuantity : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">{product.name}</h2>
            <span className={`text-xs px-2 py-1 rounded ${
              product.category === "raw" ? "bg-amber-100 text-amber-700" :
              product.category === "finished" ? "bg-green-100 text-green-700" :
              "bg-purple-100 text-purple-700"
            }`}>
              {product.category === "raw" ? "خام" : product.category === "finished" ? "جاهز" : "منتج فرعي"}
            </span>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">الكمية</p>
            <p className="text-lg font-bold text-blue-600">{product.currentQuantity} {product.unit}</p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">التكاليف</p>
            <p className="text-lg font-bold text-rose-600">{product.totalCost.toLocaleString()} ج.م</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">الإيرادات</p>
            <p className="text-lg font-bold text-emerald-600">{product.totalRevenue.toLocaleString()} ج.م</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${netProfit >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
            <p className="text-xs text-muted-foreground">الصافي</p>
            <p className={`text-lg font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {netProfit.toLocaleString()} ج.م
            </p>
          </div>
        </div>

        {/* Product Notes */}
        {product.notes && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-4 border border-amber-200 dark:border-amber-800">
            <h3 className="font-bold mb-2 text-amber-800 dark:text-amber-300">تفاصيل المنتج</h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 whitespace-pre-wrap">{product.notes}</p>
          </div>
        )}

        {/* Actions */}
        <button
          onClick={onAddOperation}
          className="w-full mb-4 py-3 bg-primary text-primary-foreground rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة عملية
        </button>

        {/* Operations Timeline */}
        <div>
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Archive className="w-5 h-5" /> سجل العمليات ({operations.length})
          </h3>
          {operations.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">لا توجد عمليات بعد</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {operations.map((op) => (
                <div key={op._id} className="bg-muted/30 rounded-lg p-3 border border-border">
                  {editingOp?._id === op._id ? (
                    // Edit mode
                    <div className="space-y-3">
                      <input 
                        className="w-full border rounded p-2 bg-background text-sm"
                        placeholder="البيان"
                        value={editForm.description}
                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input 
                          type="date"
                          className="border rounded p-2 bg-background text-sm"
                          value={editForm.date}
                          onChange={e => setEditForm({...editForm, date: e.target.value})}
                        />
                        {op.type !== "expense" && (
                          <input 
                            type="number"
                            className="border rounded p-2 bg-background text-sm"
                            placeholder="الكمية"
                            value={editForm.quantity}
                            onChange={e => setEditForm({...editForm, quantity: e.target.value})}
                          />
                        )}
                        {op.type !== "donation" && (
                          <input 
                            type="number"
                            className="border rounded p-2 bg-background text-sm"
                            placeholder="المبلغ"
                            value={editForm.amount}
                            onChange={e => setEditForm({...editForm, amount: e.target.value})}
                          />
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => setEditingOp(null)}
                          className="px-3 py-1 text-sm border rounded"
                        >
                          إلغاء
                        </button>
                        <button 
                          onClick={handleSaveEdit}
                          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded"
                        >
                          حفظ
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(op.type)}`}>
                            {getTypeLabel(op.type)}
                          </span>
                          <span className="text-sm font-medium">{op.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(op.date).toLocaleDateString("ar-EG")}
                          </span>
                          <button 
                            onClick={() => startEditOperation(op)}
                            className="p-1 hover:bg-muted rounded"
                            title="تعديل"
                          >
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button 
                            onClick={() => handleDeleteOperation(op._id)}
                            disabled={deleting === op._id}
                            className="p-1 hover:bg-red-50 rounded group"
                            title="حذف"
                          >
                            {deleting === op._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-red-600" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        {op.quantity !== undefined && op.quantity > 0 && (
                          <span>الكمية: {op.quantity}</span>
                        )}
                        {op.amount > 0 && (
                          <span className={op.amountType === "revenue" ? "text-green-600" : "text-rose-600"}>
                            {op.amountType === "revenue" ? "+" : "-"}{op.amount.toLocaleString()} ج.م
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-6 py-2 bg-muted rounded-md hover:bg-muted/80">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function WarehousePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { selectedBranchId } = useBranchContext();
  
  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin" || isSuperAdmin;

  const branchParam = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
  
  // Fetch branches for SuperAdmin
  const { data: branchesData } = useSWR(
    isLoaded && isSuperAdmin ? "/api/branches" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  
  const selectedBranch = branchesData?.branches?.find((b: { _id: string; name: string }) => b._id === selectedBranchId);
  
  // Fetch products
  const { data, mutate } = useSWR(
    isLoaded ? `/api/products${branchParam}` : null, 
    fetcher
  );

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddOperationOpen, setIsAddOperationOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  useEffect(() => {
    if (isLoaded && role !== "admin" && role !== "member" && role !== "superadmin") {
      router.push("/");
    }
  }, [isLoaded, role, router]);

  const products: Product[] = data?.products || [];
  const stats = data?.stats || { totalProducts: 0, totalCost: 0, totalRevenue: 0, netProfit: 0, totalQuantity: 0 };

  const filteredProducts = useMemo(() => {
    let result = products;
    
    if (filterCategory !== "all") {
      result = result.filter(p => p.category === filterCategory);
    }
    
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(lowerTerm));
    }
    
    return result;
  }, [products, filterCategory, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    try {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      mutate();
    } catch {
      alert("فشل الحذف");
    }
  };

  const openDetails = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailsOpen(true);
  };

  const openAddOperation = (product: Product) => {
    setSelectedProduct(product);
    setIsAddOperationOpen(true);
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Package className="w-8 h-8" /> إدارة المنتجات
              </h1>
              <p className="text-muted-foreground mt-1">تتبع المنتجات والتكاليف والإيرادات</p>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setIsAddProductOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:shadow hover:bg-primary/90 transition-all font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> منتج جديد
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            title="إجمالي المنتجات" 
            value={`${stats.totalProducts}`} 
            icon={<Package className="w-6 h-6" />} 
            colorClass="bg-blue-50 text-blue-700 border-blue-200" 
          />
          <StatCard 
            title="إجمالي التكاليف" 
            value={`${stats.totalCost.toLocaleString()} ج.م`} 
            icon={<TrendingDown className="w-6 h-6" />} 
            colorClass="bg-rose-50 text-rose-700 border-rose-200" 
          />
          <StatCard 
            title="إجمالي الإيرادات" 
            value={`${stats.totalRevenue.toLocaleString()} ج.م`} 
            icon={<TrendingUp className="w-6 h-6" />} 
            colorClass="bg-emerald-50 text-emerald-700 border-emerald-200" 
          />
          <StatCard 
            title="صافي الربح" 
            value={`${stats.netProfit.toLocaleString()} ج.م`} 
            icon={<DollarSign className="w-6 h-6" />} 
            colorClass={stats.netProfit >= 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"} 
          />
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="max-w-md flex-1">
            <SearchFilterBar 
              searchTerm={searchTerm} 
              onSearchChange={setSearchTerm} 
              placeholder="بحث في المنتجات..." 
            />
          </div>
          <div className="flex gap-2">
            {["all", "raw", "finished", "byproduct"].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filterCategory === cat 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat === "all" ? "الكل" : cat === "raw" ? "خام" : cat === "finished" ? "جاهز" : "فرعي"}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-card border rounded-xl">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد منتجات</p>
            {isAdmin && (
              <button 
                onClick={() => setIsAddProductOpen(true)}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
              >
                إضافة أول منتج
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const netProfit = product.totalRevenue - product.totalCost;
              return (
                <div key={product._id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg">{product.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          product.category === "raw" ? "bg-amber-100 text-amber-700" :
                          product.category === "finished" ? "bg-green-100 text-green-700" :
                          "bg-purple-100 text-purple-700"
                        }`}>
                          {product.category === "raw" ? "خام" : product.category === "finished" ? "جاهز" : "فرعي"}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{product.currentQuantity}</p>
                        <p className="text-xs text-muted-foreground">{product.unit}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-xs text-muted-foreground">التكاليف</p>
                        <p className="font-semibold text-rose-600">{product.totalCost.toLocaleString()}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-xs text-muted-foreground">الإيرادات</p>
                        <p className="font-semibold text-emerald-600">{product.totalRevenue.toLocaleString()}</p>
                      </div>
                      <div className={`rounded p-2 ${netProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                        <p className="text-xs text-muted-foreground">الصافي</p>
                        <p className={`font-semibold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {netProfit.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-3 border-t border-border flex gap-2">
                    {isAdmin && (
                      <button 
                        onClick={() => openAddOperation(product)}
                        className="flex-1 bg-primary text-primary-foreground py-2 rounded-md text-sm font-medium hover:bg-primary/90"
                      >
                        <Plus className="w-4 h-4 inline ml-1" /> عملية
                      </button>
                    )}
                    <button 
                      onClick={() => openDetails(product)}
                      className="px-3 py-2 border border-border bg-background rounded-md hover:bg-muted"
                      title="التفاصيل"
                    >
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDelete(product._id)}
                        className="px-3 py-2 border border-border bg-background rounded-md hover:bg-red-50 hover:border-red-200 group"
                        title="حذف"
                      >
                        <Trash2 className="w-5 h-5 text-muted-foreground group-hover:text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSuccess={() => mutate()}
        branchId={isSuperAdmin ? selectedBranchId : null}
        branchName={isSuperAdmin ? selectedBranch?.name : null}
        allBranches={isSuperAdmin ? branchesData?.branches : []}
      />
      
      <AddOperationModal
        isOpen={isAddOperationOpen}
        onClose={() => {
          setIsAddOperationOpen(false);
          setSelectedProduct(null);
        }}
        onSuccess={() => {
          mutate();
          setIsAddOperationOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
      />

      <ProductDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedProduct(null);
        }}
        productId={selectedProduct?._id || null}
        onAddOperation={() => {
          setIsDetailsOpen(false);
          setIsAddOperationOpen(true);
        }}
        onRefresh={() => mutate()}
      />
    </div>
  );
}
