import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import MarriageCase from "@/lib/models/MarriageCase";
import Beneficiary from "@/lib/models/Beneficiary";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";
import { getActorName } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const authResult = await getAuthenticatedUser();

    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const beneficiaryId = searchParams.get("beneficiaryId");

    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);

    // Auto-sync: Find any existing beneficiaries with acceptsMarriage: true who do not have a MarriageCase yet
    try {
      const beneficiariesWithFlag = await Beneficiary.find({
        ...branchFilter,
        acceptsMarriage: true,
      })
        .select("name nationalId phone address branch branchName marriageDetails marriageCertificateImage children")
        .lean();

      if (beneficiariesWithFlag.length > 0) {
        const existingCasesBeneficiaries = await MarriageCase.distinct("beneficiary", {
          ...branchFilter,
        });
        const existingBenSet = new Set(
          existingCasesBeneficiaries.map((id: any) => id?.toString())
        );

        const toCreate = [];
        for (const b of beneficiariesWithFlag) {
          if (!existingBenSet.has(b._id.toString())) {
            let personName = "مقبل على الزواج (قيد استكمال البيانات)";
            let relationship: any = "daughter";
            if (b.children && b.children.length > 0) {
              const singleChild =
                b.children.find((c: any) => c.maritalStatus === "single") || b.children[0];
              if (singleChild?.name) {
                personName = singleChild.name;
                relationship = singleChild.gender === "female" ? "daughter" : "son";
              }
            }

            toCreate.push({
              beneficiary: b._id,
              beneficiaryName: b.name,
              beneficiaryNationalId: b.nationalId,
              beneficiaryPhone: b.phone,
              beneficiaryAddress: b.address,
              personName,
              relationship,
              status: "pending",
              itemsProvided: [],
              cashAssistance: 0,
              totalCost: 0,
              certificateImage: b.marriageCertificateImage || "",
              notes: b.marriageDetails || "مستفيد لديه ابن/ابنة مقبل على الزواج (مسجل سابقاً)",
              branch: b.branch,
              branchName: b.branchName,
              createdBy: "النظام (استيراد تلقائي)",
            });
          }
        }

        if (toCreate.length > 0) {
          await MarriageCase.insertMany(toCreate);
        }
      }
    } catch (syncErr) {
      console.error("Error auto-syncing existing marriage beneficiaries:", syncErr);
    }

    const query: any = { ...branchFilter };

    if (status && status !== "all") {
      query.status = status;
    }

    if (beneficiaryId) {
      query.beneficiary = beneficiaryId;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { beneficiaryName: { $regex: s, $options: "i" } },
        { personName: { $regex: s, $options: "i" } },
        { beneficiaryNationalId: { $regex: s, $options: "i" } },
        { phone: { $regex: s, $options: "i" } },
        { beneficiaryPhone: { $regex: s, $options: "i" } },
        { spouseName: { $regex: s, $options: "i" } },
      ];
    }

    const cases = await MarriageCase.find(query)
      .populate("beneficiary", "name internalId phone nationalId address category monthlyAllowanceAmount")
      .sort({ createdAt: -1 })
      .lean();

    // Summary stats for the branch scope
    const allBranchCases = await MarriageCase.find(branchFilter).select("status totalCost").lean();
    const stats = {
      total: allBranchCases.length,
      pending: allBranchCases.filter((c: any) => c.status === "pending").length,
      inProgress: allBranchCases.filter((c: any) => c.status === "in_progress").length,
      completed: allBranchCases.filter((c: any) => c.status === "completed").length,
      cancelled: allBranchCases.filter((c: any) => c.status === "cancelled").length,
      totalCost: allBranchCases
        .filter((c: any) => c.status !== "cancelled")
        .reduce((sum: number, c: any) => sum + (c.totalCost || 0), 0),
    };

    return NextResponse.json({
      cases,
      stats,
      branch: authResult.branchName,
    });
  } catch (error) {
    console.error("Error fetching marriage cases:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب حالات تيسير الزواج" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const authResult = await getAuthenticatedUser();

    if (!authResult.isAuthorized || (!authResult.isAdmin && !authResult.isMember)) {
      return NextResponse.json({ error: "غير مصرح لك بتسجيل حالات" }, { status: 403 });
    }

    const body = await req.json();
    const {
      beneficiaryId,
      personName,
      relationship = "daughter",
      nationalId,
      phone,
      spouseName,
      marriageDate,
      status = "pending",
      itemsProvided = [],
      cashAssistance = 0,
      certificateImage = "",
      notes = "",
    } = body;

    if (!beneficiaryId || !personName || !personName.trim()) {
      return NextResponse.json(
        { error: "المستفيد واسم الشخص المقبل على الزواج مطلوبان" },
        { status: 400 }
      );
    }

    const beneficiary = await Beneficiary.findById(beneficiaryId);
    if (!beneficiary) {
      return NextResponse.json({ error: "المستفيد غير موجود" }, { status: 404 });
    }

    // Calculate total cost
    const itemsTotal = (itemsProvided || []).reduce(
      (sum: number, item: any) => sum + (Number(item.cost || 0) * Number(item.quantity || 1)),
      0
    );
    const totalCost = itemsTotal + Number(cashAssistance || 0);

    const branch = beneficiary.branch || authResult.branch;
    const branchName = beneficiary.branchName || authResult.branchName;

    const newCase = await MarriageCase.create({
      beneficiary: beneficiary._id,
      beneficiaryName: beneficiary.name,
      beneficiaryNationalId: beneficiary.nationalId,
      beneficiaryPhone: beneficiary.phone,
      beneficiaryAddress: beneficiary.address,
      personName: personName.trim(),
      relationship,
      nationalId: nationalId ? String(nationalId).trim() : "",
      phone: phone ? String(phone).trim() : "",
      spouseName: spouseName ? String(spouseName).trim() : "",
      marriageDate: marriageDate ? new Date(marriageDate) : undefined,
      status,
      itemsProvided: (itemsProvided || []).map((item: any) => ({
        itemName: String(item.itemName || "").trim(),
        quantity: Number(item.quantity || 1),
        cost: Number(item.cost || 0),
        notes: item.notes ? String(item.notes).trim() : "",
        deliveredAt: item.deliveredAt ? new Date(item.deliveredAt) : undefined,
      })),
      cashAssistance: Number(cashAssistance || 0),
      totalCost,
      certificateImage: certificateImage ? String(certificateImage).trim() : "",
      notes: notes ? String(notes).trim() : "",
      branch,
      branchName,
      createdBy: getActorName(authResult),
      completedAt: status === "completed" ? new Date() : undefined,
    });

    // Make sure beneficiary acceptsMarriage flag is true and sync certificate if available
    const benUpdate: any = { acceptsMarriage: true };
    if (certificateImage && !beneficiary.marriageCertificateImage) {
      benUpdate.marriageCertificateImage = certificateImage;
    }
    await Beneficiary.findByIdAndUpdate(beneficiaryId, benUpdate);

    return NextResponse.json({ success: true, case: newCase }, { status: 201 });
  } catch (error) {
    console.error("Error creating marriage case:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حفظ حالة تيسير الزواج" },
      { status: 500 }
    );
  }
}

