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
    // Priority: always search by identifier (internalId, id, nationalId) first
    const preferredKeys = [
      "internalId",
      "beneficiaryInternalId",
      "id",
      "beneficiaryId",
      "nationalId",
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
  } catch {
    // Ignore JSON parse errors and fallback to raw payload.
  }

  return { searchValue: value };
};

const cleanBarcodeValue = (value: string): string => {
  let cleaned = value.trim().toLowerCase();
  if (cleaned.startsWith("*")) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.endsWith("*")) {
    cleaned = cleaned.slice(0, -1);
  }
  cleaned = cleaned.trim();
  if (cleaned.startsWith("dhz")) {
    const withoutPrefix = cleaned.slice(3);
    const num = withoutPrefix.replace(/^0+/, "");
    return num || "0";
  }
  return cleaned;
};

export default function QRScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "مسح باركود",
}: QRScannerModalProps) {
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
    scanFile?: (file: File, showImage?: boolean) => Promise<string>;
  } | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const isCancelledRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setIsCameraActive(true);
    }
  }, [isOpen]);

  const handleManualSubmit = () => {
    if (!manualValue.trim()) return;
    void stopScanner();
    onScan(cleanBarcodeValue(manualValue.trim()));
    onClose();
  };

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
    isCancelledRef.current = false;

    // Stop any active camera first to be safe
    await stopScanner();

    if (isCancelledRef.current) {
      setIsStarting(false);
      return;
    }

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (isCancelledRef.current) throw new Error("cancelled");

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8
        ],
        verbose: false
      });
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      if (isCancelledRef.current) throw new Error("cancelled");
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
          fps: 15,
          qrbox: (width, height) => {
            // Enforce minimum sizes of 150px/80px for standard views, ensuring dimensions are
            // never below 50px (the library's validation minimum) even if width/height are zero.
            const qrWidth = Math.max(150, Math.floor(width * 0.8));
            const qrHeight = Math.max(80, Math.floor(height * 0.45));
            const finalWidth = Math.min(qrWidth, width || 150);
            const finalHeight = Math.min(qrHeight, height || 80);
            return {
              width: Math.max(50, finalWidth),
              height: Math.max(50, finalHeight)
            };
          },
          aspectRatio: 1.777778, // 16:9 box
          videoConstraints: {
            deviceId: preferredCamera.id
          } as any
        },
        async (decodedText: string) => {
          if (isCancelledRef.current) return;
          if (!decodedText.trim()) return;

          const parsed = parseScannedValue(decodedText);
          if (!parsed.searchValue) return;

          await stopScanner();
          onScan(cleanBarcodeValue(parsed.searchValue));
          onClose();
        },
        () => {
          // No-op for continuous scan failures.
        }
      );

      if (isCancelledRef.current) {
        await stopScanner();
      }
    } catch (error) {
      if (error instanceof Error && error.message === "cancelled") {
        return;
      }
      console.warn("Barcode scanner start failed:", error);
      if (!isCancelledRef.current) {
        setScanError("تعذر تشغيل الكاميرا. يمكنك المحاولة بصورة باركود.");
      }
    } finally {
      if (!isCancelledRef.current) {
        setIsStarting(false);
      }
    }
  }, [onClose, onScan, stopScanner]);

  useEffect(() => {
    if (!isOpen || !isCameraActive) {
      return;
    }

    startScanner();

    return () => {
      isCancelledRef.current = true;
      void stopScanner();
    };
  }, [isOpen, isCameraActive, startScanner, stopScanner]);

  const handleScanImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    // Signal cancellation to any running startScanner promise
    isCancelledRef.current = true;
    setIsStarting(false);
    setScanError(null);
    setIsCameraActive(false);

    try {
      // Stop the active camera before scanning a file
      await stopScanner();

      // Load file into Image object to inspect dimensions and draw on canvas
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      const loadedImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = objectUrl;
      });

      // Add a 40px white border (quiet zone) on all sides.
      // This is crucial for 1D barcodes that have been cropped tightly without side margins.
      const padding = 40;
      const canvas = document.createElement("canvas");
      canvas.width = loadedImg.width + padding * 2;
      canvas.height = loadedImg.height + padding * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Draw solid white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw original image in center
      ctx.drawImage(loadedImg, padding, padding);
      URL.revokeObjectURL(objectUrl);

      // Convert canvas to a File object for the scanner
      const paddedFile = await new Promise<File>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Canvas to blob failed"));
            return;
          }
          resolve(new File([blob], "padded_barcode.png", { type: "image/png" }));
        }, "image/png");
      });

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const tempScanner = new Html5Qrcode("hidden-file-scanner-container", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8
        ],
        verbose: false
      });
      
      try {
        const scannedText = await tempScanner.scanFile(paddedFile, false);
        tempScanner.clear(); // cleanup temporary scanner

        const parsed = parseScannedValue(scannedText);
        if (!parsed.searchValue) {
          setScanError("لم يتم العثور على باركود أو رمز QR صالح في الصورة.");
          return;
        }

        onScan(cleanBarcodeValue(parsed.searchValue));
        onClose();
      } catch (scanError) {
        tempScanner.clear(); // clean up elements even on failure
        throw scanError;
      }
    } catch (error) {
      console.warn("Barcode image scan failed:", error);
      setScanError("تعذر قراءة الباركود من الصورة. يرجى التأكد من وضوح الصورة وقربها.");
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
            وجّه الكاميرا إلى باركود المستفيد لالتقاط بياناته تلقائياً.
          </p>

          {/* Camera area - stable aspect-ratio container */}
          {isCameraActive && (
            <div className="rounded-lg border border-border bg-muted/20 overflow-hidden relative w-full aspect-video min-h-[220px]">
              <div id={SCANNER_ELEMENT_ID} className="w-full h-full" />
              {isStarting && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground bg-black/40">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري تشغيل الكاميرا...
                </div>
              )}
              <style dangerouslySetInnerHTML={{ __html: `
                #${SCANNER_ELEMENT_ID} video {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                }
              `}} />
            </div>
          )}

          {/* Hidden scanner container for file scanning to avoid DOM conflicts */}
          <div id="hidden-file-scanner-container" className="hidden" style={{ display: 'none' }} />

          {!isCameraActive && (
            <button
              type="button"
              onClick={() => {
                setScanError(null);
                setIsCameraActive(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm transition-colors"
            >
              <Camera className="w-5 h-5" />
              العودة لتشغيل الكاميرا
            </button>
          )}

          {scanError && (
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
              {scanError}
            </div>
          )}

          {/* Image scan button - always visible */}
          <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted cursor-pointer transition-colors">
            <ImagePlus className="w-5 h-5" />
            قراءة باركود من صورة في المعرض
            <input
              type="file"
              accept="image/*"
              onChange={handleScanImage}
              className="hidden"
            />
          </label>

          {/* Manual Entry Fallback Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleManualSubmit();
            }}
            className="pt-3 border-t border-border space-y-2 shrink-0"
          >
            <label htmlFor="manual-barcode-input" className="block text-xs font-medium text-muted-foreground text-right">
              أو أدخل رقم الباركود / رقم المستفيد يدوياً:
            </label>
            <div className="flex gap-2">
              <input
                id="manual-barcode-input"
                type="text"
                placeholder="مثال: DHZ00040 أو 40"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary focus:border-primary text-right"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                تأكيد
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
