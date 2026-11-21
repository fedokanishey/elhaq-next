import {
  ASSISTANCE_CATEGORIES,
  ASSISTANCE_CATEGORY_CUSTOM_MAX_LENGTH,
  type AssistanceCategory,
  type ApplicantMaritalStatus,
  MARITAL_STATUS_VALUES,
  type ValidatedAssistanceSubmission,
} from "./types";

const FULL_NAME_REGEX =
  /^(?:[\u0600-\u06FFa-zA-Z]{2,})(?:[\s'-][\u0600-\u06FFa-zA-Z]+)+$/;
const NATIONAL_ID_EXACT_REGEX = /^\d{14}$/;
const PHONE_REGEX = /^\+?\d{10,13}$/;
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const CLOUDINARY_URL_PREFIX = "https://res.cloudinary.com/";

export class ValidationError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

function asTrimmedString(val: unknown): string {
  if (typeof val !== "string") return "";
  return val.trim();
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Validates and sanitizes applicant submission without inspecting or leaking database match state.
 * Preserves leading zeros on nationalId by requiring strict string representation.
 */
export function validateAssistanceSubmission(
  rawBody: unknown
): ValidatedAssistanceSubmission {
  if (!isPlainObject(rawBody)) {
    throw new ValidationError("بيانات الطلب غير صالحة");
  }

  // Enforce string type on nationalId to ensure leading zeros were never stripped by numeric JSON coercion
  if (typeof rawBody.nationalId !== "string") {
    throw new ValidationError(
      "الرقم القومي يجب أن يُرسل كنص مكوّن من 14 رقماً للحفاظ على الأصفار البادئة",
      "nationalId"
    );
  }

  const fullName = asTrimmedString(rawBody.fullName).replace(/\s+/g, " ");
  if (fullName.length < 3 || fullName.length > 120) {
    throw new ValidationError(
      "يرجى إدخال الاسم الكامل بشكل صحيح (من 3 إلى 120 حرفاً)",
      "fullName"
    );
  }
  if (!FULL_NAME_REGEX.test(fullName)) {
    throw new ValidationError(
      "يرجى إدخال الاسم ثنائياً على الأقل وبأحرف صحيحة فقط",
      "fullName"
    );
  }

  const nationalId = rawBody.nationalId.trim();
  if (!NATIONAL_ID_EXACT_REGEX.test(nationalId)) {
    throw new ValidationError(
      "الرقم القومي يجب أن يتكون من 14 رقماً بالضبط",
      "nationalId"
    );
  }

  const phone = asTrimmedString(rawBody.phone).replace(/\s+/g, "");
  if (!PHONE_REGEX.test(phone)) {
    throw new ValidationError(
      "رقم الموبايل يجب أن يتكون من 10 إلى 13 رقماً صحيحاً",
      "phone"
    );
  }

  let whatsapp: string | undefined;
  if (rawBody.whatsapp !== undefined && rawBody.whatsapp !== null && rawBody.whatsapp !== "") {
    const cleanWa = asTrimmedString(rawBody.whatsapp).replace(/\s+/g, "");
    if (!PHONE_REGEX.test(cleanWa)) {
      throw new ValidationError(
        "رقم الواتساب يجب أن يتكون من 10 إلى 13 رقماً صحيحاً",
        "whatsapp"
      );
    }
    whatsapp = cleanWa;
  }

  const address = asTrimmedString(rawBody.address);
  if (address.length < 5 || address.length > 300) {
    throw new ValidationError(
      "يرجى إدخال العنوان بالتفصيل (5 أحرف على الأقل)",
      "address"
    );
  }

  const rawCategory = asTrimmedString(rawBody.assistanceCategory);
  let category: AssistanceCategory;
  let categoryCustom: string | undefined;

  if (ASSISTANCE_CATEGORIES.includes(rawCategory as AssistanceCategory)) {
    category = rawCategory as AssistanceCategory;
    if (category === "other") {
      const custom = asTrimmedString(rawBody.assistanceCategoryCustom);
      if (custom) {
        if (custom.length > ASSISTANCE_CATEGORY_CUSTOM_MAX_LENGTH) {
          throw new ValidationError(
            `نوع المساعدة المكتوب طويل جداً (الحد الأقصى ${ASSISTANCE_CATEGORY_CUSTOM_MAX_LENGTH} حرفاً)`,
            "assistanceCategory"
          );
        }
        categoryCustom = custom;
      }
    }
  } else if (rawCategory) {
    // A free-text category typed by the applicant (not one of the predefined options)
    if (rawCategory.length < 2) {
      throw new ValidationError(
        "يرجى كتابة نوع المساعدة المطلوبة (حرفان على الأقل)",
        "assistanceCategory"
      );
    }
    if (rawCategory.length > ASSISTANCE_CATEGORY_CUSTOM_MAX_LENGTH) {
      throw new ValidationError(
        `نوع المساعدة المكتوب طويل جداً (الحد الأقصى ${ASSISTANCE_CATEGORY_CUSTOM_MAX_LENGTH} حرفاً)`,
        "assistanceCategory"
      );
    }
    category = "other";
    categoryCustom = rawCategory;
  } else {
    throw new ValidationError(
      "يرجى اختيار أو كتابة نوع المساعدة المطلوبة",
      "assistanceCategory"
    );
  }

  const description = asTrimmedString(rawBody.description);
  if (description.length < 10 || description.length > 3000) {
    throw new ValidationError(
      "يرجى كتابة شرح وافٍ للحالة (10 أحرف على الأقل)",
      "description"
    );
  }

  let maritalStatus: ApplicantMaritalStatus | undefined;
  if (
    rawBody.maritalStatus !== undefined &&
    rawBody.maritalStatus !== null &&
    rawBody.maritalStatus !== ""
  ) {
    const ms = asTrimmedString(rawBody.maritalStatus);
    if (!MARITAL_STATUS_VALUES.includes(ms as ApplicantMaritalStatus)) {
      throw new ValidationError("الحالة الاجتماعية المختارة غير صالحة", "maritalStatus");
    }
    maritalStatus = ms as ApplicantMaritalStatus;
  }

  let familyMembersCount: number | undefined;
  if (
    rawBody.familyMembersCount !== undefined &&
    rawBody.familyMembersCount !== null &&
    rawBody.familyMembersCount !== ""
  ) {
    const parsed = Number(rawBody.familyMembersCount);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
      throw new ValidationError(
        "عدد أفراد الأسرة يجب أن يكون رقماً صحيحاً بين 1 و 30",
        "familyMembersCount"
      );
    }
    familyMembersCount = parsed;
  }

  let monthlyIncome: number | undefined;
  if (
    rawBody.monthlyIncome !== undefined &&
    rawBody.monthlyIncome !== null &&
    rawBody.monthlyIncome !== ""
  ) {
    const parsed = Number(rawBody.monthlyIncome);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) {
      throw new ValidationError("الدخل الشهري المدخل غير صالح", "monthlyIncome");
    }
    monthlyIncome = parsed;
  }

  let branchId: string | undefined;
  if (
    rawBody.branchId !== undefined &&
    rawBody.branchId !== null &&
    rawBody.branchId !== ""
  ) {
    const cleanBranch = asTrimmedString(rawBody.branchId);
    if (!OBJECT_ID_REGEX.test(cleanBranch)) {
      throw new ValidationError("معرف الفرع المختار غير صالح", "branchId");
    }
    branchId = cleanBranch;
  }

  const attachments: string[] = [];
  if (rawBody.attachments !== undefined && rawBody.attachments !== null) {
    if (!Array.isArray(rawBody.attachments)) {
      throw new ValidationError("صيغة المرفقات غير صالحة", "attachments");
    }
    if (rawBody.attachments.length > 3) {
      throw new ValidationError("الحد الأقصى للمرفقات هو 3 ملفات", "attachments");
    }
    for (const item of rawBody.attachments) {
      if (typeof item !== "string" || item.length > 500) {
        throw new ValidationError("رابط المرفق غير مصرح به", "attachments");
      }
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(item);
      } catch {
        throw new ValidationError("رابط المرفق غير مصرح به", "attachments");
      }
      if (
        parsedUrl.protocol !== "https:" ||
        parsedUrl.hostname !== "res.cloudinary.com" ||
        !item.startsWith(CLOUDINARY_URL_PREFIX)
      ) {
        throw new ValidationError("رابط المرفق غير مصرح به", "attachments");
      }
      attachments.push(item);
    }
  }

  return {
    fullName,
    nationalId,
    phone,
    whatsapp,
    address,
    assistanceCategory: category,
    assistanceCategoryCustom: categoryCustom,
    description,
    maritalStatus,
    familyMembersCount,
    monthlyIncome,
    branchId,
    attachments,
  };
}
