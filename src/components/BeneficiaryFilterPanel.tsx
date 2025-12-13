"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";

export interface BeneficiaryFilterCriteria {
  city?: string;
  healthStatus?: "healthy" | "sick" | "";
  housingType?: "owned" | "rented" | "";
  status?: "active" | "cancelled" | "pending" | "";
  listName?: string;
  priorityMin?: number;
  priorityMax?: number;
  employment?: string;
  acceptsMarriage?: boolean;
  receivesMonthlyAllowance?: boolean;
  searchByBeneficiaryId?: boolean;
}

interface BeneficiaryFilterPanelProps {
  onFilterChange: (filters: BeneficiaryFilterCriteria) => void;
  variant?: "dropdown" | "inline"; // dropdown = floating panel, inline = always visible section
  showLabel?: boolean;
}

const defaultFilters: BeneficiaryFilterCriteria = {
  city: "",
  healthStatus: "",
  housingType: "",
  status: "",
  listName: "",
  priorityMin: 1,
  priorityMax: 10,
  employment: "",
  acceptsMarriage: false,
  receivesMonthlyAllowance: false,
  searchByBeneficiaryId: false,
};

export default function BeneficiaryFilterPanel({
  onFilterChange,
  variant = "dropdown",
  showLabel = true,
}: BeneficiaryFilterPanelProps) {
  const [filters, setFilters] = useState<BeneficiaryFilterCriteria>(defaultFilters);
  const [isOpen, setIsOpen] = useState(variant === "inline");
  const [listNameSuggestions, setListNameSuggestions] = useState<string[]>([]);
  const [showListNameSuggestions, setShowListNameSuggestions] = useState(false);

  const handleChange = (field: keyof BeneficiaryFilterCriteria, value: string | number | boolean) => {
    const updated = { ...filters, [field]: value };
    setFilters(updated);
    onFilterChange(updated);
  };

  const handleListNameChange = async (value: string) => {
    handleChange("listName", value);
    
    if (value.trim().length >= 2) {
      try {
        const res = await fetch(`/api/beneficiaries/list-names?q=${encodeURIComponent(value.trim())}`);
        console.log('API Response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('List names received:', data.listNames);
          setListNameSuggestions(data.listNames || []);
          setShowListNameSuggestions(true);
        }
      } catch (err) {
        console.error('Error fetching list names:', err);
      }
    } else {
      setListNameSuggestions([]);
      setShowListNameSuggestions(false);
    }
  };

  const handleSelectListName = (name: string) => {
    handleChange("listName", name);
    setShowListNameSuggestions(false);
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  const hasActiveFilters =
    filters.city ||
    filters.healthStatus ||
    filters.housingType ||
    filters.status ||
    filters.listName ||
    filters.employment ||
    filters.priorityMin !== 1 ||
    filters.priorityMax !== 10 ||
    filters.acceptsMarriage ||
    filters.searchByBeneficiaryId;

  const filterContent = (
    <div className="space-y-4">
      {/* City / Address */}
      <div>
        <label htmlFor="filter-city" className="block text-sm font-medium text-foreground mb-1">
          المدينة / العنوان
        </label>
        <input
          id="filter-city"
          type="text"
          placeholder="ابحث بجزء من العنوان"
          value={filters.city || ""}
          onChange={(e) => handleChange("city", e.target.value)}
          title="فلترة حسب المدينة أو العنوان"
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>

      {/* Health Status */}
      <div>
        <label htmlFor="health-filter" className="block text-sm font-medium text-foreground mb-1">
          الحالة الصحية
        </label>
        <select
          id="health-filter"
          value={filters.healthStatus || ""}
          onChange={(e) => handleChange("healthStatus", e.target.value || "")}
          title="اختر الحالة الصحية"
          aria-label="تصفية حسب الحالة الصحية"
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">الكل</option>
          <option value="healthy">سليم/سليمة</option>
          <option value="sick">مريض/مريضة</option>
        </select>
      </div>

      {/* Housing Type */}
      <div>
        <label htmlFor="housing-filter" className="block text-sm font-medium text-foreground mb-1">
          نوع السكن
        </label>
        <select
          id="housing-filter"
          value={filters.housingType || ""}
          onChange={(e) => handleChange("housingType", e.target.value || "")}
          title="اختر نوع السكن"
          aria-label="تصفية حسب نوع السكن"
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">الكل</option>
          <option value="owned">مملوك</option>
          <option value="rented">مستأجر</option>
        </select>
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status-filter" className="block text-sm font-medium text-foreground mb-1">
          حالة المستفيد
        </label>
        <select
          id="status-filter"
          value={filters.status || ""}
          onChange={(e) => handleChange("status", e.target.value || "")}
          title="اختر حالة المستفيد"
          aria-label="تصفية حسب حالة المستفيد"
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="">الكل</option>
          <option value="active">نشط</option>
          <option value="pending">انتظار</option>
          <option value="cancelled">ملغى</option>
        </select>
      </div>

      {/* Employment */}
      <div>
        <label htmlFor="filter-employment" className="block text-sm font-medium text-foreground mb-1">
          الحالة الوظيفية
        </label>
        <input
          id="filter-employment"
          type="text"
          placeholder="مثال: موظف، عامل حر"
          value={filters.employment || ""}
          onChange={(e) => handleChange("employment", e.target.value)}
          title="فلترة حسب الحالة الوظيفية"
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>

      {/* List Name */}
      <div className="relative">
        <label htmlFor="filter-list-name" className="block text-sm font-medium text-foreground mb-1">
          اسم الكشف
        </label>
        <input
          id="filter-list-name"
          type="text"
          placeholder="ابحث باسم الكشف"
          value={filters.listName || ""}
          onChange={(e) => handleListNameChange(e.target.value)}
          onFocus={() => {
            if (listNameSuggestions.length > 0) {
              setShowListNameSuggestions(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => setShowListNameSuggestions(false), 200);
          }}
          title="فلترة حسب اسم الكشف"
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary"
        />
        {showListNameSuggestions && listNameSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {listNameSuggestions.map((name, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectListName(name)}
                className="w-full px-3 py-2 text-right hover:bg-accent text-foreground transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Priority Range */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          نطاق الأولوية
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="priority-min" className="block text-xs text-muted-foreground mb-1">
              من
            </label>
            <input
              id="priority-min"
              type="number"
              min="1"
              max="10"
              value={filters.priorityMin || 1}
              onChange={(e) =>
                handleChange("priorityMin", parseInt(e.target.value) || 1)
              }
              title="أقل أولوية"
              aria-label="أقل قيمة للأولوية"
              placeholder="1"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="priority-max" className="block text-xs text-muted-foreground mb-1">
              إلى
            </label>
            <input
              id="priority-max"
              type="number"
              min="1"
              max="10"
              value={filters.priorityMax || 10}
              onChange={(e) =>
                handleChange("priorityMax", parseInt(e.target.value) || 10)
              }
              title="أقصى أولوية"
              aria-label="أقصى قيمة للأولوية"
              placeholder="10"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Accepts Marriage */}
      <div className="flex items-center gap-3 pt-2">
        <input
          id="filter-accepts-marriage"
          type="checkbox"
          checked={filters.acceptsMarriage || false}
          onChange={(e) => handleChange("acceptsMarriage", e.target.checked ? true : false)}
          title="فلترة المقبولين على الزواج"
          aria-label="فلترة المقبولين على الزواج"
          className="w-4 h-4 rounded border-input bg-background cursor-pointer accent-primary"
        />
        <label htmlFor="filter-accepts-marriage" className="text-sm font-medium text-foreground cursor-pointer">
          لديه ابن/ابنه مقبل على الزواج
        </label>
      </div>

      {/* Receives Monthly Allowance */}
      <div className="flex items-center gap-3 pt-2">
        <input
          id="filter-receives-allowance"
          type="checkbox"
          checked={filters.receivesMonthlyAllowance || false}
          onChange={(e) => handleChange("receivesMonthlyAllowance", e.target.checked ? true : false)}
          title="فلترة من يتقاضى شهرية"
          aria-label="فلترة من يتقاضى شهرية"
          className="w-4 h-4 rounded border-input bg-background cursor-pointer accent-primary"
        />
        <label htmlFor="filter-receives-allowance" className="text-sm font-medium text-foreground cursor-pointer">
          يتقاضى شهرية؟
        </label>
      </div>

      {/* Search by Beneficiary ID */}
      <div className="flex items-center gap-3 pt-2">
        <input
          id="filter-search-by-id"
          type="checkbox"
          checked={filters.searchByBeneficiaryId || false}
          onChange={(e) => handleChange("searchByBeneficiaryId", e.target.checked ? true : false)}
          title="تفعيل البحث برقم المستفيد الداخلي"
          aria-label="تفعيل البحث برقم المستفيد الداخلي"
          className="w-4 h-4 rounded border-input bg-background cursor-pointer accent-primary"
        />
        <label htmlFor="filter-search-by-id" className="text-sm font-medium text-foreground cursor-pointer">
          بحث برقم المستفيد الداخلي
        </label>
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleReset}
          className="w-full mt-4 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted transition-colors text-sm"
        >
          إعادة تعيين الفلاتر
        </button>
      )}
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="border border-border rounded-lg bg-muted/20 p-4">
        {showLabel && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">معايير الفلترة</h3>
            {hasActiveFilters && (
              <span className="text-xs text-primary font-medium">
                فلاتر نشطة ✓
              </span>
            )}
          </div>
        )}
        {filterContent}
      </div>
    );
  }

  // Dropdown variant
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="فتح أو إغلاق خيارات التصفية"
        aria-label="فتح أو إغلاق خيارات التصفية"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          hasActiveFilters
            ? "bg-primary/10 border-primary text-primary"
            : "border-border bg-background text-foreground hover:bg-muted"
        }`}
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">تصفية</span>
        {hasActiveFilters && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-primary text-primary-foreground rounded-full">
            ✓
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Filter panel */}
          <div className="fixed inset-x-0 top-16 z-50 sm:absolute sm:inset-auto sm:top-full sm:left-0 sm:mt-2 sm:w-72 bg-card border-b sm:border border-border sm:rounded-lg shadow-lg p-6 overflow-y-scroll sm:overflow-y-auto max-h-[calc(100vh-4rem)] sm:max-h-[32rem]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">خيارات التصفية</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="إغلاق"
                aria-label="إغلاق خيارات التصفية"
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {filterContent}
          </div>
        </>
      )}
    </div>
  );
}
