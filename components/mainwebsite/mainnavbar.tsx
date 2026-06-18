"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import Image from "next/image";
import ClerkAuthControls from "@/components/clerkauthcontrols";

export default function MainNavbar() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("main_theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("main_theme", "light");
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;

    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("main_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("main_theme", "light");
    }

    setIsDark(nextDark);
  };

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Menu", href: "/mainwebsite/location?action=menu" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <header className="top-0 z-50 w-full bg-[#16A34A] text-white shadow-sm transition-colors duration-300 dark:border-b dark:border-white/10 dark:bg-[#003b11]">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-0">
        {/* Top Row */}
        <div className="relative flex min-h-[76px] items-center justify-between gap-4 xl:h-[82px]">
          {/* Desktop Nav */}
          <nav className="hidden items-center gap-8 text-sm font-extrabold uppercase tracking-wide xl:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-white transition hover:text-green-100 dark:hover:text-green-300"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Logo */}
          <Link
            href="/"
            className="shrink-0 xl:absolute xl:left-1/2 xl:-translate-x-1/2"
          >
            <Image
              src="/images/newstokoslogo.png"
              alt="Stoko's Logo"
              width={170}
              height={70}
              priority
              className="h-10 w-auto object-contain md:h-12"
            />
          </Link>

          {/* Right Actions */}
          <div className="ml-auto flex items-center gap-3 md:gap-4">
            <ClerkAuthControls variant="main" />

            <a
              href="/mainwebsite/location?action=order"
              className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#16A34A] transition hover:bg-green-50 dark:bg-white dark:text-[#003b11] md:px-6 md:py-3 md:text-sm"
            >
              Order Online
            </a>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="relative flex h-10 w-[76px] cursor-pointer items-center rounded-full border border-white/30 bg-white/20 p-1 transition dark:bg-white/10 md:h-9 md:w-[70px]"
            >
              <span
                className={`absolute flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#16A34A] shadow-md transition-all duration-300 md:h-7 md:w-7 ${
                  isDark
                    ? "translate-x-[36px] md:translate-x-[34px]"
                    : "translate-x-0"
                }`}
              >
                {isDark ? (
                  <Moon size={15} className="text-black" />
                ) : (
                  <Sun size={15} className="text-green-800" />
                )}
              </span>

              <span className="flex w-full items-center justify-between px-2 text-white">
                <Sun size={14} />
                <Moon size={14} />
              </span>
            </button>
          </div>
        </div>

        {/* Tablet / Mobile Navigation */}
        <nav className="-mx-4 flex items-center justify-start gap-7 overflow-x-auto border-t border-white/20 px-4 py-3 text-xs font-extrabold uppercase tracking-wide no-scrollbar xl:hidden sm:-mx-5 sm:px-5 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-white transition hover:text-green-200"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}