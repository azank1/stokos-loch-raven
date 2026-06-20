import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectMongoDB from "@/lib/mongodb";
import Order from "@/models/order";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );
    const skip = (page - 1) * limit;

    const query = { clerkUserId: userId, paymentStatus: "paid" };

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      orders,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (error) {
    console.error("ACCOUNT ORDERS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load orders" },
      { status: 500 }
    );
  }
}
