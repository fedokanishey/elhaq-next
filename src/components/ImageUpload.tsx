"use client";

import { CldUploadWidget } from "next-cloudinary";
import { useState } from "react";
import CloudinaryImage from "./CloudinaryImage";

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
  const preview = currentImage || null;
  const cloudinaryPreset =
    process.env.NEXT_PUBLIC_CLOUDINARY_BENEFICIARIES_PRESET ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    "elhaq_beneficiaries";
  const cloudinaryFolder = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_FOLDER || "elhaq";
  const cloudinarySignatureEndpoint = "/api/cloudinary/sign";

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>

      {preview && (
        <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
          <CloudinaryImage
            src={preview}
            alt="Preview"
            width="card"
            height={128}
            layout="card"
            crop="fill"
            quality="auto"
            className="w-full h-full"
          />
        </div>
      )}

      <CldUploadWidget
        uploadPreset={cloudinaryPreset}
        signatureEndpoint={cloudinarySignatureEndpoint}
        options={{ folder: cloudinaryFolder }}
        onSuccess={(result: unknown) => {
          const uploadResult = result as { info: { secure_url: string } };
          const imageUrl = uploadResult.info.secure_url;
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
