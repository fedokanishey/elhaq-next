"use client";

import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import InitiativeForm, { InitiativeFormValues } from "../../components/InitiativeForm";

type InitiativeResponse = Partial<InitiativeFormValues> & {
  _id?: string;
  beneficiaries?: Array<string | { _id?: string }>;
};

export default function EditInitiativePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const initiativeId = useMemo(() => {
    if (!params?.id) return "";
    return Array.isArray(params.id) ? params.id[0] : params.id;
  }, [params]);

  const [initialValues, setInitialValues] = useState<InitiativeFormValues>();
  const [initialBeneficiaryIds, setInitialBeneficiaryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin" && role !== "superadmin") {
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
        const data: InitiativeResponse = await res.json();

        const formattedDate = data?.date
          ? new Date(data.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];

        setInitialValues({
          name: data?.name || "",
          description: data?.description || "",
          date: formattedDate,
          totalAmount: data?.totalAmount || 0,
          status: (data?.status as InitiativeFormValues["status"]) || "planned",
          images: Array.isArray(data?.images) ? (data.images as string[]) : [],
        });

        const ids = Array.isArray(data?.beneficiaries)
          ? data.beneficiaries
              .map((beneficiary) => (typeof beneficiary === "string" ? beneficiary : beneficiary?._id))
              .filter((value): value is string => Boolean(value))
          : [];
        setInitialBeneficiaryIds(ids);
        setError("");
      } catch (fetchError) {
        console.error(fetchError);
        setError(fetchError instanceof Error ? fetchError.message : "فشل تحميل بيانات المبادرة");
      } finally {
        setLoading(false);
      }
    };

    fetchInitiative();
  }, [initiativeId]);

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (error) {
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

  if (!initialValues || !initiativeId) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-destructive">
        <p>بيانات المبادرة غير متاحة</p>
      </div>
    );
  }

  return (
    <InitiativeForm
      mode="edit"
      initiativeId={initiativeId}
      initialValues={initialValues}
      initialBeneficiaryIds={initialBeneficiaryIds}
      onSuccess={() => router.push("/admin/initiatives")}
    />
  );
}
