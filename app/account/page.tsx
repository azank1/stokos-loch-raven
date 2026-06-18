"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Gift, MapPin, Package } from "lucide-react";

type LoyaltyAccount = {
  points: number;
  lifetimePoints: number;
  tier: string;
};

export default function AccountOverviewPage() {
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    fetch("/api/account/loyalty")
      .then((r) => r.json())
      .then((d) => d.success && setLoyalty(d.account));

    fetch("/api/account/orders")
      .then((r) => r.json())
      .then((d) => d.success && setOrderCount(d.orders?.length || 0));
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link
        href="/account/orders"
        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition hover:shadow-md"
      >
        <Package className="text-green-800" size={24} />
        <p className="mt-4 text-3xl font-black">{orderCount}</p>
        <p className="mt-1 text-sm font-bold text-zinc-500">Past orders</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-green-800">
          View history <ArrowRight size={14} />
        </span>
      </Link>

      <Link
        href="/account/addresses"
        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition hover:shadow-md"
      >
        <MapPin className="text-green-800" size={24} />
        <p className="mt-4 text-lg font-black">Saved addresses</p>
        <p className="mt-1 text-sm font-bold text-zinc-500">Manage delivery locations</p>
      </Link>

      <Link
        href="/account/rewards"
        className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition hover:shadow-md"
      >
        <Gift className="text-green-800" size={24} />
        <p className="mt-4 text-3xl font-black">{loyalty?.points ?? "—"}</p>
        <p className="mt-1 text-sm font-bold text-zinc-500">
          {loyalty ? `${loyalty.tier} tier` : "Rewards points"}
        </p>
      </Link>

      <div className="md:col-span-3 rounded-3xl bg-green-800 p-6 text-white">
        <h2 className="text-xl font-black">Track a guest order</h2>
        <p className="mt-2 text-sm text-white/80">
          Don&apos;t have an account order yet? Track by order number anytime.
        </p>
        <Link
          href="/track"
          className="mt-4 inline-flex rounded-full bg-white px-5 py-2 text-sm font-black text-green-800"
        >
          Track order
        </Link>
      </div>
    </div>
  );
}
