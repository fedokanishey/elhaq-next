"use client";

import React from 'react'
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, use } from "react";
import { Loader2 } from "lucide-react";
import ViewBeneficiary from "@/app/admin/beneficiaries/[id]/page"

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { id } = use(params);
  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
  const canAccess = role === "admin" || role === "member";

  useEffect(() => {
    if (!isLoaded) return;
    if (!canAccess) {
      router.replace("/");
    }
  }, [isLoaded, canAccess, router]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        جاري تحويلك للصفحة الرئيسية...
      </div>
    );
  }

  return (
    <ViewBeneficiary params={Promise.resolve({ id })} />
  )
}
