"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";

interface Child {
    _id?: string;
    name: string;
    dateOfBirth?: string;
    gender?: string;
}

interface FormData {
  name: string;
  nationalId: string;
  phone: string;
  email: string;
  address: string;
  familyMembers: number;
  maritalStatus: string;
  income: string;
  priority: number;
  profileImage: string;
  idImage: string;
  notes: string;
  children: Child[];
}

export default function EditBeneficiary({ params }: { params: Promise<{ id: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { id } = use(params);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [childName, setChildName] = useState("");

  const [formData, setFormData] = useState<FormData>({
    name: "",
    nationalId: "",
    phone: "",
    email: "",
    address: "",
    familyMembers: 1,
    maritalStatus: "single",
    income: "",
    priority: 5,
    profileImage: "",
    idImage: "",
    notes: "",
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
        const res = await fetch(`/api/beneficiaries/${id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch beneficiary");
        }
        const data = await res.json();
        setFormData({
          name: data.name || "",
          nationalId: data.nationalId || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          familyMembers: data.familyMembers || 1,
          maritalStatus: data.maritalStatus || "single",
          income: data.income || "",
          priority: data.priority || 5,
          profileImage: data.profileImage || "",
          idImage: data.idImage || "",
          notes: data.notes || "",
          children: data.children || [],
        });
      } catch (err) {
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
        name === "familyMembers" || name === "priority" || name === "income"
          ? value === ""
            ? 0
            : parseInt(value)
          : value,
    }));
  };

  const handleAddChild = () => {
    if (childName.trim()) {
      setFormData((prev) => ({
        ...prev,
        children: [...prev.children, { name: childName }],
      }));
      setChildName("");
    }
  };

  const handleRemoveChild = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index),
    }));
  };

  const handleEditChild = (index: number) => {
    const child = formData.children[index];
    setChildName(child.name);
    handleRemoveChild(index);
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
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push("/admin/beneficiaries");
      } else {
        const data = await res.json();
        setError(data.error || "فشل تحديث المستفيد");
      }
    } catch (err) {
      setError("حدث خطأ أثناء الإرسال");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/beneficiaries"
            className="text-blue-600 hover:text-blue-700 mb-4 inline-block"
          >
            ← العودة
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">تعديل بيانات المستفيد</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                الاسم الكامل
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                رقم الهوية
              </label>
              <input
                type="text"
                name="nationalId"
                value={formData.nationalId}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                رقم الهاتف
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          {/* Address and Family Info */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              العنوان
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                عدد أفراد الأسرة
              </label>
              <input
                type="number"
                name="familyMembers"
                value={formData.familyMembers}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                الحالة الاجتماعية
                </label>
                <select
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                <option value="single">أعزب/عزباء</option>
                <option value="married">متزوج/متزوجة</option>
                <option value="divorced">مطلق/مطلقة</option>
                <option value="widowed">أرمل/أرملة</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                الدخل الشهري
                </label>
                <input
                type="number"
                name="income"
                value={formData.income}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                الأولوية (1-10)
              </label>
              <input
                type="range"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                min="1"
                max="10"
                className="w-full"
              />
              <div className="text-center text-sm text-gray-600 mt-1">
                {formData.priority}
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900">الصور</h3>

            <ImageUpload
              label="صورة الملف الشخصي"
              onImageUpload={(url) =>
                setFormData((prev) => ({ ...prev, profileImage: url }))
              }
              currentImage={formData.profileImage}
            />

            <ImageUpload
              label="صورة الهوية"
              onImageUpload={(url) =>
                setFormData((prev) => ({ ...prev, idImage: url }))
              }
              currentImage={formData.idImage}
            />
          </div>

          {/* Children */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900">الأطفال</h3>

            <div className="flex gap-2">
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="اسم الطفل"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
              <button
                type="button"
                onClick={handleAddChild}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                ➕
              </button>
            </div>

            {formData.children.length > 0 && (
              <div className="space-y-2">
                {formData.children.map((child, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center bg-gray-50 p-3 rounded-lg text-gray-900"
                  >
                    <span>{child.name}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditChild(index)}
                        className="text-blue-600 hover:text-blue-700"
                        title="تعديل"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveChild(index)}
                        className="text-red-600 hover:text-red-700"
                        title="حذف"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              ملاحظات
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-6 border-t">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition"
            >
              {submitting ? "جاري التحديث..." : "💾 تحديث المستفيد"}
            </button>

            <Link
              href="/admin/beneficiaries"
              className="flex-1 px-6 py-3 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-medium transition text-center"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
