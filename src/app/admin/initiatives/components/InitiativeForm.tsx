"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CldUploadWidget } from "next-cloudinary";
import { ArrowDownUp } from "lucide-react";
import BeneficiaryFilterPanel, { BeneficiaryFilterCriteria } from "@/components/BeneficiaryFilterPanel";
import { useBranchContext } from "@/contexts/BranchContext";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export type InitiativeStatus = "planned" | "active" | "completed" | "cancelled";

export interface InitiativeFormValues {
  name: string;
  description: string;
  date: string;
  totalAmount: number;
  status: InitiativeStatus;
  images: string[];
}

interface BeneficiaryChildSummary {
  _id?: string;
  name?: string;
}

interface BeneficiaryOption {
  _id: string;
  name: string;
  phone?: string;
  nationalId?: string;
  children?: BeneficiaryChildSummary[];
  address?: string;
  healthStatus?: "healthy" | "sick";
  housingType?: "owned" | "rented";
  employment?: string;
  priority?: number;
}

interface BeneficiaryApiRecord {
  _id?: string;
  name?: string;
  phone?: string;
  whatsapp?: string;
  nationalId?: string;
  address?: string;
  healthStatus?: "healthy" | "sick";
  housingType?: "owned" | "rented";
  employment?: string;
  priority?: number;
  children?: BeneficiaryChildSummary[];
}

export interface InitiativeFormProps {
  mode: "create" | "edit";
  initiativeId?: string;
  initialValues?: InitiativeFormValues;
  initialBeneficiaryIds?: string[];
  onSuccess?: () => void;
  isModal?: boolean;
  onCancel?: () => void;
}

const defaultFormValues = (): InitiativeFormValues => ({
  name: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
  totalAmount: 0,
  status: "planned",
  images: [],
});

export default function InitiativeForm({
  mode,
  initiativeId,
  initialValues,
  initialBeneficiaryIds = [],
  onSuccess,
  isModal = false,
  onCancel,
}: InitiativeFormProps) {
  const router = useRouter();
  const { selectedBranchId, isSuperAdmin } = useBranchContext();
  
  // Fetch branch details if SuperAdmin has selected a branch
  const { data: branchesData } = useSWR(
    isSuperAdmin && selectedBranchId ? "/api/branches" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  
  const selectedBranch = branchesData?.branches?.find((b: { _id: string; name: string }) => b._id === selectedBranchId);
  
  const [formData, setFormData] = useState<InitiativeFormValues>(() => initialValues || defaultFormValues());
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryOption[]>([]);
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState<BeneficiaryOption[]>([]);
  const [selectionSeed, setSelectionSeed] = useState<string[]>(initialBeneficiaryIds);
  const [hasHydratedSelection, setHasHydratedSelection] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [beneficiaryFilters, setBeneficiaryFilters] = useState<BeneficiaryFilterCriteria>({
    city: "",
    healthStatus: "",
    housingType: "",
    priorityMin: 1,
    priorityMax: 10,
    employment: "",
  });
  const [sortByNationalId, setSortByNationalId] = useState(true);

  const cloudinaryPreset =
    process.env.NEXT_PUBLIC_CLOUDINARY_INITIATIVE_PRESET ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    "elhaq_beneficiaries";

  useEffect(() => {
    if (initialValues) {
      setFormData(initialValues);
    } else if (mode === "create") {
      setFormData(defaultFormValues());
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    setSelectionSeed(initialBeneficiaryIds);
    setHasHydratedSelection(false);
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadBeneficiaries = async () => {
      setLoadingBeneficiaries(true);
      try {
        const res = await fetch("/api/beneficiaries", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch beneficiaries");
        }
        const data = await res.json();
        const mapped: BeneficiaryOption[] = Array.isArray(data?.beneficiaries)
          ? data.beneficiaries.map((item: BeneficiaryApiRecord) => ({
              _id: item?._id?.toString?.() ?? item?._id ?? "",
              name: item?.name || "بدون اسم",
              phone: item?.phone || item?.whatsapp,
              nationalId: item?.nationalId,
              address: item?.address,
              healthStatus: item?.healthStatus,
              housingType: item?.housingType,
              employment: item?.employment,
              priority: item?.priority,
              children: Array.isArray(item?.children)
                ? item.children.map((child: BeneficiaryChildSummary) => ({
                    _id: child?._id?.toString?.() ?? child?._id,
                    name: child?.name || "",
                  }))
                : [],
            }))
          : [];
        setBeneficiaries(mapped);
      } catch (fetchError) {
        console.error(fetchError);
        setError("فشل تحميل المستفيدين، حاول تحديث الصفحة");
      } finally {
        setLoadingBeneficiaries(false);
      }
    };

    loadBeneficiaries();
  }, []);

  useEffect(() => {
    if (hasHydratedSelection) {
      return;
    }
    if (!beneficiaries.length) {
      return;
    }
    if (!selectionSeed.length) {
      setSelectedBeneficiaries([]);
      setHasHydratedSelection(true);
      return;
    }

    setSelectedBeneficiaries(
      selectionSeed
        .map((beneficiaryId) =>
          beneficiaries.find((record) => record._id === beneficiaryId) || null
        )
        .filter(Boolean) as BeneficiaryOption[]
    );
    setHasHydratedSelection(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beneficiaries, selectionSeed]);

  const filteredBeneficiaries = useMemo(() => {
    let result = beneficiaries;

    // Apply text search
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter((beneficiary) => {
        // If searchByBeneficiaryId is enabled, only search by nationalId
        if (beneficiaryFilters.searchByBeneficiaryId) {
          return (beneficiary.nationalId || "").toLowerCase().includes(term);
        }

        const base = `${beneficiary.name} ${beneficiary.phone || ""} ${beneficiary.nationalId || ""}`.toLowerCase();
        const matchesBase = base.includes(term);
        const matchesChildren = beneficiary.children?.some((child) =>
          (child?.name || "").toLowerCase().includes(term)
        );
        return matchesBase || Boolean(matchesChildren);
      });
    }

    // Apply filter criteria
    // City/Address filter
    if (beneficiaryFilters.city?.trim()) {
      const cityTerm = beneficiaryFilters.city.toLowerCase();
      result = result.filter((b) =>
        (b.address || "").toLowerCase().includes(cityTerm)
      );
    }

    // Health status filter
    if (beneficiaryFilters.healthStatus) {
      result = result.filter((b) => b.healthStatus === beneficiaryFilters.healthStatus);
    }

    // Housing type filter
    if (beneficiaryFilters.housingType) {
      result = result.filter((b) => b.housingType === beneficiaryFilters.housingType);
    }

    // Employment filter
    if (beneficiaryFilters.employment?.trim()) {
      const empTerm = beneficiaryFilters.employment.toLowerCase();
      result = result.filter((b) =>
        (b.employment || "").toLowerCase().includes(empTerm)
      );
    }

    // Priority range filter
    if (beneficiaryFilters.priorityMin !== undefined || beneficiaryFilters.priorityMax !== undefined) {
      const minPriority = beneficiaryFilters.priorityMin ?? 1;
      const maxPriority = beneficiaryFilters.priorityMax ?? 10;
      result = result.filter((b) => {
        const priority = b.priority ?? 5;
        return priority >= minPriority && priority <= maxPriority;
      });
    }

    // Sort by nationalId
    result.sort((a, b) => {
      const aId = parseInt(a.nationalId || "0", 10);
      const bId = parseInt(b.nationalId || "0", 10);
      return sortByNationalId ? aId - bId : bId - aId;
    });

    return result;
  }, [beneficiaries, searchTerm, beneficiaryFilters, sortByNationalId]);

  const toggleBeneficiary = (beneficiary: BeneficiaryOption) => {
    setSelectedBeneficiaries((prev) => {
      const exists = prev.some((item) => item._id === beneficiary._id);
      return exists ? prev.filter((item) => item._id !== beneficiary._id) : [...prev, beneficiary];
    });
  };

  const handleImageUpload = (imageUrl: string) => {
    setFormData((prev) => ({ ...prev, images: [...prev.images, imageUrl] }));
  };

  const handleRemoveImage = (imageUrl: string) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((img) => img !== imageUrl),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      ...formData,
      totalAmount: Number(formData.totalAmount) || 0,
      beneficiaries: selectedBeneficiaries.map((item) => item._id),
      // Include branch for SuperAdmin when a specific branch is selected
      ...(isSuperAdmin && selectedBranchId && mode === "create" ? {
        branch: selectedBranchId,
        branchName: selectedBranch?.name || null,
      } : {}),
    };

    const endpoint = mode === "edit" && initiativeId ? `/api/initiatives/${initiativeId}` : "/api/initiatives";
    const method = mode === "edit" ? "PUT" : "POST";

    if (mode === "edit" && !initiativeId) {
      setSubmitting(false);
      setError("معرف المبادرة غير متوفر");
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "فشل حفظ بيانات المبادرة");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/admin/initiatives");
      }
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "حدث خطأ أثناء حفظ المبادرة");
    } finally {
      setSubmitting(false);
    }
  };

  const heading = mode === "edit" ? "تعديل المبادرة" : "إضافة مبادرة جديدة";
  const submitLabel = mode === "edit" ? "تحديث المبادرة" : "حفظ المبادرة";
  const submittingLabel = mode === "edit" ? "جاري التحديث..." : "جاري الحفظ...";

  if (isModal) {
    return (
       <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
            {error}
          </div>
        )}
        <div className="bg-card rounded-lg p-1">
           <form onSubmit={handleSubmit} className="space-y-6">
             {/* Form content will follow */}
             {/* We need to restructure slightly to avoid duplicating form content. 
                 Actually, the original return wraps everything. 
                 Let's keep the form logic here but careful about duplication.
             */}
             {renderFormFields()}
           </form>
        </div>
       </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link
            href="/admin/initiatives"
            className="text-primary hover:text-primary/80 mb-3 inline-flex items-center gap-2"
          >
            ← العودة للمبادرات
          </Link>
          <h1 className="text-3xl font-bold text-foreground">{heading}</h1>
          <p className="text-muted-foreground mt-1">
            {mode === "edit"
              ? "قم بتحديث بيانات الحملة وضبط المستفيدين المرتبطين بها."
              : "املأ التفاصيل التالية لضبط الحملة وتحديد المستفيدين المستهدفين."}
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
            {error}
          </div>
        )}

        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {renderFormFields()}
          </form>
        </div>
      </div>
    </div>
  );

  function renderFormFields() {
    return (
      <>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">
            اسم المبادرة
          </label>
          <input
            id="name"
            type="text"
            required
            className="w-full p-3 bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-1">
            الوصف
          </label>
          <textarea
            id="description"
            required
            rows={4}
            className="w-full p-3 bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-muted-foreground mb-1">
              التاريخ
            </label>
            <input
              id="date"
              type="date"
              required
              className="w-full p-3 bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="totalAmount" className="block text-sm font-medium text-muted-foreground mb-1">
              المبلغ الإجمالي (ج.م)
            </label>
            <input
              id="totalAmount"
              type="number"
              min="0"
              required
              className="w-full p-3 bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary"
              value={formData.totalAmount}
              onChange={(e) => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
            />
          </div>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-muted-foreground mb-1">
            الحالة
          </label>
          <select
            id="status"
            className="w-full p-3 bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary"
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as InitiativeStatus,
              })
            }
          >
            <option value="planned">مخططة</option>
            <option value="active">نشطة</option>
            <option value="completed">مكتملة</option>
            <option value="cancelled">ملغاة</option>
          </select>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-muted-foreground">صور المبادرة</label>
            <p className="text-xs text-muted-foreground">
              يمكنك رفع أكثر من صورة، وسيتم تخزين الروابط بعد رفعها على Cloudinary.
            </p>
          </div>

          {formData.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {formData.images.map((image) => (
                <div key={image} className="relative group rounded-lg overflow-hidden border border-border">
                  <img src={image} alt="صورة المبادرة" className="w-full h-28 object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(image)}
                    className="absolute top-2 left-2 bg-background/90 text-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shadow"
                    aria-label="حذف الصورة"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <CldUploadWidget
            uploadPreset={cloudinaryPreset}
            options={{ multiple: false }}
            onSuccess={(result) => {
              const info = result?.info as { secure_url?: string } | undefined;
              if (info?.secure_url) {
                handleImageUpload(info.secure_url);
              }
              setUploadingImage(false);
            }}
            onError={() => {
              setUploadingImage(false);
              setError("فشل تحميل الصورة. حاول مرة أخرى.");
            }}
            onClose={() => setUploadingImage(false)}
          >
            {({ open }) => (
              <button
                type="button"
                onClick={() => {
                  setUploadingImage(true);
                  open();
                }}
                disabled={uploadingImage}
                className="w-full p-3 border border-dashed border-primary text-primary rounded-md hover:bg-primary/5 transition disabled:opacity-50"
              >
                {uploadingImage ? "جاري رفع الصورة..." : "إضافة صورة"}
              </button>
            )}
          </CldUploadWidget>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">المستفيدون من المبادرة</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedBeneficiaries.length} مختار
              </span>
              <button
                type="button"
                onClick={() => setSortByNationalId(!sortByNationalId)}
                className="px-3 py-1.5 bg-card border border-border rounded-md text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
                title={sortByNationalId ? "ترتيب تصاعدي حسب رقم المستفيد" : "ترتيب تنازلي حسب رقم المستفيد"}
              >
                <ArrowDownUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 w-full">
              <input
                type="text"
                placeholder={beneficiaryFilters.searchByBeneficiaryId ? "ابحث برقم المستفيد..." : "ابحث بالاسم أو رقم الهاتف أو اسم الأبناء"}
                className="w-full p-3 bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <BeneficiaryFilterPanel onFilterChange={setBeneficiaryFilters} variant="dropdown" />
          </div>

          {selectedBeneficiaries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedBeneficiaries.map((beneficiary) => (
                <span
                  key={beneficiary._id}
                  className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm"
                >
                  {beneficiary.nationalId ? `${beneficiary.nationalId} - ${beneficiary.name}` : beneficiary.name}
                  <button
                    type="button"
                    onClick={() => toggleBeneficiary(beneficiary)}
                    className="text-xs text-primary/70 hover:text-primary"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border max-h-64 overflow-y-auto">
            {loadingBeneficiaries ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">جاري تحميل المستفيدين...</div>
            ) : filteredBeneficiaries.length > 0 ? (
              filteredBeneficiaries.map((beneficiary) => {
                const isSelected = selectedBeneficiaries.some((item) => item._id === beneficiary._id);
                const childNames = beneficiary.children?.map((child) => child?.name).filter(Boolean);
                return (
                  <button
                    type="button"
                    key={beneficiary._id}
                    onClick={() => toggleBeneficiary(beneficiary)}
                    className={`w-full text-right px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 transition-colors ${
                      isSelected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium">
                      {beneficiary.nationalId ? `${beneficiary.nationalId} - ${beneficiary.name}` : beneficiary.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {beneficiary.phone || "بدون رقم"}
                      {childNames?.length ? ` • أبناء: ${childNames.join(", ")}` : ""}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                لا توجد نتائج مطابقة للبحث
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {isModal && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full bg-muted text-muted-foreground py-3 px-4 rounded-md hover:bg-muted/80 transition"
            >
              إلغاء
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-md hover:bg-primary/90 transition disabled:opacity-50"
          >
            {submitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </>
    );
  }
}
