"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

  const [initialValues, setInitialValues] = useState<BeneficiaryFormValues>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role;
    if (isLoaded && role !== "admin") {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    if (!beneficiaryId) {
      setLoading(false);
      setError("لم يتم العثور على معرف المستفيد");
      return;
    }

    const fetchBeneficiary = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/beneficiaries/${beneficiaryId}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch beneficiary");
        }
        const data = await res.json();
        const record = data?.beneficiary ?? data;

        const normalized: BeneficiaryFormValues = {
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

        setInitialValues(normalized);
        setError("");
      } catch (err) {
        console.error(err);
        setError("فشل تحميل بيانات المستفيد");
      } finally {
        setLoading(false);
      }
    };

    fetchBeneficiary();
  }, [beneficiaryId]);

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
