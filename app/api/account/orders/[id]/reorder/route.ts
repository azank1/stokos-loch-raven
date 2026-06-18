import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@clerk/nextjs/server";
import connectMongoDB from "@/lib/mongodb";
import Order from "@/models/order";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, message: "Invalid order ID" }, { status: 400 });
    }

    await connectMongoDB();

    const order = await Order.findOne({ _id: id, clerkUserId: userId }).lean();
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    type OrderLineItem = {
      name: string;
      quantity?: number;
      unitPrice?: number;
      amount?: number;
      size?: { label?: string; price?: number };
      toppings?: Record<string, string> | Map<string, string>;
      sauces?: string[];
      note?: string;
    };

    const cartItems = ((order.items || []) as OrderLineItem[]).map((item, index) => ({
      cartId: `reorder-${id}-${index}`,
      id: `reorder-${index}`,
      category: "reorder",
      title: item.name,
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop",
      price: Number(item.unitPrice || (item.amount || 0) / Math.max(item.quantity || 1, 1)),
      quantity: Number(item.quantity || 1),
      size: item.size,
      toppings:
        item.toppings instanceof Map
          ? Object.fromEntries(item.toppings)
          : item.toppings,
      sauces: item.sauces,
      note: item.note,
    }));

    return NextResponse.json({
      success: true,
      storeSlug: order.storeSlug,
      items: cartItems,
    });
  } catch (error) {
    console.error("REORDER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to build reorder cart" },
      { status: 500 }
    );
  }
}
