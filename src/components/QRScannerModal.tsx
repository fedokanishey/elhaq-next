"use client";

import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
  title?: string;
}

const SCANNER_ELEMENT_ID = "global-qr-scanner";

type ParsedPayload = {
  searchValue: string;
};

const parseScannedValue = (rawText: string): ParsedPayload => {
  const value = rawText.trim();
  if (!value) {
    return { searchValue: "" };
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    // Priority: always search by name first
    const preferredKeys = [
      "name",
    ];

    for (const key of preferredKeys) {
      const candidate = parsed[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return { searchValue: candidate.trim() };
      }
      if (typeof candidate === "number") {
        return { searchValue: String(candidate) };
      }
    }

    // Fallback to other identifiers if name is not available
    const fallbackKeys = [
      "internalId",
      "beneficiaryInternalId",
      "id",
      "beneficiaryId",
      "nationalId",
    ];

    for (const key of fallbackKeys) {
      const candidate = parsed[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return { searchValue: candidate.trim() };
      }
      if (typeof candidate === "number") {
        return { searchValue: String(candidate) };
      }
    }
  } catch {
    // Ignore JSON parse errors and fallback to raw payload.
  }

  return { searchValue: value };
};

export default function QRScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "مسح QR",
}: QRScannerModalProps) {
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
    scanFile?: (file: File, showImage?: boolean) => Promise<string>;
  } | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
    } catch {
      // Scanner may already be stopped.
    }
    try {
      await scannerRef.current.clear();
    } catch {
      // Ignore clear failures.
    }
    scannerRef.current = null;
  }, []);

  const startScanner = useCallback(async () => {
    setIsStarting(true);
    setScanError(null);

    let isCancelled = false;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (isCancelled) return;

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) {
        throw new Error("لم يتم العثور على كاميرا متاحة");
      }

      const preferredCamera =
        cameras.find((camera) =>
          /back|rear|environment|خلف/i.test(camera.label || "")
        ) || cameras[0];

      await scanner.start(
        preferredCamera.id,
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
        },
        async (decodedText: string) => {
          if (!decodedText.trim()) return;

          const parsed = parseScannedValue(decodedText);
          if (!parsed.searchValue) return;

          await stopScanner();
          onScan(parsed.searchValue);
          onClose();
        },
        () => {
          // No-op for continuous scan failures.
        }
      );
    } catch (error) {
      console.error("QR scanner start failed:", error);
      if (!isCancelled) {
        setScanError("تعذر تشغيل الكاميرا. يمكنك المحاولة بصورة QR.");
      }
    } finally {
      if (!isCancelled) {
        setIsStarting(false);
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [onClose, onScan, stopScanner]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const cleanup = startScanner();

    return () => {
      cleanup.then((fn: (() => void) | void) => fn && fn());
      void stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  const handleScanImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      setScanError(null);

      // Stop the active camera before scanning a file
      await stopScanner();

      const { Html5Qrcode } = await import("html5-qrcode");
      const tempScanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      
      const scannedText = await tempScanner.scanFile(file, true);
      tempScanner.clear(); // cleanup temporary scanner

      const parsed = parseScannedValue(scannedText);
      if (!parsed.searchValue) {
        setScanError("لم يتم العثور على رمز QR صالح في الصورة.");
        void startScanner();
        return;
      }

      onScan(parsed.searchValue);
      onClose();
    } catch (error) {
      console.error("QR image scan failed:", error);
      setScanError("تعذر قراءة الرمز من الصورة.");
      void startScanner();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-background border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Camera className="w-5 h-5 text-primary" />
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            title="إغلاق"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-muted-foreground">
            وجّه الكاميرا إلى بطاقة المستفيد لالتقاط بياناته تلقائياً.
          </p>

          {/* Camera area - constrained height */}
          <div className="rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden relative" style={{ maxHeight: '45vh' }}>
            <div id={SCANNER_ELEMENT_ID} className="w-full" />
            {isStarting && (
              <div className="absolute flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري تشغيل الكاميرا...
              </div>
            )}
          </div>

          {scanError && (
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
              {scanError}
            </div>
          )}

          {/* Image scan button - always visible */}
          <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted cursor-pointer transition-colors">
            <ImagePlus className="w-5 h-5" />
            قراءة QR من صورة في المعرض
            <input
              type="file"
              accept="image/*"
              onChange={handleScanImage}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
