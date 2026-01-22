"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp, Loader2, PiggyBank, Receipt, Trash2, Edit2, Printer } from "lucide-react";
import SearchFilterBar from "@/components/SearchFilterBar";
import BeneficiaryFilterPanel, { BeneficiaryFilterCriteria } from "@/components/BeneficiaryFilterPanel";
import MonthlyAllowancePrintModal from "@/components/MonthlyAllowancePrintModal";
import { useBranchContext } from "@/contexts/BranchContext";

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
  notebookId?: string;
  notebookNameSnapshot?: string;
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

interface NotebookSummary {
  _id: string;
  name: string;
  transactionsCount: number;
  totalAmount: number;
  lastUsedDate?: string;
}

interface BeneficiarySummary {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  healthStatus?: "healthy" | "sick";
  housingType?: "owned" | "rented";
  employment?: string;
  priority?: number;
  acceptsMarriage?: boolean;
  marriageDetails?: string;
  nationalId?: string;
  receivesMonthlyAllowance?: boolean;
  monthlyAllowanceAmount?: number;
  listName?: string;
  listNames?: string[];
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
  notebookName: string;
  notebookId?: string;
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
  notebookName: "",
  notebookId: "",
  beneficiaryIds: [],
});

export default function TreasuryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [beneficiarySearchTerm, setBeneficiarySearchTerm] = useState("");
  const [beneficiaryFilters, setBeneficiaryFilters] = useState<BeneficiaryFilterCriteria>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [formData, setFormData] = useState<TreasuryFormState>(createDefaultFormState);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [showMonthlyAllowancePrint, setShowMonthlyAllowancePrint] = useState(false);

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin" || isSuperAdmin;
  const canEdit = isAdmin;
  const canAccess = isAdmin || role === "member";
  
  const { selectedBranchId } = useBranchContext();
  
  // Fetch branch details if SuperAdmin has selected a branch
  const { data: branchesData } = useSWR(
    isSuperAdmin && selectedBranchId ? "/api/branches" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  
  const selectedBranch = branchesData?.branches?.find((b: { _id: string; name: string }) => b._id === selectedBranchId);
  
  // Build API URLs with branch filter
  const branchParam = selectedBranchId ? `branchId=${selectedBranchId}` : "";

  const { data: treasuryData, isLoading: treasuryLoading, mutate: mutateTreasury } = useSWR(
    isLoaded && canAccess ? `/api/treasury${branchParam ? `?${branchParam}` : ""}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: donorsData } = useSWR(
    isLoaded && canAccess ? `/api/donors?limit=200${branchParam ? `&${branchParam}` : ""}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: notebooksData } = useSWR(
    isLoaded && canAccess ? `/api/notebooks?limit=200${branchParam ? `&${branchParam}` : ""}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: beneficiariesData } = useSWR(
    isLoaded && canAccess ? `/api/beneficiaries?limit=500${branchParam ? `&${branchParam}` : ""}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const totals = useMemo(() => treasuryData?.totals || { incomeTotal: 0, expenseTotal: 0, balance: 0 }, [treasuryData]);
  const donors = useMemo(() => donorsData?.donors || [], [donorsData]);
  const notebooks = useMemo(() => notebooksData?.notebooks || [], [notebooksData]);
  const beneficiaries = useMemo(() => (beneficiariesData?.beneficiaries || []).map((b: BeneficiarySummary) => ({
    _id: b._id,
    name: b.name,
    phone: b.phone,
    address: b.address,
    healthStatus: b.healthStatus,
    housingType: b.housingType,
    employment: b.employment,
    priority: b.priority,
    acceptsMarriage: b.acceptsMarriage,
    marriageDetails: b.marriageDetails,
    nationalId: b.nationalId,
    receivesMonthlyAllowance: b.receivesMonthlyAllowance,
    monthlyAllowanceAmount: b.monthlyAllowanceAmount,
    listName: b.listName,
    listNames: b.listNames,
  })), [beneficiariesData]);
  const loading = treasuryLoading;

  const [showDonorSuggestions, setShowDonorSuggestions] = useState(false);
  const filteredDonors = useMemo(() => {
    const term = (formData.donorName || "").trim().toLowerCase();
    if (!term) return donors.slice(0, 6);
    return donors.filter((d: DonorSummary) => d.name.toLowerCase().includes(term)).slice(0, 6);
  }, [donors, formData.donorName]);

  const [showNotebookSuggestions, setShowNotebookSuggestions] = useState(false);
  const filteredNotebooks = useMemo(() => {
    const term = (formData.notebookName || "").trim().toLowerCase();
    if (!term) return notebooks.slice(0, 10); // Show more notebooks when empty
    return notebooks.filter((n: NotebookSummary) => n.name.toLowerCase().includes(term)).slice(0, 10);
  }, [notebooks, formData.notebookName]);

  const filteredBeneficiaries = useMemo(() => {
    let result = beneficiaries;

    // Apply search filter
    const searchTerm = beneficiarySearchTerm.trim().toLowerCase();
    if (searchTerm) {
      if (beneficiaryFilters.searchByBeneficiaryId) {
        // Search by beneficiary internal number (nationalId)
        result = result.filter((b: BeneficiarySummary) =>
          (b.nationalId || "").toLowerCase().includes(searchTerm)
        );
      } else {
        // Search by name
        result = result.filter((b: BeneficiarySummary) =>
          b.name.toLowerCase().includes(searchTerm)
        );
      }
    }

    // Apply filter criteria - city/address
    if (beneficiaryFilters.city?.trim()) {
      const cityTerm = beneficiaryFilters.city.toLowerCase();
      result = result.filter((b: BeneficiarySummary) =>
        (b.address || "").toLowerCase().includes(cityTerm)
      );
    }

    // Apply filter criteria - health status
    if (beneficiaryFilters.healthStatus) {
      result = result.filter((b: BeneficiarySummary) => b.healthStatus === beneficiaryFilters.healthStatus);
    }

    // Apply filter criteria - housing type
    if (beneficiaryFilters.housingType) {
      result = result.filter((b: BeneficiarySummary) => b.housingType === beneficiaryFilters.housingType);
    }

    // Apply filter criteria - employment
    if (beneficiaryFilters.employment?.trim()) {
      const empTerm = beneficiaryFilters.employment.toLowerCase();
      result = result.filter((b: BeneficiarySummary) =>
        (b.employment || "").toLowerCase().includes(empTerm)
      );
    }

    // Apply filter criteria - priority range
    if (beneficiaryFilters.priorityMin !== undefined || beneficiaryFilters.priorityMax !== undefined) {
      const minPriority = beneficiaryFilters.priorityMin ?? 1;
      const maxPriority = beneficiaryFilters.priorityMax ?? 10;
      result = result.filter((b: BeneficiarySummary) => {
        const priority = b.priority ?? 5;
        return priority >= minPriority && priority <= maxPriority;
      });
    }

    // Apply filter criteria - accepts marriage
    if (beneficiaryFilters.acceptsMarriage) {
      result = result.filter((b: BeneficiarySummary) => b.acceptsMarriage === true);
    }

    // Apply filter criteria - receives monthly allowance
    if (beneficiaryFilters.receivesMonthlyAllowance) {
      result = result.filter((b: BeneficiarySummary) => b.receivesMonthlyAllowance === true);
    }

    return result;
  }, [beneficiaries, beneficiarySearchTerm, beneficiaryFilters]);

  useEffect(() => {
    if (isLoaded && !canAccess) {
      router.push("/");
    }
  }, [isLoaded, canAccess, router]);

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
    setFormData((prev) => ({ 
      ...prev, 
      [name]: value, 
      ...(name === "donorName" ? { donorId: "" } : {}),
      ...(name === "notebookName" ? { notebookId: "" } : {})
    }));
    if (name === "donorName") setShowDonorSuggestions(true);
    if (name === "notebookName") setShowNotebookSuggestions(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      setError("من فضلك أدخل وصف العملية");
      return;
    }

    // Check if income and no donor name
    if (formData.type === "income" && !formData.donorName.trim()) {
      setError("يجب إدخال اسم المتبرع عند تسجيل إيراد");
      return;
    }

    // SuperAdmin must select a specific branch before adding transactions
    if (isSuperAdmin && !selectedBranchId && !editingTransactionId) {
      setError("يجب اختيار الفرع قبل إضافة العملية. اختر فرع من القائمة أعلاه.");
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
      if (editingTransactionId) {
        // Update existing transaction
        const res = await fetch(`/api/treasury/${editingTransactionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            amount: amountNumber,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "فشل تحديث العملية");
        }

        setFormData(createDefaultFormState());
        setEditingTransactionId(null);
        setBeneficiarySearchTerm("");
        mutateTreasury();
        setBeneficiaryFilters({});
      } else {
        // Create new transaction
        const res = await fetch("/api/treasury", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            amount: amountNumber,
            recordedBy: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : undefined,
            // Include branch for SuperAdmin when a specific branch is selected
            ...(isSuperAdmin && selectedBranchId ? {
              branch: selectedBranchId,
              branchName: selectedBranch?.name || null,
            } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "فشل تسجيل العملية");
        }

        setFormData(createDefaultFormState());
        setBeneficiarySearchTerm("");
        setBeneficiaryFilters({});
      }

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
      await mutateTreasury();
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

  const handleEditTransaction = (transactionId: string) => {
    const transaction = (treasuryData?.transactions || []).find((t: TreasuryTransaction) => t._id === transactionId);
    if (!transaction) return;

    setFormData({
      amount: transaction.amount.toString(),
      type: transaction.type,
      description: transaction.description,
      category: transaction.category || "",
      reference: transaction.reference || "",
      transactionDate: transaction.transactionDate?.split("T")[0] || new Date().toISOString().split("T")[0],
      donorName: transaction.donorNameSnapshot || "",
      donorId: transaction.donorId,
      beneficiaryIds: transaction.beneficiaryIds || [],
    });
    setEditingTransactionId(transactionId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setFormData(createDefaultFormState());
    setEditingTransactionId(null);
    setBeneficiarySearchTerm("");
    setBeneficiaryFilters({});
  };

  const sortedTransactions = useMemo(() => {
    let result = [...(treasuryData?.transactions || [])];

    // Apply type filter
    if (typeFilter !== "all") {
      result = result.filter((txn) => txn.type === typeFilter);
    }

    // Apply date filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter((txn) => {
        const txnDate = new Date(txn.transactionDate || txn.createdAt);
        return txnDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((txn) => {
        const txnDate = new Date(txn.transactionDate || txn.createdAt);
        return txnDate <= toDate;
      });
    }

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
            .map((name: string) => normalize(name))
            .join(" ")
        ]
          .filter(Boolean)
          .join(" ");

        return searchableText.includes(query);
      });
    }

    // Sort by date - create new array to ensure React detects the change
    const sorted = [...result].sort((a, b) => {
      const dateA = new Date(a.transactionDate || a.createdAt).getTime();
      const dateB = new Date(b.transactionDate || b.createdAt).getTime();
      return sortDesc ? dateB - dateA : dateA - dateB;
    });

    return sorted;
  }, [treasuryData?.transactions, debouncedSearch, sortDesc, dateFrom, dateTo, typeFilter]);

  const formattedTotals = useMemo(() => ({
    balance: formatCurrency(totals.balance),
    income: formatCurrency(totals.incomeTotal),
    expense: formatCurrency(totals.expenseTotal),
  }), [totals]);

  // Calculate filtered totals for display
  const filteredTotals = useMemo(() => {
    const incomeTotal = sortedTransactions
      .filter(txn => txn.type === "income")
      .reduce((sum, txn) => sum + txn.amount, 0);
    const expenseTotal = sortedTransactions
      .filter(txn => txn.type === "expense")
      .reduce((sum, txn) => sum + txn.amount, 0);
    return {
      incomeTotal,
      expenseTotal,
      total: incomeTotal - expenseTotal,
      count: sortedTransactions.length,
    };
  }, [sortedTransactions]);

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
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href="/admin/donors"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                🧾 قائمة المتبرعين ({donors.length})
              </Link>
              <Link
                href="/admin/notebooks"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                📓 الدفاتر ({notebooks.length})
              </Link>
              <button
                onClick={() => {
                  console.log("Button clicked - Opening print modal");
                  console.log("Total beneficiaries:", beneficiaries.length);
                  setShowMonthlyAllowancePrint(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                type="button"
              >
                <Printer className="w-4 h-4" />
                طباعة الكشوف
              </button>
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
          {canEdit && (
            <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {editingTransactionId ? "تعديل العملية" : "تسجيل عملية جديدة"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {editingTransactionId ? "قم بتعديل بيانات العملية" : "أدخل الوارد أو الصادر وسيتم تحديث الرصيد تلقائياً."}
                </p>
              </div>

              {/* Branch selection warning for SuperAdmin */}
              {isSuperAdmin && !selectedBranchId && !editingTransactionId && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>يجب اختيار فرع محدد من القائمة أعلاه قبل إضافة عملية مالية</span>
                </div>
              )}

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
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
                  <label htmlFor="donorName" className="block text-sm font-medium text-muted-foreground mb-1">
                    اسم المتبرع <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="donorName"
                    name="donorName"
                    type="text"
                    placeholder="اسم المتبرع أو جهة التبرع (مطلوب)"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.donorName}
                        onChange={handleInputChange}
                        onFocus={() => setShowDonorSuggestions(true)}
                        autoComplete="off"
                  />
                      {showDonorSuggestions && filteredDonors.length > 0 && (
                        <div className="border border-border rounded-md mt-2 bg-card max-h-40 overflow-auto z-50">
                          {filteredDonors.map((d: DonorSummary) => (
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

              {formData.type === "income" && (
                <div className="relative">
                  <label htmlFor="notebookName" className="block text-sm font-medium text-muted-foreground mb-1">
                    الدفتر <span className="text-xs text-muted-foreground">(اختياري)</span>
                  </label>
                  <input
                    id="notebookName"
                    name="notebookName"
                    type="text"
                    placeholder="اضغط لاختيار دفتر أو اكتب اسم دفتر جديد"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.notebookName}
                    onChange={handleInputChange}
                    onFocus={() => setShowNotebookSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNotebookSuggestions(false), 200)}
                    autoComplete="off"
                  />
                  {showNotebookSuggestions && (
                    <div className="absolute w-full border border-border rounded-md mt-1 bg-card max-h-48 overflow-auto z-50 shadow-lg">
                      {notebooks.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                          لا توجد دفاتر بعد - اكتب اسم دفتر جديد
                        </div>
                      ) : filteredNotebooks.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                          لا يوجد دفتر بهذا الاسم - اضغط Enter لإضافته كدفتر جديد
                        </div>
                      ) : (
                        <>
                          <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border">
                            📓 الدفاتر المتاحة ({filteredNotebooks.length})
                          </div>
                          {filteredNotebooks.map((n: NotebookSummary) => (
                            <button
                              key={n._id}
                              type="button"
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, notebookName: n.name, notebookId: n._id }));
                                setShowNotebookSuggestions(false);
                              }}
                              className="w-full text-right px-4 py-2.5 hover:bg-muted text-foreground flex justify-between items-center border-b border-border/50 last:border-0"
                            >
                              <span className="font-medium">{n.name}</span>
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{n.transactionsCount || 0} عملية</span>
                            </button>
                          ))}
                          {formData.notebookName && !filteredNotebooks.some((n: NotebookSummary) => n.name.toLowerCase() === formData.notebookName.toLowerCase()) && (
                            <div className="px-4 py-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-t border-border">
                              ✨ سيتم إنشاء دفتر جديد: &quot;{formData.notebookName}&quot;
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {formData.type === "expense" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-muted-foreground">المستفيدون من المبلغ</label>
                    <span className="text-xs text-muted-foreground">
                      {formData.beneficiaryIds.length} مختار
                    </span>
                  </div>
                  <div className="mb-3 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                    <div className="flex-1 w-full">
                      <SearchFilterBar
                        searchTerm={beneficiarySearchTerm}
                        onSearchChange={setBeneficiarySearchTerm}
                        placeholder={beneficiaryFilters.searchByBeneficiaryId ? "ابحث برقم المستفيد..." : "ابحث بالاسم..."}
                        onClearSearch={() => setBeneficiarySearchTerm("")}
                      />
                    </div>
                    <BeneficiaryFilterPanel
                      onFilterChange={setBeneficiaryFilters}
                      variant="dropdown"
                    />
                  </div>

                  {formData.beneficiaryIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.beneficiaryIds.map((beneficiaryId) => {
                        const beneficiary = beneficiaries.find((b: BeneficiarySummary) => b._id === beneficiaryId);
                        return beneficiary ? (
                          <span
                            key={beneficiaryId}
                            className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm"
                          >
                            {beneficiary.name}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  beneficiaryIds: prev.beneficiaryIds.filter(id => id !== beneficiaryId)
                                }));
                              }}
                              className="text-xs text-primary/70 hover:text-primary"
                            >
                              ×
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border max-h-64 overflow-y-auto">
                    {filteredBeneficiaries.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {beneficiaries.length === 0 ? "لا يوجد مستفيدون" : "لا توجد نتائج بحث"}
                      </p>
                    ) : (
                      filteredBeneficiaries.map((b: BeneficiarySummary) => {
                        const isSelected = formData.beneficiaryIds.includes(b._id);
                        return (
                          <button
                            key={b._id}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                beneficiaryIds: isSelected
                                  ? prev.beneficiaryIds.filter(id => id !== b._id)
                                  : [...prev.beneficiaryIds, b._id]
                              }));
                            }}
                            className={`w-full text-right px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition-colors ${
                              isSelected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1">
                              <span className="font-medium">{b.name}</span>
                              {b.nationalId && (
                                <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                                  رقم المستفيد: {b.nationalId}
                                </span>
                              )}
                              {b.phone && <span className="text-sm text-muted-foreground">📞 {b.phone}</span>}
                              {b.receivesMonthlyAllowance && (
                                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-600 dark:text-green-400 rounded-full">
                                  💰 شهرية: {b.monthlyAllowanceAmount || 0} ج.م
                                </span>
                              )}
                              {b.acceptsMarriage && (
                                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full">
                                  💍 مقبل على الزواج
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
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
                ) : editingTransactionId ? (
                  "تحديث العملية"
                ) : (
                  "حفظ العملية"
                )}
              </button>

              {editingTransactionId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center rounded-lg bg-muted px-4 py-3 text-foreground font-semibold hover:bg-muted/80 transition disabled:opacity-60"
                >
                  إلغاء التعديل
                </button>
              )}
            </form>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">العمليات المالية</h2>
                  <p className="text-sm text-muted-foreground">عرض جميع العمليات المسجلة ({sortedTransactions.length} عملية)</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSortDesc(!sortDesc);
                    }}
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 px-3 py-2 rounded-md border border-border hover:bg-primary/10 transition"
                    type="button"
                    title={sortDesc ? "من الأحدث للأقدم - انقر للتبديل" : "من الأقدم للأحدث - انقر للتبديل"}
                  >
                    {sortDesc ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                    <span className="text-xs font-medium">التاريخ {sortDesc ? "↓" : "↑"}</span>
                  </button>
                </div>
              </div>

              {/* Type filter tabs */}
              <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setTypeFilter("all")}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    typeFilter === "all"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  type="button"
                >
                  الكل
                </button>
                <button
                  onClick={() => setTypeFilter("income")}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    typeFilter === "income"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-emerald-600"
                  }`}
                  type="button"
                >
                  <span className="flex items-center justify-center gap-1">
                    <ArrowDownCircle className="w-4 h-4" />
                    الوارد
                  </span>
                </button>
                <button
                  onClick={() => setTypeFilter("expense")}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    typeFilter === "expense"
                      ? "bg-rose-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-rose-600"
                  }`}
                  type="button"
                >
                  <span className="flex items-center justify-center gap-1">
                    <ArrowUpCircle className="w-4 h-4" />
                    الصادر
                  </span>
                </button>
              </div>

              <SearchFilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder="ابحث عن وصف أو فئة أو متبرع أو مستفيد..."
                onClearSearch={() => setSearchTerm("")}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="dateFrom" className="block text-sm font-medium text-muted-foreground mb-1">
                    من تاريخ
                  </label>
                  <input
                    id="dateFrom"
                    type="date"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="dateTo" className="block text-sm font-medium text-muted-foreground mb-1">
                    إلى تاريخ
                  </label>
                  <input
                    id="dateTo"
                    type="date"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              {(dateFrom || dateTo || typeFilter !== "all") && (
                <div className="flex flex-wrap items-center gap-3">
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                      className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                      type="button"
                    >
                      ✕ مسح فلتر التاريخ
                    </button>
                  )}
                  {typeFilter !== "all" && (
                    <button
                      onClick={() => setTypeFilter("all")}
                      className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                      type="button"
                    >
                      ✕ مسح فلتر النوع
                    </button>
                  )}
                </div>
              )}

              {/* Filtered summary */}
              {(dateFrom || dateTo || typeFilter !== "all" || debouncedSearch) && sortedTransactions.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{filteredTotals.count}</span> عملية
                      {typeFilter === "income" && " وارد"}
                      {typeFilter === "expense" && " صادر"}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {(typeFilter === "all" || typeFilter === "income") && filteredTotals.incomeTotal > 0 && (
                        <div className="flex items-center gap-2">
                          <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
                          <span className="text-muted-foreground">الوارد:</span>
                          <span className="font-bold text-emerald-600">{formatCurrency(filteredTotals.incomeTotal)} ج.م</span>
                        </div>
                      )}
                      {(typeFilter === "all" || typeFilter === "expense") && filteredTotals.expenseTotal > 0 && (
                        <div className="flex items-center gap-2">
                          <ArrowUpCircle className="w-4 h-4 text-rose-500" />
                          <span className="text-muted-foreground">الصادر:</span>
                          <span className="font-bold text-rose-600">{formatCurrency(filteredTotals.expenseTotal)} ج.م</span>
                        </div>
                      )}
                      {typeFilter === "all" && filteredTotals.incomeTotal > 0 && filteredTotals.expenseTotal > 0 && (
                        <div className="flex items-center gap-2 border-r border-border pr-4">
                          <span className="text-muted-foreground">الصافي:</span>
                          <span className={`font-bold ${filteredTotals.total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {filteredTotals.total >= 0 ? "+" : ""}{formatCurrency(filteredTotals.total)} ج.م
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                        {txn.notebookId && txn.notebookNameSnapshot && (
                          <div className="mt-1 text-sm">
                            <Link href={`/admin/notebooks`} className="text-amber-600 dark:text-amber-400 text-sm flex items-center gap-1">
                              <span>📓</span> {txn.notebookNameSnapshot}
                            </Link>
                          </div>
                        )}
                        {txn.beneficiaryNamesSnapshot && txn.beneficiaryNamesSnapshot.length > 0 && (
                          <div className="mt-2 text-sm">
                            <p className="text-muted-foreground text-xs mb-1">المستفيدون:</p>
                            <div className="flex flex-wrap gap-1">
                              {txn.beneficiaryNamesSnapshot.map((name: string, idx: number) => {
                                const beneficiaryId = txn.beneficiaryIds?.[idx];
                                return beneficiaryId ? (
                                  <Link
                                    key={idx}
                                    href={`/beneficiaries/${beneficiaryId}`}
                                    className="bg-primary/10 text-primary px-2 py-1 rounded text-xs hover:bg-primary/20 transition-colors cursor-pointer"
                                  >
                                    {name}
                                  </Link>
                                ) : (
                                  <span key={idx} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                                    {name}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditTransaction(txn._id)}
                            disabled={deleting === txn._id || submitting}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition flex items-center gap-1 disabled:opacity-50"
                            type="button"
                            title="تعديل العملية"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
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
                      )}
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

        {/* Print Modal */}
        {showMonthlyAllowancePrint && (
          <MonthlyAllowancePrintModal
            isOpen={showMonthlyAllowancePrint}
            onClose={() => setShowMonthlyAllowancePrint(false)}
            beneficiaries={beneficiaries.map((b: BeneficiarySummary) => ({
              _id: b._id,
              name: b.name,
              nationalId: b.nationalId,
              monthlyAllowanceAmount: b.monthlyAllowanceAmount,
              receivesMonthlyAllowance: b.receivesMonthlyAllowance,
              listName: b.listName,
              listNames: b.listNames,
            }))}
          />
        )}
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
