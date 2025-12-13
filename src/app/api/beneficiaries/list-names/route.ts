import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Beneficiary from "@/lib/models/Beneficiary";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (query.trim().length < 2) {
      return NextResponse.json({ listNames: [] });
    }

    // Get distinct list names that match the query
    const listNames = await Beneficiary.distinct("listName", {
      listName: { $regex: query, $options: "i" },
    });

    // Filter out null/undefined and sort
    const filtered = listNames
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b, "ar"));

    return NextResponse.json({ listNames: filtered });
  } catch (error) {
    console.error("Error fetching list names:", error);
    return NextResponse.json(
      { error: "Failed to fetch list names" },
      { status: 500 }
    );
  }
}
