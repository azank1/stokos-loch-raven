"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  Moon,
  Sun,
  MapPin,
  ChevronDown,
  X,
  Phone,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useCartStore } from "@/app/store/[slug]/usecartstore";
import { STORES } from "@/lib/data/stores";
import { useSearchStore } from "@/lib/data/useSearchStore";
import ClerkAuthControls from "@/components/clerkauthcontrols";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isDark, setIsDark] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("");

  const { cart, toggleCart, clearCart } = useCartStore();
  const { searchQuery, setSearchQuery } = useSearchStore();

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const storeSlug = pathname.match(/^\/store\/([^/]+)/)?.[1];
  const currentStore =
    STORES.find((store) => store.slug === storeSlug) || STORES[0];

  const storeMenuUrl = currentStore?.menuUrl || "/store/towson";
  const storeBasePath = `/store/${currentStore.slug}`;
  const storeContactPath = `/store/${currentStore.slug}/contact`;

  useEffect(() => {
    const updateHash = () => {
      setActiveHash(window.location.hash);
    };

    updateHash();
    window.addEventListener("hashchange", updateHash);

    return () => {
      window.removeEventListener("hashchange", updateHash);
    };
  }, [pathname]);

  const isMenuActive =
    pathname === storeBasePath &&
    (activeHash === "" || activeHash === "#trending");

  const isContactActive = pathname === storeContactPath;
  const showFloatingCart = pathname === storeBasePath;

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const nextDark = !isDark;

    if (nextDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }

    setIsDark(nextDark);
  };

  const clearActiveOrderData = () => {
    localStorage.removeItem("stokos_order_type");
    localStorage.removeItem("stokos_delivery_address");
    localStorage.removeItem("stokos_order_day");
    localStorage.removeItem("stokos_order_time");
    localStorage.removeItem("stokos_order_store");

    window.dispatchEvent(new Event("stokos-order-updated"));
  };

  const changeStore = (menuUrl: string, slug: string) => {
    if (slug !== currentStore.slug) {
      clearCart();
      clearActiveOrderData();
      setSearchQuery("");
    }

    setLocationOpen(false);
    router.push(menuUrl);
  };

  const navClass = (active: boolean) =>
    `font-extrabold transition whitespace-nowrap ${
      active
        ? "text-white border-b-2 border-green-200 pb-1"
        : "text-white hover:text-green-200"
    }`;

  return (
    <>
      <header className="top-0 z-50 w-full border-b border-zinc-800 bg-green-600 text-white shadow-md dark:bg-green-700">
        <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6">
          {/* Top Row */}
          <div className="relative flex min-h-[76px] items-center justify-between gap-3 md:min-h-[82px] 2xl:h-[86px]">
            {/* Desktop Navigation Only */}
            <nav className="hidden items-center gap-8 text-sm uppercase tracking-wide 2xl:flex">
              <Link href="/" className={navClass(pathname === "/")}>
                Home
              </Link>

              <Link
                href={`${storeMenuUrl}#trending`}
                className={navClass(isMenuActive)}
              >
                Menu
              </Link>

              <Link
                href={`/store/${currentStore.slug}/contact`}
                className={navClass(isContactActive)}
              >
                Contact Us
              </Link>
            </nav>

            {/* Logo */}
            <Link
              href={storeMenuUrl}
              className="flex shrink-0 items-center 2xl:absolute 2xl:left-1/2 2xl:-translate-x-1/2"
            >
              <Image
                src="/images/newstokoslogo.png"
                alt="Stoko's Logo"
                width={170}
                height={70}
                priority
                className="h-10 w-auto object-contain sm:h-11 md:h-12"
              />
            </Link>

            {/* Right Actions */}
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 md:gap-4 2xl:gap-3">
              {/* Desktop Search Only */}
              <div className="hidden min-w-0 items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 2xl:flex">
                <Search size={17} className="shrink-0" />

        <input
  type="text"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  placeholder="Search menu..."
  className="w-full bg-transparent text-sm text-white placeholder:text-white/70 outline-none"
/>
              </div>

              {/* Desktop Location Only */}
              <button
                type="button"
                onClick={() => setLocationOpen(true)}
                className="hidden shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20 2xl:flex"
              >
                <MapPin size={16} />
                <span className="max-w-[110px] truncate">
                  {currentStore.displayName}
                </span>
                <ChevronDown size={15} />
              </button>

              <ClerkAuthControls variant="store" />

              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
                className="relative flex h-9 w-[64px] shrink-0 cursor-pointer items-center rounded-full border border-white/25 bg-white/20 px-1 md:w-[70px]"
              >
                <span
                  className={`absolute flex h-7 w-7 items-center justify-center rounded-full bg-white transition-transform duration-300 ${
                    isDark
                      ? "translate-x-[28px] md:translate-x-[34px]"
                      : "translate-x-0"
                  }`}
                >
                  {isDark ? (
                    <Moon size={14} className="text-black" />
                  ) : (
                    <Sun size={14} className="text-green-800" />
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Mobile Search + Location */}
          <div className="-mx-4 flex gap-2 border-t border-white/20 px-4 py-3 md:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-2">
              <Search size={15} className="shrink-0" />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu..."
                className="w-full bg-transparent text-xs text-white placeholder:text-white/70 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setLocationOpen(true)}
              className="flex max-w-[42%] shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/15 px-3 py-2 text-xs font-black text-white"
            >
              <MapPin size={14} className="shrink-0" />
              <span className="truncate">{currentStore.displayName}</span>
            </button>
          </div>

          {/* Laptop + Tablet Bottom Row */}
          <div className="-mx-4 hidden border-t border-white/20 md:-mx-6 md:block 2xl:hidden">
            <div className="flex w-full items-center justify-between gap-4 px-4 py-3 md:px-6">
              <nav className="flex shrink-0 items-center gap-6 overflow-x-auto text-xs uppercase no-scrollbar md:gap-8 md:text-sm">
                <Link href="/" className={navClass(pathname === "/")}>
                  Home
                </Link>

                <Link
                  href={`${storeMenuUrl}#trending`}
                  className={navClass(isMenuActive)}
                >
                  Menu
                </Link>

                <Link
                  href={`/store/${currentStore.slug}/contact`}
                  className={navClass(isContactActive)}
                >
                  Contact
                </Link>
              </nav>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                <div className="flex min-w-[210px] max-w-[380px] flex-1 items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 xl:max-w-[430px]">
                  <Search size={17} className="shrink-0" />

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search menu..."
                    className="w-full bg-transparent text-sm text-white placeholder:text-white/70 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setLocationOpen(true)}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20"
                >
                  <MapPin size={16} className="shrink-0" />
                  <span className="max-w-[110px] truncate">
                    {currentStore.displayName}
                  </span>
                  <ChevronDown size={15} className="shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          <nav className="-mx-4 flex w-auto items-center justify-start gap-7 overflow-x-auto border-t border-white/20 px-4 py-3 text-xs uppercase no-scrollbar md:hidden">
            <Link href="/" className={navClass(pathname === "/")}>
              Home
            </Link>

            <Link
              href={`${storeMenuUrl}#trending`}
              className={navClass(isMenuActive)}
            >
              Menu
            </Link>

            <Link
              href={`/store/${currentStore.slug}/contact`}
              className={navClass(isContactActive)}
            >
              Contact
            </Link>
          </nav>
        </div>
      </header>

      {/* Overlay */}
      {locationOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
          onClick={() => setLocationOpen(false)}
        />
      )}

      {/* Location Drawer */}
      <aside
        className={`fixed right-0 top-3 z-[90] flex h-[calc(100dvh-24px)] w-[92vw] max-w-[420px] flex-col overflow-hidden rounded-l-3xl bg-white shadow-2xl transition-transform duration-300 dark:bg-[#111] md:top-0 md:h-dvh md:max-w-md md:rounded-none ${
          locationOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="shrink-0 border-b bg-white p-5 dark:border-zinc-800 dark:bg-[#111]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-black dark:text-white">
                Choose Location
              </h2>

              <p className="mt-1 text-xs text-zinc-500">
                Select your nearest Stoko&apos;s store.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setLocationOpen(false)}
              className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-8">
          {STORES.map((store) => {
            const isActive = store.slug === currentStore.slug;

            return (
              <div
                key={store.slug}
                className={`rounded-2xl border p-4 transition ${
                  isActive
                    ? "border-green-700 bg-green-50 dark:bg-green-950/20"
                    : "border-zinc-200 bg-white hover:border-green-500 dark:border-zinc-800 dark:bg-black"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-black dark:text-white">
                      {store.name}
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      {store.address}
                      <br />
                      {store.cityStateZip}
                    </p>
                  </div>

                  {isActive && (
                    <span className="rounded-full bg-green-700 px-3 py-1 text-[10px] font-black uppercase text-white">
                      Current
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex gap-2">
                    <Phone size={16} className="mt-0.5 shrink-0" />

                    <a
                      href={`tel:${store.phone}`}
                      className="hover:text-green-700"
                    >
                      {store.phone}
                    </a>
                  </div>

                  <div className="flex gap-2">
                    <Clock size={16} className="mt-0.5 shrink-0" />

                    <span>
                      {store.hours.map((hour) => (
                        <span key={hour} className="block">
                          {hour}
                        </span>
                      ))}
                    </span>
                  </div>

                  {store.social.google && (
                    <a
                      href={store.social.google}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-bold text-green-700"
                    >
                      View on Google Maps
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isActive}
                  onClick={() => changeStore(store.menuUrl, store.slug)}
                  className={`mt-5 h-11 w-full rounded-full text-sm font-black uppercase transition ${
                    isActive
                      ? "cursor-default bg-green-700 text-white"
                      : "bg-[#DA3327] text-white hover:bg-[#c52d22]"
                  }`}
                >
                  {isActive ? "Current Store" : "Order From This Store"}
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Floating Cart */}
      {showFloatingCart && (
        <button
          type="button"
          onClick={toggleCart}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#DA3327] text-white shadow-2xl transition hover:scale-105 active:scale-95 md:h-16 md:w-16"
        >
          <ShoppingCart size={24} />

          {cartCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-2 text-xs font-black text-white dark:bg-green-500">
              {cartCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}