"use client";

import { useSearchParams } from "next/navigation";

export default function AdminSignInAlert() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (error !== "unauthorized") return null;

  return (
    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
      Your account is not authorized for admin access. Contact a manager if you need access.
    </div>
  );
}
