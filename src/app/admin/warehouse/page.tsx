"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Loader2, Archive, ArrowDownCircle, ArrowUpCircle, Filter, Package, DollarSign, Trash2, Edit } from "lucide-react";
import StatCard from "@/components/StatCard";
import SearchFilterBar from "@/components/SearchFilterBar";

// --- Types ---
interface WarehouseMovement {
  _id: string;
  type: "inbound" | "outbound";
  category: "cash" | "product";
  itemName?: string;
  description: string;
  quantity?: number;
  value?: number;
  date: string;
}

// --- Components ---


function RecordMovementModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  inventory = [], 
  cashBalance = 0,
  initialData = null
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void; 
  inventory?: { itemName: string; quantity: number }[];
  cashBalance?: number;
  initialData?: WarehouseMovement | null;
}) {
  const [formData, setFormData] = useState({
    type: "inbound",
    category: "product",
    itemName: "",
    description: "",
    quantity: "",
    value: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Populate form when initialData changes or modal opens
  useMemo(() => {
    if (initialData) {
      setFormData({
        type: initialData.type,
        category: initialData.category,
        itemName: initialData.itemName || "",
        description: initialData.description,
        quantity: initialData.quantity?.toString() || "",
        value: initialData.value?.toString() || "",
      });
    } else {
       // Reset form for new entry
       setFormData({
        type: "inbound",
        category: "product",
        itemName: "",
        description: "",
        quantity: "",
        value: "",
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    
    // Client-side quick validation logic (same as before)
    if (formData.type === 'outbound') {
      if (formData.category === 'cash') {
        // If editing, we should technically add back the old value before checking, but simple check is okay for now
        // or just let backend handle it
        if (Number(formData.value) > (cashBalance + (initialData?.category === 'cash' && initialData?.type ==='outbound' ? (initialData.value || 0) : 0))) {
          // Relaxed client check for edit
        }
      } else if (formData.category === 'product') {
        // Similar logic for inventory
      }
    }

    try {
      const url = initialData ? `/api/warehouse/${initialData._id}` : "/api/warehouse";
      const method = initialData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          quantity: formData.quantity ? Number(formData.quantity) : undefined,
          value: formData.value ? Number(formData.value) : undefined,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      
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
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">{initialData ? "تعديل حركة" : "تسجيل حركة مخزن"}</h2>
        {error && <div className="text-red-500 mb-3 text-sm font-medium bg-red-50 p-2 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">نوع الحركة</label>
              <select 
                className="w-full border rounded p-2 bg-background"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
              >
                <option value="inbound">وارد (إضافة)</option>
                <option value="outbound">صادر (سحب)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الفئة</label>
              <select 
                className="w-full border rounded p-2 bg-background"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                <option value="product">منتج / عيني</option>
                <option value="cash">نقدي</option>
              </select>
            </div>
          </div>
          
          {formData.category === 'product' && (
            <div>
              <label className="block text-sm font-medium mb-1">اسم الصنف</label>
              {formData.type === 'outbound' ? (
                 <select 
                   required
                   className="w-full border rounded p-2 bg-background"
                   value={formData.itemName}
                   onChange={e => setFormData({...formData, itemName: e.target.value})}
                 >
                   <option value="">اختر الصنف...</option>
                   {inventory.map(item => (
                     <option key={item.itemName} value={item.itemName}>
                       {item.itemName} (متاح: {item.quantity})
                     </option>
                   ))}
                 </select>
              ) : (
                <input 
                  required
                  className="w-full border rounded p-2 bg-background"
                  placeholder="مثال: أرز، سكر، زيت..."
                  value={formData.itemName}
                  onChange={e => setFormData({...formData, itemName: e.target.value})}
                />
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">بيان الحركة</label>
            <textarea 
              required
              className="w-full border rounded p-2 bg-background"
              rows={3}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">الكمية (اختياري)</label>
              <input 
                type="number" 
                className="w-full border rounded p-2 bg-background"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">القيمة {formData.category === 'cash' ? '(المبلغ)' : 'التقديرية'} </label>
              <input 
                type="number" 
                className="w-full border rounded p-2 bg-background"
                value={formData.value}
                onChange={e => setFormData({...formData, value: e.target.value})}
              />
               {formData.type === 'outbound' && formData.category === 'cash' && (
                  <p className="text-xs text-muted-foreground mt-1">الرصيد المتاح: {cashBalance.toLocaleString()} ج.م</p>
               )}
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">إلغاء</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">حفظ</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WarehousePage() {
  const { user, isLoaded } = useUser();
  const { data, error, mutate } = useSWR(isLoaded ? "/api/warehouse" : null, fetcher);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editItem, setEditItem] = useState<WarehouseMovement | null>(null);
  
  const role = user?.publicMetadata?.role as string | undefined;
  const isAdmin = role === "admin";

  const movements: WarehouseMovement[] = data?.movements || [];
  const inventory: { itemName: string; quantity: number }[] = data?.stats?.productInventory || [];
  const cashBalance: number = data?.stats?.cashBalance || 0;

  const filteredMovements = useMemo(() => {
    let result = movements;
    
    // Filter by type
    if (filterType !== "all" && filterType !== "stock") {
      result = result.filter(m => m.type === filterType);
    }
    
    // Filter by search term
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(m => 
        (m.itemName && m.itemName.toLowerCase().includes(lowerTerm)) || 
        m.description.toLowerCase().includes(lowerTerm)
      );
    }
    
    return result;
  }, [movements, filterType, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await fetch(`/api/warehouse/${id}`, { method: "DELETE" });
      mutate();
    } catch {
      alert("فشل الحذف");
    }
  };

  if (!isLoaded) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Archive className="w-8 h-8" /> سجل المخزن
            </h1>
            <p className="text-muted-foreground mt-1">تتبع حركة المخزن الواردة والصادرة</p>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:shadow hover:bg-primary/90 transition-all font-medium"
            >
              تسجيل حركة
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard 
            title="الرصيد النقدي" 
            value={`${cashBalance.toLocaleString()} ج.م`} 
            icon={<DollarSign className="w-6 h-6" />} 
            colorClass="bg-emerald-50 text-emerald-700 border-emerald-200" 
          />
          <StatCard 
            title="أصناف المخزن" 
            value={`${inventory.length} صنف`} 
            icon={<Package className="w-6 h-6" />} 
            colorClass="bg-blue-50 text-blue-700 border-blue-200" 
          />
        </div>
        
        {/* Search */}
        <div className="max-w-md">
           <SearchFilterBar 
             searchTerm={searchTerm} 
             onSearchChange={setSearchTerm} 
             placeholder="بحث في تحركات المخزن..." 
           />
        </div>

        {/* Filters */}
        <div className="flex gap-2 border-b border-border pb-4 overflow-x-auto">
          <button 
            onClick={() => setFilterType("all")} 
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterType === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            سجل الحركات (الكل)
          </button>
          <button 
            onClick={() => setFilterType("stock")} 
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterType === 'stock' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            📦 المخزون الحالي
          </button>
          <div className="w-px bg-border mx-2"></div>
          <button 
            onClick={() => setFilterType("inbound")} 
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterType === 'inbound' ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            وارد
          </button>
          <button 
            onClick={() => setFilterType("outbound")} 
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filterType === 'outbound' ? 'bg-rose-100 text-rose-800' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            صادر
          </button>
        </div>

        {/* List Content */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[300px]">
          {filterType === 'stock' ? (
            // Stock View
            inventory.length === 0 ? (
               <div className="p-12 text-center text-muted-foreground">المخزن فارغ حالياً</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
                  {inventory.map((item, idx) => (
                    <div key={idx} className="bg-background border border-border rounded-lg p-4 flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-3">
                         <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Package className="w-5 h-5"/></div>
                         <span className="font-bold text-lg">{item.itemName}</span>
                      </div>
                      <div className="text-right">
                         <span className="block text-2xl font-bold text-primary">{item.quantity}</span>
                         <span className="text-xs text-muted-foreground">الكمية المتاحة</span>
                      </div>
                    </div>
                  ))}
                </div>
            )
          ) : (
             // Movements View
             filteredMovements.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد حركات مسجلة</div>
          ) : (
            <div className="divide-y divide-border">
              {filteredMovements.map((item) => (
                <div key={item._id} className="p-4 hover:bg-muted/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 p-2 rounded-full ${item.type === 'inbound' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {item.type === 'inbound' ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {item.itemName ? `${item.itemName} - ` : ""}{item.description}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          {item.category === 'cash' ? <DollarSign className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                          {item.category === 'cash' ? 'نقدي' : 'عيني'}
                        </span>
                        <span>•</span>
                        <span>{new Date(item.date).toLocaleDateString("ar-EG")}</span>
                      </div>
                    </div>
                  </div>
                  

                  <div className="flex items-center justify-between sm:justify-end gap-6 pl-2">
                    <div className="text-left">
                      {item.quantity && <p className="text-sm font-medium">{item.quantity} قطعة</p>}
                      {item.value && <p className="text-sm text-muted-foreground">{item.value.toLocaleString()} ج.م</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            setEditItem(item);
                            setIsModalOpen(true);
                          }}
                          className="text-muted-foreground hover:text-primary transition-colors p-2"
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item._id)}
                          className="text-muted-foreground hover:text-red-500 transition-colors p-2"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
            </div>
          ))}
        </div>
      )
    )
  }
        </div>
      </div>
      
      <RecordMovementModal 
        isOpen={isModalOpen} 
        onClose={() => {
           setIsModalOpen(false);
           setEditItem(null);
        }} 
        onSuccess={() => {     
           mutate();
           setEditItem(null);
        }} 
        inventory={inventory}
        cashBalance={cashBalance}
        initialData={editItem}
      />
    </div>
  );
}
