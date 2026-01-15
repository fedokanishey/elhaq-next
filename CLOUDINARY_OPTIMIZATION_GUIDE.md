# Cloudinary Bandwidth Optimization Guide

## Overview

This document outlines the Cloudinary optimization strategy implemented for the ElHaq charity management system to minimize bandwidth consumption on the free tier (25GB/month).

## Implemented Optimizations

### 1. URL-based Transformations

All images now use Cloudinary's dynamic transformations:

- **`f_auto`** (Automatic Format): Serves WebP to Chrome/Firefox/Edge, AVIF to supported browsers, and falls back to JPEG/PNG for older browsers
- **`q_auto`** (Automatic Quality): Intelligent compression that maintains visual quality while reducing file size
- **`dpr_auto`** (Device Pixel Ratio): Serves appropriate resolution for retina displays

### 2. Responsive Sizing

Images are served at appropriate sizes for their context:

| Context | Size (px) | Use Case |
|---------|-----------|----------|
| `thumbnail` | 96 | Avatar cards, small previews |
| `card` | 200 | Card images, form previews |
| `preview` | 400 | Medium detail views |
| `detail` | 800 | Full detail views |
| `full` | 1200 | Modals, print-ready images |

### 3. Lazy Loading

- Native `loading="lazy"` attribute for modern browsers
- Intersection Observer fallback for older browsers
- Images load 200px before entering viewport (root margin)
- Priority loading (`fetchpriority="high"`) for LCP images

### 4. Browser Caching

Cloudinary URLs are immutable and include version identifiers. The browser will:

1. Cache images based on the URL (standard HTTP caching)
2. Reuse cached images across sessions
3. Only fetch when the URL changes (new upload or transformation)

**Note**: We do NOT use LocalStorage for image caching as it:
- Has a 5-10MB limit per origin
- Is synchronous and blocks the main thread
- Is slower than browser cache for large files

## Bandwidth Savings Breakdown

| Optimization | Estimated Savings |
|--------------|-------------------|
| f_auto (WebP/AVIF) | 30-50% |
| q_auto (Quality) | 20-40% |
| Proper sizing | 40-60% |
| **Combined Total** | **60-80%** |

### Example Calculation

**Before optimization:**
- Original image: 4MB
- 100 beneficiaries × 2 images each = 200 images
- 200 images × 4MB × 10 views/month = 8GB/month (just for one branch!)

**After optimization:**
- Optimized thumbnail (96px): ~15KB (99.6% reduction!)
- Optimized card (200px): ~30KB (99.25% reduction!)
- Optimized detail (800px): ~150KB (96.25% reduction!)
- Average use case: 100 × 2 × 0.03MB × 10 = **60MB/month** per branch

## Files Modified

### New Files
- [src/lib/cloudinary.ts](src/lib/cloudinary.ts) - URL transformation utilities
- [src/components/CloudinaryImage.tsx](src/components/CloudinaryImage.tsx) - Optimized image component

### Updated Files
- [src/components/BeneficiaryCard.tsx](src/components/BeneficiaryCard.tsx) - Card thumbnails
- [src/components/ImageUpload.tsx](src/components/ImageUpload.tsx) - Upload preview
- [src/app/admin/beneficiaries/components/BeneficiaryDetailsView.tsx](src/app/admin/beneficiaries/components/BeneficiaryDetailsView.tsx) - Detail views
- [src/app/admin/initiatives/components/InitiativeForm.tsx](src/app/admin/initiatives/components/InitiativeForm.tsx) - Initiative images
- [src/app/admin/initiatives/components/InitiativeDetailsView.tsx](src/app/admin/initiatives/components/InitiativeDetailsView.tsx) - Initiative gallery

## Component Usage

### Basic Usage

```tsx
import CloudinaryImage from "@/components/CloudinaryImage";

// Thumbnail (avatar, small preview)
<CloudinaryImage
  src={beneficiary.profileImage}
  alt={beneficiary.name}
  width="thumbnail"
  height={96}
  layout="thumbnail"
  crop="fill"
  gravity="face"
/>

// Card image
<CloudinaryImage
  src={image}
  alt="Description"
  width="card"
  layout="card"
  crop="fill"
/>

// Detail view (documents, certificates)
<CloudinaryImage
  src={healthCertificate}
  alt="Health Certificate"
  width="detail"
  layout="detail"
  crop="limit"
  quality="auto:good"
/>

// Full-size modal
<CloudinaryImage
  src={selectedImage}
  alt="Full size"
  width="full"
  layout="full"
  priority  // For modal images that should load immediately
/>
```

### Direct URL Transformation

```tsx
import { getOptimizedImageUrl, cloudinaryPresets } from "@/lib/cloudinary";

// Custom transformation
const optimizedUrl = getOptimizedImageUrl(originalUrl, {
  width: 400,
  height: 300,
  crop: "fill",
  quality: "auto:good",
  format: "auto",
});

// Using presets
const thumbnailUrl = cloudinaryPresets.thumbnail(originalUrl);
const idCardUrl = cloudinaryPresets.idCard(originalUrl);
const documentUrl = cloudinaryPresets.document(originalUrl);
```

## Verifying Bandwidth Savings

### In Cloudinary Console

1. Log in to [Cloudinary Console](https://console.cloudinary.com/)
2. Navigate to **Dashboard** → **Usage**
3. Check the following metrics:
   - **Bandwidth** - Total data transferred
   - **Transformations** - Number of transformations applied
   - **Requests** - Number of image requests

### Key Metrics to Monitor

| Metric | Before | Target After |
|--------|--------|--------------|
| Average bandwidth per image | 2-4MB | 30-150KB |
| Monthly bandwidth usage | 8-15GB | 500MB-2GB |
| Cache hit ratio | N/A | >80% |

### Using Browser DevTools

1. Open DevTools (F12) → **Network** tab
2. Filter by **Img**
3. Check the **Size** column for each image
4. Look for `webp` or `avif` in the **Type** column

### Cloudinary URL Analysis

Compare original vs optimized URLs:

```
Original:
https://res.cloudinary.com/elhaq/image/upload/v1234567890/beneficiaries/id_card.jpg
Size: ~3MB

Optimized:
https://res.cloudinary.com/elhaq/image/upload/f_auto,q_auto,dpr_auto,w_200,c_limit/beneficiaries/id_card.jpg
Size: ~30KB
```

## Service Worker (Advanced Option)

For branches with dedicated machines that need offline access:

### When to Use a Service Worker

✅ **Good for:**
- Dedicated branch machines
- Offline-first requirements
- Frequently accessed beneficiary images

❌ **Not recommended for:**
- Mobile devices with limited storage
- Shared computers
- Images that change frequently

### Implementation Concept

```typescript
// sw.js - Service Worker for image caching
const CACHE_NAME = 'elhaq-images-v1';
const CLOUDINARY_PATTERN = /res\.cloudinary\.com\/elhaq/;

self.addEventListener('fetch', (event) => {
  if (CLOUDINARY_PATTERN.test(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
  }
});
```

**Note**: This is provided as guidance only. Full Service Worker implementation requires additional consideration for cache invalidation and storage limits.

## Multi-Branch Scalability

The solution scales well because:

1. **URL-based transformations** - No server-side processing needed
2. **Branch-agnostic** - All branches use the same component
3. **CDN delivery** - Cloudinary CDN handles geographic distribution
4. **Cached at edge** - Transformed images are cached globally

### Adding New Branches

No additional configuration needed:
- New beneficiaries get optimized images automatically
- The `CloudinaryImage` component works identically across all branches
- Cloudinary handles caching per unique URL

## Troubleshooting

### Images Not Optimizing

1. Verify the URL contains `cloudinary.com`
2. Check that transformations appear in the URL (`f_auto,q_auto`)
3. Ensure the component is imported correctly

### High Bandwidth Despite Optimization

1. Check for images loaded outside the component
2. Verify lazy loading is working (check Network tab)
3. Look for duplicate image loads

### Images Not Loading

1. Check Cloudinary console for errors
2. Verify the `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` env variable
3. Check browser console for CORS issues

## Maintenance

### Monthly Checks

1. Review Cloudinary usage dashboard
2. Check bandwidth trends
3. Identify any unoptimized images
4. Verify cache hit ratios

### When Adding New Image Fields

Always use the `CloudinaryImage` component:

```tsx
{newImageField && (
  <CloudinaryImage
    src={newImageField}
    alt="Description"
    width="card"
    layout="card"
  />
)}
```

## Summary

By implementing these optimizations, we expect:

- **60-80%** reduction in bandwidth usage
- **Improved loading times** for all branches
- **Better mobile experience** with smaller files
- **Scalable solution** that works for any number of branches
- **Maintained image legibility** for ID cards and documents

The free tier (25GB/month) should comfortably support multiple branches with thousands of beneficiaries.
