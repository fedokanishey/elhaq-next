"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, X, Check, User } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  extra?: string;
  phone?: string;
}

interface ZkSearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

function normalizeArabic(text: string = ""): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F]/g, "") // remove tashkeel
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\s\-_]+/g, " ");
}

export default function ZkSearchableSelect({
  options,
  value,
  onChange,
  placeholder = "-- اختر من القائمة --",
  searchPlaceholder = "ابحث بالاسم، الهاتف، أو الكود...",
  emptyMessage = "لا توجد نتائج مطابقة للبحث",
  required = false,
  disabled = false,
  className = "",
}: ZkSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected option
  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value));
  }, [options, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = normalizeArabic(searchQuery);

    return options.filter((opt) => {
      const matchLabel = normalizeArabic(opt.label).includes(q);
      const matchSub = opt.subLabel ? normalizeArabic(opt.subLabel).includes(q) : false;
      const matchExtra = opt.extra ? normalizeArabic(opt.extra).includes(q) : false;
      const matchPhone = opt.phone ? opt.phone.includes(searchQuery.trim()) : false;
      return matchLabel || matchSub || matchExtra || matchPhone;
    });
  }, [options, searchQuery]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={containerRef} className={`relative w-full dir-rtl ${className}`}>
      {/* Hidden input for form required validation */}
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required={required}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-slate-800"
            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800" : ""}`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
          <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-slate-900 dark:text-white truncate">
                {selectedOption.label}
              </span>
              {selectedOption.extra && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 shrink-0">
                  {selectedOption.extra}
                </span>
              )}
              {selectedOption.subLabel && (
                <span className="text-slate-600 dark:text-slate-300 text-[11px] truncate shrink-0">
                  — {selectedOption.subLabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-600 dark:text-slate-300 font-medium text-xs truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-600 dark:text-slate-300">
          {selectedOption && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              title="إلغاء التحديد"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-emerald-600 dark:text-emerald-400" : ""}`}
          />
        </div>
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Search Box Header */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute right-3 text-slate-400 dark:text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pr-9 pl-8 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute left-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Results List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-600 dark:text-slate-300 font-bold">
                <p>{emptyMessage}</p>
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-right text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white truncate">{opt.label}</span>
                        {opt.extra && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 shrink-0">
                            {opt.extra}
                          </span>
                        )}
                      </div>
                      {(opt.subLabel || opt.phone) && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 truncate flex items-center gap-2">
                          {opt.phone && <span>📞 {opt.phone}</span>}
                          {opt.subLabel && <span>📍 {opt.subLabel}</span>}
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mr-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer count indicator */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-800 dark:text-slate-200 font-bold flex items-center justify-between">
            <span>عدد النتائج: {filteredOptions.length}</span>
            {selectedOption && <span>المحدد: <strong className="text-emerald-700 dark:text-emerald-400">{selectedOption.label}</strong></span>}
          </div>
        </div>
      )}
    </div>
  );
}
