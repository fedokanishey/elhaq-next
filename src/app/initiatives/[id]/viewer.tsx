'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Image as ImageIcon,
  Users,
  Wallet,
} from "lucide-react";

interface BeneficiaryPreview {
  _id: string;
  name: string;
  phone?: string;
}

interface InitiativeDetails {
  _id: string;
  name: string;
  description?: string;
  status?: string;
  date?: string;
  totalAmount?: number;
  images?: string[];
  beneficiaries?: BeneficiaryPreview[];
}

const statusLabels: Record<string, string> = {
  planned: "مخططة",
  active: "نشطة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

interface InitiativeDetailsClientProps {
  initiativeId: string;
}

export default function InitiativeDetailsClient({
  initiativeId,
}: InitiativeDetailsClientProps) {
  const [initiative, setInitiative] = useState<InitiativeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initiativeId) return;

    const controller = new AbortController();

    const fetchInitiative = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/initiatives/${initiativeId}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (res.status === 404) {
          if (controller.signal.aborted) return;
          setInitiative(null);
          setError("لم نعثر على هذه المبادرة");
          return;
        }

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          const message =
            (payload && typeof payload.error === "string")
              ? payload.error
              : `تعذر تحميل البيانات (رمز ${res.status})`;
          throw new Error(message);
        }

        const data = await res.json();
        if (controller.signal.aborted) return;
        setInitiative(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Failed to load initiative", err);
        setError(err instanceof Error ? err.message : "تعذر تحميل بيانات المبادرة. حاول مجدداً لاحقاً.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchInitiative();

    return () => {
      controller.abort();
    };
  }, [initiativeId]);

  const coverImage = initiative?.images?.[0];
  const galleryImages = useMemo(
    () => (initiative?.images ? initiative.images.slice(1) : []),
    [initiative]
  );
  const readableStatus = initiative?.status
    ? statusLabels[initiative.status] || initiative.status
    : undefined;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  if (error || !initiative) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center gap-6 px-6">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">لم نعثر على هذه المبادرة</h1>
          <p className="text-muted-foreground">{error || "يبدو أن هذه المبادرة غير متاحة أو تم حذفها."}</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-primary-foreground font-semibold"
        >
          العودة للرئيسية
          <ArrowRight className="w-4 h-4 mr-2" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-background/80 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors gap-1"
            >
              ← العودة للرئيسية
            </Link>
            <div className="space-y-2">
              <span className="inline-flex items-center text-xs font-semibold tracking-widest uppercase text-primary/80">
                مبادرة مجتمعية
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                {initiative.name}
              </h1>
            </div>
            {readableStatus && (
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary">
                {readableStatus}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-muted shadow-xl">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt={`صورة غلاف لمبادرة ${initiative.name}`}
                  className="w-full h-full object-cover max-h-[520px]"
                />
              ) : (
                <div className="aspect-video flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <ImageIcon className="h-10 w-10" />
                  لا توجد صورة رئيسية بعد
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-3">
                <span className="text-xs text-muted-foreground uppercase tracking-widest">
                  تفاصيل سريعة
                </span>
                <div className="flex flex-wrap gap-3 text-white text-sm font-medium">
                  <span className="bg-background/70 backdrop-blur rounded-full px-3 py-1">
                    {initiative.date
                      ? new Date(initiative.date).toLocaleDateString("ar-EG")
                      : "تاريخ غير متاح"}
                  </span>
                  <span className="bg-background/70 backdrop-blur rounded-full px-3 py-1">
                    {initiative.totalAmount ? `${initiative.totalAmount.toLocaleString("ar-EG")} ج.م` : "ميزانية غير محددة"}
                  </span>
                </div>
              </div>
            </div>

            {galleryImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {galleryImages.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="rounded-2xl overflow-hidden border border-border/70 shadow-sm"
                  >
                    <img
                      src={image}
                      alt={`صورة إضافية ${index + 1} لمبادرة ${initiative.name}`}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="bg-card border border-border rounded-3xl p-8 space-y-4 shadow-sm">
              <h3 className="text-sm font-semibold text-primary tracking-widest uppercase">عن المبادرة</h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {initiative.description || "لا يوجد وصف تفصيلي متاح حالياً لهذه المبادرة. سيتم تحديث هذه المعلومات قريباً."}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">معلومات أساسية</h3>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> التاريخ
                  </span>
                  <span className="font-medium text-foreground">
                    {initiative.date
                      ? new Date(initiative.date).toLocaleDateString("ar-EG")
                      : "غير محدد"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> الميزانية
                  </span>
                  <span className="font-medium text-foreground">
                    {initiative.totalAmount ? `${initiative.totalAmount.toLocaleString("ar-EG")} ج.م` : "غير محدد"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4" /> الحالة الحالية
                  </span>
                  <span className="font-medium text-foreground">
                    {readableStatus || "غير محدد"}
                  </span>
                </div>
              </div>
            </div>

            {initiative.beneficiaries && initiative.beneficiaries.length > 0 && (
              <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">
                    المستفيدون المرتبطون
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    {initiative.beneficiaries.length} أشخاص
                  </span>
                </div>
              </div>
            )}

            <Link
              href="/"
              className="inline-flex items-center justify-center w-full rounded-3xl bg-primary px-6 py-4 text-primary-foreground font-semibold text-base gap-2 shadow-lg hover:bg-primary/90 transition"
            >
              العودة للصفحة الرئيسية
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
