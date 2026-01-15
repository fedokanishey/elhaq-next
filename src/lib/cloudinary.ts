/**
 * Cloudinary URL Transformation Utilities
 * 
 * These utilities help optimize image delivery to minimize bandwidth consumption.
 * Using f_auto (automatic format) and q_auto (automatic quality) can reduce
 * bandwidth by 40-80% compared to serving raw images.
 * 
 * @see https://cloudinary.com/documentation/image_optimization
 */

/**
 * Preset responsive breakpoints for different use cases
 */
export const IMAGE_SIZES = {
  /** Small thumbnail (avatar, card preview) */
  thumbnail: 96,
  /** Card image size */
  card: 200,
  /** Medium preview size */
  preview: 400,
  /** Large detail view */
  detail: 800,
  /** Full-size for modal/print */
  full: 1200,
} as const;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;

interface TransformOptions {
  /** Width in pixels or preset name */
  width?: number | ImageSizeKey;
  /** Height in pixels (optional, maintains aspect ratio if omitted) */
  height?: number;
  /** Crop mode: 'fill', 'fit', 'scale', 'thumb', 'crop' */
  crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'crop' | 'limit';
  /** Quality: 'auto', 'auto:low', 'auto:eco', 'auto:good', 'auto:best' or number 1-100 */
  quality?: 'auto' | 'auto:low' | 'auto:eco' | 'auto:good' | 'auto:best' | number;
  /** Format: 'auto' for automatic WebP/AVIF selection */
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  /** Gravity for cropping: 'face', 'auto', 'center' */
  gravity?: 'face' | 'auto' | 'center' | 'faces';
  /** Device pixel ratio for retina displays */
  dpr?: 'auto' | number;
}

/**
 * Extracts the public ID from a Cloudinary URL
 * 
 * @example
 * extractPublicId('https://res.cloudinary.com/demo/image/upload/v1234/folder/image.jpg')
 * // Returns: 'folder/image'
 */
export function extractPublicId(url: string): string | null {
  if (!url) return null;
  
  // Check if it's a Cloudinary URL
  const cloudinaryRegex = /cloudinary\.com\/([^/]+)\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z]+)?$/;
  const match = url.match(cloudinaryRegex);
  
  if (match) {
    return match[2];
  }
  
  return null;
}

/**
 * Checks if a URL is a Cloudinary URL
 */
export function isCloudinaryUrl(url: string): boolean {
  return url?.includes('cloudinary.com') ?? false;
}

/**
 * Generates an optimized Cloudinary URL with transformations
 * 
 * Key bandwidth savings:
 * - f_auto: Serves WebP/AVIF when supported (30-50% smaller)
 * - q_auto: Intelligent compression (20-40% smaller)
 * - Width limiting: Prevents oversized images
 * 
 * @param url - Original Cloudinary URL or public ID
 * @param options - Transformation options
 * @returns Optimized Cloudinary URL
 */
export function getOptimizedImageUrl(
  url: string,
  options: TransformOptions = {}
): string {
  if (!url) return '';
  
  // If it's not a Cloudinary URL, return as-is
  if (!isCloudinaryUrl(url)) {
    return url;
  }
  
  const {
    width,
    height,
    crop = 'limit',
    quality = 'auto',
    format = 'auto',
    gravity,
    dpr = 'auto',
  } = options;
  
  // Resolve width from preset or use direct value
  const resolvedWidth = typeof width === 'string' 
    ? IMAGE_SIZES[width] 
    : width;
  
  // Build transformation string
  const transforms: string[] = [];
  
  // Always add format and quality auto for bandwidth optimization
  transforms.push(`f_${format}`);
  transforms.push(`q_${quality}`);
  
  // Add DPR for retina displays
  if (dpr) {
    transforms.push(`dpr_${dpr}`);
  }
  
  // Add dimensions if specified
  if (resolvedWidth) {
    transforms.push(`w_${resolvedWidth}`);
  }
  if (height) {
    transforms.push(`h_${height}`);
  }
  
  // Add crop mode if we have dimensions
  if (resolvedWidth || height) {
    transforms.push(`c_${crop}`);
  }
  
  // Add gravity for smart cropping
  if (gravity) {
    transforms.push(`g_${gravity}`);
  }
  
  // Parse the original URL and insert transformations
  const transformString = transforms.join(',');
  
  // Handle different URL formats
  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex !== -1) {
    const beforeUpload = url.substring(0, uploadIndex + 8); // includes '/upload/'
    const afterUpload = url.substring(uploadIndex + 8);
    
    // Remove any existing version number for cleaner URLs
    const cleanedAfter = afterUpload.replace(/^v\d+\//, '');
    
    return `${beforeUpload}${transformString}/${cleanedAfter}`;
  }
  
  return url;
}

/**
 * Generates srcSet for responsive images
 * 
 * @param url - Original Cloudinary URL
 * @param widths - Array of widths to generate
 * @param options - Additional transformation options
 * @returns srcSet string for use with img or source elements
 */
export function generateSrcSet(
  url: string,
  widths: number[] = [200, 400, 800, 1200],
  options: Omit<TransformOptions, 'width'> = {}
): string {
  if (!url || !isCloudinaryUrl(url)) return '';
  
  return widths
    .map(w => `${getOptimizedImageUrl(url, { ...options, width: w })} ${w}w`)
    .join(', ');
}

/**
 * Get responsive sizes attribute for common layouts
 */
export function getResponsiveSizes(layout: 'card' | 'thumbnail' | 'detail' | 'full'): string {
  switch (layout) {
    case 'thumbnail':
      return '96px';
    case 'card':
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
    case 'detail':
      return '(max-width: 768px) 100vw, 800px';
    case 'full':
      return '100vw';
    default:
      return '100vw';
  }
}

/**
 * Pre-configured URL generators for common use cases
 */
export const cloudinaryPresets = {
  /** Thumbnail for cards (96x96) */
  thumbnail: (url: string) => getOptimizedImageUrl(url, {
    width: 'thumbnail',
    height: 96,
    crop: 'fill',
    gravity: 'face',
  }),
  
  /** Card preview (200px width) */
  card: (url: string) => getOptimizedImageUrl(url, {
    width: 'card',
    crop: 'limit',
  }),
  
  /** ID card image - optimized for legibility */
  idCard: (url: string) => getOptimizedImageUrl(url, {
    width: 'detail',
    quality: 'auto:good',
    crop: 'limit',
  }),
  
  /** Full-size for print/modal */
  fullSize: (url: string) => getOptimizedImageUrl(url, {
    width: 'full',
    quality: 'auto:best',
    crop: 'limit',
  }),
  
  /** Certificate/document - prioritize text legibility */
  document: (url: string) => getOptimizedImageUrl(url, {
    width: 'full',
    quality: 'auto:good',
    format: 'auto',
    crop: 'limit',
  }),
};

/**
 * Calculate estimated bandwidth savings
 * 
 * Typical savings:
 * - f_auto alone: 30-50%
 * - q_auto alone: 20-40%
 * - Combined with proper sizing: 60-80%
 */
export const ESTIMATED_SAVINGS = {
  formatAuto: 0.4,  // 40% savings from WebP/AVIF
  qualityAuto: 0.3, // 30% savings from intelligent compression
  properSizing: 0.5, // 50% savings from not oversizing
  combined: 0.7,    // 70% total savings with all optimizations
} as const;
