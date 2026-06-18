import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@/lib/mongodb";
import Order from "@/models/order";
import {
  isValidTransition,
  type OrderStatus,
  type OrderType,
} from "@/lib/orderstatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectMongoDB();

    const { id } = await context.params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid order ID." },
        { status: 400 }
      );
    }

    const { status } = (await req.json()) as { status: OrderStatus };

    if (!status) {
      return NextResponse.json(
        { success: false, message: "Status is required." },
        { status: 400 }
      );
    }

    const order = await Order.findById(id);

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found." },
        { status: 404 }
      );
    }

    if (
      !isValidTransition(
        order.status as OrderStatus,
        status,
        order.orderType as OrderType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot transition from "${order.status}" to "${status}".`,
        },
        { status: 400 }
      );
    }

    order.status = status;
    order.statusHistory.push({ status, at: new Date() });
    await order.save();

    return NextResponse.json({
      success: true,
      message: "Order status updated.",
      order,
    });
  } catch (error) {
    console.error("UPDATE ORDER STATUS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update order status." },
      { status: 500 }
    );
  }
}
