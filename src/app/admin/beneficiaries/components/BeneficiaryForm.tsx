"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import { calculatePriority } from "@/lib/utils/calculatePriority";

export type MaritalStatus = "single" | "married" | "divorced" | "widowed";
export type RelationshipType =
  | "father"
  | "mother"
  | "son"
  | "daughter"
  | "brother"
  | "sister"
  | "spouse"
  | "grandfather"
  | "grandmother"
  | "other";

export interface SpouseDetails {
  name: string;
  nationalId: string;
  phone: string;
  whatsapp: string;
}

export interface Child {
  _id?: string;
  name: string;
  nationalId?: string;
  school?: string;
  educationStage?: string;
  maritalStatus: MaritalStatus;
  spouse: SpouseDetails;
  healthStatus?: "healthy" | "sick";
  healthCertificationImage?: string;
}

export interface RelationshipEntry {
  relation: RelationshipType;
  relativeName: string;
  relativeNationalId: string;
  linkedBeneficiaryId?: string;
}

export interface BeneficiaryFormValues {
  name: string;
  nationalId: string;
  phone: string;
  whatsapp: string;
  address: string;
  familyMembers: number;
  maritalStatus: MaritalStatus;
  income: string;
  priority: number;
  profileImage: string;
  idImage: string;
  notes: string;
  healthStatus: "healthy" | "sick";
  healthCertificationImage: string;
  housingType: "owned" | "rented";
  rentalCost: string;
  employment: string;
  acceptsMarriage: boolean;
  marriageDetails: string;
  spouse: SpouseDetails;
  children: Child[];
  relationships: RelationshipEntry[];
}

interface RelationshipSearchResult {
  _id: string;
  name: string;
  nationalId: string;
  phone?: string;
  whatsapp?: string;
}

interface RelationshipLookupState {
  term: string;
  results: RelationshipSearchResult[];
  loading: boolean;
}

export interface BeneficiaryFormProps {
  mode: "create" | "edit";
  initialValues?: BeneficiaryFormValues;
  beneficiaryId?: string;
  onSuccess?: () => void;
}

const NAME_REGEX = /^[\u0600-\u06FFa-zA-Z]+(?:[\s'-][\u0600-\u06FFa-zA-Z]+)*$/;
const NATIONAL_ID_REGEX = /^\d+$/;
const PHONE_REGEX = /^\+?\d{10,20}$/;
const ADDRESS_MIN_LENGTH = 5;

const maritalStatusOptions: Array<{ value: MaritalStatus; label: string }> = [
  { value: "single", label: "أعزب/عزباء" },
  { value: "married", label: "متزوج/متزوجة" },
  { value: "divorced", label: "مطلق/مطلقة" },
  { value: "widowed", label: "أرمل/أرملة" },
];

const relationshipOptions: Array<{ value: RelationshipType; label: string }> = [
  { value: "father", label: "الأب" },
  { value: "mother", label: "الأم" },
  { value: "son", label: "الابن" },
  { value: "daughter", label: "الابنة" },
  { value: "brother", label: "الأخ" },
  { value: "sister", label: "الأخت" },
  { value: "spouse", label: "الزوج/الزوجة" },
  { value: "grandfather", label: "الجد" },
  { value: "grandmother", label: "الجدة" },
  { value: "other", label: "أخرى" },
];

export const createEmptySpouse = (): SpouseDetails => ({
  name: "",
  nationalId: "",
  phone: "",
  whatsapp: "",
});

export const createEmptyChild = (): Child => ({
  name: "",
  nationalId: "",
  school: "",
  educationStage: "",
  maritalStatus: "single",
  spouse: createEmptySpouse(),
  healthStatus: "healthy",
  healthCertificationImage: "",
});

export const createEmptyRelationship = (): RelationshipEntry => ({
  relation: "father",
  relativeName: "",
  relativeNationalId: "",
});

const createInitialFormValues = (): BeneficiaryFormValues => ({
  name: "",
  nationalId: "",
  phone: "",
  whatsapp: "",
  address: "",
  familyMembers: 1,
  maritalStatus: "single",
  income: "",
  priority: 5,
  profileImage: "",
  idImage: "",
  notes: "",
  healthStatus: "healthy",
  healthCertificationImage: "",
  housingType: "owned",
  rentalCost: "",
  employment: "",
  acceptsMarriage: false,
  marriageDetails: "",
  spouse: createEmptySpouse(),
  children: [],
  relationships: [],
});

const cloneFormValues = (values: BeneficiaryFormValues): BeneficiaryFormValues => ({
  ...values,
  spouse: { ...values.spouse },
  children: values.children.map((child) => ({
    ...child,
    spouse: { ...child.spouse },
  })),
  relationships: values.relationships.map((relationship) => ({ ...relationship })),
});

const isSpouseEmpty = (spouse?: SpouseDetails) => {
  if (!spouse) return true;
  return !spouse.name && !spouse.nationalId && !spouse.phone && !spouse.whatsapp;
};

export default function BeneficiaryForm({
  mode,
  initialValues,
  beneficiaryId,
  onSuccess,
}: BeneficiaryFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<BeneficiaryFormValues>(() =>
    initialValues ? cloneFormValues(initialValues) : createInitialFormValues()
  );
  const [relationshipLookups, setRelationshipLookups] = useState<RelationshipLookupState[]>(() =>
    initialValues?.relationships?.map((relationship) => ({
      term: relationship.relativeName || "",
      results: [],
      loading: false,
    })) ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [manualPriority, setManualPriority] = useState(false);

  useEffect(() => {
    if (mode === "edit" && initialValues) {
      setFormData(cloneFormValues(initialValues));
      setRelationshipLookups(
        initialValues.relationships.map((relationship) => ({
          term: relationship.relativeName || "",
          results: [],
          loading: false,
        }))
      );
    } else if (mode === "create" && !initialValues) {
      setFormData(createInitialFormValues());
      setRelationshipLookups([]);
    }
  }, [mode, initialValues]);

  useEffect(() => {
    if (formData.maritalStatus !== "married") {
      setFormData((prev) => {
        if (prev.maritalStatus !== "married" && !prev.idImage && isSpouseEmpty(prev.spouse)) {
          return prev;
        }
        return {
          ...prev,
          spouse: createEmptySpouse(),
          idImage: "",
        };
      });
    }
  }, [formData.maritalStatus]);

  // Live compute priority unless user chooses manual override
  useEffect(() => {
    if (manualPriority) return;
    const monthlyIncome = formData.income === "" ? 0 : Number(formData.income);
    const rent = formData.housingType === "rented" ? (formData.rentalCost === "" ? 0 : Number(formData.rentalCost)) : 0;
    const calc = calculatePriority(monthlyIncome, rent, formData.familyMembers);
    setFormData((prev) => ({ ...prev, priority: calc }));
  }, [formData.income, formData.rentalCost, formData.familyMembers, formData.housingType, manualPriority]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "familyMembers" || name === "priority"
          ? value === ""
            ? 0
            : parseInt(value, 10)
          : value,
    }));
  };

  const handleSpouseChange = (field: keyof SpouseDetails, value: string) => {
    setFormData((prev) => ({
      ...prev,
      spouse: {
        ...prev.spouse,
        [field]: value,
      },
    }));
  };

  const handleAddChild = () => {
    setFormData((prev) => ({
      ...prev,
      children: [...prev.children, createEmptyChild()],
    }));
  };

  const handleRemoveChild = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index),
    }));
  };

  const handleChildChange = (index: number, field: keyof Child, value: string) => {
    setFormData((prev) => {
      const children = [...prev.children];
      const nextChild = {
        ...children[index],
        [field]: value,
      } as Child;

      if (field === "maritalStatus" && value !== "married") {
        nextChild.spouse = createEmptySpouse();
      }
      // If health status changed to healthy, clear any uploaded child health certificate
      if (field === "healthStatus" && value !== "sick") {
        nextChild.healthCertificationImage = "";
      }

      children[index] = nextChild;
      return { ...prev, children };
    });
  };

  const handleChildSpouseChange = (
    index: number,
    field: keyof SpouseDetails,
    value: string
  ) => {
    setFormData((prev) => {
      const children = [...prev.children];
      const currentChild = children[index];
      const spouse = currentChild.spouse || createEmptySpouse();
      children[index] = {
        ...currentChild,
        spouse: {
          ...spouse,
          [field]: value,
        },
      };
      return { ...prev, children };
    });
  };

  const handleAddRelationship = () => {
    setFormData((prev) => ({
      ...prev,
      relationships: [...prev.relationships, createEmptyRelationship()],
    }));
    setRelationshipLookups((prev) => [...prev, { term: "", results: [], loading: false }]);
  };

  const handleRelationshipChange = (
    index: number,
    field: keyof RelationshipEntry,
    value: string
  ) => {
    setFormData((prev) => {
      const relationships = [...prev.relationships];
      const current = relationships[index];
      if (!current) {
        return prev;
      }

      const updated: RelationshipEntry = {
        ...current,
        [field]: value,
      };

      if ((field === "relativeName" || field === "relativeNationalId") && current.linkedBeneficiaryId) {
        updated.linkedBeneficiaryId = undefined;
      }

      relationships[index] = updated;
      return { ...prev, relationships };
    });
  };

  const handleRemoveRelationship = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      relationships: prev.relationships.filter((_, i) => i !== index),
    }));
    setRelationshipLookups((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRelationshipSearchChange = async (index: number, term: string) => {
    setRelationshipLookups((prev) => {
      const next = [...prev];
      const current = next[index] ?? { term: "", results: [], loading: false };
      next[index] = { ...current, term, loading: term.trim().length >= 2 };
      return next;
    });

    const normalized = term.trim();
    if (normalized.length < 2) {
      setRelationshipLookups((prev) => {
        const next = [...prev];
        const current = next[index];
        if (!current) {
          return prev;
        }
        next[index] = { ...current, results: [], loading: false };
        return next;
      });
      return;
    }

    const requestTerm = term;
    const excludeParam = mode === "edit" && beneficiaryId ? `&excludeId=${beneficiaryId}` : "";

    try {
      const res = await fetch(
        `/api/beneficiaries/search?q=${encodeURIComponent(normalized)}${excludeParam}`
      );
      if (!res.ok) {
        throw new Error("Failed to search beneficiaries");
      }
      const data = await res.json();
      setRelationshipLookups((prev) => {
        const existing = prev[index];
        if (!existing || existing.term !== requestTerm) {
          return prev;
        }
        const next = [...prev];
        next[index] = {
          ...existing,
          results: Array.isArray(data?.beneficiaries) ? data.beneficiaries : [],
          loading: false,
        };
        return next;
      });
    } catch (err) {
      console.error(err);
      setRelationshipLookups((prev) => {
        const existing = prev[index];
        if (!existing || existing.term !== requestTerm) {
          return prev;
        }
        const next = [...prev];
        next[index] = { ...existing, results: [], loading: false };
        return next;
      });
    }
  };

  const handleSelectRelationshipSuggestion = (
    index: number,
    suggestion: RelationshipSearchResult
  ) => {
    setFormData((prev) => {
      const relationships = [...prev.relationships];
      const current = relationships[index];
      if (!current) {
        return prev;
      }
      relationships[index] = {
        ...current,
        relativeName: suggestion.name || "",
        relativeNationalId: suggestion.nationalId || "",
        linkedBeneficiaryId: suggestion._id,
      };
      return { ...prev, relationships };
    });

    setRelationshipLookups((prev) => {
      const next = [...prev];
      const current = next[index] ?? { term: "", results: [], loading: false };
      next[index] = { ...current, term: suggestion.name, results: [], loading: false };
      return next;
    });
  };

  const handleClearRelationshipSelection = (index: number) => {
    setFormData((prev) => {
      const relationships = [...prev.relationships];
      const current = relationships[index];
      if (!current) {
        return prev;
      }
      relationships[index] = {
        ...current,
        linkedBeneficiaryId: undefined,
      };
      return { ...prev, relationships };
    });
    setRelationshipLookups((prev) => {
      const next = [...prev];
      if (!next[index]) {
        return prev;
      }
      next[index] = { term: "", results: [], loading: false };
      return next;
    });
  };

  const validateForm = (): string | null => {
    const name = formData.name.trim();
    const beneficiaryIdValue = formData.nationalId.trim();
    const phone = formData.phone.trim();
    const whatsapp = formData.whatsapp.trim();
    const address = formData.address.trim();

    if (!NAME_REGEX.test(name)) {
      return "الاسم يجب أن يحتوي على أحرف فقط";
    }

    if (!NATIONAL_ID_REGEX.test(beneficiaryIdValue)) {
      return "رقم المستفيد يجب أن يكون أرقاماً فقط";
    }

    if (!PHONE_REGEX.test(phone)) {
      return "رقم الهاتف يجب أن يكون بين 10 و13 رقم";
    }

    if (!PHONE_REGEX.test(whatsapp)) {
      return "رقم الواتساب يجب أن يكون بين 10 و13 رقم";
    }

    if (address.length < ADDRESS_MIN_LENGTH) {
      return "يرجى إدخال عنوان مفصل (5 أحرف على الأقل)";
    }

    if (formData.familyMembers < 1) {
      return "عدد أفراد الأسرة يجب أن يكون 1 على الأقل";
    }

    for (let i = 0; i < formData.children.length; i += 1) {
      const child = formData.children[i];
      const childName = child.name.trim();
      if (childName && !NAME_REGEX.test(childName)) {
        return `اسم الابن رقم ${i + 1} يجب أن يحتوي على أحرف فقط`;
      }
      const childNationalId = child.nationalId?.trim();
      if (childNationalId && !NATIONAL_ID_REGEX.test(childNationalId)) {
        return `الرقم القومي للابن رقم ${i + 1} يجب أن يكون أرقاماً فقط`;
      }
      if (child.maritalStatus === "married") {
        const spouseName = child.spouse?.name?.trim();
        if (!spouseName || !NAME_REGEX.test(spouseName)) {
          return `يرجى إدخال اسم الزوج/الزوجة للابن رقم ${i + 1}`;
        }
        const spouseNationalId = child.spouse?.nationalId?.trim();
        if (spouseNationalId && !NATIONAL_ID_REGEX.test(spouseNationalId)) {
          return `الرقم القومي لزوج/زوجة الابن رقم ${i + 1} غير صالح`;
        }
      }
    }

    for (let i = 0; i < formData.relationships.length; i += 1) {
      const relationship = formData.relationships[i];
      const hasValue =
        relationship.relativeName.trim() || relationship.relativeNationalId.trim();
      if (!hasValue) {
        continue;
      }

      if (!NAME_REGEX.test(relationship.relativeName.trim())) {
        return `اسم ذي القرابة رقم ${i + 1} يجب أن يحتوي على أحرف فقط`;
      }

      if (
        relationship.relativeNationalId.trim() &&
        !NATIONAL_ID_REGEX.test(relationship.relativeNationalId.trim())
      ) {
        return `الرقم القومي لذي القرابة رقم ${i + 1} غير صالح`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setSubmitting(false);
      return;
    }

    const sanitizedChildren = formData.children
      .map((child) => ({
        ...child,
        name: child.name.trim(),
        nationalId: child.nationalId?.trim(),
        school: child.school?.trim(),
        educationStage: child.educationStage || "",
      }))
      .filter((child) => child.name);

    const sanitizedRelationships = formData.relationships
      .map((relationship) => ({
        relation: relationship.relation,
        relativeName: relationship.relativeName.trim(),
        relativeNationalId: relationship.relativeNationalId.trim(),
      }))
      .filter((relationship) => relationship.relativeName);

    const monthlyIncome = formData.income === "" ? 0 : Number(formData.income);
    const rentalCost = formData.rentalCost === "" ? 0 : Number(formData.rentalCost);
    const calculatedPriority = calculatePriority(monthlyIncome, rentalCost, formData.familyMembers);

    const payload = {
      ...formData,
      name: formData.name.trim(),
      nationalId: formData.nationalId.trim(),
      phone: formData.phone.trim(),
      whatsapp: formData.whatsapp.trim(),
      address: formData.address.trim(),
      income: monthlyIncome || undefined,
      rentalCost: formData.housingType === "rented" ? rentalCost : undefined,
      priority: calculatedPriority,
      children: sanitizedChildren,
      spouse: formData.maritalStatus === "married" ? formData.spouse : undefined,
      idImage: formData.maritalStatus === "married" ? formData.idImage : "",
      relationships: sanitizedRelationships,
      healthCertificationImage: formData.healthStatus === "sick" ? formData.healthCertificationImage : "",
    };

    const endpoint =
      mode === "edit" && beneficiaryId
        ? `/api/beneficiaries/${beneficiaryId}`
        : "/api/beneficiaries";
    const method = mode === "edit" ? "PUT" : "POST";

    if (mode === "edit" && !beneficiaryId) {
      setError("معرف المستفيد غير متوفر للتعديل");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/admin/beneficiaries");
        }
      } else {
        const data = await res.json();
        setError(data.error || (mode === "edit" ? "فشل تحديث المستفيد" : "فشل إضافة المستفيد"));
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء الإرسال");
    } finally {
      setSubmitting(false);
    }
  };

  const heading = mode === "edit" ? "تعديل بيانات المستفيد" : "إضافة مستفيد جديد";
  const submitLabel = mode === "edit" ? "💾 تحديث المستفيد" : "💾 حفظ المستفيد";
  const submittingLabel = mode === "edit" ? "جاري التحديث..." : "جاري الحفظ...";

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/admin/beneficiaries"
            className="text-muted-foreground hover:text-primary mb-4 inline-flex items-center gap-2 transition-colors"
          >
            ← العودة
          </Link>
          <h1 className="text-3xl font-bold text-foreground">{heading}</h1>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="beneficiary-name" className="block text-sm font-medium text-foreground mb-2">
                الاسم الكامل
              </label>
              <input
                id="beneficiary-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                title="يجب أن يحتوي الاسم على أحرف فقط"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="beneficiary-id" className="block text-sm font-medium text-foreground mb-2">
                رقم المستفيد الداخلي
              </label>
              <input
                id="beneficiary-id"
                type="text"
                name="nationalId"
                value={formData.nationalId}
                onChange={handleChange}
                required
                inputMode="numeric"
                pattern="\d+"
                title="أرقام فقط"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="beneficiary-phone" className="block text-sm font-medium text-foreground mb-2">
                الرقم القومي
              </label>
              <input
                id="beneficiary-phone"
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                inputMode="numeric"
                pattern="\d{10,20}"
                title="أرقام فقط (10-20 رقم)"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="beneficiary-whatsapp" className="block text-sm font-medium text-foreground mb-2">
                رقم الواتساب
              </label>
              <input
                id="beneficiary-whatsapp"
                type="tel"
                name="whatsapp"
                value={formData.whatsapp}
                onChange={handleChange}
                required
                inputMode="numeric"
                pattern="\+?\d{7,15}"
                title="أرقام فقط (7-15 رقم)"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="beneficiary-address" className="block text-sm font-medium text-foreground mb-2">
              العنوان
            </label>
            <input
              id="beneficiary-address"
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              minLength={ADDRESS_MIN_LENGTH}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="beneficiary-family" className="block text-sm font-medium text-foreground mb-2">
                عدد أفراد الأسرة
              </label>
              <input
                id="beneficiary-family"
                type="number"
                name="familyMembers"
                value={formData.familyMembers}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="beneficiary-marital" className="block text-sm font-medium text-foreground mb-2">
                الحالة الاجتماعية
              </label>
              <select
                id="beneficiary-marital"
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {maritalStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="beneficiary-income" className="block text-sm font-medium text-foreground mb-2">
                الدخل الشهري
              </label>
              <input
                id="beneficiary-income"
                type="number"
                name="income"
                value={formData.income}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">الأولوية (1-10)</label>
              <div className="flex items-center gap-3">
                <div className="text-xl font-semibold text-foreground">{formData.priority}</div>
                <div className="text-sm text-muted-foreground">(محسوبة تلقائياً)</div>
                <label className="ml-auto flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={manualPriority}
                    onChange={(e) => setManualPriority(e.target.checked)}
                    aria-label="تفعيل التخصيص اليدوي للأولوية"
                    title="تفعيل التخصيص اليدوي للأولوية"
                  />
                  تخصيص يدوي
                </label>
              </div>

              {manualPriority && (
                <div className="mt-3">
                  <input
                    id="beneficiary-priority"
                    type="range"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    min="1"
                    max="10"
                    className="w-full"
                    aria-label="مستوى الأولوية (1-10)"
                    title="مستوى الأولوية (1-10)"
                  />
                  <div className="text-center text-sm text-muted-foreground mt-1">{formData.priority}</div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="beneficiary-health" className="block text-sm font-medium text-foreground mb-2">
                الحالة الصحية
              </label>
              <select
                id="beneficiary-health"
                name="healthStatus"
                value={formData.healthStatus}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="healthy">سليم/سليمة</option>
                <option value="sick">مريض/مريضة</option>
              </select>
            </div>

            <div>
              <label htmlFor="beneficiary-housing" className="block text-sm font-medium text-foreground mb-2">
                نوع السكن
              </label>
              <select
                id="beneficiary-housing"
                name="housingType"
                value={formData.housingType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="owned">مملوك</option>
                <option value="rented">مستأجر</option>
              </select>
            </div>

            {formData.housingType === "rented" && (
              <div>
                <label htmlFor="beneficiary-rental" className="block text-sm font-medium text-foreground mb-2">
                  تكلفة الإيجار الشهري
                </label>
                <input
                  id="beneficiary-rental"
                  type="number"
                  name="rentalCost"
                  value={formData.rentalCost}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            )}

            <div>
              <label htmlFor="beneficiary-employment" className="block text-sm font-medium text-foreground mb-2">
                الحالة الوظيفية
              </label>
              <input
                id="beneficiary-employment"
                type="text"
                name="employment"
                value={formData.employment}
                onChange={handleChange}
                placeholder="مثال: موظف حكومي، عامل حر، طالب..."
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                id="accepts-marriage"
                type="checkbox"
                checked={formData.acceptsMarriage}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    acceptsMarriage: e.target.checked,
                  }))
                }
                className="w-4 h-4 rounded border-input bg-background cursor-pointer accent-primary"
              />
              <label htmlFor="accepts-marriage" className="text-sm font-medium text-foreground cursor-pointer">
                مقبل على الزواج
              </label>
            </div>

            {formData.acceptsMarriage && (
              <div>
                <label htmlFor="marriage-details" className="block text-sm font-medium text-foreground mb-2">
                  تفاصيل مستلزمات الزواج
                </label>
                <textarea
                  id="marriage-details"
                  value={formData.marriageDetails}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      marriageDetails: e.target.value,
                    }))
                  }
                  placeholder="أضف أي تفاصيل إضافية حول مستلزمات الزواج..."
                  rows={3}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                />
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-foreground">الصور</h3>

            <ImageUpload
              label="صورة هوية الزوج"
              onImageUpload={(url) =>
                setFormData((prev) => ({ ...prev, profileImage: url }))
              }
              currentImage={formData.profileImage}
            />

            {formData.maritalStatus === "married" && (
              <ImageUpload
                label="صورة هوية الزوجة"
                onImageUpload={(url) =>
                  setFormData((prev) => ({ ...prev, idImage: url }))
                }
                currentImage={formData.idImage}
              />
            )}

            {formData.healthStatus === "sick" && (
              <ImageUpload
                label="شهادة طبية (للحالات المرضية)"
                onImageUpload={(url) =>
                  setFormData((prev) => ({ ...prev, healthCertificationImage: url }))
                }
                currentImage={formData.healthCertificationImage}
              />
            )}
          </div>

          {formData.maritalStatus === "married" && (
            <div className="space-y-4 border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground">بيانات الزوج/الزوجة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="spouse-name" className="block text-sm font-medium text-foreground mb-2">
                    الاسم الكامل
                  </label>
                  <input
                    id="spouse-name"
                    type="text"
                    value={formData.spouse.name}
                    onChange={(e) => handleSpouseChange("name", e.target.value)}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="spouse-national" className="block text-sm font-medium text-foreground mb-2">
                    الرقم القومي
                  </label>
                  <input
                    id="spouse-national"
                    type="text"
                    value={formData.spouse.nationalId}
                    onChange={(e) => handleSpouseChange("nationalId", e.target.value)}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="spouse-phone" className="block text-sm font-medium text-foreground mb-2">
                    رقم الهاتف
                  </label>
                  <input
                    id="spouse-phone"
                    type="tel"
                    value={formData.spouse.phone}
                    onChange={(e) => handleSpouseChange("phone", e.target.value)}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label htmlFor="spouse-whatsapp" className="block text-sm font-medium text-foreground mb-2">
                    رقم الواتساب
                  </label>
                  <input
                    id="spouse-whatsapp"
                    type="tel"
                    value={formData.spouse.whatsapp}
                    onChange={(e) => handleSpouseChange("whatsapp", e.target.value)}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">الأبناء</h3>
              <button
                type="button"
                onClick={handleAddChild}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                إضافة ابن
              </button>
            </div>

            {formData.children.length > 0 ? (
              <div className="space-y-4">
                {formData.children.map((child, index) => (
                  <div
                    key={child._id ?? index}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-border rounded-lg p-4 bg-muted/50"
                  >
                    <div>
                      <label htmlFor={`child-name-${index}`} className="block text-sm font-medium text-foreground mb-2">
                        اسم الابن
                      </label>
                      <input
                        id={`child-name-${index}`}
                        type="text"
                        value={child.name}
                        onChange={(e) => handleChildChange(index, "name", e.target.value)}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor={`child-national-${index}`} className="block text-sm font-medium text-foreground mb-2">
                        الرقم القومي
                      </label>
                      <input
                        id={`child-national-${index}`}
                        type="text"
                        value={child.nationalId || ""}
                        onChange={(e) => handleChildChange(index, "nationalId", e.target.value)}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor={`child-marital-${index}`} className="block text-sm font-medium text-foreground mb-2">
                        الحالة الاجتماعية
                      </label>
                      <select
                        id={`child-marital-${index}`}
                        value={child.maritalStatus}
                        onChange={(e) => handleChildChange(index, "maritalStatus", e.target.value)}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        {maritalStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`child-school-${index}`} className="block text-sm font-medium text-foreground mb-2">
                        المدرسة
                      </label>
                      <input
                        id={`child-school-${index}`}
                        type="text"
                        value={child.school || ""}
                        onChange={(e) => handleChildChange(index, "school", e.target.value)}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor={`child-stage-${index}`} className="block text-sm font-medium text-foreground mb-2">
                        المرحلة التعليمية
                      </label>
                      <select
                        id={`child-stage-${index}`}
                        value={child.educationStage || ""}
                        onChange={(e) => handleChildChange(index, "educationStage", e.target.value)}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="">اختر المرحلة</option>
                        <option value="kindergarten">حضانه</option>
                        <option value="primary">ابتدائي</option>
                        <option value="preparatory">إعدادي</option>
                        <option value="secondary">ثانوي</option>
                        <option value="university">جامعي</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`child-health-${index}`} className="block text-sm font-medium text-foreground mb-2">
                        الحالة الصحية
                      </label>
                      <select
                        id={`child-health-${index}`}
                        value={child.healthStatus || "healthy"}
                        onChange={(e) => handleChildChange(index, "healthStatus", e.target.value)}
                        className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="healthy">سليم/سليمة</option>
                        <option value="sick">مريض/مريضة</option>
                      </select>
                    </div>

                    {child.healthStatus === "sick" && (
                      <div className="sm:col-span-2">
                        <ImageUpload
                          label={`شهادة طبية للابن ${child.name || index + 1}`}
                          onImageUpload={(url) =>
                            setFormData((prev) => {
                              const children = [...prev.children];
                              children[index] = { ...children[index], healthCertificationImage: url } as Child;
                              return { ...prev, children };
                            })
                          }
                          currentImage={child.healthCertificationImage}
                        />
                      </div>
                    )}
                    {child.maritalStatus === "married" && (
                      <div className="sm:col-span-2 border border-border rounded-lg p-4 bg-background/80 space-y-4">
                        <p className="text-sm font-semibold text-foreground">بيانات زوج/زوجة الابن</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor={`child-spouse-name-${index}`} className="block text-sm font-medium text-foreground mb-2">
                              الاسم الكامل
                            </label>
                            <input
                              id={`child-spouse-name-${index}`}
                              type="text"
                              value={child.spouse?.name || ""}
                              onChange={(e) => handleChildSpouseChange(index, "name", e.target.value)}
                              className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                          </div>
                          <div>
                            <label htmlFor={`child-spouse-national-${index}`} className="block text-sm font-medium text-foreground mb-2">
                              الرقم القومي
                            </label>
                            <input
                              id={`child-spouse-national-${index}`}
                              type="text"
                              value={child.spouse?.nationalId || ""}
                              onChange={(e) => handleChildSpouseChange(index, "nationalId", e.target.value)}
                              className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                          </div>
                          <div>
                            <label htmlFor={`child-spouse-phone-${index}`} className="block text-sm font-medium text-foreground mb-2">
                              رقم الهاتف
                            </label>
                            <input
                              id={`child-spouse-phone-${index}`}
                              type="tel"
                              value={child.spouse?.phone || ""}
                              onChange={(e) => handleChildSpouseChange(index, "phone", e.target.value)}
                              className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                          </div>
                          <div>
                            <label htmlFor={`child-spouse-whatsapp-${index}`} className="block text-sm font-medium text-foreground mb-2">
                              رقم الواتساب
                            </label>
                            <input
                              id={`child-spouse-whatsapp-${index}`}
                              type="tel"
                              value={child.spouse?.whatsapp || ""}
                              onChange={(e) => handleChildSpouseChange(index, "whatsapp", e.target.value)}
                              className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveChild(index)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد بيانات أبناء مسجلة</p>
            )}
          </div>

          <div className="space-y-4 border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">العلاقات العائلية</h3>
              <button
                type="button"
                onClick={handleAddRelationship}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                إضافة علاقة
              </button>
            </div>

            {formData.relationships.length > 0 ? (
              <div className="space-y-4">
                {formData.relationships.map((relationship, index) => {
                  const lookup = relationshipLookups[index];
                  const searchValue = lookup?.term ?? relationship.relativeName;
                  const suggestions = lookup?.results ?? [];

                  return (
                    <div
                      key={relationship.linkedBeneficiaryId || relationship.relativeNationalId || index}
                      className="space-y-4 border border-border rounded-lg p-4 bg-muted/40"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-[180px,1fr] gap-4">
                        <div>
                          <label htmlFor={`relationship-type-${index}`} className="block text-sm font-medium text-foreground mb-2">
                            نوع العلاقة
                          </label>
                          <select
                            id={`relationship-type-${index}`}
                            value={relationship.relation}
                            onChange={(e) => handleRelationshipChange(index, "relation", e.target.value)}
                            className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                          >
                            {relationshipOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`relationship-search-${index}`} className="block text-sm font-medium text-foreground mb-2">
                            ابحث عن مستفيد لربطه
                          </label>
                          <div className="relative">
                            <input
                              id={`relationship-search-${index}`}
                              type="text"
                              autoComplete="off"
                              value={searchValue}
                              onChange={(e) => handleRelationshipSearchChange(index, e.target.value)}
                              placeholder="اكتب اسم أو رقم المستفيد"
                              className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                            {lookup?.loading && (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                جاري البحث...
                              </span>
                            )}
                            {suggestions.length > 0 && (
                              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                                {suggestions.map((suggestion) => (
                                  <button
                                    type="button"
                                    key={suggestion._id}
                                    onClick={() => handleSelectRelationshipSuggestion(index, suggestion)}
                                    className="w-full px-4 py-2 text-right hover:bg-muted transition"
                                  >
                                    <p className="font-medium text-foreground">{suggestion.name}</p>
                                    <p className="text-xs text-muted-foreground">{suggestion.nationalId}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">اختر مستفيدًا قائمًا بدل كتابة البيانات يدويًا</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={`relationship-name-${index}`} className="block text-sm font-medium text-foreground mb-2">
                            الاسم المرتبط
                          </label>
                          <input
                            id={`relationship-name-${index}`}
                            type="text"
                            value={relationship.relativeName}
                            onChange={(e) => handleRelationshipChange(index, "relativeName", e.target.value)}
                            className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div>
                          <label htmlFor={`relationship-national-${index}`} className="block text-sm font-medium text-foreground mb-2">
                            الرقم القومي
                          </label>
                          <input
                            id={`relationship-national-${index}`}
                            type="text"
                            value={relationship.relativeNationalId}
                            onChange={(e) => handleRelationshipChange(index, "relativeNationalId", e.target.value)}
                            className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {relationship.linkedBeneficiaryId ? (
                          <div className="text-sm text-primary">
                            تم الربط مع {relationship.relativeName || "مستفيد"}
                            <button
                              type="button"
                              onClick={() => handleClearRelationshipSelection(index)}
                              className="ml-3 text-destructive hover:text-destructive/80 text-xs"
                            >
                              إزالة الربط
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">ما زال بالإمكان تعديل الاسم أو الرقم يدويًا</p>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveRelationship(index)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد علاقات مسجلة حاليًا</p>
            )}
          </div>

          <div>
            <label htmlFor="beneficiary-notes" className="block text-sm font-medium text-foreground mb-2">
              ملاحظات
            </label>
            <textarea
              id="beneficiary-notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="flex gap-4 pt-6 border-t border-border">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-70 font-medium transition"
            >
              {submitting ? submittingLabel : submitLabel}
            </button>

            <Link
              href="/admin/beneficiaries"
              className="flex-1 px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 font-medium transition text-center"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
