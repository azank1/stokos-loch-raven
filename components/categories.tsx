"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";

export type MenuCategoryTab = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  sortOrder?: number;
};

type CategoriesProps = {
  // Kept for compatibility with existing page props. No client API fetch is done here.
  storeSlug?: string;
  initialCategories?: MenuCategoryTab[] | null;
};

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const number = Number(cleanString(value).replace(/[^0-9.-]/g, "") || 0);
  return Number.isFinite(number) ? number : 0;
}

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCategories(categories?: Partial<MenuCategoryTab>[] | null) {
  const seen = new Set<string>();

  return (Array.isArray(categories) ? categories : [])
    .map((category) => {
      const name = cleanString(category?.name);
      const id = slugify(category?.slug || category?.id || name);

      return {
        id,
        slug: id,
        name,
        description: cleanString(category?.description),
        image: cleanString(category?.image),
        sortOrder: cleanNumber(category?.sortOrder),
      };
    })
    .filter((category) => {
      if (!category.id || !category.name) return false;
      if (seen.has(category.id)) return false;

      seen.add(category.id);
      return true;
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

export default function Categories({ initialCategories = [] }: CategoriesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Important: this component no longer calls /api/store/[slug]/menu-categories.
  // Categories are rendered from the server-provided initialCategories only.
  const categories = useMemo(
    () => normalizeCategories(initialCategories),
    [initialCategories]
  );

  const [active, setActive] = useState(categories[0]?.id || "");

  useEffect(() => {
    if (!categories.length) {
      setActive("");
      return;
    }

    setActive((current) => {
      if (current && categories.some((category) => category.id === current)) {
        return current;
      }

      return categories[0]?.id || "";
    });
  }, [categories]);

  const handleCategoryClick = (
    id: string,
    event: MouseEvent<HTMLButtonElement>
  ) => {
    setActive(id);

    const target = event.currentTarget;
    const container = scrollRef.current;

    if (container) {
      const scrollPos =
        target.offsetLeft -
        container.clientWidth / 2 +
        target.clientWidth / 2;

      const maxScroll = container.scrollWidth - container.clientWidth;

      container.scrollTo({
        left: Math.max(0, Math.min(scrollPos, maxScroll)),
        behavior: "smooth",
      });
    }

    const section = document.getElementById(id);

    if (section) {
      const yOffset = -150;
      const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;

      window.scrollTo({
        top: y,
        behavior: "smooth",
      });
    }
  };

  if (!categories.length) {
    return null;
  }

  return (
    <div className="top-[125px] z-30 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-black/95 md:top-[82px]">
      <div className="mx-auto w-full max-w-[1600px]">
        <div
          ref={scrollRef}
          className="
            no-scrollbar flex w-full flex-nowrap items-center gap-2.5
            overflow-x-auto scroll-smooth px-4 py-4
            sm:px-5
            md:gap-3 md:px-6
            lg:px-3
            xl:px-10
            2xl:px-0
          "
        >
          {categories.map((cat) => {
            const isActive = active === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={(event) => handleCategoryClick(cat.id, event)}
                className={`
                  relative flex-shrink-0 whitespace-nowrap rounded-full
                  px-5 py-2 text-[12px] font-semibold leading-none
                  outline-none transition-all duration-200
                  sm:px-6 sm:py-2.5 sm:text-[13px]
                  md:px-7 md:text-sm
                  lg:px-8
                  ${
                    isActive
                      ? "bg-[#DA3327] text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }
                `}
              >
                {cat.name}
              </button>
            );
          })}

          <div className="h-1 w-4 flex-shrink-0 md:w-6" />
        </div>
      </div>
    </div>
  );
}
