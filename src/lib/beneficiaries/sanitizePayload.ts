type MaritalStatus = "single" | "married" | "divorced" | "widowed";
type RelationshipType =
  | "father"
  | "mother"
  | "son"
  | "daughter"
  | "brother"
  | "sister"
  | "spouse"
  | "grandfather"
  | "grandmother"
  | "other";

interface ChildPayload {
  name?: string;
  nationalId?: string;
  school?: string;
  educationStage?: string;
  maritalStatus?: MaritalStatus;
  spouse?: SpousePayload;
  healthStatus?: "healthy" | "sick";
  healthCertificationImage?: string;
}

interface SpousePayload {
  name?: string;
  nationalId?: string;
  phone?: string;
  whatsapp?: string;
}

interface RelationshipPayload {
  relation?: RelationshipType | string;
  relativeName?: string;
  relativeNationalId?: string;
}

export interface SanitizedRelationship {
  relation: RelationshipType;
  relativeName: string;
  relativeNationalId?: string;
}

export interface SanitizedBeneficiaryPayload {
  name: string;
  nationalId: string;
  phone: string;
  whatsapp: string;
  address: string;
  familyMembers: number;
  maritalStatus: MaritalStatus;
  income?: number;
  priority: number;
  profileImage?: string;
  idImage?: string;
  notes?: string;
  healthStatus?: "healthy" | "sick";
  healthCertificationImage?: string;
  housingType?: "owned" | "rented";
  rentalCost?: number;
  employment?: string;
  spouse?: SpousePayload;
  children: Array<
    Required<Pick<ChildPayload, "name">> &
      Omit<ChildPayload, "name">
  >;
  relationships: SanitizedRelationship[];
}

const allowedMaritalStatuses: MaritalStatus[] = [
  "single",
  "married",
  "divorced",
  "widowed",
];

const allowedRelationshipTypes: RelationshipType[] = [
  "father",
  "mother",
  "son",
  "daughter",
  "brother",
  "sister",
  "spouse",
  "grandfather",
  "grandmother",
  "other",
];

const NAME_REGEX = /^[\u0600-\u06FFa-zA-Z]+(?:[\s'-][\u0600-\u06FFa-zA-Z]+)*$/;
const NATIONAL_ID_REGEX = /^\d{10,20}$/;
const PHONE_REGEX = /^\+?\d{7,15}$/;
const ADDRESS_MIN_LENGTH = 5;

const normalizeString = (value: unknown) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const str = String(value).trim();
  return str || undefined;
};

const normalizeRequiredString = (value: unknown) => String(value ?? "").trim();

const ensureName = (value: string, label: string) => {
  if (!NAME_REGEX.test(value)) {
    throw new Error(`${label} يجب ألا يحتوي على أرقام أو رموز خاصة`);
  }
};

const ensureNationalId = (value: string, label: string) => {
  if (!NATIONAL_ID_REGEX.test(value)) {
    throw new Error(`${label} يجب أن يتكون من أرقام فقط (10-20 رقم)`);
  }
};

const ensurePhone = (value: string, label: string) => {
  if (!PHONE_REGEX.test(value)) {
    throw new Error(`${label} يجب أن يتكون من أرقام فقط (7-15 رقم)`);
  }
};

const normalizeNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

const sanitizeChild = (child: ChildPayload) => {
  const name = normalizeString(child?.name);
  if (!name) {
    return null;
  }

  if (!NAME_REGEX.test(name)) {
    throw new Error("اسم الابن يجب أن يحتوي على أحرف فقط");
  }

  const maritalStatus = allowedMaritalStatuses.includes(
    child?.maritalStatus as MaritalStatus
  )
    ? (child?.maritalStatus as MaritalStatus)
    : "single";

  const spouse =
    maritalStatus === "married" ? sanitizeSpouse(child?.spouse as SpousePayload) : undefined;

  const healthStatus = ["healthy", "sick"].includes(child?.healthStatus as string)
    ? (child?.healthStatus as "healthy" | "sick")
    : "healthy";

  const healthCertificationImage = healthStatus === "sick" ? ((child?.healthCertificationImage as string) || "") : "";

  return {
    name,
    nationalId: (() => {
      const normalized = normalizeString(child?.nationalId);
      if (normalized) {
        ensureNationalId(normalized, "الرقم القومي للابن");
      }
      return normalized;
    })(),
    school: normalizeString(child?.school),
    educationStage: normalizeString(child?.educationStage),
    maritalStatus,
    spouse,
    healthStatus,
    healthCertificationImage,
  };
};

const sanitizeSpouse = (spouse?: SpousePayload) => {
  if (!spouse) {
    return undefined;
  }

  const sanitized: SpousePayload = {
    name: normalizeString(spouse.name),
    nationalId: normalizeString(spouse.nationalId),
    phone: normalizeString(spouse.phone),
    whatsapp: normalizeString(spouse.whatsapp),
  };

  if (sanitized.name) {
    ensureName(sanitized.name, "اسم الزوج/الزوجة");
  }
  if (sanitized.nationalId) {
    ensureNationalId(sanitized.nationalId, "الرقم القومي للزوج/الزوجة");
  }
  if (sanitized.phone) {
    ensurePhone(sanitized.phone, "هاتف الزوج/الزوجة");
  }
  if (sanitized.whatsapp) {
    ensurePhone(sanitized.whatsapp, "واتساب الزوج/الزوجة");
  }

  const hasValue = Object.values(sanitized).some(Boolean);
  return hasValue ? sanitized : undefined;
};

const sanitizeRelationship = (relationship?: RelationshipPayload) => {
  if (!relationship) return null;
  const relation = allowedRelationshipTypes.includes(
    relationship.relation as RelationshipType
  )
    ? (relationship.relation as RelationshipType)
    : null;
  const relativeName = normalizeString(relationship.relativeName);

  if (!relation || !relativeName) {
    return null;
  }

  ensureName(relativeName, "اسم ذي القرابة");

  const relativeNationalId = normalizeString(relationship.relativeNationalId);
  if (relativeNationalId) {
    ensureNationalId(relativeNationalId, "الرقم القومي لذي القرابة");
  }

  return {
    relation,
    relativeName,
    relativeNationalId,
  } satisfies SanitizedRelationship;
};

const clampPriority = (priority?: number) => {
  if (priority === undefined) {
    return 5;
  }
  return Math.min(10, Math.max(1, priority));
};

export const sanitizeBeneficiaryPayload = (
  body: Record<string, unknown>
): SanitizedBeneficiaryPayload => {
  const maritalStatus = allowedMaritalStatuses.includes(
    body?.maritalStatus as MaritalStatus
  )
    ? (body.maritalStatus as MaritalStatus)
    : "single";

  const rawName = normalizeRequiredString(body?.name);
  ensureName(rawName, "اسم المستفيد");

  const rawBeneficiaryId = normalizeRequiredString(body?.nationalId);
  ensureNationalId(rawBeneficiaryId, "رقم المستفيد");

  const rawNationalId = normalizeRequiredString(body?.phone);
  ensureNationalId(rawNationalId, "الرقم القومي");

  const rawWhatsapp = normalizeRequiredString(body?.whatsapp);
  ensurePhone(rawWhatsapp, "رقم الواتساب");

  const rawAddress = normalizeRequiredString(body?.address);
  if (!rawAddress || rawAddress.length < ADDRESS_MIN_LENGTH) {
    throw new Error("العنوان يجب أن يحتوي على 5 أحرف على الأقل");
  }

  const familyMembers = Math.max(1, normalizeNumber(body?.familyMembers) ?? 1);
  const income = normalizeNumber(body?.income);
  const priority = clampPriority(normalizeNumber(body?.priority));

  const children = Array.isArray(body?.children)
    ? (body.children as ChildPayload[])
        .map(sanitizeChild)
        .filter((child): child is NonNullable<ReturnType<typeof sanitizeChild>> => Boolean(child))
    : [];

  const spouse = maritalStatus === "married"
    ? sanitizeSpouse(body?.spouse as SpousePayload)
    : undefined;

  const relationships = Array.isArray(body?.relationships)
    ? (body.relationships as RelationshipPayload[])
        .map(sanitizeRelationship)
        .filter((relationship): relationship is NonNullable<ReturnType<typeof sanitizeRelationship>> => Boolean(relationship))
    : [];

  const healthStatus = ["healthy", "sick"].includes(body?.healthStatus as string)
    ? (body?.healthStatus as "healthy" | "sick")
    : "healthy";

  const housingType = ["owned", "rented"].includes(body?.housingType as string)
    ? (body?.housingType as "owned" | "rented")
    : "owned";

  const rentalCost = housingType === "rented" ? normalizeNumber(body?.rentalCost) : undefined;
  const employment = normalizeString(body?.employment);
  const healthCertificationImage = healthStatus === "sick" ? ((body?.healthCertificationImage as string) || "") : "";

  return {
    name: rawName,
    nationalId: rawBeneficiaryId,
    phone: rawNationalId,
    whatsapp: rawWhatsapp,
    address: rawAddress,
    familyMembers,
    maritalStatus,
    income,
    priority,
    profileImage: (body?.profileImage as string) || "",
    idImage: maritalStatus === "married" ? ((body?.idImage as string) || "") : "",
    notes: (body?.notes as string) ?? "",
    healthStatus,
    healthCertificationImage,
    housingType,
    rentalCost,
    employment,
    spouse,
    children,
    relationships,
  };
};
