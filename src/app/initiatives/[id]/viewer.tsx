'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Wallet,
  X,
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
    <div className="w-full bg-linear-to-b from-background via-background to-background/80">
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-12 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors gap-1"
          >
            ← العودة للرئيسية
          </Link>
          <div>
            <span className="inline-flex items-center text-xs font-semibold tracking-widest uppercase text-primary/80 mb-2">
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

        {/* Cover Image */}
        {initiative.images && initiative.images.length > 0 && (
          <div
            className="w-full rounded-2xl overflow-hidden border border-border/70 bg-muted shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => setSelectedImage(initiative.images![0])}
          >
            <div className="w-full aspect-video md:aspect-4/3 lg:aspect-video">
              <img
                src={initiative.images[0]}
                alt={`صورة غلاف لمبادرة ${initiative.name}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
          {/* Left Column: Gallery & Description */}
          <div className="lg:col-span-2 space-y-8">
            {/* Gallery */}
            {initiative.images && initiative.images.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">الصور الإضافية</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {initiative.images.slice(1).map((image, index) => (
                    <div
                      key={`gallery-${index}`}
                      className="rounded-xl overflow-hidden border border-border/70 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedImage(image)}
                    >
                      <div className="w-full aspect-square">
                        <img
                          src={image}
                          alt={`صورة ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="bg-card border border-border overflow-scroll rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm">
              <h3 className="text-sm font-semibold text-primary tracking-widest uppercase">عن المبادرة</h3>
              <p className="text-muted-foreground leading-relaxed text-base">
                {initiative.description || "لا يوجد وصف تفصيلي متاح حالياً لهذه المبادرة. سيتم تحديث هذه المعلومات قريباً."}
              </p>
            </div>
          </div>

          {/* Right Column: Info */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">معلومات أساسية</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> التاريخ
                  </span>
                  <span className="font-medium text-foreground text-right">
                    {initiative.date
                      ? new Date(initiative.date).toLocaleDateString("ar-EG")
                      : "غير محدد"}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> الميزانية
                  </span>
                  <span className="font-medium text-foreground text-right">
                    {initiative.totalAmount ? `${initiative.totalAmount.toLocaleString("ar-EG")} ج.م` : "غير محدد"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4" /> الحالة
                  </span>
                  <span className="font-medium text-foreground text-right">
                    {readableStatus || "غير محدد"}
                  </span>
                </div>
              </div>
            </div>

            {/* Beneficiaries */}
            {initiative.beneficiaries && initiative.beneficiaries.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">المستفيدون</h3>
                  <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                    {initiative.beneficiaries.length} أشخاص
                  </span>
                </div>
              </div>
            )}

            {/* Back Button */}
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full rounded-2xl bg-primary px-6 py-3 text-primary-foreground font-semibold text-sm gap-2 shadow-md hover:bg-primary/90 transition"
            >
              العودة للرئيسية
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage}
              alt="صورة بحجم كامل"
              className="w-full h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
