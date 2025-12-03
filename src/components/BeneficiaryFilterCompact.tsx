"use client";

import { useState, useCallback } from "react";
import { ChevronDown, X } from "lucide-react";

export interface BeneficiaryFilterCriteria {
  city?: string;
  healthStatus?: string;
  housingType?: string;
  employment?: string;
  priorityMin?: number;
  priorityMax?: number;
}

interface BeneficiaryFilterCompactProps {
  onFilterChange: (filters: BeneficiaryFilterCriteria) => void;
  onClear?: () => void;
}

export default function BeneficiaryFilterCompact({
  onFilterChange,
  onClear,
}: BeneficiaryFilterCompactProps) {
  const [filters, setFilters] = useState<BeneficiaryFilterCriteria>({});
  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = useCallback(
    (newFilters: BeneficiaryFilterCriteria) => {
      setFilters(newFilters);
      onFilterChange(newFilters);
    },
    [onFilterChange]
  );

  const handleClearFilters = useCallback(() => {
    setFilters({});
    onFilterChange({});
    onClear?.();
  }, [onFilterChange, onClear]);

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== "" && v !== null
  );

  const filterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== "" && v !== null
  ).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-4 py-3 rounded-lg border transition-all inline-flex items-center gap-2 font-medium ${
          hasActiveFilters
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card border-border text-foreground hover:bg-muted"
        }`}
        type="button"
      >
        <span>🔽 التصفية</span>
        {hasActiveFilters && (
          <span className="ml-2 px-2 py-0.5 bg-primary-foreground text-primary rounded-full text-xs font-bold">
            {filterCount}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg p-4 space-y-4 z-50">
          {/* Health Status */}
          <div>
            <label htmlFor="health-filter" className="block text-sm font-medium text-foreground mb-2">
              الصحة
            </label>
            <select
              id="health-filter"
              title="اختر حالة الصحة"
              value={filters.healthStatus || ""}
              onChange={(e) =>
                handleFilterChange({
                  ...filters,
                  healthStatus: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">الكل</option>
              <option value="healthy">صحي</option>
              <option value="sick">مريض</option>
            </select>
          </div>

          {/* Housing Type */}
          <div>
            <label htmlFor="housing-filter" className="block text-sm font-medium text-foreground mb-2">
              نوع السكن
            </label>
            <select
              id="housing-filter"
              title="اختر نوع السكن"
              value={filters.housingType || ""}
              onChange={(e) =>
                handleFilterChange({
                  ...filters,
                  housingType: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">الكل</option>
              <option value="owned">مملوك</option>
              <option value="rented">مستأجر</option>
            </select>
          </div>

          {/* City / Address */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              المدينة
            </label>
            <input
              type="text"
              value={filters.city || ""}
              onChange={(e) =>
                handleFilterChange({
                  ...filters,
                  city: e.target.value || undefined,
                })
              }
              placeholder="ابحث عن مدينة..."
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Employment */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              التوظيف
            </label>
            <input
              type="text"
              value={filters.employment || ""}
              onChange={(e) =>
                handleFilterChange({
                  ...filters,
                  employment: e.target.value || undefined,
                })
              }
              placeholder="نوع التوظيف..."
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Priority Range */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              نطاق الأولوية
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="1"
                max="10"
                value={filters.priorityMin || ""}
                onChange={(e) =>
                  handleFilterChange({
                    ...filters,
                    priorityMin: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="من"
                className="w-1/2 px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="number"
                min="1"
                max="10"
                value={filters.priorityMax || ""}
                onChange={(e) =>
                  handleFilterChange({
                    ...filters,
                    priorityMax: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="إلى"
                className="w-1/2 px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="w-full px-3 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors inline-flex items-center justify-center gap-2 font-medium"
              type="button"
            >
              <X className="w-4 h-4" />
              مسح جميع الفلاتر
            </button>
          )}
        </div>
      )}
    </div>
  );
}
