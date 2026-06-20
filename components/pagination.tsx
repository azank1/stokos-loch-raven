"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  /** Items shown per page — used for the "Showing X to Y of Z" label. */
  pageSize: number;
  /** Plural noun for the count label, e.g. "orders", "products". */
  itemLabel?: string;
  onPageChange: (page: number) => void;
};

/**
 * Build a windowed list of page numbers so large page counts don't render
 * dozens of buttons. Always includes the first and last page, the current
 * page, and its immediate neighbours, with "…" gaps in between.
 */
function getPageWindow(current: number, total: number): (number | "ellipsis")[] {
  const delta = 1;
  const pages = new Set<number>([1, total]);

  for (let p = current - delta; p <= current + delta; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  let previous = 0;

  for (const page of sorted) {
    if (previous && page - previous > 1) result.push("ellipsis");
    result.push(page);
    previous = page;
  }

  return result;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel = "items",
  onPageChange,
}: PaginationProps) {
  if (totalItems <= pageSize) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pages = getPageWindow(currentPage, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-zinc-500">
        Showing <span className="font-black text-zinc-950">{startItem}</span>{" "}
        to <span className="font-black text-zinc-950">{endItem}</span> of{" "}
        <span className="font-black text-zinc-950">{totalItems}</span>{" "}
        {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="flex h-9 items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} />
          Prev
        </button>

        <div className="flex items-center gap-1">
          {pages.map((page, index) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="flex h-9 w-9 items-center justify-center text-sm font-black text-zinc-400"
              >
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black transition ${
                  currentPage === page
                    ? "bg-green-700 text-white"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="flex h-9 items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
