import { BeneficiaryFormValues, Child, RelationshipEntry, SpouseDetails, createEmptySpouse } from "./components/BeneficiaryForm";

export const createBlankFormValues = (): BeneficiaryFormValues => ({
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
  spouse: createEmptySpouse(),
  children: [],
  relationships: [],
});

export const mapRelationships = (input: any): RelationshipEntry[] => {
  if (!Array.isArray(input)) return [];

  return input.map((relationship: any) => {
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

export const mapChildren = (input: any): Child[] => {
  if (!Array.isArray(input)) return [];

  return input.map((child: any) => ({
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

export const mapBeneficiaryToForm = (record: any): BeneficiaryFormValues | undefined => {
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
}
