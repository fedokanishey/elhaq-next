"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import InitiativeForm from "../components/InitiativeForm";

export default function AddInitiativePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (role !== "admin" && role !== "superadmin") {
      const timer = setTimeout(() => router.push("/"), 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return <InitiativeForm mode="create" />;
}
