import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongodb";
import Order from "@/models/order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const storeSlug = searchParams.get("store");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 200);

    const query: Record<string, unknown> = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (storeSlug) {
      query.storeSlug = storeSlug;
    }

    if (search) {
      const s = search.trim();
      query.$or = [
        { orderNumber: { $regex: s, $options: "i" } },
        { customerName: { $regex: s, $options: "i" } },
        { customerEmail: { $regex: s, $options: "i" } },
        { storeName: { $regex: s, $options: "i" } },
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error("GET ADMIN ORDERS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch orders." },
      { status: 500 }
    );
  }
}
