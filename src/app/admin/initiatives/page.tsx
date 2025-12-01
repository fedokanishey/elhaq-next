"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

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
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    const fetchInitiatives = async () => {
      try {
        const res = await fetch("/api/initiatives");
        const data = await res.json();
        if (res.ok) {
          setInitiatives(data.initiatives);
        }
      } catch (error) {
        console.error("Error fetching initiatives:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded) {
      fetchInitiatives();
    }
  }, [isLoaded]);

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المبادرة؟")) return;

    try {
      const res = await fetch(`/api/initiatives/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setInitiatives((prev) => prev.filter((i) => i._id !== id));
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
          <Link
            href="/admin/initiatives/add"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            ➕ إضافة مبادرة
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : initiatives.length === 0 ? (
          <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
            <p className="text-muted-foreground text-lg">لا توجد مبادرات حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {initiatives.map((initiative) => (
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
                <div className="flex gap-2 justify-end border-t border-border pt-4">
                  <Link
                    href={`/admin/initiatives/${initiative._id}`}
                    className="px-3 py-1 border border-border text-foreground rounded hover:bg-muted text-sm"
                  >
                    عرض التفاصيل
                  </Link>
                  <Link
                    href={`/admin/initiatives/${initiative._id}/edit`}
                    className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
                  >
                    تعديل
                  </Link>
                  <button
                    onClick={() => handleDelete(initiative._id)}
                    className="px-3 py-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/80 text-sm"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
