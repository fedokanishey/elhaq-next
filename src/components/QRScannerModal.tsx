"use client";

import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
  title?: string;
}

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
    // Ignore JSON parse errors
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

const VIEWPORT_ID = "qr-scanner-viewport";

export default function QRScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "مسح باركود",
}: QRScannerModalProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");

  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  // Reset states when opened
  useEffect(() => {
    if (isOpen) {
      setIsCameraActive(true);
      setScanError(null);
      setManualValue("");
    }
  }, [isOpen]);

  // Main camera scanner lifecycle
  useEffect(() => {
    if (!isOpen || !isCameraActive) {
      return;
    }

    let isMounted = true;
    let scannerInstance: any = null;

    // Suppress html5-qrcode's uncaught onabort throw and browser video.play() aborts
    const handleGlobalError = (event: ErrorEvent) => {
      const msg = String(event.message || event.error || "");
      if (
        msg.includes("RenderedCameraImpl") ||
        msg.includes("onabort") ||
        msg.includes("play()") ||
        msg.includes("AbortError")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason?.message || event.reason || "");
      if (
        reason.includes("RenderedCameraImpl") ||
        reason.includes("onabort") ||
        reason.includes("play()") ||
        reason.includes("AbortError")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("error", handleGlobalError, true);
    window.addEventListener("unhandledrejection", handleRejection, true);

    const runScanner = async () => {
      setIsStarting(true);
      setScanError(null);

      // Ensure DOM element is mounted
      await new Promise((r) => setTimeout(r, 60));
      if (!isMounted) return;

      const targetEl = document.getElementById(VIEWPORT_ID);
      if (!targetEl) return;

      // MutationObserver to neutralize video.onabort that html5-qrcode sets
      const observer = new MutationObserver(() => {
        const videos = targetEl.querySelectorAll("video");
        videos.forEach((v) => {
          v.onabort = null;
          v.onerror = null;
        });
      });
      observer.observe(targetEl, { childList: true, subtree: true });

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!isMounted) return;

        const scanner = new Html5Qrcode(VIEWPORT_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
          ],
          verbose: false,
        });
        scannerInstance = scanner;

        // Determine camera ID or facing mode
        let cameraConfig: any = { facingMode: "environment" };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const preferred = cameras.find((c) =>
              /back|rear|environment|خلف/i.test(c.label || "")
            );
            cameraConfig = (preferred || cameras[0]).id;
          }
        } catch {
          // If getCameras fails, facingMode: environment will prompt for permission
        }

        if (!isMounted) return;

        await scanner.start(
          cameraConfig,
          {
            fps: 15,
            qrbox: (width, height) => {
              const qrWidth = Math.max(150, Math.floor(width * 0.8));
              const qrHeight = Math.max(80, Math.floor(height * 0.45));
              const finalWidth = Math.min(qrWidth, width || 150);
              const finalHeight = Math.min(qrHeight, height || 80);
              return {
                width: Math.max(50, finalWidth),
                height: Math.max(50, finalHeight),
              };
            },
            aspectRatio: 1.777778,
          },
          async (decodedText: string) => {
            if (!isMounted) return;
            if (!decodedText.trim()) return;

            const parsed = parseScannedValue(decodedText);
            if (!parsed.searchValue) return;

            try {
              if (scanner.getState() === 2) {
                await scanner.stop();
              }
            } catch {}
            onScanRef.current(cleanBarcodeValue(parsed.searchValue));
            onCloseRef.current();
          },
          () => {}
        );

        // Wipe onabort from active video
        const videos = targetEl.querySelectorAll("video");
        videos.forEach((v) => {
          v.onabort = null;
          v.onerror = null;
        });
      } catch (err: any) {
        if (!isMounted) return;
        const msg = String(err?.message || err || "");
        if (msg.includes("cancelled") || msg.includes("onabort") || msg.includes("AbortError")) {
          return;
        }
        console.warn("Scanner start error:", err);
        setScanError("تعذر تشغيل الكاميرا. يمكنك استخدام الإدخال اليدوي أو اختيار صورة باركود.");
      } finally {
        if (isMounted) {
          setIsStarting(false);
        }
      }
    };

    runScanner();

    return () => {
      isMounted = false;
      window.removeEventListener("error", handleGlobalError, true);
      window.removeEventListener("unhandledrejection", handleRejection, true);

      // Clean up video media tracks
      const targetEl = document.getElementById(VIEWPORT_ID);
      if (targetEl) {
        const videos = targetEl.querySelectorAll("video");
        videos.forEach((v) => {
          v.onabort = null;
          v.onerror = null;
          try {
            v.pause();
            if (v.srcObject instanceof MediaStream) {
              v.srcObject.getTracks().forEach((t) => t.stop());
              v.srcObject = null;
            }
          } catch {}
        });
      }

      // Stop scanner instance
      if (scannerInstance) {
        try {
          const state = scannerInstance.getState?.();
          if (state === 2 || state === 3) {
            void scannerInstance.stop().catch(() => {});
          }
        } catch {}
        try {
          void scannerInstance.clear();
        } catch {}
      }
    };
  }, [isOpen, isCameraActive]);

  const handleManualSubmit = () => {
    if (!manualValue.trim()) return;
    const val = cleanBarcodeValue(manualValue.trim());
    onScanRef.current(val);
    onCloseRef.current();
  };

  const handleScanImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setScanError(null);
    setIsCameraActive(false);

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      const loadedImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = objectUrl;
      });

      const padding = 40;
      const canvas = document.createElement("canvas");
      canvas.width = loadedImg.width + padding * 2;
      canvas.height = loadedImg.height + padding * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(loadedImg, padding, padding);
      URL.revokeObjectURL(objectUrl);

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
          Html5QrcodeSupportedFormats.EAN_8,
        ],
        verbose: false,
      });

      try {
        const scannedText = await tempScanner.scanFile(paddedFile, false);
        tempScanner.clear();

        const parsed = parseScannedValue(scannedText);
        if (!parsed.searchValue) {
          setScanError("لم يتم العثور على باركود أو رمز QR صالح في الصورة.");
          return;
        }

        onScanRef.current(cleanBarcodeValue(parsed.searchValue));
        onCloseRef.current();
      } catch (scanErr) {
        tempScanner.clear();
        throw scanErr;
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
              <div id={VIEWPORT_ID} className="w-full h-full min-h-[220px]" />
              {isStarting && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground bg-black/40">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري تشغيل الكاميرا...
                </div>
              )}
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                #${VIEWPORT_ID} video {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                }
              `,
                }}
              />
            </div>
          )}

          {/* Hidden scanner container for file scanning to avoid DOM conflicts */}
          <div id="hidden-file-scanner-container" className="hidden" style={{ display: "none" }} />

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
            <label
              htmlFor="manual-barcode-input"
              className="block text-xs font-medium text-muted-foreground text-right"
            >
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
