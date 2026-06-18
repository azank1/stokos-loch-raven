"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useCartStore } from "@/app/store/[slug]/usecartstore";

type OrderRow = {
  _id: string;
  orderNumber: string;
  storeSlug: string;
  storeName: string;
  status: string;
  amountTotal: number;
  createdAt: string;
};

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const router = useRouter();
  const setCart = useCartStore((s) => s.setCart);

  useEffect(() => {
    fetch("/api/account/orders")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setOrders(d.orders || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleReorder = async (orderId: string) => {
    setReorderingId(orderId);
    try {
      const res = await fetch(`/api/account/orders/${orderId}/reorder`);
      const data = await res.json();
      if (!res.ok || !data.success) return;

      setCart(data.items);
      router.push(`/store/${data.storeSlug}`);
    } finally {
      setReorderingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm font-bold text-zinc-500">Loading orders...</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-zinc-200">
        <p className="font-bold text-zinc-600">No orders yet.</p>
        <Link href="/store/towson" className="mt-4 inline-block font-black text-green-800">
          Start an order
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <article
          key={order._id}
          className="flex flex-col gap-4 rounded-3xl bg-white p-5 ring-1 ring-zinc-200 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-zinc-400">
              {order.orderNumber}
            </p>
            <p className="mt-1 text-lg font-black">{order.storeName}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {new Date(order.createdAt).toLocaleString()} · {order.status}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-lg font-black">${Number(order.amountTotal).toFixed(2)}</p>
            <Link
              href={`/track?orderNumber=${encodeURIComponent(order.orderNumber)}`}
              className="rounded-full border px-4 py-2 text-xs font-black uppercase"
            >
              Track
            </Link>
            <button
              type="button"
              onClick={() => handleReorder(order._id)}
              disabled={reorderingId === order._id}
              className="inline-flex items-center gap-2 rounded-full bg-[#DA3327] px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-60"
            >
              <RotateCcw size={14} />
              {reorderingId === order._id ? "Loading..." : "Reorder"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
