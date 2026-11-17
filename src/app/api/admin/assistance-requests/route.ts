import { NextResponse } from "next/server";
import { requireAssistanceReadAccess } from "@/lib/assistance/auth";
import { executeAdminAssistanceListQuery } from "@/lib/assistance/admin-queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const authCheck = await requireAssistanceReadAccess();
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    const { searchParams } = new URL(request.url);

    // Note: National ID filtering is intentionally accepted ONLY via POST /query
    // to ensure plaintext National IDs never appear in server/browser URL logs.
    const result = await executeAdminAssistanceListQuery({
      authResult: authCheck.authResult,
      branchIdOverride: searchParams.get("branchId"),
      page: Number(searchParams.get("page") || 1),
      limit: Number(searchParams.get("limit") || 20),
      filters: {
        searchName: searchParams.get("searchName") || undefined,
        searchPhone: searchParams.get("searchPhone") || undefined,
        dateFrom: searchParams.get("dateFrom") || undefined,
        dateTo: searchParams.get("dateTo") || undefined,
        status: searchParams.get("status") || undefined,
        verificationStatus: searchParams.get("verificationStatus") || undefined,
        relationshipType: searchParams.get("relationshipType") || undefined,
        assignedReviewerId: searchParams.get("assignedReviewerId") || undefined,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing assistance requests:", error);
    return NextResponse.json(
      { error: "تعذر تحميل قائمة طلبات المساعدة" },
      { status: 500 }
    );
  }
}
