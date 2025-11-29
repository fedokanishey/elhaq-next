type MaritalStatus = "single" | "married" | "divorced" | "widowed";

interface ChildPayload {
  name?: string;
  nationalId?: string;
  school?: string;
  educationStage?: string;
}

interface SpousePayload {
  name?: string;
  nationalId?: string;
  phone?: string;
  whatsapp?: string;
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
  spouse?: SpousePayload;
  children: Array<Required<Pick<ChildPayload, "name">> & Omit<ChildPayload, "name">>;
}

const allowedMaritalStatuses: MaritalStatus[] = [
  "single",
  "married",
  "divorced",
  "widowed",
];

const normalizeString = (value: unknown) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const str = String(value).trim();
  return str || undefined;
};

const normalizeRequiredString = (value: unknown) => String(value ?? "").trim();

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

  return {
    name,
    nationalId: normalizeString(child?.nationalId),
    school: normalizeString(child?.school),
    educationStage: normalizeString(child?.educationStage),
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

  const hasValue = Object.values(sanitized).some(Boolean);
  return hasValue ? sanitized : undefined;
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

  const familyMembers = normalizeNumber(body?.familyMembers) ?? 1;
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

  return {
    name: normalizeRequiredString(body?.name),
    nationalId: normalizeRequiredString(body?.nationalId),
    phone: normalizeRequiredString(body?.phone),
    whatsapp: normalizeRequiredString(body?.whatsapp),
    address: normalizeRequiredString(body?.address),
    familyMembers,
    maritalStatus,
    income,
    priority,
    profileImage: (body?.profileImage as string) || "",
    idImage: maritalStatus === "married" ? ((body?.idImage as string) || "") : "",
    notes: (body?.notes as string) ?? "",
    spouse,
    children,
  };
};
