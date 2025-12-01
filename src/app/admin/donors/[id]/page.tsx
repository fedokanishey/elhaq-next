"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Donor {
  _id: string;
  name: string;
  totalDonated: number;
  donationsCount: number;
  lastDonationDate?: string;
}

interface DonationEntry {
  _id: string;
  amount: number;
  description: string;
  transactionDate: string;
  category?: string;
  reference?: string;
  donorNameSnapshot?: string;
}

export default function DonorDetailPage() {
  const params = useParams<{ id: string }>();
  const donorId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [donor, setDonor] = useState<Donor | null>(null);
  const [donations, setDonations] = useState<DonationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") router.push("/");
  }, [isLoaded, user, router]);

  useEffect(() => {
    const load = async () => {
      if (!donorId) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/donors/${donorId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("فشل تحميل بيانات المتبرع");
        const data = await res.json();
        setDonor(data.donor || null);
        setDonations(data.donations || []);
      } catch (err) {
        console.error(err);
        setError("فشل تحميل بيانات المتبرع");
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded) load();
  }, [donorId, isLoaded]);

  if (!isLoaded || loading) {
    return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  if (!donor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>المتبرع غير موجود</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin/donors" className="text-muted-foreground">← العودة لقائمة المتبرعين</Link>
            <h1 className="text-2xl font-bold mt-2">{donor.name}</h1>
            <p className="text-sm text-muted-foreground">إجمالي المبلغ: {donor.totalDonated?.toLocaleString("ar-EG") || 0} ج.م</p>
          </div>
          <div>
            <Link href="/admin/treasury" className="text-sm text-muted-foreground">العودة للخزينة</Link>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-semibold">سجل التبرعات ({donations.length})</h2>
          {donations.length === 0 ? (
            <div className="text-sm text-muted-foreground mt-4">
              {donor.totalDonated > 0 ? (
                <>
                  يبدو أن سجل التبرعات مرتبط بإجمالي {donor.totalDonated?.toLocaleString("ar-EG")} ج.م ولكن الدفعات غير مرتبطة بهذا الملف.
                  <div className="mt-3">
                    <button
                      className="px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const res = await fetch(`/api/donors/${donor._id}/relink`, { method: "POST" });
                          if (!res.ok) throw new Error("فشل محاولة الربط");
                          const data = await res.json();
                          // reload donations after relink
                          const r2 = await fetch(`/api/donors/${donor._id}`, { cache: "no-store" });
                          const latest = await r2.json();
                          setDonor(latest.donor || donor);
                          setDonations(latest.donations || []);
                          alert(`تم ربط ${data.modified || 0} دفعات بهذا المتبرع`);
                        } catch (err) {
                          console.error(err);
                          alert("حدث خطأ أثناء محاولة الربط");
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      ربط الدفعات بهذا المتبرع
                    </button>
                  </div>
                </>
              ) : (
                <div>لا توجد دفعات مسجلة لهذا المتبرع.</div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {donations.map((d) => (
                  <div key={d._id} className="border border-border rounded-lg p-3 bg-background/50">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-foreground">{d.description || "بدون وصف"}</div>
                          <div className="font-semibold text-foreground">{formatCurrency(d.amount)} ج.م</div>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-3">
                          {d.category && <span>تصنيف: {d.category}</span>}
                          {d.reference && <span>مرجع: {d.reference}</span>}
                          {d.donorNameSnapshot && <span>اسم الملف: {d.donorNameSnapshot}</span>}
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">{formatDate((d.transactionDate as string) || (d as unknown as { createdAt?: string }).createdAt)}</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ar-EG");
}
