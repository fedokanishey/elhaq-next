import React from "react";
import Image from "next/image";

interface BrandedLoaderProps {
  /** If true, renders full screen with fixed positioning */
  fullScreen?: boolean;
  /** Size variant: 'sm' for inline/cards, 'md' default, 'lg' for hero/splash */
  size?: "sm" | "md" | "lg";
  /** Which of the two official logos to display: 'emblem' (شعار) or 'full' (Asset 1) */
  logoType?: "emblem" | "full";
  /** Optional status text displayed beneath the dots */
  text?: string;
  className?: string;
}

export default function BrandedLoader({
  fullScreen = false,
  size = "md",
  logoType,
  text,
  className = "",
}: BrandedLoaderProps) {
  const isSm = size === "sm";
  const isLg = size === "lg";

  // Use emblem for sm by default, or if explicitly requested
  const useEmblem = logoType === "emblem" || (logoType === undefined && isSm);

  // Dimensions based on exact aspect ratios of the official assets:
  // شعار.png is (712 x 958)
  // Asset 1.png is (876 x 257)
  const logoDimensions = useEmblem
    ? isSm
      ? { width: 48, height: 64 }
      : isLg
      ? { width: 100, height: 135 }
      : { width: 75, height: 100 }
    : isSm
    ? { width: 175, height: 51 }
    : isLg
    ? { width: 320, height: 94 }
    : { width: 240, height: 70 };

  const logoSrc = useEmblem ? "/logos/شعار.png" : "/logos/Asset 1.png";

  // Dot sizes
  const dotClass = isSm ? "w-1.5 h-1.5" : isLg ? "w-3 h-3" : "w-2.5 h-2.5";
  const gapClass = isSm ? "gap-1.5 mt-2.5" : "gap-2 mt-4";

  const content = (
    <div
      className={`flex flex-col items-center justify-center select-none ${className}`}
      role="status"
      aria-label={text || "جاري التحميل..."}
    >
      {/* Branded Logo with subtle breathe animation - exactly the user's official logos in both light and dark mode */}
      <div className="relative animate-branded-logo flex items-center justify-center">
        <Image
          src={logoSrc}
          alt="دعوة الحق"
          width={logoDimensions.width}
          height={logoDimensions.height}
          quality={100}
          priority
          unoptimized
          className="object-contain"
        />
      </div>

      {/* Three green animated dots */}
      <div className={`flex items-center ${gapClass}`} aria-hidden="true">
        <span
          className={`${dotClass} rounded-full bg-primary animate-branded-dot-1`}
        />
        <span
          className={`${dotClass} rounded-full bg-primary animate-branded-dot-2`}
        />
        <span
          className={`${dotClass} rounded-full bg-primary animate-branded-dot-3`}
        />
      </div>

      {/* Optional helper text */}
      {text && (
        <p className="mt-3 text-xs sm:text-sm font-medium text-muted-foreground animate-pulse text-center">
          {text}
        </p>
      )}
      <span className="sr-only">{text || "جاري التحميل..."}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background transition-colors duration-300">
        {content}
      </div>
    );
  }

  return content;
}
