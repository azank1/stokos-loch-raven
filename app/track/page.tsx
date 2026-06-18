"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Home,
  MapPin,
  PackageSearch,
  Search,
  Store,
  Truck,
} from "lucide-react";
import { STATUS_COLORS, type OrderStatus } from "@/lib/orderstatus";

type TrackedOrder = {
  orderNumber: string;
  storeName: string;
  storeSlug: string;
  orderType: string;
  deliveryAddress?: string;
  orderDay: string;
  orderTime: string;
  customerName: string;
  items: {
    name: string;
    quantity: number;
    amount: number;
    currency: string;
    size?: { label?: string };
    toppings?: Record<string, string>;
    sauces?: string[];
    note?: string;
  }[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
  status: string;
  statusHistory: { status: string; at: string }[];
  createdAt: string;
};

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orderNumber.trim()) return;

    setLoading(true);
    setError("");
    setOrder(null);

    try {
      const params = new URLSearchParams({
        orderNumber: orderNumber.trim().toUpperCase(),
      });

      if (email.trim()) {
        params.set("email", email.trim());
      }

      const res = await fetch(`/api/orders/track?${params}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Order not found. Check the order number and try again.");
        return;
      }

      setOrder(data.order);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isDelivery = order?.orderType === "delivery";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ecfdf5_0%,#ffffff_45%,#f5f5f5_100%)] px-4 py-12 text-black">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
            <PackageSearch size={30} />
          </div>

          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Track Your Order
          </h1>

          <p className="mt-3 text-sm text-zinc-500">
            Enter your order number to see real-time status.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-[30px] border border-zinc-200 bg-white p-6 shadow-sm md:p-8"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-zinc-700">
                Order Number
              </label>

              <input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="STK-XXXXXX"
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold uppercase tracking-widest text-zinc-900 outline-none transition focus:border-green-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-zinc-700">
                Email{" "}
                <span className="font-normal text-zinc-400">(optional, for verification)</span>
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-green-600 focus:bg-white"
              />
            </div>

            {error && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !orderNumber.trim()}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#0F3F24] py-3.5 text-sm font-black uppercase text-white transition hover:bg-[#146C38] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                "Looking up..."
              ) : (
                <>
                  <Search size={17} />
                  Track Order
                </>
              )}
            </button>
          </div>
        </form>

        {order && (
          <div className="mt-6 overflow-hidden rounded-[30px] border border-zinc-200 bg-white shadow-sm">
            {/* Header */}
            <div className="border-b border-zinc-200 bg-gradient-to-br from-green-50 to-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-green-700">
                    Order
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    {order.orderNumber}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>

                <span
                  className={`rounded-full px-4 py-2 text-xs font-black uppercase ${STATUS_COLORS[order.status as OrderStatus] || "bg-zinc-100 text-zinc-600"}`}
                >
                  {order.status}
                </span>
              </div>
            </div>

            {/* Order type + address */}
            <div className="grid border-b border-zinc-200 sm:grid-cols-2">
              <div className="border-b border-zinc-200 p-5 sm:border-b-0 sm:border-r">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100">
                  {isDelivery ? <Truck size={18} /> : <Store size={18} />}
                </div>

                <p className="text-xs font-black uppercase text-zinc-500">
                  Order Type
                </p>

                <p className="mt-1 font-black">
                  {isDelivery ? "Delivery" : "Pickup / Carryout"}
                </p>
              </div>

              <div className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100">
                  <MapPin size={18} />
                </div>

                <p className="text-xs font-black uppercase text-zinc-500">
                  {isDelivery ? "Delivery Address" : "Pickup From"}
                </p>

                <p className="mt-1 text-sm font-semibold leading-6">
                  {isDelivery
                    ? order.deliveryAddress || "Not provided"
                    : order.storeName}
                </p>
              </div>
            </div>

            {/* Status history */}
            {order.statusHistory.length > 0 && (
              <div className="border-b border-zinc-200 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-green-700" />
                  <p className="text-xs font-black uppercase text-zinc-500">
                    Status History
                  </p>
                </div>

                <ol className="space-y-3">
                  {[...order.statusHistory].reverse().map((h, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <CheckCircle2
                        size={15}
                        className={
                          i === 0 ? "text-green-700" : "text-zinc-300"
                        }
                      />

                      <span className={i === 0 ? "font-black" : "text-zinc-500"}>
                        {h.status}
                      </span>

                      <span className="ml-auto text-xs text-zinc-400">
                        {new Date(h.at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Items */}
            {order.items.length > 0 && (
              <div className="border-b border-zinc-200 p-5">
                <p className="mb-3 text-xs font-black uppercase text-zinc-500">
                  Items
                </p>

                <div className="space-y-2">
                  {order.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-4 rounded-2xl bg-zinc-50 p-3 text-sm"
                    >
                      <div>
                        <p className="font-black">
                          {item.quantity}x {item.name}
                        </p>

                        {item.size?.label && (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            Size: {item.size.label}
                          </p>
                        )}
                      </div>

                      <p className="shrink-0 font-black">
                        ${item.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-1.5 rounded-2xl bg-zinc-50 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="font-bold">
                      ${order.subtotal.toFixed(2)}
                    </span>
                  </div>

                  {order.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Delivery Fee</span>
                      <span className="font-bold">
                        ${order.deliveryFee.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {order.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Tax</span>
                      <span className="font-bold">${order.tax.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-zinc-200 pt-2">
                    <span className="font-black">Total</span>
                    <span className="font-black text-green-800">
                      ${order.amountTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-col gap-3 p-5 sm:flex-row">
              <Link
                href={`/store/${order.storeSlug}`}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black uppercase transition hover:bg-zinc-50"
              >
                <Home size={16} />
                Order Again
              </Link>

              <Link
                href="/"
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0F3F24] text-sm font-black uppercase text-white transition hover:bg-[#146C38]"
              >
                Home
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
