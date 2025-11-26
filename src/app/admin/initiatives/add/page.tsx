"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AddInitiative() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    totalAmount: 0,
    status: "planned"
  });

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/initiatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        router.push("/admin/initiatives");
      } else {
        alert("حدث خطأ أثناء إضافة المبادرة");
      }
    } catch (error) {
      console.error("Error adding initiative:", error);
      alert("حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/admin/initiatives" className="text-blue-600 hover:text-blue-700 mb-2 inline-block">
            ← العودة للمبادرات
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">إضافة مبادرة جديدة</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">اسم المبادرة</label>
              <input
                id="name"
                type="text"
                required
                className="w-full p-2 border rounded-md"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
              <textarea
                id="description"
                required
                rows={4}
                className="w-full p-2 border rounded-md"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                <input
                  id="date"
                  type="date"
                  required
                  className="w-full p-2 border rounded-md"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 mb-1">المبلغ الإجمالي (ج.م)</label>
                <input
                  id="totalAmount"
                  type="number"
                  min="0"
                  required
                  className="w-full p-2 border rounded-md"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
              <select
                id="status"
                className="w-full p-2 border rounded-md"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="planned">مخططة</option>
                <option value="active">نشطة</option>
                <option value="completed">مكتملة</option>
                <option value="cancelled">ملغاة</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition disabled:opacity-50"
            >
              {loading ? "جاري الحفظ..." : "حفظ المبادرة"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
