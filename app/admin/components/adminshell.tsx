"use client";

import { useState } from "react";
import { Bell, Menu as MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import AdminSidebar from "./adminsidebar";
import ClerkAuthControls from "@/components/clerkauthcontrols";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const pageTitle =
    pathname === "/admin"
      ? "Dashboard"
      : pathname.startsWith("/admin/orders")
      ? "Orders Dashboard"
      : pathname.startsWith("/admin/menu")
      ? "Menu Management"
      : "Admin Dashboard";

  return (
    <main className="min-h-screen bg-[#F6F7F4] text-black">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[300px] border-r border-white/10 bg-[#0F3F24] p-4 text-white lg:flex">
        <AdminSidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[300px] border-r border-white/10 bg-[#0F3F24] p-4 text-white transition-transform duration-300 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AdminSidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      <section className="min-h-screen lg:ml-[300px]">
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#F6F7F4]/85 backdrop-blur-xl">
          <div className="flex h-[76px] items-center justify-between px-4 md:px-6 xl:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm lg:hidden"
              >
                <MenuIcon size={20} />
              </button>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-green-800">
                  Stoko&apos;s Admin
                </p>
                <h1 className="text-xl font-black tracking-tight md:text-2xl">
                  {pageTitle}
                </h1>
              </div>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <ClerkAuthControls variant="admin" />

              <div className="flex items-center gap-2 rounded-full border border-green-100 bg-white px-4 py-2 shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
                <span className="text-xs font-black uppercase text-green-800">
                  Live Updates
                </span>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
                <Bell size={19} className="text-green-800" />
              </div>
            </div>
          </div>
        </header>

        <div className="px-4 py-5 md:px-6 xl:px-8">{children}</div>
      </section>
    </main>
  );
}