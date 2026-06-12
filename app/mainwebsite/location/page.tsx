import type { Metadata } from "next";
import { Suspense } from "react";
import LocationStoreCards from "@/components/mainwebsite/mainlocationcard";

export const metadata: Metadata = {
  title: "Choose Location | Stokos",
  description: "Choose your nearest Stokos location to view the menu and place your order.",
  alternates: {
    canonical: "https://stokos-loch-raven.vercel.app/mainwebsite/location",
  },
  robots: {
    index: true,
    follow: true,
  },
};

function LocationPageFallback() {
  return (
    <section className="flex min-h-screen items-center justify-center bg-white text-black dark:bg-[#07110a] dark:text-white">
      <p className="text-sm font-bold uppercase tracking-wide">
        Loading locations...
      </p>
    </section>
  );
}

export default function LocationPage() {
  return (
    <Suspense fallback={<LocationPageFallback />}>
      <LocationStoreCards />
    </Suspense>
  );
}