import { NextResponse } from "next/server";
import Stripe from "stripe";
import connectMongoDB from "@/lib/mongodb";
import Order from "@/models/order";
import Store from "@/models/store";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function generateOrderNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `STK-${code}`;
}

// CREATE STRIPE CHECKOUT
export async function POST(req: Request) {
  try {
    const {
      items,
      slug,
      orderType,
      deliveryAddress,
      orderDay,
      orderTime,
      orderStore,
    } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    if (!orderType) {
      return NextResponse.json(
        { error: "Order type is required" },
        { status: 400 }
      );
    }

    if (orderType === "delivery" && !deliveryAddress) {
      return NextResponse.json(
        { error: "Delivery address is required" },
        { status: 400 }
      );
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const stripe = getStripe();
    const cleanOrigin = origin.replace(/\/$/, "");
    const storeSlug = slug || orderStore || "towson";
    const formattedDay = orderDay || "Today";
    const formattedTime = orderTime || "ASAP";

    // Fetch store for delivery fee, tax, minimum order
    await connectMongoDB();

    const storeDoc = await Store.findOne({ slug: storeSlug }).lean() as {
      name: string;
      deliveryFee?: number;
      taxRate?: number;
      minimumOrder?: number;
    } | null;

    const storeName = storeDoc?.name || storeSlug;
    const deliveryFee =
      orderType === "delivery" ? Number(storeDoc?.deliveryFee ?? 0) : 0;
    const taxRate = Number(storeDoc?.taxRate ?? 0);
    const minimumOrder = Number(storeDoc?.minimumOrder ?? 0);

    // Compute money breakdown
    const subtotal = items.reduce(
      (acc: number, item: { price: number; quantity: number }) =>
        acc + Number(item.price) * Number(item.quantity || 1),
      0
    );

    if (minimumOrder > 0 && subtotal < minimumOrder) {
      return NextResponse.json(
        {
          error: `Minimum order amount is $${minimumOrder.toFixed(2)}. Your subtotal is $${subtotal.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    const taxAmount = Math.round((subtotal * taxRate) / 100 * 100) / 100;
    const amountTotal =
      Math.round((subtotal + deliveryFee + taxAmount) * 100) / 100;

    // Build Stripe line items
    const lineItems = items.map(
      (item: {
        title: string;
        price: number;
        quantity: number;
        size?: { label?: string };
        toppings?: Record<string, string>;
        sauces?: string[];
        note?: string;
      }) => {
        const descriptionParts: string[] = [];

        if (item.size?.label) {
          descriptionParts.push(`Size: ${item.size.label}`);
        }

        if (item.toppings && Object.keys(item.toppings).length > 0) {
          descriptionParts.push(
            `Toppings: ${Object.entries(item.toppings)
              .map(([name, side]) => `${name} (${side})`)
              .join(", ")}`
          );
        }

        if (item.sauces && item.sauces.length > 0) {
          descriptionParts.push(`Sauces: ${item.sauces.join(", ")}`);
        }

        if (item.note) {
          descriptionParts.push(`Note: ${item.note}`);
        }

        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: item.title,
              description: descriptionParts.length
                ? descriptionParts.join(" | ")
                : undefined,
            },
            unit_amount: Math.round(Number(item.price) * 100),
          },
          quantity: item.quantity || 1,
        };
      }
    );

    const extraLineItems = [];

    if (deliveryFee > 0) {
      extraLineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Delivery Fee" },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      });
    }

    if (taxAmount > 0) {
      extraLineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: `Tax (${taxRate}%)` },
          unit_amount: Math.round(taxAmount * 100),
        },
        quantity: 1,
      });
    }

    const allLineItems = [...lineItems, ...extraLineItems];

    // Generate unique order number
    let orderNumber = generateOrderNumber();
    let attempts = 0;
    while (attempts < 5) {
      const exists = await Order.exists({ orderNumber });
      if (!exists) break;
      orderNumber = generateOrderNumber();
      attempts++;
    }

    // Persist order as Placed/pending before Stripe session
    const orderItems = items.map(
      (item: {
        title?: string;
        name?: string;
        price: number;
        quantity: number;
        size?: { label?: string; price?: number };
        toppings?: Record<string, string>;
        sauces?: string[];
        note?: string;
      }) => ({
        name: item.title || item.name || "Item",
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.price),
        amount: Number(item.price) * Number(item.quantity || 1),
        size: item.size,
        toppings: item.toppings
          ? Object.fromEntries(Object.entries(item.toppings))
          : undefined,
        sauces: item.sauces,
        note: item.note,
      })
    );

    // Create the order in MongoDB
    const newOrder = await Order.create({
      orderNumber,
      stripeSessionId: "pending_" + orderNumber,
      storeSlug,
      storeName,
      orderType,
      deliveryAddress: deliveryAddress || "",
      orderDay: formattedDay,
      orderTime: formattedTime,
      items: orderItems,
      subtotal,
      deliveryFee,
      tax: taxAmount,
      amountTotal,
      currency: "USD",
      paymentStatus: "pending",
      status: "Placed",
      statusHistory: [{ status: "Placed", at: new Date() }],
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      adaptive_pricing: {
        enabled: false,
      },

      payment_method_types: ["card"],

      line_items: allLineItems,

      metadata: {
        store: storeSlug,
        orderStore: orderStore || storeSlug,
        orderType,
        deliveryAddress: deliveryAddress || "",
        orderDay: formattedDay,
        orderTime: formattedTime,
        orderId: String(newOrder._id),
        orderNumber,
      },

      success_url: `${cleanOrigin}/store/${storeSlug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cleanOrigin}/store/${storeSlug}?payment=cancelled`,
    });

    // Update order with real Stripe session ID
    await Order.findByIdAndUpdate(newOrder._id, {
      stripeSessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("STRIPE ERROR:", error);

    return NextResponse.json(
      { error: "Stripe checkout failed" },
      { status: 500 }
    );
  }
}

// GET STRIPE SESSION DETAILS FOR SUCCESS PAGE
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 50,
    });

    // Fallback: if webhook hasn't fired yet, mark paid now
    if (session.payment_status === "paid") {
      await connectMongoDB();

      await Order.findOneAndUpdate(
        { stripeSessionId: sessionId, paymentStatus: { $ne: "paid" } },
        {
          $set: {
            paymentStatus: "paid",
            status: "Confirmed",
            customerName: session.customer_details?.name || "Not provided",
            customerEmail: session.customer_details?.email || "Not provided",
          },
          $push: {
            statusHistory: { status: "Confirmed", at: new Date() },
          },
        }
      );
    }

    return NextResponse.json({
      id: session.id,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency?.toUpperCase() || "USD",
      customerName: session.customer_details?.name || "Not provided",
      customerEmail: session.customer_details?.email || "Not provided",
      metadata: session.metadata || {},
      items: lineItems.data.map((item) => ({
        name: item.description || "Item",
        quantity: item.quantity || 1,
        amount: item.amount_total ? item.amount_total / 100 : 0,
        currency: item.currency?.toUpperCase() || "USD",
      })),
    });
  } catch (error) {
    console.error("CHECKOUT SESSION ERROR:", error);

    return NextResponse.json(
      { error: "Failed to fetch checkout session" },
      { status: 500 }
    );
  }
}
