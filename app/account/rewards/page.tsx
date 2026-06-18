"use client";

import { useEffect, useState } from "react";
import { Gift, Star } from "lucide-react";

type LoyaltyAccount = {
  points: number;
  lifetimePoints: number;
  tier: string;
};

export default function AccountRewardsPage() {
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);

  useEffect(() => {
    fetch("/api/account/loyalty")
      .then((r) => r.json())
      .then((d) => d.success && setAccount(d.account));
  }, []);

  const nextTierAt =
    account?.tier === "Gold"
      ? null
      : account?.tier === "Silver"
      ? 500
      : 200;

  const progress = account
    ? nextTierAt
      ? Math.min(100, (account.lifetimePoints / nextTierAt) * 100)
      : 100
    : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-green-900 to-green-700 p-8 text-white">
        <div className="flex items-center gap-3">
          <Gift size={28} />
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-white/70">Rewards</p>
            <h2 className="text-3xl font-black">{account?.points ?? 0} points</h2>
          </div>
        </div>
        <p className="mt-4 text-sm text-white/80">
          Earn 1 point per $1 spent. Points are added when your order is marked Completed.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
        <div className="flex items-center gap-2">
          <Star className="text-yellow-500" size={20} />
          <p className="font-black">{account?.tier ?? "Bronze"} tier</p>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Lifetime points: {account?.lifetimePoints ?? 0}
          {nextTierAt ? ` · ${nextTierAt - (account?.lifetimePoints ?? 0)} to next tier` : " · Top tier reached"}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-green-700" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
