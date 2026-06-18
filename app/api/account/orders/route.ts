import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectMongoDB from "@/lib/mongodb";
import Order from "@/models/order";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectMongoDB();

    const orders = await Order.find({
      clerkUserId: userId,
      paymentStatus: "paid",
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error("ACCOUNT ORDERS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load orders" },
      { status: 500 }
    );
  }
}
