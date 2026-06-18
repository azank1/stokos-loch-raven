import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongodb";
import Order from "@/models/order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderNumber = searchParams.get("orderNumber")?.trim().toUpperCase();
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, message: "Order number is required." },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const order = await Order.findOne({ orderNumber }).lean() as {
      orderNumber: string;
      storeName: string;
      storeSlug: string;
      orderType: string;
      deliveryAddress?: string;
      orderDay: string;
      orderTime: string;
      customerName: string;
      customerEmail: string;
      items: unknown[];
      subtotal: number;
      deliveryFee: number;
      tax: number;
      amountTotal: number;
      currency: string;
      paymentStatus: string;
      status: string;
      statusHistory: { status: string; at: Date }[];
      createdAt: Date;
    } | null;

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found." },
        { status: 404 }
      );
    }

    // Light email verification when provided
    if (email && order.customerEmail.toLowerCase() !== email) {
      return NextResponse.json(
        { success: false, message: "Order not found." },
        { status: 404 }
      );
    }

    // Return safe subset only
    return NextResponse.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        storeName: order.storeName,
        storeSlug: order.storeSlug,
        orderType: order.orderType,
        deliveryAddress: order.deliveryAddress,
        orderDay: order.orderDay,
        orderTime: order.orderTime,
        customerName: order.customerName,
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        tax: order.tax,
        amountTotal: order.amountTotal,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
        status: order.status,
        statusHistory: order.statusHistory,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error("TRACK ORDER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to look up order." },
      { status: 500 }
    );
  }
}
