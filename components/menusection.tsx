"use client";

import ProductCard from "@/components/productcard";
import { ChevronRight } from "lucide-react";
import { useSearchStore } from "@/lib/data/useSearchStore";

interface MenuSectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  products: any[];
}

export default function MenuSection({
  id,
  title,
  subtitle,
  products,
}: MenuSectionProps) {
  const { searchQuery } = useSearchStore();

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredProducts = normalizedSearch
    ? products.filter((product) =>
        String(product?.title || product?.name || "")
          .toLowerCase()
          .includes(normalizedSearch)
      )
    : products;

  const visibleProducts = filteredProducts.slice(0, 10);

  if (visibleProducts.length === 0) {
    return null;
  }

  return (
    <section
      id={id}
      className="
        scroll-mt-[120px]
        mx-auto w-full max-w-[1600px]
        px-4
        sm:px-5
        md:px-6
        lg:px-8
        xl:px-10
        2xl:px-0
        pt-6 pb-8
        md:pt-8 md:pb-10
      "
    >
      <div className="mb-5 flex items-center justify-between gap-4 md:mb-6">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2 md:gap-3">
          <h2
            className="
              text-black dark:text-white
              text-[26px]
              font-black uppercase tracking-wide
              leading-tight
              sm:text-[30px]
              md:text-[32px]
              lg:text-4xl
            "
          >
            {title}
          </h2>

          {subtitle && (
            <span
              className="
                text-black dark:text-white
                text-xs font-bold
                md:text-sm
              "
            >
              ({subtitle})
            </span>
          )}

          <span
            className="
              hidden text-xs font-bold uppercase
              text-zinc-600 dark:text-zinc-500
              sm:block
            "
          >
            {visibleProducts.length} Items
          </span>
        </div>

        {!normalizedSearch && (
          <button
            type="button"
            className="
              hidden shrink-0 items-center gap-1
              text-sm font-black uppercase tracking-widest
              text-black transition-all dark:text-white
              md:flex
              lg:text-lg
            "
          >
            ALL <ChevronRight size={20} strokeWidth={4} className="mt-0.5" />
          </button>
        )}
      </div>

      <div
        className="
          grid w-full
          grid-cols-2
          gap-3
          md:grid-cols-3
          md:gap-4
          lg:grid-cols-3
          lg:gap-5
          xl:grid-cols-4
          xl:gap-5
          2xl:grid-cols-5
          2xl:gap-6
        "
      >
        {visibleProducts.map((product, index) => (
          <div
            key={product.id || product._id || `${product.title}-${index}`}
            className={`
              min-w-0 h-full
              ${!normalizedSearch && index >= 4 ? "hidden md:block" : "block"}
            `}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
