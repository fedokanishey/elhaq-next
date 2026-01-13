"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BeneficiaryForm from "../components/BeneficiaryForm";

export default function AddBeneficiaryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin" && role !== "superadmin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return <BeneficiaryForm mode="create" />;
}
