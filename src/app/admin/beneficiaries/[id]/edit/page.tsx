"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";

interface Child {
  _id?: string;
  name: string;
  nationalId?: string;
  school?: string;
  educationStage?: string;
}

interface SpouseDetails {
  name: string;
  nationalId: string;
  phone: string;
  whatsapp: string;
}

interface FormData {
  name: string;
  nationalId: string;
  phone: string;
  whatsapp: string;
  address: string;
  familyMembers: number;
  maritalStatus: string;
  income: string;
  priority: number;
  profileImage: string;
  idImage: string;
  notes: string;
  spouse: SpouseDetails;
  children: Child[];
}

const createEmptySpouse = (): SpouseDetails => ({
  name: "",
  nationalId: "",
  phone: "",
  whatsapp: "",
});

const createEmptyChild = (): Child => ({
  name: "",
  nationalId: "",
  school: "",
  educationStage: "",
});

const isSpouseEmpty = (spouse?: SpouseDetails) => {
  if (!spouse) return true;
  return !spouse.name && !spouse.nationalId && !spouse.phone && !spouse.whatsapp;
};

export default function EditBeneficiary({ params }: { params: Promise<{ id: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { id } = use(params);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<FormData>({
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
    spouse: createEmptySpouse(),
    children: [],
  });

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    const fetchBeneficiary = async () => {
      try {
        const res = await fetch(`/api/beneficiaries/${id}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch beneficiary");
        }
        const data = await res.json();
        const record = data?.beneficiary || data;
        setFormData({
          name: record.name || "",
          nationalId: record.nationalId || "",
          phone: record.phone || "",
          whatsapp: record.whatsapp || "",
          address: record.address || "",
          familyMembers: record.familyMembers || 1,
          maritalStatus: record.maritalStatus || "single",
          income: record.income?.toString?.() || "",
          priority: record.priority || 5,
          profileImage: record.profileImage || "",
          idImage: record.idImage || "",
          notes: record.notes || "",
          spouse: record.spouse || createEmptySpouse(),
          children: Array.isArray(record.children)
            ? record.children.map((child: Child & { idNumber?: string }) => ({
                _id: child._id,
                name: child.name || "",
                nationalId: child.nationalId || child.idNumber || "",
                school: child.school || "",
                educationStage: child.educationStage || "",
              }))
            : [],
        });
      } catch (err) {
        console.error(err);
        setError("فشل تحميل بيانات المستفيد");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchBeneficiary();
    }
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "familyMembers" || name === "priority"
          ? value === ""
            ? 0
            : parseInt(value)
          : value,
    }));
  };

  useEffect(() => {
    if (formData.maritalStatus !== "married") {
      setFormData((prev) => {
        if (!prev.idImage && isSpouseEmpty(prev.spouse)) {
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
      children[index] = { ...children[index], [field]: value };
      return { ...prev, children };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/beneficiaries/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          income: formData.income === "" ? undefined : Number(formData.income),
          spouse: formData.maritalStatus === "married" ? formData.spouse : undefined,
          idImage: formData.maritalStatus === "married" ? formData.idImage : "",
          children: formData.children
            .map((child) => ({
              ...child,
              name: child.name.trim(),
              nationalId: child.nationalId?.trim(),
              school: child.school?.trim(),
            }))
            .filter((child) => child.name),
        }),
      });

      if (res.ok) {
        router.push("/admin/beneficiaries");
      } else {
        const data = await res.json();
        setError(data.error || "فشل تحديث المستفيد");
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء الإرسال");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/beneficiaries"
            className="text-muted-foreground hover:text-primary mb-4 inline-flex items-center gap-2 transition-colors"
          >
            ← العودة
          </Link>
          <h1 className="text-3xl font-bold text-foreground">تعديل بيانات المستفيد</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
            {error}
          </div>
        )}

        {/* Form */}
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
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="beneficiary-id" className="block text-sm font-medium text-foreground mb-2">
                رقم المستفيد
              </label>
              <input
                id="beneficiary-id"
                type="text"
                name="nationalId"
                value={formData.nationalId}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="beneficiary-phone" className="block text-sm font-medium text-foreground mb-2">
                رقم الهاتف
              </label>
              <input
                id="beneficiary-phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
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
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Address and Family Info */}
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
                <option value="single">أعزب/عزباء</option>
                <option value="married">متزوج/متزوجة</option>
                <option value="divorced">مطلق/مطلقة</option>
                <option value="widowed">أرمل/أرملة</option>
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
              <label htmlFor="beneficiary-priority" className="block text-sm font-medium text-foreground mb-2">
                الأولوية (1-10)
              </label>
              <input
                id="beneficiary-priority"
                type="range"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                min="1"
                max="10"
                className="w-full"
              />
              <div className="text-center text-sm text-muted-foreground mt-1">
                {formData.priority}
              </div>
            </div>
          </div>

          {/* Images */}
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
                  <div key={child._id ?? index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-border rounded-lg p-4 bg-muted/50">
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

          {/* Notes */}
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

          {/* Submit Button */}
          <div className="flex gap-4 pt-6 border-t border-border">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-70 font-medium transition"
            >
              {submitting ? "جاري التحديث..." : "💾 تحديث المستفيد"}
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
