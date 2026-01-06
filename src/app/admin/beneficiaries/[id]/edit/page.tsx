"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import BeneficiaryForm, {
  BeneficiaryFormValues,
  RelationshipEntry,
  createEmptySpouse,
} from "../../components/BeneficiaryForm";

interface ApiRelationship extends RelationshipEntry {
  relative?: { _id?: string; name?: string; nationalId?: string } | string;
}

interface ApiChild {
  _id?: string;
  name?: string;
  nationalId?: string;
  idNumber?: string;
  school?: string;
  educationStage?: string;
  maritalStatus?: BeneficiaryFormValues["children"][number]["maritalStatus"];
  spouse?: {
    name?: string;
    nationalId?: string;
    phone?: string;
    whatsapp?: string;
  };
  healthStatus?: "healthy" | "sick";
  healthCertificationImage?: string;
}

const createBlankFormValues = (): BeneficiaryFormValues => ({
  name: "",
  nationalId: "",
  phone: "",
  whatsapp: "",
  address: "",
  familyMembers: 1,
  maritalStatus: "single",
  income: "",
  priority: 5,
  profileImage: "",
  idImage: "",
  notes: "",
  healthStatus: "healthy",
  healthCertificationImage: "",
  housingType: "owned",
  rentalCost: "",
  employment: "",
  acceptsMarriage: false,
  marriageDetails: "",
  marriageCertificateImage: "",
  status: "active",
  statusReason: "",
  statusDate: new Date().toISOString().split('T')[0],
  listNames: ["الكشف العام"],
  receivesMonthlyAllowance: false,
  monthlyAllowanceAmount: "",
  category: "C",
  spouse: createEmptySpouse(),
  children: [],
  relationships: [],
});

const mapRelationships = (input: unknown): RelationshipEntry[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((relationship: ApiRelationship) => {
    const relativeDetails =
      typeof relationship.relative === "object" && relationship.relative
        ? relationship.relative
        : undefined;

    const linkedId =
      typeof relationship.relative === "string"
        ? relationship.relative
        : relativeDetails?._id;

    return {
      relation: relationship.relation || "other",
      relativeName: relationship.relativeName || relativeDetails?.name || "",
      relativeNationalId:
        relationship.relativeNationalId || relativeDetails?.nationalId || "",
      linkedBeneficiaryId: linkedId,
    };
  });
};

const mapChildren = (input: unknown): BeneficiaryFormValues["children"] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((child: ApiChild) => ({
    _id: child._id,
    name: child.name || "",
    nationalId: child.nationalId || child.idNumber || "",
    school: child.school || "",
    educationStage: child.educationStage || "",
    maritalStatus: child.maritalStatus || "single",
    healthStatus: child.healthStatus || "healthy",
    healthCertificationImage: child.healthCertificationImage || "",
    spouse: child.spouse
      ? {
          name: child.spouse.name || "",
          nationalId: child.spouse.nationalId || "",
          phone: child.spouse.phone || "",
          whatsapp: child.spouse.whatsapp || "",
        }
      : createEmptySpouse(),
  }));
};

export default function EditBeneficiaryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const beneficiaryId = useMemo(() => {
    if (!params?.id) return "";
    return Array.isArray(params.id) ? params.id[0] : params.id;
  }, [params]);

  const { data, error: swrError, isLoading } = useSWR(
    beneficiaryId ? `/api/beneficiaries/${beneficiaryId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const record = data?.beneficiary ?? data;
  const error = swrError ? "فشل تحميل بيانات المستفيد" : !beneficiaryId ? "لم يتم العثور على معرف المستفيد" : "";
  const loading = isLoading;

  const initialValues = useMemo(() => {
    if (!record) return undefined;

    return {
      ...createBlankFormValues(),
      name: record?.name || "",
      nationalId: record?.nationalId || "",
      phone: record?.phone || "",
      whatsapp: record?.whatsapp || "",
      address: record?.address || "",
      familyMembers: record?.familyMembers || 1,
      maritalStatus: record?.maritalStatus || "single",
      income: record?.income?.toString?.() || "",
      priority: record?.priority || 5,
      profileImage: record?.profileImage || "",
      idImage: record?.idImage || "",
      notes: record?.notes || "",
      healthStatus: record?.healthStatus || "healthy",
      healthCertificationImage: record?.healthCertificationImage || "",
      housingType: record?.housingType || "owned",
      rentalCost: record?.rentalCost?.toString?.() || "",
      employment: record?.employment || "",
      acceptsMarriage: record?.acceptsMarriage || false,
      marriageDetails: record?.marriageDetails || "",
      marriageCertificateImage: record?.marriageCertificateImage || "",
      status: record?.status || "active",
      statusReason: record?.statusReason || "",
      statusDate: record?.statusDate ? new Date(record.statusDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      listNames: record?.listNames?.length ? record.listNames : (record?.listName ? [record.listName] : ["الكشف العام"]),
      receivesMonthlyAllowance: record?.receivesMonthlyAllowance || false,
      monthlyAllowanceAmount: record?.monthlyAllowanceAmount?.toString?.() || "",
      category: record?.category || "C",
      spouse: record?.spouse
        ? {
            name: record.spouse.name || "",
            nationalId: record.spouse.nationalId || "",
            phone: record.spouse.phone || "",
            whatsapp: record.spouse.whatsapp || "",
          }
        : createEmptySpouse(),
      children: mapChildren(record?.children),
      relationships: mapRelationships(record?.relationships),
    };
  }, [record]);

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-muted-foreground">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-destructive text-lg font-semibold">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/admin/beneficiaries")}
          className="px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          العودة لقائمة المستفيدين
        </button>
      </div>
    );
  }

  if (!initialValues || !beneficiaryId) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-destructive">
        <p>بيانات المستفيد غير متاحة</p>
      </div>
    );
  }

  return (
    <BeneficiaryForm
      mode="edit"
      beneficiaryId={beneficiaryId}
      initialValues={initialValues}
      onSuccess={() => router.push("/admin/beneficiaries")}
    />
  );
}
