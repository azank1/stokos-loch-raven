"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Clock, MapPin, Phone } from "lucide-react";
import { formatHoursLines, isStoreOpenNow } from "@/lib/store-hours";
import type { DayHours } from "@/lib/time-slots";

type StoreLocation = {
  name: string;
  slug: string;
  addressLine: string;
  phone: string;
  hoursLabel: string;
  schedule: {
    days: number[];
    open: string;
    close: string;
  }[];
};

const STORES: StoreLocation[] = [
  {
    name: "Towson",
    slug: "towson",
    addressLine: "6821 Loch Raven Blvd, Towson, MD 21286",
    phone: "410-296-6066",
    hoursLabel: "Daily: 11am - 11:30pm",
    schedule: [{ days: [0, 1, 2, 3, 4, 5, 6], open: "11:00", close: "23:30" }],
  },
  {
    name: "York",
    slug: "york",
    addressLine: "5403 York Rd, Baltimore, MD 21212",
    phone: "410-433-4161",
    hoursLabel: "Daily: 11am - 12am",
    schedule: [{ days: [0, 1, 2, 3, 4, 5, 6], open: "11:00", close: "24:00" }],
  },
  {
    name: "Liberty",
    slug: "liberty",
    addressLine: "6700 Liberty Rd, Baltimore, MD 21207",
    phone: "410-655-0009",
    hoursLabel: "Sun - Thu: 10am - 10pm\nFri - Sat: 10am - 11pm",
    schedule: [
      { days: [0, 1, 2, 3, 4], open: "10:00", close: "22:00" },
      { days: [5, 6], open: "10:00", close: "23:00" },
    ],
  },
];

export default function MainStoreSelection({
  availableStoreSlugs,
}: {
  availableStoreSlugs?: string[] | null;
}) {
  const searchParams = useSearchParams();

  const action = searchParams.get("action");
  const category = searchParams.get("category");
  const deal = searchParams.get("deal");

  // Live hours come from the DB (what the admin edits); the hardcoded
  // schedule/hoursLabel above is a fallback for un-migrated stores.
  const [dbHours, setDbHours] = useState<
    Record<string, { hours: DayHours[]; timezone: string }>
  >({});

  useEffect(() => {
    let active = true;

    Promise.all(
      STORES.map((s) =>
        fetch(`/api/store/${s.slug}/config`)
          .then((r) => r.json())
          .then((data) => ({ slug: s.slug, data }))
          .catch(() => null)
      )
    ).then((results) => {
      if (!active) return;
      const map: Record<string, { hours: DayHours[]; timezone: string }> = {};
      for (const res of results) {
        if (
          res?.data?.success &&
          Array.isArray(res.data.hours) &&
          res.data.hours.length === 7
        ) {
          map[res.slug] = {
            hours: res.data.hours,
            timezone: res.data.timezone || "America/New_York",
          };
        }
      }
      setDbHours(map);
    });

    return () => {
      active = false;
    };
  }, []);

  const buildStoreHref = (slug: string) => {
    const params = new URLSearchParams();

    if (deal) params.set("deal", deal);
    if (category) params.set("category", category);
    if (action) params.set("action", action);

    const query = params.toString();

    if (category) {
      return query
        ? `/store/${slug}?${query}#${category}`
        : `/store/${slug}#${category}`;
    }

    if (deal) {
      return query ? `/store/${slug}?${query}#deals` : `/store/${slug}#deals`;
    }

    return query ? `/store/${slug}?${query}` : `/store/${slug}`;
  };

  return (
    <section
      id="stores"
      className="w-full bg-white px-4 py-16 text-black transition-colors duration-300 dark:bg-[#07110a] dark:text-white sm:px-6 lg:px-8 lg:py-20"
    >
      <div className="mx-auto w-full max-w-[1320px]">
        {/* Header */}
        <div className="mb-10 md:mb-9 lg:mb-10">
          <p className="mb-3 text-[12px] font-black uppercase tracking-[0.35em] text-[#ff3131]">
            Find a Stoko’s near you
          </p>

          <h2 className="text-[38px] font-black leading-tight tracking-[-0.05em] text-black dark:text-white md:text-[42px] lg:text-[44px]">
            Our Locations
          </h2>
        </div>

        {/* Store Cards */}
        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3 md:gap-4 lg:gap-6">
          {STORES.filter(store => 
            !availableStoreSlugs || availableStoreSlugs.length === 0 || availableStoreSlugs.includes(store.slug)
          ).map((store) => {
            const db = dbHours[store.slug];
            const openNow = db
              ? isStoreOpenNow(db.hours, db.timezone)
              : isStoreOpen(store.schedule);
            const hoursLines =
              db && db.hours.length
                ? formatHoursLines(db.hours)
                : store.hoursLabel.split("\n");

            return (
              <article
                key={store.slug}
                className="group flex h-full min-w-0 flex-col rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_10px_28px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.1)] dark:border-white/10 dark:bg-[#121b13] dark:ring-white/5 dark:shadow-[0_16px_45px_rgba(0,0,0,0.35)] md:rounded-[22px] md:p-4 lg:rounded-[28px] lg:p-6"
              >
                <div className="mb-8 flex items-start justify-between gap-4 md:mb-6 md:gap-2 lg:mb-8 lg:gap-4">
                  <h3 className="text-[24px] font-black tracking-[-0.04em] text-black dark:text-white md:text-[20px] lg:text-[24px]">
                    {store.name}
                  </h3>

                  <span
                    className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-black uppercase md:px-3 md:py-1.5 md:text-[10px] lg:px-4 lg:py-2 lg:text-[12px] ${
                      openNow
                        ? "bg-green-100 text-[#138A3D] dark:bg-green-500/15 dark:text-green-300"
                        : "bg-[#DA3327] text-white"
                    }`}
                  >
                    {openNow ? "Open Now" : "Closed"}
                  </span>
                </div>

                <div className="mb-8 space-y-4 md:mb-6 md:space-y-3 lg:mb-8 lg:space-y-4">
                  <div className="flex min-w-0 items-center gap-3 text-neutral-700 dark:text-neutral-300 md:gap-2 lg:gap-3">
                    <MapPin
                      size={17}
                      className="shrink-0 text-[#ff3131] md:size-[15px] lg:size-[17px]"
                    />
                    <p className="min-w-0 truncate whitespace-nowrap text-[14px] font-medium md:text-[12px] lg:text-[15px]">
                      {store.addressLine}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-neutral-700 dark:text-neutral-300 md:gap-2 lg:gap-3">
                    <Phone
                      size={17}
                      className="shrink-0 text-[#ff3131] md:size-[15px] lg:size-[17px]"
                    />
                    <a
                      href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
                      className="text-[14px] font-medium transition hover:text-[#DA3327] md:text-[12px] lg:text-[15px]"
                    >
                      {store.phone}
                    </a>
                  </div>

                  <div className="flex items-start gap-3 text-neutral-700 dark:text-neutral-300 md:gap-2 lg:gap-3">
                    <Clock
                      size={17}
                      className="mt-[2px] shrink-0 text-[#ff3131] md:size-[15px] lg:size-[17px]"
                    />

                    <div className="space-y-2 text-[14px] font-medium md:text-[12px] lg:text-[15px]">
                      {hoursLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>
                </div>

                <Link
                  href={buildStoreHref(store.slug)}
                  className="mt-auto inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#DA3327] px-6 py-4 text-sm font-black uppercase text-white shadow-[0_12px_28px_rgba(218,51,39,0.22)] transition hover:bg-[#12863d] md:h-[48px] md:px-3 md:py-0 md:text-[12px] lg:h-auto lg:px-6 lg:py-4 lg:text-sm"
                >
                  Order Now
                  <ArrowRight size={18} className="md:size-[16px] lg:size-[18px]" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function isStoreOpen(schedule: StoreLocation["schedule"]) {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);

  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hourValue = parts.find((part) => part.type === "hour")?.value;
  const minuteValue = parts.find((part) => part.type === "minute")?.value;

  if (!weekday || !hourValue || !minuteValue) return false;

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const currentDay = dayMap[weekday];
  let currentHour = Number(hourValue);

  if (currentHour === 24) currentHour = 0;

  const currentMinutes = currentHour * 60 + Number(minuteValue);
  const todaySchedule = schedule.find((item) => item.days.includes(currentDay));

  if (!todaySchedule) return false;

  const openMinutes = timeToMinutes(todaySchedule.open);
  const closeMinutes = timeToMinutes(todaySchedule.close);

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}