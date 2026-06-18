"use client";

import { UserProfile } from "@clerk/nextjs";

export default function AccountProfilePage() {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
      <UserProfile routing="hash" />
    </div>
  );
}
