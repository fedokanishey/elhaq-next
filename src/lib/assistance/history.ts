import type { ApplicantRelationshipType } from "./types";

export type HistoryScope = "individual" | "family_level";

export type HistorySourceType =
  | "treasury_transaction"
  | "initiative"
  | "marriage_case"
  | "loan"
  | "assistance_request"
  | "monthly_allowance_profile";

export interface HistoryEntry {
  id: string;
  source: HistorySourceType;
  scope: HistoryScope;
  scopeLabel: string;
  title: string;
  category?: string;
  amount?: number;
  status?: string;
  date: string;
  description?: string;
  recipientNote?: string;
}

export interface PrimaryBeneficiaryHistoryContext {
  _id: string;
  name: string;
  internalId?: string;
  nationalId?: string;
  receivesMonthlyAllowance?: boolean;
  monthlyAllowanceAmount?: number;
  loanDetails?: {
    loanId?: unknown;
    amount?: number;
    status?: string;
  };
}

export interface RawTreasuryExpenseForHistory {
  _id: unknown;
  amount: number;
  description: string;
  category?: string;
  transactionDate: Date | string;
  beneficiaryIds?: unknown[];
  beneficiaryShares?: Array<{
    beneficiaryId?: unknown;
    name?: string;
    amount?: number;
  }>;
  isMonthlyAllowance?: boolean;
}

export interface RawInitiativeForHistory {
  _id: unknown;
  name: string;
  description?: string;
  date: Date | string;
  totalAmount?: number;
  status: string;
  beneficiariesReceived?: unknown[];
  receivedLogs?: Array<{
    beneficiaryId?: unknown;
    receivedAt?: Date | string;
  }>;
}

export interface RawMarriageCaseForHistory {
  _id: unknown;
  beneficiary?: unknown;
  personName: string;
  relationship: "daughter" | "son" | "self" | "other" | string;
  nationalId?: string;
  status: string;
  cashAssistance?: number;
  totalCost: number;
  itemsProvided?: Array<{ itemName: string; quantity: number }>;
  marriageDate?: Date | string;
  completedAt?: Date | string;
  createdAt: Date | string;
}

export interface RawLoanForHistory {
  _id: unknown;
  beneficiaryName: string;
  nationalId?: string;
  amount: number;
  amountPaid: number;
  status: string;
  startDate: Date | string;
  notes?: string;
}

export interface RawPriorRequestForHistory {
  _id: unknown;
  assistanceCategory: string;
  status: string;
  createdAt: Date | string;
  nationalIdBlindIndex: string;
  fullName: string;
  relationshipType: ApplicantRelationshipType;
  description?: string;
}

export interface AssistanceHistoryReport {
  mode: "primary" | "family_member" | "unlinked";
  individualAssistance: HistoryEntry[];
  familyAssistance: HistoryEntry[];
  summary: {
    individualCount: number;
    familyCount: number;
    totalTreasuryShareAmount: number;
    receivesMonthlyAllowance: boolean;
    monthlyAllowanceAmount?: number;
  };
  limitationsNotice: string[];
}

const FAMILY_LEVEL_LABEL = "مساعدة على مستوى الأسرة";
const INDIVIDUAL_LEVEL_LABEL = "مساعدة مسجلة باسم المتقدم شخصياً";

function stringifyId(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && "toString" in val && typeof val.toString === "function") {
    const s = val.toString();
    return s !== "[object Object]" ? s : "";
  }
  return "";
}

function toIsoString(val?: Date | string | null): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function sortByDateDesc(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) => {
    const tA = a.date ? new Date(a.date).getTime() : 0;
    const tB = b.date ? new Date(b.date).getTime() : 0;
    return tB - tA;
  });
}

function computeTreasuryShare(
  tx: RawTreasuryExpenseForHistory,
  primaryBeneficiary?: PrimaryBeneficiaryHistoryContext | null
): number {
  const benId = primaryBeneficiary?._id || "";
  const exactShare = (tx.beneficiaryShares || []).find(
    (s) => stringifyId(s.beneficiaryId) === benId
  );

  if (exactShare && typeof exactShare.amount === "number") {
    return exactShare.amount;
  }

  const isMonthlyTx = Boolean(
    tx.isMonthlyAllowance ||
      (tx.category && (tx.category.includes("شهرية") || tx.category.includes("شهريات"))) ||
      (tx.description && (tx.description.includes("شهرية") || tx.description.includes("شهريات")))
  );

  if (
    isMonthlyTx &&
    primaryBeneficiary &&
    (primaryBeneficiary.monthlyAllowanceAmount || primaryBeneficiary.receivesMonthlyAllowance)
  ) {
    return primaryBeneficiary.monthlyAllowanceAmount || 0;
  }

  const count = tx.beneficiaryIds?.length || 1;
  return count > 0 ? Math.round(tx.amount / count) : tx.amount;
}

export interface ClassifyAssistanceHistoryParams {
  relationshipType: ApplicantRelationshipType;
  applicantNationalId?: string | null;
  applicantBlindIndex: string;
  currentRequestId: string;
  primaryBeneficiary?: PrimaryBeneficiaryHistoryContext | null;
  treasuryExpenses?: RawTreasuryExpenseForHistory[];
  initiatives?: RawInitiativeForHistory[];
  marriageCases?: RawMarriageCaseForHistory[];
  loans?: RawLoanForHistory[];
  priorRequests?: RawPriorRequestForHistory[];
}

const DEFAULT_LIMITATIONS_NOTICE = [
  "سجلات الخزينة (TreasuryTransaction) والمبادرات (Initiative) مرتبطة برقم ملف المستفيد الأساسي فقط ولا تسجل أي فرد استلم المساعدة فعلياً، ولذلك تُعرض كـ (مساعدة على مستوى الأسرة) ولا تُنسب شخصياً للزوج أو الأبناء.",
  "سجلات زكاة الأرز/المحاصيل (zk_distributions) تستخدم قائمة مستفيدين منفصلة بالاسم والهاتف دون رقم قومي أو ربط بملف المستفيد العام، لذا لا يتم ربطها تلقائياً تجنباً للتطابق غير الدقيق بالأسماء.",
  "حالات تيسير الزواج والقروض تُصنّف كمساعدة شخصية فقط إذا تطابق الرقم القومي المسجل بها تطابقاً تاماً مع الرقم القومي لمقدم الطلب.",
];

export function classifyAssistanceHistory(
  params: ClassifyAssistanceHistoryParams
): AssistanceHistoryReport {
  const {
    relationshipType,
    applicantNationalId,
    applicantBlindIndex,
    currentRequestId,
    primaryBeneficiary,
    treasuryExpenses = [],
    initiatives = [],
    marriageCases = [],
    loans = [],
    priorRequests = [],
  } = params;

  const isPrimary = relationshipType === "primary_beneficiary";
  const isFamilyMember =
    relationshipType === "beneficiary_spouse" ||
    relationshipType === "beneficiary_child" ||
    relationshipType === "other_dependent";

  const mode: AssistanceHistoryReport["mode"] = !primaryBeneficiary
    ? "unlinked"
    : isPrimary
    ? "primary"
    : isFamilyMember
    ? "family_member"
    : "unlinked";

  const individualAssistance: HistoryEntry[] = [];
  const familyAssistance: HistoryEntry[] = [];
  let totalTreasuryShareAmount = 0;

  const primaryId = primaryBeneficiary?._id || "";
  const primaryNationalId = primaryBeneficiary?.nationalId?.trim() || "";
  const exactApplicantNid = applicantNationalId?.trim() || "";

  // 1. Treasury Expenses (always bound to primaryBeneficiary._id only)
  for (const tx of treasuryExpenses) {
    const shareAmount = computeTreasuryShare(tx, primaryBeneficiary);
    totalTreasuryShareAmount += shareAmount;

    const entry: HistoryEntry = {
      id: stringifyId(tx._id),
      source: "treasury_transaction",
      scope: "family_level",
      scopeLabel: FAMILY_LEVEL_LABEL,
      title: tx.description || "صرف مساعدة من الخزينة",
      category: tx.category || (tx.isMonthlyAllowance ? "شهرية" : "عام"),
      amount: shareAmount,
      date: toIsoString(tx.transactionDate),
      description:
        (tx.beneficiaryIds?.length || 1) > 1
          ? `ضمن كشف صرف جماعي (${tx.beneficiaryIds?.length} أسرة) — حصة الملف: ${shareAmount} ج.م`
          : `صرف مباشر على ملف المستفيد — المبلغ: ${shareAmount} ج.م`,
      recipientNote: `المستفيد الأساسي: ${primaryBeneficiary?.name || "غير محدد"}`,
    };

    familyAssistance.push(entry);
  }

  // 2. Initiatives (bound to primaryBeneficiary._id only)
  for (const init of initiatives) {
    const received = (init.beneficiariesReceived || []).some(
      (id) => stringifyId(id) === primaryId
    );
    const receiptLog = (init.receivedLogs || []).find(
      (l) => stringifyId(l.beneficiaryId) === primaryId
    );

    const entry: HistoryEntry = {
      id: stringifyId(init._id),
      source: "initiative",
      scope: "family_level",
      scopeLabel: FAMILY_LEVEL_LABEL,
      title: init.name,
      category: "مبادرة خيرية",
      status: received ? "تم التسليم" : `مدرج بالمبادرة (${init.status})`,
      date: toIsoString(receiptLog?.receivedAt || init.date),
      description: init.description || undefined,
      recipientNote: `المستفيد الأساسي: ${primaryBeneficiary?.name || "غير محدد"}`,
    };

    familyAssistance.push(entry);
  }

  // 3. Marriage Cases (individual ONLY if mc.nationalId === exactApplicantNid, OR primary + relationship === 'self')
  for (const mc of marriageCases) {
    const mcNid = mc.nationalId?.trim() || "";
    const isExactApplicantMatch =
      Boolean(exactApplicantNid && mcNid && mcNid === exactApplicantNid) ||
      (isPrimary &&
        mc.relationship === "self" &&
        stringifyId(mc.beneficiary) === primaryId);

    const itemsSummary = (mc.itemsProvided || [])
      .map((item) => `${item.itemName} (${item.quantity})`)
      .join("، ");

    if (isExactApplicantMatch) {
      individualAssistance.push({
        id: stringifyId(mc._id),
        source: "marriage_case",
        scope: "individual",
        scopeLabel: INDIVIDUAL_LEVEL_LABEL,
        title: `تيسير زواج — ${mc.personName}`,
        category: "تيسير زواج",
        amount: mc.totalCost || mc.cashAssistance || 0,
        status: mc.status,
        date: toIsoString(mc.completedAt || mc.marriageDate || mc.createdAt),
        description: itemsSummary || undefined,
        recipientNote: `المستفيد الفعلي المسجل: ${mc.personName}`,
      });
    } else {
      familyAssistance.push({
        id: stringifyId(mc._id),
        source: "marriage_case",
        scope: "family_level",
        scopeLabel: FAMILY_LEVEL_LABEL,
        title: `تيسير زواج — ${mc.personName}`,
        category: "تيسير زواج",
        amount: mc.totalCost || mc.cashAssistance || 0,
        status: mc.status,
        date: toIsoString(mc.completedAt || mc.marriageDate || mc.createdAt),
        description: itemsSummary || undefined,
        recipientNote: mcNid
          ? `مساعدة لملف الأسرة باسم: ${mc.personName}`
          : `مساعدة على مستوى الأسرة (بدون رقم قومي فردي محدد) — ${mc.personName}`,
      });
    }
  }

  // 4. Loans (individual ONLY if loan.nationalId === exactApplicantNid)
  for (const loan of loans) {
    const loanNid = loan.nationalId?.trim() || "";
    const isExactLoanMatch = Boolean(
      exactApplicantNid && loanNid && loanNid === exactApplicantNid
    );

    if (isExactLoanMatch) {
      individualAssistance.push({
        id: stringifyId(loan._id),
        source: "loan",
        scope: "individual",
        scopeLabel: INDIVIDUAL_LEVEL_LABEL,
        title: `قرض حسن — ${loan.beneficiaryName}`,
        category: "قرض حسن",
        amount: loan.amount,
        status: loan.status,
        date: toIsoString(loan.startDate),
        description: `إجمالي القرض: ${loan.amount} ج.م — المسدد: ${loan.amountPaid} ج.م`,
        recipientNote: `مسجل بالرقم القومي لمقدم الطلب`,
      });
    } else if (
      primaryBeneficiary &&
      ((primaryNationalId && loanNid === primaryNationalId) ||
        stringifyId(primaryBeneficiary.loanDetails?.loanId) === stringifyId(loan._id))
    ) {
      familyAssistance.push({
        id: stringifyId(loan._id),
        source: "loan",
        scope: "family_level",
        scopeLabel: FAMILY_LEVEL_LABEL,
        title: `قرض حسن — ${loan.beneficiaryName}`,
        category: "قرض حسن",
        amount: loan.amount,
        status: loan.status,
        date: toIsoString(loan.startDate),
        description: `إجمالي القرض: ${loan.amount} ج.م — المسدد: ${loan.amountPaid} ج.م`,
        recipientNote: `مرتبط بملف المستفيد الأساسي: ${primaryBeneficiary.name}`,
      });
    }
  }

  // 5. Prior Assistance Requests
  for (const req of priorRequests) {
    const reqId = stringifyId(req._id);
    if (!reqId || reqId === currentRequestId) continue;

    if (req.nationalIdBlindIndex === applicantBlindIndex) {
      individualAssistance.push({
        id: reqId,
        source: "assistance_request",
        scope: "individual",
        scopeLabel: INDIVIDUAL_LEVEL_LABEL,
        title: `طلب مساعدة سابق (${req.assistanceCategory})`,
        category: req.assistanceCategory,
        status: req.status,
        date: toIsoString(req.createdAt),
        description: req.description ? req.description.slice(0, 140) : undefined,
        recipientNote: `مقدم من نفس الرقم القومي (${req.fullName})`,
      });
    } else if (primaryBeneficiary) {
      familyAssistance.push({
        id: reqId,
        source: "assistance_request",
        scope: "family_level",
        scopeLabel: FAMILY_LEVEL_LABEL,
        title: `طلب مساعدة سابق من فرد بالأسرة (${req.fullName})`,
        category: req.assistanceCategory,
        status: req.status,
        date: toIsoString(req.createdAt),
        description: req.description ? req.description.slice(0, 140) : undefined,
        recipientNote: `طلب سابق مرتبط بنفس ملف الأسرة`,
      });
    }
  }

  return {
    mode,
    individualAssistance: sortByDateDesc(individualAssistance),
    familyAssistance: sortByDateDesc(familyAssistance),
    summary: {
      individualCount: individualAssistance.length,
      familyCount: familyAssistance.length,
      totalTreasuryShareAmount,
      receivesMonthlyAllowance: Boolean(primaryBeneficiary?.receivesMonthlyAllowance),
      monthlyAllowanceAmount: primaryBeneficiary?.monthlyAllowanceAmount,
    },
    limitationsNotice: DEFAULT_LIMITATIONS_NOTICE,
  };
}

export async function loadAssistanceHistoryForRequest(params: {
  relationshipType: ApplicantRelationshipType;
  applicantNationalId?: string | null;
  applicantBlindIndex: string;
  currentRequestId: string;
  primaryBeneficiaryId?: string | null;
}): Promise<AssistanceHistoryReport> {
  const [
    { default: dbConnect },
    { default: Beneficiary },
    { default: TreasuryTransaction },
    { default: Initiative },
    { default: MarriageCase },
    { default: Loan },
    { default: AssistanceRequest },
  ] = await Promise.all([
    import("@/lib/mongodb"),
    import("@/lib/models/Beneficiary"),
    import("@/lib/models/TreasuryTransaction"),
    import("@/lib/models/Initiative"),
    import("@/lib/models/MarriageCase"),
    import("@/lib/models/Loan"),
    import("@/lib/models/AssistanceRequest"),
  ]);

  await dbConnect();

  let primaryBeneficiary: PrimaryBeneficiaryHistoryContext | null = null;
  if (params.primaryBeneficiaryId) {
    const rawBen = (await Beneficiary.findById(params.primaryBeneficiaryId)
      .select(
        "_id name internalId nationalId receivesMonthlyAllowance monthlyAllowanceAmount loanDetails"
      )
      .lean()) as {
      _id: unknown;
      name: string;
      internalId?: string;
      nationalId?: string;
      receivesMonthlyAllowance?: boolean;
      monthlyAllowanceAmount?: number;
      loanDetails?: { loanId?: unknown; amount?: number; status?: string };
    } | null;

    if (rawBen) {
      primaryBeneficiary = {
        _id: stringifyId(rawBen._id),
        name: rawBen.name,
        internalId: rawBen.internalId,
        nationalId: rawBen.nationalId,
        receivesMonthlyAllowance: rawBen.receivesMonthlyAllowance,
        monthlyAllowanceAmount: rawBen.monthlyAllowanceAmount,
        loanDetails: rawBen.loanDetails,
      };
    }
  }

  const benId = primaryBeneficiary?._id;
  const exactApplicantNid = params.applicantNationalId?.trim() || "";
  const primaryNid = primaryBeneficiary?.nationalId?.trim() || "";

  const loanOrClauses: Record<string, unknown>[] = [];
  if (exactApplicantNid) loanOrClauses.push({ nationalId: exactApplicantNid });
  if (primaryNid && primaryNid !== exactApplicantNid) {
    loanOrClauses.push({ nationalId: primaryNid });
  }
  if (primaryBeneficiary?.loanDetails?.loanId) {
    loanOrClauses.push({ _id: primaryBeneficiary.loanDetails.loanId });
  }

  const marriageOrClauses: Record<string, unknown>[] = [];
  if (benId) marriageOrClauses.push({ beneficiary: benId });
  if (exactApplicantNid) marriageOrClauses.push({ nationalId: exactApplicantNid });

  const requestOrClauses: Record<string, unknown>[] = [
    { nationalIdBlindIndex: params.applicantBlindIndex },
  ];
  if (benId) requestOrClauses.push({ beneficiary: benId });

  const [treasuryExpenses, initiatives, marriageCases, loans, priorRequests] =
    await Promise.all([
      benId
        ? TreasuryTransaction.find({
            beneficiaryIds: benId,
            type: "expense",
          })
            .sort({ transactionDate: -1 })
            .select(
              "_id amount description category transactionDate beneficiaryIds beneficiaryShares isMonthlyAllowance"
            )
            .lean()
        : Promise.resolve([]),
      benId
        ? Initiative.find({
            $or: [{ beneficiaries: benId }, { beneficiariesReceived: benId }],
          })
            .sort({ date: -1 })
            .select(
              "_id name description date totalAmount status beneficiariesReceived receivedLogs"
            )
            .lean()
        : Promise.resolve([]),
      marriageOrClauses.length > 0
        ? MarriageCase.find({ $or: marriageOrClauses })
            .sort({ createdAt: -1 })
            .select(
              "_id beneficiary personName relationship nationalId status cashAssistance totalCost itemsProvided marriageDate completedAt createdAt"
            )
            .lean()
        : Promise.resolve([]),
      loanOrClauses.length > 0
        ? Loan.find({
            deletedAt: null,
            $or: loanOrClauses,
          })
            .sort({ startDate: -1 })
            .select(
              "_id beneficiaryName nationalId amount amountPaid status startDate notes"
            )
            .lean()
        : Promise.resolve([]),
      AssistanceRequest.find({
        _id: { $ne: params.currentRequestId },
        $or: requestOrClauses,
      })
        .sort({ createdAt: -1 })
        .select(
          "_id assistanceCategory status createdAt nationalIdBlindIndex fullName relationshipType description"
        )
        .lean(),
    ]);

  return classifyAssistanceHistory({
    relationshipType: params.relationshipType,
    applicantNationalId: params.applicantNationalId,
    applicantBlindIndex: params.applicantBlindIndex,
    currentRequestId: params.currentRequestId,
    primaryBeneficiary,
    treasuryExpenses: treasuryExpenses as unknown as RawTreasuryExpenseForHistory[],
    initiatives: initiatives as unknown as RawInitiativeForHistory[],
    marriageCases: marriageCases as unknown as RawMarriageCaseForHistory[],
    loans: loans as unknown as RawLoanForHistory[],
    priorRequests: priorRequests as unknown as RawPriorRequestForHistory[],
  });
}
