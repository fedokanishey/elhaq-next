"use client";

import { CldUploadWidget } from "next-cloudinary";
import { useState } from "react";

interface ImageUploadProps {
  onImageUpload: (imageUrl: string) => void;
  label?: string;
  currentImage?: string;
}

export default function ImageUpload({
  onImageUpload,
  label = "اختر صورة",
  currentImage,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {preview && (
        <div className="relative w-32 h-32">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
      )}

      <CldUploadWidget
        uploadPreset="elhaq_beneficiaries"
        onSuccess={(result: unknown) => {
          const uploadResult = result as { info: { secure_url: string } };
          const imageUrl = uploadResult.info.secure_url;
          setPreview(imageUrl);
          onImageUpload(imageUrl);
          setUploading(false);
        }}
        onError={() => {
          setUploading(false);
          alert("فشل تحميل الصورة");
        }}
      >
        {({ open }) => (
          <button
            type="button"
            onClick={() => {
              setUploading(true);
              open();
            }}
            disabled={uploading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {uploading ? "جاري التحميل..." : "📤 اختر صورة من جهازك"}
          </button>
        )}
      </CldUploadWidget>
    </div>
  );
}
