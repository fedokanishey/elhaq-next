"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id?: string;
  options: SearchableSelectOption[];
  value: string;
  customValue?: string;
  onChange: (value: string, customValue?: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowCustom?: boolean;
  createLabel?: (query: string) => string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

function normalize(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\s\-_]+/g, " ");
}

export default function SearchableSelect({
  id,
  options,
  value,
  customValue,
  onChange,
  placeholder = "-- اختر من القائمة --",
  searchPlaceholder = "ابحث أو اكتب نوعاً جديداً...",
  emptyMessage = "لا توجد نتائج مطابقة",
  allowCustom = false,
  createLabel = (query) => `إضافة "${query}"`,
  required = false,
  invalid = false,
  describedBy,
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${id || "searchable-select"}-listbox`;

  const selectedLabel = useMemo(() => {
    if (value === "other" && customValue && customValue.trim()) {
      return customValue.trim();
    }
    return options.find((opt) => opt.value === value)?.label ?? "";
  }, [options, value, customValue]);

  const filteredOptions = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((opt) => normalize(opt.label).includes(q));
  }, [options, query]);

  const trimmedQuery = query.trim();

  const canCreate = useMemo(() => {
    if (!allowCustom || trimmedQuery.length < 2) return false;
    const normalizedQuery = normalize(trimmedQuery);
    return !options.some((opt) => normalize(opt.label) === normalizedQuery);
  }, [allowCustom, options, trimmedQuery]);

  const totalItems = filteredOptions.length + (canCreate ? 1 : 0);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
    setQuery("");
    setActiveIndex(0);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const close = () => setIsOpen(false);

  const selectOption = (optionValue: string) => {
    onChange(optionValue);
    close();
  };

  const createOption = () => {
    if (!canCreate) return;
    onChange("other", trimmedQuery);
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        totalItems ? (index + 1) % totalItems : 0
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        totalItems ? (index - 1 + totalItems) % totalItems : 0
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex < filteredOptions.length) {
        selectOption(filteredOptions[activeIndex].value);
      } else if (canCreate) {
        createOption();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
      )}

      <button
        type="button"
        id={id}
        role="combobox"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border bg-background text-foreground text-right transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
          invalid ? "border-destructive" : "border-input"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <span
          className={`truncate ${selectedLabel ? "" : "text-muted-foreground"}`}
        >
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative flex items-center">
              <Search
                className="w-4 h-4 absolute right-3 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pr-9 pl-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <ul id={listboxId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.map((option, index) => {
              const isSelected =
                option.value === value &&
                !(value === "other" && Boolean(customValue && customValue.trim()));
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option.value)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-right text-sm transition-colors ${
                      activeIndex === index ? "bg-muted" : ""
                    } ${
                      isSelected ? "font-semibold text-primary" : "text-foreground"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}

            {canCreate && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={activeIndex === filteredOptions.length}
                  onMouseEnter={() => setActiveIndex(filteredOptions.length)}
                  onClick={createOption}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-right text-sm text-primary transition-colors ${
                    activeIndex === filteredOptions.length ? "bg-muted" : ""
                  }`}
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{createLabel(trimmedQuery)}</span>
                </button>
              </li>
            )}

            {filteredOptions.length === 0 && !canCreate && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
