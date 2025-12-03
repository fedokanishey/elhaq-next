"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp, Loader2, PiggyBank, Receipt, Trash2 } from "lucide-react";
import SearchFilterBar from "@/components/SearchFilterBar";
import BeneficiaryFilterCompact, { BeneficiaryFilterCriteria } from "@/components/BeneficiaryFilterCompact";

interface TreasuryTotals {
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
}

interface TreasuryTransaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category?: string;
  reference?: string;
  transactionDate: string;
  recordedBy?: string;
  donorId?: string;
  donorNameSnapshot?: string;
  beneficiaryIds?: string[];
  beneficiaryNamesSnapshot?: string[];
  createdAt: string;
}

interface DonorSummary {
  _id: string;
  name: string;
  totalDonated: number;
  donationsCount: number;
  lastDonationDate?: string;
}

interface BeneficiarySummary {
  _id: string;
  name: string;
}

type TreasuryFormState = {
  amount: string;
  type: "income" | "expense";
  description: string;
  category: string;
  reference: string;
  transactionDate: string;
  donorName: string;
  donorId?: string;
  beneficiaryIds: string[];
};

const createDefaultFormState = (): TreasuryFormState => ({
  amount: "",
  type: "income" as const,
  description: "",
  category: "",
  reference: "",
  transactionDate: new Date().toISOString().split("T")[0],
  donorName: "",
  donorId: "",
  beneficiaryIds: [],
});

export default function TreasuryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [beneficiarySearchTerm, setBeneficiarySearchTerm] = useState("");
  const [beneficiaryFilters, setBeneficiaryFilters] = useState<BeneficiaryFilterCriteria>({});
  const [formData, setFormData] = useState<TreasuryFormState>(createDefaultFormState);
  const [totals, setTotals] = useState<TreasuryTotals>({ incomeTotal: 0, expenseTotal: 0, balance: 0 });
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [donors, setDonors] = useState<DonorSummary[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiarySummary[]>([]);

  const loadDonors = useCallback(async () => {
    try {
      const res = await fetch("/api/donors?limit=200", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setDonors(data.donors || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadBeneficiaries = useCallback(async () => {
    try {
      const res = await fetch("/api/beneficiaries?limit=500", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setBeneficiaries(data.beneficiaries?.map((b: any) => ({ _id: b._id, name: b.name })) || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const [showDonorSuggestions, setShowDonorSuggestions] = useState(false);
  const filteredDonors = useMemo(() => {
    const term = (formData.donorName || "").trim().toLowerCase();
    if (!term) return donors.slice(0, 6);
    return donors.filter((d) => d.name.toLowerCase().includes(term)).slice(0, 6);
  }, [donors, formData.donorName]);

  const filteredBeneficiaries = useMemo(() => {
    let result = beneficiaries;

    // Apply search filter
    const searchTerm = beneficiarySearchTerm.trim().toLowerCase();
    if (searchTerm) {
      result = result.filter((b) =>
        b.name.toLowerCase().includes(searchTerm)
      );
    }

    // Apply filter criteria - health status
    if (beneficiaryFilters.healthStatus) {
      // This would need to be fetched with full beneficiary data
      // For now, we filter by name if it contains the status
    }

    // Apply filter criteria - housing type
    if (beneficiaryFilters.housingType) {
      // This would need to be fetched with full beneficiary data
    }

    return result;
  }, [beneficiaries, beneficiarySearchTerm, beneficiaryFilters]);

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    const fetchTreasury = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/treasury?limit=100", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch treasury data");
        }
        const data = await res.json();
        setTotals(data.totals || { incomeTotal: 0, expenseTotal: 0, balance: 0 });
        setTransactions(data.transactions || []);
        setError("");
      } catch (err) {
        console.error(err);
        setError("فشل تحميل بيانات الخزينة");
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded) {
      fetchTreasury();
      loadDonors();
      loadBeneficiaries();
    }
  }, [isLoaded, loadDonors, loadBeneficiaries]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value, ...(name === "donorName" ? { donorId: "" } : {}) }));
    if (name === "donorName") setShowDonorSuggestions(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      setError("من فضلك أدخل وصف العملية");
      return;
    }

    const amountNumber = Number(formData.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("قيمة المبلغ غير صحيحة");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/treasury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: amountNumber,
          recordedBy: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل تسجيل العملية");
      }

      setFormData(createDefaultFormState());
      await refreshTreasury();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء التسجيل");
    } finally {
      setSubmitting(false);
    }
  };

  const refreshTreasury = async () => {
    try {
      const res = await fetch("/api/treasury?limit=100", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setTotals(data.totals || { incomeTotal: 0, expenseTotal: 0, balance: 0 });
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه العملية؟\nلا يمكن التراجع عن هذا الإجراء.")) {
      return;
    }

    setDeleting(transactionId);
    try {
      const res = await fetch(`/api/treasury/${transactionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل حذف العملية");
      }

      setError("");
      await refreshTreasury();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء حذف العملية");
    } finally {
      setDeleting(null);
    }
  };

  const sortedTransactions = useMemo(() => {
    let result = [...transactions];

    // Apply search filter
    if (debouncedSearch) {
      const normalize = (value?: string | number) =>
        typeof value === "number"
          ? value.toString()
          : (value || "")
              .toString()
              .toLowerCase()
              .normalize("NFKD")
              .replace(/[\u064B-\u065F]/g, "");

      const query = normalize(debouncedSearch);
      
      result = result.filter((txn) => {
        const searchableText = [
          normalize(txn.description),
          normalize(txn.category),
          normalize(txn.reference),
          normalize(txn.amount),
          normalize(txn.donorNameSnapshot),
          normalize(txn.type),
          (txn.beneficiaryNamesSnapshot || [])
            .map(name => normalize(name))
            .join(" ")
        ]
          .filter(Boolean)
          .join(" ");

        return searchableText.includes(query);
      });
    }

    // Sort by date
    result.sort((a, b) => {
      const dateA = new Date(a.transactionDate || a.createdAt).getTime();
      const dateB = new Date(b.transactionDate || b.createdAt).getTime();
      return sortDesc ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [transactions, debouncedSearch, sortDesc]);

  const formattedTotals = useMemo(() => ({
    balance: formatCurrency(totals.balance),
    income: formatCurrency(totals.incomeTotal),
    expense: formatCurrency(totals.expenseTotal),
  }), [totals]);

  // donors state is populated by loadDonors and used to populate donor pages

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-3">
          <Link href="/admin/dashboard" className="text-muted-foreground hover:text-primary inline-flex items-center gap-2">
            ← العودة للوحة التحكم
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">الخزينة</h1>
            <p className="text-muted-foreground">تتبع الوارد والصادر وراقب الرصيد المتبقي بسهولة.</p>
            <div className="mt-2">
              <Link
                href="/admin/donors"
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                🧾 قائمة المتبرعين ({donors.length})
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            title="الرصيد المتبقي"
            value={formattedTotals.balance}
            icon={<PiggyBank className="w-6 h-6 text-primary" />}
            accent="border-primary"
          />
          <SummaryCard
            title="إجمالي الوارد"
            value={formattedTotals.income}
            icon={<ArrowDownCircle className="w-6 h-6 text-emerald-500" />}
            accent="border-emerald-500"
          />
          <SummaryCard
            title="إجمالي المصروف"
            value={formattedTotals.expense}
            icon={<ArrowUpCircle className="w-6 h-6 text-rose-500" />}
            accent="border-rose-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-foreground">تسجيل عملية جديدة</h2>
              <p className="text-sm text-muted-foreground">أدخل الوارد أو الصادر وسيتم تحديث الرصيد تلقائياً.</p>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-muted-foreground mb-1">
                    المبلغ (ج.م)
                  </label>
                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.amount}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label htmlFor="transactionDate" className="block text-sm font-medium text-muted-foreground mb-1">
                    التاريخ
                  </label>
                  <input
                    id="transactionDate"
                    name="transactionDate"
                    type="date"
                    required
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.transactionDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-muted-foreground mb-1">نوع العملية</label>
                  <select
                    id="type"
                    name="type"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.type}
                    onChange={handleInputChange}
                  >
                    <option value="income">وارد</option>
                    <option value="expense">مصروف</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-muted-foreground mb-1">التصنيف</label>
                  <input
                    id="category"
                    name="category"
                    type="text"
                    placeholder="مثل: تبرعات، فواتير، مساعدات"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.category}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {formData.type === "income" && (
                <div>
                  <label htmlFor="donorName" className="block text-sm font-medium text-muted-foreground mb-1">اسم المتبرع (إذا وُجد)</label>
                  <input
                    id="donorName"
                    name="donorName"
                    type="text"
                    placeholder="اسم المتبرع أو جهة التبرع"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.donorName}
                        onChange={handleInputChange}
                        onFocus={() => setShowDonorSuggestions(true)}
                        autoComplete="off"
                  />
                      {showDonorSuggestions && filteredDonors.length > 0 && (
                        <div className="border border-border rounded-md mt-2 bg-card max-h-40 overflow-auto z-50">
                          {filteredDonors.map((d) => (
                            <button
                              key={d._id}
                              type="button"
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, donorName: d.name, donorId: d._id }));
                                setShowDonorSuggestions(false);
                              }}
                              className="w-full text-right px-4 py-2 hover:bg-muted text-foreground flex justify-between items-center"
                            >
                              <span>{d.name}</span>
                              <span className="text-xs text-muted-foreground">{d.totalDonated?.toLocaleString("ar-EG") || 0} ج.م</span>
                            </button>
                          ))}
                        </div>
                      )}
                </div>
              )}

              {formData.type === "expense" && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-3">المستفيدون من المبلغ</label>
                  <div className="mb-3 flex gap-3">
                    <div className="flex-1">
                      <SearchFilterBar
                        searchTerm={beneficiarySearchTerm}
                        onSearchChange={setBeneficiarySearchTerm}
                        placeholder="ابحث عن المستفيد..."
                        onClearSearch={() => setBeneficiarySearchTerm("")}
                      />
                    </div>
                    <BeneficiaryFilterCompact
                      onFilterChange={setBeneficiaryFilters}
                      onClear={() => setBeneficiaryFilters({})}
                    />
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto border border-border rounded-lg p-3 bg-background/50">
                    {filteredBeneficiaries.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {beneficiaries.length === 0 ? "لا يوجد مستفيدون" : "لا توجد نتائج بحث"}
                      </p>
                    ) : (
                      filteredBeneficiaries.map((b) => (
                        <label key={b._id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded transition">
                          <input
                            type="checkbox"
                            checked={formData.beneficiaryIds.includes(b._id)}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                beneficiaryIds: e.target.checked
                                  ? [...prev.beneficiaryIds, b._id]
                                  : prev.beneficiaryIds.filter(id => id !== b._id)
                              }));
                            }}
                            className="w-4 h-4 rounded border-border"
                          />
                          <span className="text-sm text-foreground">{b.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {formData.beneficiaryIds.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">تم اختيار {formData.beneficiaryIds.length} مستفيد</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-muted-foreground mb-1">الوصف</label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={formData.description}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label htmlFor="reference" className="block text-sm font-medium text-muted-foreground mb-1">مرجع العملية (اختياري)</label>
                <input
                  id="reference"
                  name="reference"
                  type="text"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={formData.reference}
                  onChange={handleInputChange}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center rounded-lg bg-primary px-4 py-3 text-primary-foreground font-semibold hover:bg-primary/90 transition disabled:opacity-60"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري الحفظ...
                  </span>
                ) : (
                  "حفظ العملية"
                )}
              </button>
            </form>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">آخر العمليات</h2>
                  <p className="text-sm text-muted-foreground">يتم عرض آخر 100 عملية مالية.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSortDesc(!sortDesc)}
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/10 transition"
                    type="button"
                    title={sortDesc ? "من الأحدث للأقدم" : "من الأقدم للأحدث"}
                  >
                    {sortDesc ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <SearchFilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder="ابحث عن وصف أو فئة أو متبرع أو مستفيد..."
                onClearSearch={() => setSearchTerm("")}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : sortedTransactions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                لا توجد عمليات مسجلة بعد
              </div>
            ) : (
              <div className="space-y-3 max-h-128 overflow-y-auto pr-1">
                {sortedTransactions.map((txn) => (
                  <div
                    key={txn._id}
                    className="border border-border rounded-lg p-4 bg-background/60 hover:bg-background/80 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-base font-semibold text-foreground">
                          {txn.description}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Receipt className="w-4 h-4" />
                          {formatDate(txn.transactionDate || txn.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-lg font-bold ${
                            txn.type === "income" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {txn.type === "income" ? "+" : "-"}
                          {formatCurrency(txn.amount)} ج.م
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {txn.category || "غير مصنف"}
                        </div>
                        {txn.donorId && (
                          <div className="mt-2 text-sm">
                            <Link href={`/admin/donors/${txn.donorId}`} className="text-primary text-sm">
                              {txn.donorNameSnapshot || "متبرع"}
                            </Link>
                          </div>
                        )}
                        {txn.beneficiaryNamesSnapshot && txn.beneficiaryNamesSnapshot.length > 0 && (
                          <div className="mt-2 text-sm">
                            <p className="text-muted-foreground text-xs mb-1">المستفيدون:</p>
                            <div className="flex flex-wrap gap-1">
                              {txn.beneficiaryNamesSnapshot.map((name, idx) => (
                                <span key={idx} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteTransaction(txn._id)}
                        disabled={deleting === txn._id}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-2 rounded transition flex items-center gap-1 disabled:opacity-50"
                        type="button"
                        title="حذف العملية"
                      >
                        {deleting === txn._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {(txn.reference || txn.recordedBy) && (
                      <div className="mt-3 text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        {txn.reference && <span>مرجع: {txn.reference}</span>}
                        {txn.recordedBy && <span>مسجل بواسطة: {txn.recordedBy}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}

function SummaryCard({ title, value, icon, accent }: SummaryCardProps) {
  return (
    <div className={`bg-card border border-border rounded-xl shadow-sm p-5 flex items-center gap-4 ${accent}`}>
      <div className="p-3 bg-primary/5 rounded-full">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-1">{value} ج.م</p>
      </div>
    </div>
  );
}
