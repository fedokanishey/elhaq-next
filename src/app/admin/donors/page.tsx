"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") router.push("/");
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

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">المتبرعون</h1>
          <Link href="/admin/treasury" className="text-sm text-muted-foreground">العودة للخزينة</Link>
        </div>

        {loading ? (
          <div>جاري التحميل...</div>
        ) : donors.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">لا توجد متبرعون بعد</div>
        ) : (
          <div className="grid gap-3">
            {donors.map((d) => (
              <Link key={d._id} href={`/admin/donors/${d._id}`} className="border border-border rounded-lg p-4 flex justify-between items-center hover:bg-muted">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-sm text-muted-foreground">عدد التبرعات: {d.donationsCount}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{d.totalDonated?.toLocaleString("ar-EG") || 0} ج.م</div>
                  <div className="text-sm text-muted-foreground">آخر تبرع: {d.lastDonationDate ? new Date(d.lastDonationDate).toLocaleDateString("ar-EG") : "-"}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
