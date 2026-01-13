"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface BranchSelectorProps {
  onBranchChange: (branchId: string | null) => void;
  selectedBranchId: string | null;
  className?: string;
}

export default function BranchSelector({
  onBranchChange,
  selectedBranchId,
  className = "",
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: branchesData } = useSWR("/api/branches", fetcher, {
    revalidateOnFocus: false,
  });

  const branches: Branch[] = branchesData?.branches || [];

  const selectedBranch = branches.find((b) => b._id === selectedBranchId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (branchId: string | null) => {
      onBranchChange(branchId);
      setIsOpen(false);
    },
    [onBranchChange]
  );

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors min-w-40"
      >
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-right truncate">
          {selectedBranch ? selectedBranch.name : "جميع الفروع"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-full min-w-[200px] bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {/* All Branches Option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-right ${
                !selectedBranchId
                  ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                  : ""
              }`}
            >
              <div className="flex-1 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>جميع الفروع</span>
              </div>
              {!selectedBranchId && (
                <Check className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              )}
            </button>

            {/* Divider */}
            {branches.length > 0 && <div className="border-t border-border" />}

            {/* Individual Branches */}
            {branches.map((branch) => (
              <button
                key={branch._id}
                type="button"
                onClick={() => handleSelect(branch._id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-right ${
                  selectedBranchId === branch._id
                    ? "bg-primary/10 text-primary"
                    : ""
                }`}
              >
                <div className="flex-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary opacity-60" />
                  <span>{branch.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({branch.code})
                  </span>
                </div>
                {selectedBranchId === branch._id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}

            {branches.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                لا توجد فروع
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
