"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

interface DonorSummary {
  _id: string;
  name: string;
  totalDonated: number;
  donationsCount: number;
  lastDonationDate?: string;
}

export default function DonorsListPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [donors, setDonors] = useState<DonorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isAdmin = role === "admin";
  const canEdit = isAdmin;

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    const canAccess = role === "admin" || role === "member";
    if (isLoaded && !canAccess) router.push("/");
  }, [isLoaded, user, router]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/donors?limit=200", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setDonors(data.donors || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (isLoaded) load();
  }, [isLoaded]);

  const handleDeleteDonor = async (donorId: string, donorName: string) => {
    if (!confirm(`هل أنت متأكد من حذف المتبرع "${donorName}"؟\nسيتم حذف جميع بيانات التبرعات المرتبطة به.\nلا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    setDeleting(donorId);
    try {
      const res = await fetch(`/api/donors/${donorId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل حذف المتبرع");
      }

      setError("");
      setDonors((prev) => prev.filter((d) => d._id !== donorId));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء حذف المتبرع");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">المتبرعون</h1>
          <Link href="/admin/treasury" className="text-sm text-muted-foreground hover:text-primary">العودة للخزينة</Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : donors.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">لا توجد متبرعون بعد</div>
        ) : (
          <div className="grid gap-3">
            {donors.map((d) => (
              <div key={d._id} className="border border-border rounded-lg p-4 flex justify-between items-center hover:bg-muted/50 transition">
                <Link href={`/admin/donors/${d._id}`} className="flex-1">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-muted-foreground">عدد التبرعات: {d.donationsCount}</div>
                </Link>
                <div className="text-right flex-1">
                  <div className="font-semibold">{d.totalDonated?.toLocaleString("ar-EG") || 0} ج.م</div>
                  <div className="text-sm text-muted-foreground">آخر تبرع: {d.lastDonationDate ? new Date(d.lastDonationDate).toLocaleDateString("ar-EG") : "-"}</div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleDeleteDonor(d._id, d.name)}
                    disabled={deleting === d._id}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-2 rounded transition flex items-center gap-1 disabled:opacity-50 ml-2"
                    type="button"
                    title="حذف المتبرع"
                  >
                    {deleting === d._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
