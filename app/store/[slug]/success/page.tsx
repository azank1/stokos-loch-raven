"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  ReceiptText,
  MapPin,
  ArrowRight,
  Home,
  Truck,
  Store,
  ShieldCheck,
  User,
  Mail,
  CreditCard,
  PackageCheck,
  PackageSearch,
} from "lucide-react";
import { useCartStore } from "../usecartstore";
import { STORES } from "@/lib/data/stores";

type StripeItem = {
  name: string;
  quantity: number;
  amount: number;
  currency: string;
};

type FullOrderItem = {
  name: string;
  quantity: number;
  amount: number;
  currency: string;
  size?: {
    label?: string;
    price?: number;
  };
  toppings?: Record<string, string>;
  sauces?: string[];
  note?: string;
};

// Orders are now persisted to MongoDB — no localStorage needed

const getCartSnapshotFromStorage = () => {
  const keys = ["stokos-cart", "cart-storage", "cart"];

  for (const key of keys) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) continue;

      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.cart)) return parsed.cart;
      if (Array.isArray(parsed?.items)) return parsed.items;
      if (Array.isArray(parsed?.state?.cart)) return parsed.state.cart;
      if (Array.isArray(parsed?.state?.items)) return parsed.state.items;
    } catch {
      continue;
    }
  }

  return [];
};


const buildFullItems = (
  stripeItems: StripeItem[],
  cartSnapshot: any[],
  currency: string
): FullOrderItem[] => {
  if (cartSnapshot && cartSnapshot.length > 0) {
    return cartSnapshot.map((item: any, index: number) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.price || 0);
      const stripeAmount = stripeItems[index]?.amount;

      return {
        name: item.title || item.name || stripeItems[index]?.name || "Item",
        quantity,
        amount:
          typeof stripeAmount === "number" && stripeAmount > 0
            ? stripeAmount
            : unitPrice * quantity,
        currency: stripeItems[index]?.currency || currency || "USD",
        size: item.size,
        toppings: item.toppings || {},
        sauces: item.sauces || [],
        note: item.note || "",
      };
    });
  }

  return stripeItems.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    amount: item.amount,
    currency: item.currency,
    toppings: {},
    sauces: [],
    note: "",
  }));
};

export default function SuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam || "towson";

  const sessionId = searchParams.get("session_id");

  const cart = useCartStore((state: any) => state.cart || []);
  const clearCart = useCartStore((state) => state.clearCart);

  const cartSnapshotRef = useRef<any[] | null>(null);

  const [orderNumber, setOrderNumber] = useState("");
  const [orderType, setOrderType] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderDay, setOrderDay] = useState("Today");
  const [orderTime, setOrderTime] = useState("ASAP");
  const [orderStoreSlug, setOrderStoreSlug] = useState(slug);

  const [customerName, setCustomerName] = useState("Not provided");
  const [customerEmail, setCustomerEmail] = useState("Not provided");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [amountTotal, setAmountTotal] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [items, setItems] = useState<FullOrderItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  const orderStore =
    STORES.find((store) => store.slug === orderStoreSlug) ||
    STORES.find((store) => store.slug === slug) ||
    STORES[0];

  useEffect(() => {
    const fallbackOrderNumber = `STK-${Math.floor(
      100000 + Math.random() * 900000
    )}`;

    setOrderNumber(fallbackOrderNumber);

    const savedOrderType = localStorage.getItem("stokos_order_type") || "";
    const savedAddress = localStorage.getItem("stokos_delivery_address") || "";
    const savedDay = localStorage.getItem("stokos_order_day") || "Today";
    const savedTime = localStorage.getItem("stokos_order_time") || "ASAP";
    const savedStore = localStorage.getItem("stokos_order_store") || slug;

    setOrderType(savedOrderType);
    setDeliveryAddress(savedAddress);
    setOrderDay(savedDay);
    setOrderTime(savedTime);
    setOrderStoreSlug(savedStore);

    const cartSnapshot =
      cartSnapshotRef.current ||
      (cart.length > 0 ? cart : getCartSnapshotFromStorage());

    cartSnapshotRef.current = cartSnapshot;

    if (cartSnapshot.length > 0) {
      setItems(buildFullItems([], cartSnapshot, "USD"));
    }

    const loadStripeSession = async () => {
      if (!sessionId) {
        setLoadingDetails(false);
        return;
      }

      try {
        const res = await fetch(`/api/checkout?session_id=${sessionId}`);
        const data = await res.json();

        if (!res.ok) {
          console.error("Session API Error:", data);
          setLoadingDetails(false);
          return;
        }

        const finalOrderNumber =
          data.metadata?.orderNumber ||
          `STK-${data.id.slice(-6).toUpperCase()}`;
        const finalOrderType = data.metadata?.orderType || savedOrderType;
        const finalAddress = data.metadata?.deliveryAddress || savedAddress;
        const finalDay = data.metadata?.orderDay || savedDay;
        const finalTime = data.metadata?.orderTime || savedTime;
        const finalStore =
          data.metadata?.orderStore || data.metadata?.store || savedStore;

        const finalCurrency = data.currency || "USD";
        const finalStripeItems = data.items || [];
        const finalFullItems = buildFullItems(
          finalStripeItems,
          cartSnapshot,
          finalCurrency
        );

        setOrderNumber(finalOrderNumber);
        setCustomerName(data.customerName || "Not provided");
        setCustomerEmail(data.customerEmail || "Not provided");
        setPaymentStatus(data.paymentStatus || "paid");
        setAmountTotal(data.amountTotal || 0);
        setCurrency(finalCurrency);
        setItems(finalFullItems);

        setOrderType(finalOrderType);
        setDeliveryAddress(finalAddress);
        setOrderDay(finalDay);
        setOrderTime(finalTime);
        setOrderStoreSlug(finalStore);
      } catch (error) {
        console.error("Failed to load Stripe session:", error);
      } finally {
        setLoadingDetails(false);
      }
    };

    loadStripeSession();

    clearCart();

    setTimeout(() => {
      localStorage.removeItem("stokos_order_type");
      localStorage.removeItem("stokos_delivery_address");
      localStorage.removeItem("stokos_order_day");
      localStorage.removeItem("stokos_order_time");
      localStorage.removeItem("stokos_order_store");

      localStorage.removeItem("cart");
      localStorage.removeItem("stokos-cart");
      localStorage.removeItem("cart-storage");

      sessionStorage.removeItem("stripe_checkout_started");

      window.dispatchEvent(new Event("stokos-order-updated"));
    }, 1200);
  }, [clearCart, sessionId, slug]);

  const isDelivery = orderType === "delivery";

  const formattedPaymentStatus =
    paymentStatus === "paid" ? "Paid Successfully" : paymentStatus;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ecfdf5_0%,#ffffff_45%,#f5f5f5_100%)] px-4 py-8 text-black dark:bg-black dark:text-white md:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[36px] border border-zinc-200 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-[#101010]">
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-white px-6 py-12 text-center dark:from-green-950/30 dark:via-[#101010] dark:to-[#101010] md:px-12 md:py-14">
            <div className="absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-200/40 blur-3xl" />

            <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-600 ring-8 ring-green-50 dark:bg-green-900/40 dark:ring-green-950/30">
              <CheckCircle2 size={52} strokeWidth={2.5} />
            </div>

            <p className="relative mb-3 text-xs font-black uppercase tracking-[0.35em] text-green-600">
              Payment Successful
            </p>

            <h1 className="relative text-4xl font-black tracking-tight md:text-6xl">
              Order Placed!
            </h1>

            <p className="relative mx-auto mt-5 max-w-xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
              Thank you. Your order has been received and your payment was
              completed successfully.
            </p>

            <div className="relative mx-auto mt-7 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-black shadow-sm dark:border-zinc-800 dark:bg-black">
              <ReceiptText size={18} />
              Order #{orderNumber || "Generating..."}
            </div>
          </div>

          {/* Order Summary Strip */}
          <div className="grid border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#111] lg:grid-cols-3">
            <div className="border-b border-zinc-200 p-6 dark:border-zinc-800 lg:border-b-0 lg:border-r">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
                {isDelivery ? <Truck size={22} /> : <Store size={22} />}
              </div>

              <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">
                Order Type
              </p>

              <p className="text-base font-black text-black dark:text-white">
                {isDelivery ? "Delivery" : "Pickup / Carryout"}
              </p>
            </div>

            <div className="border-b border-zinc-200 p-6 dark:border-zinc-800 lg:border-b-0 lg:border-r">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
                <Clock size={22} />
              </div>

              <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">
                Estimated Time
              </p>

              <p className="text-base font-black text-black dark:text-white">
                {orderDay} · {orderTime}
              </p>
            </div>

            <div className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
                <MapPin size={22} />
              </div>

              <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">
                {isDelivery ? "Delivery Address" : "Pickup Store"}
              </p>

              <p className="text-sm font-semibold leading-6 text-zinc-600 dark:text-zinc-400">
                {isDelivery ? (
                  deliveryAddress || "Delivery address not available"
                ) : (
                  <>
                    {orderStore.name}
                    <br />
                    {orderStore.address}, {orderStore.cityStateZip}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Customer + Payment */}
          <div className="grid gap-4 px-6 py-6 md:px-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-black">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900">
                  <User size={20} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                    Payment By
                  </p>

                  <p className="text-sm font-black text-black dark:text-white">
                    {loadingDetails ? "Loading..." : customerName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white p-4 dark:bg-zinc-900">
                <Mail size={18} className="text-zinc-500" />

                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">
                    Email
                  </p>

                  <p className="text-sm font-semibold text-black dark:text-white">
                    {loadingDetails ? "Loading..." : customerEmail}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-black">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-zinc-900">
                  <CreditCard size={20} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                    Payment Status
                  </p>

                  <p className="text-sm font-black text-green-700">
                    {loadingDetails ? "Loading..." : formattedPaymentStatus}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-white p-4 dark:bg-zinc-900">
                  <p className="text-sm font-black uppercase text-zinc-500">
                    Amount Paid
                  </p>

                  <p className="text-xl font-black text-black dark:text-white">
                    {currency} {amountTotal.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-white p-4 dark:bg-zinc-900">
                  <p className="text-sm font-black uppercase text-zinc-500">
                    Payment Method
                  </p>

                  <p className="text-sm font-black text-black dark:text-white">
                    Card via Stripe
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Full Order Items */}
          {items.length > 0 && (
            <div className="px-6 pb-6 md:px-8">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-black">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
                    <PackageCheck size={20} />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                      Full Order Details
                    </p>

                    <p className="text-sm font-semibold text-zinc-500">
                      Items, size, toppings, sauces, and special instructions
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => {
                    const hasToppings =
                      item.toppings && Object.keys(item.toppings).length > 0;
                    const hasSauces = item.sauces && item.sauces.length > 0;
                    const hasNote = item.note && item.note.trim().length > 0;

                    return (
                      <div
                        key={`${item.name}-${index}`}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-base font-black text-black dark:text-white">
                              {item.quantity}x {item.name}
                            </p>

                            {item.size?.label && (
                              <p className="mt-1 text-xs font-semibold text-zinc-500">
                                Size: {item.size.label}
                              </p>
                            )}
                          </div>

                          <p className="text-sm font-black text-black dark:text-white">
                            {item.currency} {item.amount.toFixed(2)}
                          </p>
                        </div>

                        {(hasToppings || hasSauces || hasNote) && (
                          <div className="mt-4 space-y-3 rounded-xl bg-white p-3 dark:bg-black">
                            {hasToppings && (
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                                  Toppings
                                </p>

                                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                                  {Object.entries(item.toppings || {})
                                    .map(([name, side]) => `${name} (${side})`)
                                    .join(", ")}
                                </p>
                              </div>
                            )}

                            {hasSauces && (
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                                  Sauces
                                </p>

                                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                                  {(item.sauces || []).join(", ")}
                                </p>
                              </div>
                            )}

                            {hasNote && (
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                                  Special Instructions
                                </p>

                                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                                  {item.note}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Note */}
          <div className="px-6 pb-6 md:px-8">
            <div className="flex gap-3 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-200">
              <ShieldCheck size={20} className="mt-0.5 shrink-0" />

              <p>
                Your order has been sent to the store for preparation. Please
                keep your phone available in case the store needs to confirm any
                details.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-4 border-t border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-black md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-sm font-black uppercase">
                Thanks for ordering from Stoko&apos;s
              </h4>

              <p className="mt-1 text-xs text-zinc-500">
                You can start a new order anytime from the menu page.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/store/${slug}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white px-5 text-sm font-black uppercase transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-black dark:hover:bg-zinc-900"
              >
                <Home size={18} />
                Back to Menu
              </Link>

              <Link
                href={`/track?orderNumber=${orderNumber}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white px-5 text-sm font-black uppercase transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-black dark:hover:bg-zinc-900"
              >
                <PackageSearch size={18} />
                Track Order
              </Link>

              <Link
                href={`/store/${slug}`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#DA3327] px-6 text-sm font-black uppercase text-white shadow-lg transition hover:bg-red-700"
              >
                Order Again
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}