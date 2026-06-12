"use client";

import { useEffect, useState } from "react";

type DevClientOnlyProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export default function DevClientOnly({
  children,
  fallback = null,
}: DevClientOnlyProps) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const [mounted, setMounted] = useState(!isDevelopment);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (isDevelopment && !mounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}