"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect, useMemo } from "react";
import {
  getOptimizedImageUrl,
  generateSrcSet,
  getResponsiveSizes,
  IMAGE_SIZES,
  isCloudinaryUrl,
  type ImageSizeKey,
} from "@/lib/cloudinary";

interface CloudinaryImageProps {
  /** Source URL - will be optimized if it's a Cloudinary URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Width preset or pixel value */
  width?: number | ImageSizeKey;
  /** Height in pixels (optional) */
  height?: number;
  /** Responsive layout type for sizes attribute */
  layout?: "thumbnail" | "card" | "detail" | "full";
  /** CSS className */
  className?: string;
  /** Loading strategy: 'lazy' (default) or 'eager' */
  loading?: "lazy" | "eager";
  /** Priority loading (for LCP images) */
  priority?: boolean;
  /** Crop mode */
  crop?: "fill" | "fit" | "scale" | "thumb" | "crop" | "limit";
  /** Gravity for cropping */
  gravity?: "face" | "auto" | "center" | "faces";
  /** Quality preset */
  quality?: "auto" | "auto:low" | "auto:eco" | "auto:good" | "auto:best";
  /** Fallback element when no image is available */
  fallback?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: () => void;
}

/**
 * Optimized Cloudinary Image Component
 * 
 * Features:
 * - Automatic format selection (WebP/AVIF) via f_auto
 * - Automatic quality compression via q_auto
 * - Responsive sizing with srcSet
 * - Native lazy loading with Intersection Observer fallback
 * - Placeholder/skeleton while loading
 * - Graceful fallback for non-Cloudinary URLs
 * 
 * Bandwidth savings:
 * - f_auto: ~40% reduction (WebP/AVIF vs JPEG)
 * - q_auto: ~30% reduction (intelligent compression)
 * - Proper sizing: ~50% reduction (no oversized images)
 * - Total: Up to 70-80% bandwidth reduction
 */
export default function CloudinaryImage({
  src,
  alt,
  width,
  height,
  layout = "card",
  className = "",
  loading = "lazy",
  priority = false,
  crop = "limit",
  gravity,
  quality = "auto",
  fallback,
  onClick,
  onLoad,
  onError,
}: CloudinaryImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(() => priority || loading === "eager");
  const imgRef = useRef<HTMLImageElement>(null);

  // Resolve width from preset
  const resolvedWidth = useMemo(() => {
    if (typeof width === "string") {
      return IMAGE_SIZES[width];
    }
    return width;
  }, [width]);

  // Generate optimized URL
  const optimizedSrc = useMemo(() => {
    if (!src) return "";
    return getOptimizedImageUrl(src, {
      width: resolvedWidth,
      height,
      crop,
      gravity,
      quality,
      format: "auto",
      dpr: "auto",
    });
  }, [src, resolvedWidth, height, crop, gravity, quality]);

  // Generate srcSet for responsive images
  const srcSet = useMemo(() => {
    if (!src || !isCloudinaryUrl(src)) return undefined;
    
    // Generate widths based on layout
    let widths: number[];
    switch (layout) {
      case "thumbnail":
        widths = [96, 192]; // 1x and 2x for retina
        break;
      case "card":
        widths = [200, 400, 600];
        break;
      case "detail":
        widths = [400, 800, 1200];
        break;
      case "full":
        widths = [600, 1200, 1800];
        break;
      default:
        widths = [200, 400, 800];
    }
    
    return generateSrcSet(src, widths, { crop, gravity, quality });
  }, [src, layout, crop, gravity, quality]);

  // Determine if we should use native lazy loading
  const supportsNativeLazyLoad = typeof window !== "undefined" && "loading" in HTMLImageElement.prototype;
  
  // For browsers with native lazy loading, we always render the image
  // For older browsers, we use Intersection Observer
  const shouldRenderImage = supportsNativeLazyLoad || isInView;

  // Intersection Observer for lazy loading (only for browsers without native support)
  useEffect(() => {
    // Skip for priority images, eager loading, or if native lazy loading is supported
    if (priority || loading === "eager" || supportsNativeLazyLoad || isInView) {
      return;
    }

    const element = imgRef.current;
    if (!element) return;

    // Fallback to Intersection Observer for older browsers
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "200px", // Start loading 200px before entering viewport
        threshold: 0,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [isInView, priority, loading, supportsNativeLazyLoad]);

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // If no src or error, show fallback
  if (!src || hasError) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    const fallbackClasses = `flex items-center justify-center bg-muted text-muted-foreground ${className}`;
    
    return (
      <div className={fallbackClasses}>
        <span className="text-sm">لا توجد صورة</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Loading skeleton */}
      {!isLoaded && (
        <div
          className="absolute inset-0 bg-muted animate-pulse"
          aria-hidden="true"
        />
      )}

      {/* Actual image */}
      <img
        ref={imgRef}
        src={shouldRenderImage ? optimizedSrc : undefined}
        srcSet={shouldRenderImage ? srcSet : undefined}
        sizes={getResponsiveSizes(layout)}
        alt={alt}
        width={resolvedWidth}
        height={height}
        loading={priority ? "eager" : loading}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        className={`
          w-full h-full object-cover transition-opacity duration-300
          ${isLoaded ? "opacity-100" : "opacity-0"}
          ${onClick ? "cursor-pointer" : ""}
        `}
        // Add fetchpriority for LCP images
        {...(priority && { fetchPriority: "high" as const })}
      />
    </div>
  );
}

/**
 * Simple image component for non-critical images
 * Uses basic lazy loading without skeleton
 */
export function SimpleCloudinaryImage({
  src,
  alt,
  width,
  height,
  className = "",
  quality = "auto",
}: {
  src: string;
  alt: string;
  width?: number | ImageSizeKey;
  height?: number;
  className?: string;
  quality?: "auto" | "auto:low" | "auto:eco" | "auto:good" | "auto:best";
}) {
  const resolvedWidth = typeof width === "string" ? IMAGE_SIZES[width] : width;
  
  const optimizedSrc = getOptimizedImageUrl(src, {
    width: resolvedWidth,
    height,
    quality,
    format: "auto",
  });

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      width={resolvedWidth}
      height={height}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}
