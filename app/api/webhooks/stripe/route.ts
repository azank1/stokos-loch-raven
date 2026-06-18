import { NextResponse } from "next/server";
import Stripe from "stripe";
import connectMongoDB from "@/lib/mongodb";
import Order from "@/models/order";
import { incrementPromoUsage } from "@/lib/promo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    try {
      await connectMongoDB();

      const order = await Order.findOneAndUpdate(
        { stripeSessionId: session.id, paymentStatus: { $ne: "paid" } },
        {
          $set: {
            paymentStatus: "paid",
            status: "Confirmed",
            customerName: session.customer_details?.name || "Not provided",
            customerEmail: session.customer_details?.email || "Not provided",
            customerPhone: session.customer_details?.phone || undefined,
            ...(paymentIntentId
              ? { stripePaymentIntentId: paymentIntentId }
              : {}),
          },
          $push: {
            statusHistory: { status: "Confirmed", at: new Date() },
          },
        },
        { new: true }
      );

      if (order?.promoCode) {
        await incrementPromoUsage(order.promoCode);
      }
    } catch (err) {
      console.error("Order update after webhook failed:", err);
      return NextResponse.json(
        { error: "Order update failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
