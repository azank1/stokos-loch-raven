import { Suspense } from "react";
import TrackOrderClient from "./trackclient";

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<main className="min-h-screen px-4 py-12 text-center text-sm font-bold text-zinc-500">Loading track page...</main>}>
      <TrackOrderClient />
    </Suspense>
  );
}
