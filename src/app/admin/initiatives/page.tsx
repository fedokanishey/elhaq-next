"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import Link from "next/link";
import InitiativeModal from "@/components/InitiativeModal";
import { useBranchContext } from "@/contexts/BranchContext";
import { ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import QRScannerModal from "@/components/QRScannerModal";

interface Initiative {
  _id: string;
  name: string;
  description: string;
  date: string;
  status: string;
  totalAmount: number;
}

export default function AdminInitiatives() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin" || isSuperAdmin;
  
  const { selectedBranchId } = useBranchContext();
  const branchParam = selectedBranchId ? `?branchId=${selectedBranchId}` : "";

  const { data, isLoading, mutate } = useSWR(
    isLoaded ? `/api/initiatives${branchParam}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const initiatives = (data?.initiatives || []).sort((a: Initiative, b: Initiative) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const loading = isLoading;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");

  // Barcode Scanner State
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scanInitiativeId, setScanInitiativeId] = useState<string | null>(null);

  const handleBarcodeScan = async (barcode: string) => {
    if (!scanInitiativeId) return;
    try {
      const res = await fetch(`/api/initiatives/${scanInitiativeId}/scan-benefit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.alreadyReceived) {
          toast.warning(data.error || "تم الاستلام بالفعل من قبل", {
            duration: 6000,
          });
          return;
        }
        throw new Error(data.error || "فشل تسجيل الاستلام بالباركود");
      }

      toast.success(`تم تسجيل استلام المستفيد: ${data.beneficiaryName}`);
      mutate();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "فشل تسجيل الاستلام بالباركود");
    }
  };

  const handleOpenEdit = (id: string) => {
    setSelectedId(id);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const handleOpenView = (id: string) => {
    setSelectedId(id);
    setModalMode("view");
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setSelectedId(undefined); // Create mode
    setModalMode("create");
    setIsModalOpen(true);
  };

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin" && role !== "member" && role !== "superadmin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المبادرة؟")) return;

    try {
      const res = await fetch(`/api/initiatives/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        mutate();
      } else {
        alert("فشل حذف المبادرة");
      }
    } catch (error) {
      console.error("Error deleting initiative:", error);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/admin/dashboard" className="text-muted-foreground hover:text-primary mb-2 inline-flex items-center gap-2 transition-colors">
              ← العودة للوحة التحكم
            </Link>
            <h1 className="text-3xl font-bold text-foreground">إدارة المبادرات</h1>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              ➕ إضافة مبادرة
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : initiatives.length === 0 ? (
          <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
            <p className="text-muted-foreground text-lg">لا توجد مبادرات حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {initiatives.map((initiative: Initiative) => (
              <div key={initiative._id} className="bg-card border border-border rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-foreground">{initiative.name}</h3>
                  <span className={`px-2 py-1 rounded text-sm ${
                    initiative.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    initiative.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                    initiative.status === 'planned' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                    'bg-muted text-foreground'
                  }`}>
                    {initiative.status === 'active' ? 'نشطة' :
                     initiative.status === 'completed' ? 'مكتملة' :
                     initiative.status === 'planned' ? 'مخططة' : 'ملغاة'}
                  </span>
                </div>
                <p className="text-muted-foreground mb-4 line-clamp-2">{initiative.description}</p>
                <div className="flex justify-between text-sm text-muted-foreground border-t border-border pt-4 mb-4">
                  <span>📅 {new Date(initiative.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  <span>💰 {initiative.totalAmount} ج.م</span>
                </div>
                <div className="flex gap-2 justify-end border-t border-border pt-4 flex-wrap">
                  {initiative.status === "active" && (
                    <button
                      onClick={() => {
                        setScanInitiativeId(initiative._id);
                        setIsScanOpen(true);
                      }}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm inline-flex items-center gap-1.5 transition"
                      title="مسح باركود الاستلام"
                    >
                      <ScanBarcode className="w-3.5 h-3.5" />
                      استلام
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenView(initiative._id)}
                    className="px-3 py-1 border border-border text-foreground rounded hover:bg-muted text-sm"
                  >
                    عرض التفاصيل
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleOpenEdit(initiative._id)}
                        className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(initiative._id)}
                        className="px-3 py-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/80 text-sm"
                      >
                        حذف
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <InitiativeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initiativeId={selectedId}
          initialMode={modalMode}
          onSuccess={() => mutate()}
        />

        {isScanOpen && (
          <QRScannerModal
            isOpen={isScanOpen}
            onClose={() => {
              setIsScanOpen(false);
              setScanInitiativeId(null);
            }}
            onScan={handleBarcodeScan}
            title="مسح باركود استلام المبادرة"
          />
        )}
      </div>
    </div>
  );
}
