export const VERIFICATION_STATUSES = [
  "matched_primary_beneficiary",
  "matched_spouse",
  "matched_child",
  "matched_other_dependent",
  "not_matched",
  "manual_review",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const APPLICANT_RELATIONSHIP_TYPES = [
  "primary_beneficiary",
  "beneficiary_spouse",
  "beneficiary_child",
  "other_dependent",
  "unknown",
] as const;

export type ApplicantRelationshipType =
  (typeof APPLICANT_RELATIONSHIP_TYPES)[number];

export const REQUEST_STATUSES = [
  "new",
  "under_review",
  "reviewed",
  "approved",
  "rejected",
  "completed",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_PRIORITY_MAP: Record<RequestStatus, number> = {
  new: 1,
  under_review: 2,
  reviewed: 3,
  approved: 4,
  rejected: 4,
  completed: 4,
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "طلب جديد",
  under_review: "قيد المراجعة",
  reviewed: "تمت المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
  completed: "مكتمل",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  matched_primary_beneficiary: "المستفيد الأساسي",
  matched_spouse: "زوج المستفيد / زوجة المستفيدة",
  matched_child: "ابن المستفيد / ابنة المستفيدة",
  matched_other_dependent: "قريب / عائل مسجل بملف أسرة",
  not_matched: "غير مرتبط بمستفيد مسجل",
  manual_review: "يحتاج إلى مراجعة يدوية",
};

export const RELATIONSHIP_TYPE_LABELS: Record<ApplicantRelationshipType, string> = {
  primary_beneficiary: "المستفيد الأساسي",
  beneficiary_spouse: "زوج / زوجة المستفيد",
  beneficiary_child: "ابن / ابنة المستفيد",
  other_dependent: "قريب مسجل بالملف",
  unknown: "غير محدد",
};

export const ASSISTANCE_CATEGORIES = [
  "financial_aid",
  "monthly_allowance",
  "food_supply",
  "medical_aid",
  "marriage_aid",
  "education_aid",
  "housing_aid",
  "debt_relief",
  "qard_hasan",
  "other",
] as const;

export type AssistanceCategory = (typeof ASSISTANCE_CATEGORIES)[number];

export const ASSISTANCE_CATEGORY_LABELS: Record<AssistanceCategory, string> = {
  financial_aid: "مساعدة مالية عاجلة",
  monthly_allowance: "إعانة شهرية",
  food_supply: "سلع غذائية وتموينية",
  medical_aid: "مساعدة طبية وعلاج",
  marriage_aid: "تيسير زواج وتجهيز عرائس",
  education_aid: "مصروفات ومستلزمات دراسية",
  housing_aid: "إيجار أو ترميم سكن",
  debt_relief: "فك كرب وسداد ديون",
  qard_hasan: "قرض حسن",
  other: "أخرى",
};

export const VERIFICATION_WARNING_CODES = [
  "duplicate_national_id",
  "conflicting_relationship_types",
  "multiple_possible_matches",
  "invalid_primary_beneficiary",
  "incomplete_matched_person_data",
  "inconsistent_family_relationship",
  "beneficiary_inactive",
  "beneficiary_pending",
  "verification_source_unavailable",
  "duplicate_open_request",
] as const;

export type VerificationWarningCode = (typeof VERIFICATION_WARNING_CODES)[number];

export const VERIFICATION_WARNING_LABELS: Record<VerificationWarningCode, string> = {
  duplicate_national_id: "الرقم القومي مسجل في أكثر من سجل مستفيد",
  conflicting_relationship_types:
    "الرقم القومي يظهر بصفات قرابة متعارضة (مثلاً مستفيد أساسي وفرد أسرة في سجل آخر)",
  multiple_possible_matches:
    "توجد عدة تطابقات محتملة تتطلب تحديداً يدوياً من المسؤول",
  invalid_primary_beneficiary: "بيانات المستفيد الأساسي المرتبط غير مكتملة أو مفقودة",
  incomplete_matched_person_data:
    "بيانات الفرد المطابق داخل ملف الأسرة غير مكتملة (الاسم مفقود)",
  inconsistent_family_relationship:
    "تعارض في بيانات الأسرة المسجلة (مثل وجود بيانات زوج لحالة اجتماعية غير متزوج، أو تعارض رقم الهوية)",
  beneficiary_inactive: "ملف المستفيد المرتبط في حالة ملغى / غير نشط",
  beneficiary_pending: "ملف المستفيد المرتبط ما زال في حالة انتظار",
  verification_source_unavailable:
    "تعذر الوصول إلى سجل المستفيدين وقت تقديم الطلب — يرجى إعادة الفحص أو المراجعة اليدوية",
  duplicate_open_request: "يوجد طلب مساعدة آخر مفتوح حالياً لنفس الرقم القومي",
};

export const MARITAL_STATUS_VALUES = [
  "single",
  "married",
  "divorced",
  "widowed",
] as const;

export type ApplicantMaritalStatus = (typeof MARITAL_STATUS_VALUES)[number];

export const MARITAL_STATUS_LABELS: Record<ApplicantMaritalStatus, string> = {
  single: "أعزب / عزباء",
  married: "متزوج / متزوجة",
  divorced: "مطلق / مطلقة",
  widowed: "أرمل / أرملة",
};

export type MatchedPersonType =
  | "primary"
  | "spouse"
  | "child"
  | "child_spouse"
  | "relative";

export interface MatchedPersonInfo {
  name?: string;
  personType: MatchedPersonType;
  subId?: string;
  specificRelation?: string;
  gender?: "male" | "female";
  relatedViaName?: string;
}

export interface BeneficiarySnapshot {
  name: string;
  internalId?: string;
  status?: string;
  branchId?: string;
  branchName?: string;
}

export interface CandidateMatchSummary {
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryInternalId?: string;
  beneficiaryStatus?: string;
  branchName?: string;
  verificationType: Exclude<VerificationStatus, "not_matched" | "manual_review">;
  relationshipType: Exclude<ApplicantRelationshipType, "unknown">;
  matchedPerson: MatchedPersonInfo;
  warnings: VerificationWarningCode[];
}

export interface VerificationEvaluation {
  verificationStatus: VerificationStatus;
  relationshipType: ApplicantRelationshipType;
  beneficiaryId: string | null;
  beneficiarySnapshot: BeneficiarySnapshot | null;
  matchedPerson: MatchedPersonInfo | null;
  warnings: VerificationWarningCode[];
  candidateMatches: CandidateMatchSummary[];
}

export type AssistanceAuditAction =
  | "status_changed"
  | "note_added"
  | "national_id_revealed"
  | "manual_verification_resolved"
  | "verification_rerun"
  | "reviewer_assigned";

export interface ValidatedAssistanceSubmission {
  fullName: string;
  nationalId: string;
  phone: string;
  whatsapp?: string;
  address: string;
  assistanceCategory: AssistanceCategory;
  description: string;
  maritalStatus?: ApplicantMaritalStatus;
  familyMembersCount?: number;
  monthlyIncome?: number;
  branchId?: string;
  attachments: string[];
}
