"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";

interface BeneficiaryOption {
  _id: string;
  name: string;
  phone?: string;
}

export default function EditInitiative({ params }: { params: Promise<{ id: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { id } = use(params);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryOption[]>([]);
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState<BeneficiaryOption[]>([]);
  const [initialBeneficiaryIds, setInitialBeneficiaryIds] = useState<string[]>([]);
  const [hasHydratedSelection, setHasHydratedSelection] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    totalAmount: 0,
    status: "planned",
  });

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    const loadBeneficiaries = async () => {
      try {
        const res = await fetch("/api/beneficiaries", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setBeneficiaries(data.beneficiaries || []);
      } catch (error) {
        console.error("Error loading beneficiaries", error);
      }
    };

    loadBeneficiaries();
  }, []);

  useEffect(() => {
    const fetchInitiative = async () => {
      try {
        const res = await fetch(`/api/initiatives/${id}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch initiative");
        }
        const data = await res.json();

        const formattedDate = data.date
          ? new Date(data.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];

        setFormData({
          name: data.name || "",
          description: data.description || "",
          date: formattedDate,
          totalAmount: data.totalAmount || 0,
          status: data.status || "planned",
        });

        const ids = Array.isArray(data.beneficiaries)
          ? data.beneficiaries.map((value: string | { _id?: string }) =>
              typeof value === "string" ? value : value?._id
            ).filter(Boolean) as string[]
          : [];
        setInitialBeneficiaryIds(ids);
        setHasHydratedSelection(false);
      } catch (error) {
        console.error("Error fetching initiative:", error);
        alert("فشل تحميل بيانات المبادرة");
      } finally {
        setFetching(false);
      }
    };

    if (id) {
      fetchInitiative();
    }
  }, [id]);

  useEffect(() => {
    if (hasHydratedSelection) return;
    if (!beneficiaries.length) return;

    if (!initialBeneficiaryIds.length) {
      setSelectedBeneficiaries([]);
      setHasHydratedSelection(true);
      return;
    }

    setSelectedBeneficiaries(
      initialBeneficiaryIds
        .map((beneficiaryId) =>
          beneficiaries.find((beneficiary) => beneficiary._id === beneficiaryId) || null
        )
        .filter(Boolean) as BeneficiaryOption[]
    );
    setHasHydratedSelection(true);
  }, [beneficiaries, initialBeneficiaryIds, hasHydratedSelection]);

  const filteredBeneficiaries = useMemo(() => {
    if (!searchTerm.trim()) return beneficiaries;
    const term = searchTerm.toLowerCase();
    return beneficiaries.filter((b) =>
      `${b.name} ${b.phone || ""}`.toLowerCase().includes(term)
    );
  }, [beneficiaries, searchTerm]);

  const toggleBeneficiary = (beneficiary: BeneficiaryOption) => {
    setSelectedBeneficiaries((prev) => {
      const exists = prev.some((item) => item._id === beneficiary._id);
      return exists
        ? prev.filter((item) => item._id !== beneficiary._id)
        : [...prev, beneficiary];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/initiatives/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          beneficiaries: selectedBeneficiaries.map((item) => item._id),
        }),
      });

      if (res.ok) {
        router.push("/admin/initiatives");
      } else {
        alert("حدث خطأ أثناء تحديث المبادرة");
      }
    } catch (error) {
      console.error("Error updating initiative:", error);
      alert("حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || fetching) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        <p>جاري التحميل...</p>
      </div>
    );
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
          <h1 className="text-3xl font-bold text-foreground">تعديل المبادرة</h1>
          <p className="text-muted-foreground mt-1">قم بتحديث بيانات الحملة وضبط المستفيدين المرتبطين بها.</p>
        </div>

        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-1">اسم المبادرة</label>
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
              <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-1">الوصف</label>
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
                <label htmlFor="date" className="block text-sm font-medium text-muted-foreground mb-1">التاريخ</label>
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
                <label htmlFor="totalAmount" className="block text-sm font-medium text-muted-foreground mb-1">المبلغ الإجمالي (ج.م)</label>
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
              <label htmlFor="status" className="block text-sm font-medium text-muted-foreground mb-1">الحالة</label>
              <select
                id="status"
                className="w-full p-3 bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="planned">مخططة</option>
                <option value="active">نشطة</option>
                <option value="completed">مكتملة</option>
                <option value="cancelled">ملغاة</option>
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">المستفيدون من المبادرة</label>
                <span className="text-xs text-muted-foreground">{selectedBeneficiaries.length} مختار</span>
              </div>
              <input
                type="text"
                placeholder="ابحث بالاسم أو الرقم"
                className="w-full p-3 bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {selectedBeneficiaries.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedBeneficiaries.map((beneficiary) => (
                    <span
                      key={beneficiary._id}
                      className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm"
                    >
                      {beneficiary.name}
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
                {filteredBeneficiaries.map((beneficiary) => {
                  const isSelected = selectedBeneficiaries.some((item) => item._id === beneficiary._id);
                  return (
                    <button
                      type="button"
                      key={beneficiary._id}
                      onClick={() => toggleBeneficiary(beneficiary)}
                      className={`w-full text-right px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 transition-colors ${
                        isSelected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="font-medium">{beneficiary.name}</span>
                      <span className="text-sm text-muted-foreground">{beneficiary.phone || "بدون رقم"}</span>
                    </button>
                  );
                })}
                {filteredBeneficiaries.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    لا توجد نتائج مطابقة للبحث
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-md hover:bg-primary/90 transition disabled:opacity-50"
            >
              {loading ? "جاري التحديث..." : "تحديث المبادرة"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
