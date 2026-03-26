"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPWA() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Register Service Worker for Native PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
    }

    // Check if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Also check navigator.standalone for iOS
    if ((navigator as unknown as { standalone?: boolean }).standalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
    } catch (error) {
      console.error("Install prompt error:", error);
    } finally {
      setDeferredPrompt(null);
      setIsInstalling(false);
    }
  };

  // Only show on home page, only when prompt is available, and not already installed
  if (pathname !== "/" || !deferredPrompt || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-700 fade-in">
      <button
        onClick={handleInstall}
        disabled={isInstalling}
        className="group flex items-center gap-3 px-8 py-4 
          bg-gradient-to-l from-primary to-emerald-500 
          hover:from-green-500 hover:to-emerald-400 
          text-white font-bold text-lg rounded-full 
          shadow-[0_8px_30px_rgb(22,163,74,0.3)] hover:shadow-[0_8px_30px_rgb(22,163,74,0.5)]
          transition-all duration-300 ease-out 
          hover:scale-[1.05] active:scale-[0.98]
          disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <Download className="h-6 w-6 transition-transform duration-300 group-hover:-translate-y-1 animate-bounce" />
        {isInstalling ? "جاري التثبيت..." : "تثبيت التطبيق"}
      </button>
    </div>
  );
}
