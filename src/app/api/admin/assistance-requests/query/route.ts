import { NextResponse } from "next/server";
import { requireAssistanceReadAccess } from "@/lib/assistance/auth";
import { executeAdminAssistanceListQuery } from "@/lib/assistance/admin-queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authCheck = await requireAssistanceReadAccess();
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const result = await executeAdminAssistanceListQuery({
      authResult: authCheck.authResult,
      branchIdOverride:
        typeof body.branchId === "string" ? body.branchId : undefined,
      page: typeof body.page === "number" ? body.page : 1,
      limit: typeof body.limit === "number" ? body.limit : 20,
      filters: {
        searchName: typeof body.searchName === "string" ? body.searchName : undefined,
        searchPhone:
          typeof body.searchPhone === "string" ? body.searchPhone : undefined,
        searchNationalId:
          typeof body.searchNationalId === "string"
            ? body.searchNationalId
            : undefined,
        dateFrom: typeof body.dateFrom === "string" ? body.dateFrom : undefined,
        dateTo: typeof body.dateTo === "string" ? body.dateTo : undefined,
        status: typeof body.status === "string" ? body.status : undefined,
        verificationStatus:
          typeof body.verificationStatus === "string"
            ? body.verificationStatus
            : undefined,
        relationshipType:
          typeof body.relationshipType === "string"
            ? body.relationshipType
            : undefined,
        assignedReviewerId:
          typeof body.assignedReviewerId === "string"
            ? body.assignedReviewerId
            : undefined,
      },
    });

    return NextResponse.json(result);
  } catch {
    console.error("Error querying assistance requests");
    return NextResponse.json(
      { error: "تعذر تصفية طلبات المساعدة" },
      { status: 500 }
    );
  }
}
