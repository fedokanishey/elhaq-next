import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/mongodb";
import Product from "@/lib/models/Product";
import ProductOperation from "@/lib/models/ProductOperation";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getBranchFilterWithOverride } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await auth();
    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    const { searchParams } = new URL(req.url);
    const branchIdOverride = searchParams.get("branchId");
    const branchFilter = getBranchFilterWithOverride(authResult, branchIdOverride);
    const status = searchParams.get("status") || "active";
    
    const query: any = { 
      deletedAt: null, 
      ...branchFilter,
      ...(status !== "all" && { status })
    };

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Calculate stats
    const totalProducts = products.length;
    const totalCost = products.reduce((sum, p) => sum + (p.totalCost || 0), 0);
    const totalRevenue = products.reduce((sum, p) => sum + (p.totalRevenue || 0), 0);
    const totalQuantity = products.reduce((sum, p) => sum + (p.currentQuantity || 0), 0);

    return NextResponse.json({
      products,
      stats: {
        totalProducts,
        totalCost,
        totalRevenue,
        netProfit: totalRevenue - totalCost,
        totalQuantity,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    
    const authResult = await getAuthenticatedUser();
    if (!authResult.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, category, unit, notes, initialQuantity, initialCost } = body;

    if (!name) {
      return NextResponse.json({ error: "اسم المنتج مطلوب" }, { status: 400 });
    }

    // Determine target branch
    const targetBranch = authResult.isSuperAdmin ? body.branch : authResult.branch;
    const targetBranchName = authResult.isSuperAdmin ? body.branchName : authResult.branchName;

    // Create the product
    const product = await Product.create({
      name: name.trim(),
      category: category || "raw",
      unit: unit || "كيلو",
      currentQuantity: initialQuantity || 0,
      totalCost: initialCost || 0,
      totalRevenue: 0,
      status: "active",
      notes,
      branch: targetBranch,
      branchName: targetBranchName,
      createdBy: userId,
    });

    // If initial quantity/cost provided, create an initial purchase operation
    if (initialQuantity > 0 || initialCost > 0) {
      await ProductOperation.create({
        product: product._id,
        type: "purchase",
        description: "رصيد افتتاحي",
        quantity: initialQuantity || 0,
        amount: initialCost || 0,
        amountType: "cost",
        date: new Date(),
        recordedBy: userId,
        branch: targetBranch,
        branchName: targetBranchName,
      });
    }

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
