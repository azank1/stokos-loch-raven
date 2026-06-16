import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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

    const cleanOrigin = origin.replace(/\/$/, "");

    const storeSlug = slug || "towson";
    const formattedDay = orderDay || "Today";
    const formattedTime = orderTime || "ASAP";

    const lineItems = items.map((item: any) => {
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
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      adaptive_pricing: {
        enabled: false,
      },

      payment_method_types: ["card"],

      line_items: lineItems,

      metadata: {
        store: storeSlug,
        orderStore: orderStore || storeSlug,
        orderType,
        deliveryAddress: deliveryAddress || "",
        orderDay: formattedDay,
        orderTime: formattedTime,
      },

      success_url: `${cleanOrigin}/store/${storeSlug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cleanOrigin}/store/${storeSlug}?payment=cancelled`,
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

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 50,
    });

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