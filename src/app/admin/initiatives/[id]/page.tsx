"use client";
/* eslint-disable @next/next/no-img-element */

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Image as ImageIcon,
  Users,
} from "lucide-react";

interface BeneficiarySummary {
  _id: string;
  name: string;
  phone?: string;
  profileImage?: string;
}

interface InitiativeDetails {
  _id?: string;
  name?: string;
  description?: string;
  date?: string;
  totalAmount?: number;
  status?: "planned" | "active" | "completed" | "cancelled";
  images?: string[];
  beneficiaries?: BeneficiarySummary[];
}

const STATUS_LABELS: Record<string, string> = {
  planned: "مخططة",
  active: "نشطة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
};

export default function ViewInitiativePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const initiativeId = useMemo(() => {
    if (!params?.id) return "";
    return Array.isArray(params.id) ? params.id[0] : params.id;
  }, [params]);

  const [initiative, setInitiative] = useState<InitiativeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("جاري تحميل بيانات المبادرة...");

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    if (!initiativeId) {
      setLoading(false);
      setError("لم يتم العثور على معرف المبادرة");
      return;
    }

    const fetchInitiative = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/initiatives/${initiativeId}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("فشل تحميل بيانات المبادرة");
        }
        const data: InitiativeDetails & { error?: string } = await res.json();
        if (data?.error) {
          throw new Error(data.error);
        }
        setInitiative({
          ...data,
          date: data?.date ? new Date(data.date).toISOString() : undefined,
          images: Array.isArray(data?.images) ? data.images : [],
          beneficiaries: Array.isArray(data?.beneficiaries) ? data.beneficiaries : [],
        });
        setError("");
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "فشل تحميل بيانات المبادرة");
      } finally {
        setLoading(false);
      }
    };

    fetchInitiative();
  }, [initiativeId]);

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        <p>{error}</p>
      </div>
    );
  }

  if (error && !initiative) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-destructive text-lg font-semibold">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/admin/initiatives")}
          className="px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          العودة لقائمة المبادرات
        </button>
      </div>
    );
  }

  if (!initiative) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-destructive">
        <p>بيانات المبادرة غير متاحة</p>
      </div>
    );
  }

  const formattedDate = initiative.date
    ? new Date(initiative.date).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : "غير محدد";
  const beneficiaries = initiative.beneficiaries || [];

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/admin/initiatives"
              className="text-muted-foreground hover:text-primary inline-flex items-center gap-2"
            >
              ← العودة لقائمة المبادرات
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-foreground">{initiative.name}</h1>
            <p className="text-muted-foreground">تفاصيل كاملة عن المبادرة والمستفيدين المرتبطين بها</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/admin/initiatives/${initiativeId}/edit`}
              className="inline-flex items-center justify-center px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              ✏️ تعديل المبادرة
            </Link>
            <Link
              href="/admin/initiatives/add"
              className="inline-flex items-center justify-center px-5 py-2 rounded-lg border border-border text-foreground hover:bg-muted"
            >
              ➕ إنشاء مبادرة جديدة
            </Link>
          </div>
        </div>

        <section className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[initiative.status || "planned"]}`}>
              {STATUS_LABELS[initiative.status || "planned"]}
            </span>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CalendarDays className="w-4 h-4" />
              {formattedDate}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CircleDollarSign className="w-4 h-4" />
              إجمالي التمويل: {initiative.totalAmount?.toLocaleString("ar-EG") || 0} ج.م
            </div>
          </div>

          <p className="text-foreground leading-7">{initiative.description || "لا يوجد وصف للمبادرة."}</p>

          {initiative.images && initiative.images.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {initiative.images.map((image) => (
                <div key={image} className="relative rounded-lg overflow-hidden border border-border">
                  <img src={image} alt={initiative.name} className="w-full h-64 object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground text-sm">
              <ImageIcon className="w-4 h-4" aria-hidden="true" />
              لا توجد صور مرفوعة لهذه المبادرة
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">المستفيدون ({beneficiaries.length})</h2>
          </div>

          {beneficiaries.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {beneficiaries.map((beneficiary) => (
                <div key={beneficiary._id} className="border border-border rounded-lg p-4 flex gap-4 items-center">
                  <div className="w-14 h-14 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center text-lg font-semibold text-primary">
                    {beneficiary.profileImage ? (
                      <img src={beneficiary.profileImage} alt={beneficiary.name} className="w-full h-full object-cover" />
                    ) : (
                      beneficiary.name?.charAt(0) || "م"
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground font-medium">{beneficiary.name}</p>
                    <p className="text-muted-foreground text-sm">{beneficiary.phone || "لا يوجد رقم"}</p>
                  </div>
                  <Link
                    href={`/admin/beneficiaries/${beneficiary._id}`}
                    className="inline-flex items-center gap-1 text-primary text-sm hover:text-primary/80"
                  >
                    فتح الملف
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">لا توجد أسماء مستفيدين مرتبطة حالياً بهذه المبادرة.</p>
          )}
        </section>
      </div>
    </div>
  );
}
