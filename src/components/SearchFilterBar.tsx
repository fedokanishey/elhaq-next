"use client";

import { ScanQrCode, Search, X } from "lucide-react";
import { useState } from "react";
import QRScannerModal from "@/components/QRScannerModal";

export interface SearchFilterBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
  onClearSearch?: () => void;
  enableQrScanner?: boolean;
  onQrScan?: (value: string) => void;
  qrScannerTitle?: string;
}

export default function SearchFilterBar({
  searchTerm,
  onSearchChange,
  placeholder = "ابحث هنا...",
  onClearSearch,
  enableQrScanner = false,
  onQrScan,
  qrScannerTitle,
}: SearchFilterBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleQrScan = (value: string) => {
    onSearchChange(value);
    onQrScan?.(value);
  };

  return (
    <div className="w-full">
      <div
        className={`flex items-center gap-3 px-4 py-3 border rounded-lg transition-all ${
          isFocused
            ? "border-primary bg-background ring-2 ring-primary/30"
            : "border-border bg-background/50 hover:border-primary/50"
        }`}
      >
        <Search className="w-5 h-5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />
        {enableQrScanner && (
          <button
            onClick={() => setIsScannerOpen(true)}
            className="p-1 shrink-0 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
            type="button"
            title="مسح QR"
          >
            <ScanQrCode className="w-4 h-4" />
          </button>
        )}
        {searchTerm && (
          <button
            onClick={() => {
              onSearchChange("");
              onClearSearch?.();
            }}
            className="p-1 shrink-0 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
            type="button"
            title="مسح البحث"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {enableQrScanner && (
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleQrScan}
          title={qrScannerTitle}
        />
      )}
    </div>
  );
}
