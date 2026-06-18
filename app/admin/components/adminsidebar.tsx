"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  Store,
  StoreIcon,
  X,
  type LucideIcon,
} from "lucide-react";

type SidebarItem = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const navItems: SidebarItem[] = [
  {
    label: "Dashboard",
    description: "Business overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Orders",
    description: "Live order queue",
    href: "/admin/orders",
    icon: ClipboardList,
  },
  {
    label: "Menu Management",
    description: "Products and modifiers",
    href: "/admin/menu",
    icon: ShoppingBag,
  },
  {
    label: "Store Management",
    description: "Multi Stores  and details",
    href: "/admin/stores",
    icon: StoreIcon,
  },
];

export default function AdminSidebar({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { signOut } = useClerk();

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-green-800 shadow-lg">
            <Store size={22} />
          </div>

          <div>
            <p className="text-lg font-black leading-none">Stoko&apos;s</p>
            <p className="mt-1 text-xs font-bold text-white/55">Admin Panel</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mb-5 rounded-3xl bg-white/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/50">
            Store
          </p>

          <span className="rounded-full bg-green-400/20 px-3 py-1 text-[10px] font-black uppercase text-green-200">
            Online
          </span>
        </div>

        <p className="text-sm font-black">Stoko&apos;s Loch Raven</p>
        <p className="mt-1 text-xs text-white/55">Web ordering dashboard</p>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;

          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`group flex w-full items-center gap-3 rounded-3xl p-3 text-left transition ${
                active
                  ? "bg-white text-green-900 shadow-lg"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  active ? "bg-green-100 text-green-800" : "bg-white/10"
                }`}
              >
                <Icon size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{item.label}</p>

                <p
                  className={`mt-0.5 truncate text-xs ${
                    active ? "text-green-900/55" : "text-white/40"
                  }`}
                >
                  {item.description}
                </p>
              </div>

              {active && <ChevronRight size={18} />}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: "/admin/sign-in" })}
          className="flex w-full items-center gap-3 rounded-3xl p-3 text-left text-white/70 transition hover:bg-red-500/10 hover:text-white"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <LogOut size={20} />
          </div>

          <div>
            <p className="text-sm font-black">Logout</p>
            <p className="mt-0.5 text-xs text-white/40">Admin session</p>
          </div>
        </button>
      </div>
    </div>
  );
}