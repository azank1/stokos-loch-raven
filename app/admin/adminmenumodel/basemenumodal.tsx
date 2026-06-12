"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export default function BaseMenuModal({
  title,
  subtitle,
  isEdit,
  onClose,
  onSave,
  children,
}: {
  title: string;
  subtitle: string;
  isEdit: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  const isProductModal = useMemo(() => {
    return `${title} ${subtitle}`.toLowerCase().includes("product");
  }, [title, subtitle]);

  useEffect(() => {
    setMounted(true);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] h-screen w-screen bg-black/60">
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="max-h-[calc(100vh-32px)] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-green-800">
                {title}
              </p>

              <h3 className="mt-1 text-2xl font-black text-zinc-950">
                {subtitle}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-5 p-5">{children}</div>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-zinc-200 bg-white p-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-zinc-100 px-5 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-200"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              className="rounded-full bg-green-800 px-5 py-3 text-sm font-black text-white transition hover:bg-green-900"
            >
              {isProductModal ? "Next / Save" : isEdit ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
