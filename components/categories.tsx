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
  storeSlug?: string;
  initialCategories?: MenuCategoryTab[] | null;
};

const POLLING_MS = 3000;

const TRENDING_CATEGORY: MenuCategoryTab = {
  id: "trending",
  slug: "trending",
  name: "Popular Menu Items",
  description: "",
  image: "",
  sortOrder: -1,
};

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isExpectedNetworkError(error: any) {
  const message = String(error?.message || error || "").toLowerCase();

  return (
    error?.name === "AbortError" ||
    message.includes("failed to fetch") ||
    message.includes("network error") ||
    message.includes("load failed")
  );
}

function getCategorySectionId(category: Partial<MenuCategoryTab>) {
  return slugify(category.slug || category.id || category.name || "");
}

function isPopularCategory(category: Partial<MenuCategoryTab>) {
  const id = slugify(String(category.id || ""));
  const slug = slugify(String(category.slug || ""));
  const name = slugify(String(category.name || ""));

  return (
    id === "trending" ||
    slug === "trending" ||
    name === "trending" ||
    name === "popular-menu-items" ||
    name === "popular-items" ||
    name === "popular-menu-item"
  );
}

function normalizeCategories(
  categories?: Partial<MenuCategoryTab>[] | null
): MenuCategoryTab[] {
  const safeCategories = Array.isArray(categories) ? categories : [];

  return safeCategories
    .map((category) => {
      const name = String(category?.name || "").trim();

      const sectionId = getCategorySectionId({
        id: category?.id,
        slug: category?.slug,
        name,
      });

      return {
        id: sectionId,
        slug: sectionId,
        name,
        description: category?.description || "",
        image: category?.image || "",
        sortOrder: Number(category?.sortOrder || 0),
      };
    })
    .filter((category) => category.id && category.name);
}

function withTrending(
  categories?: Partial<MenuCategoryTab>[] | null
): MenuCategoryTab[] {
  const normalized = normalizeCategories(categories);

  const withoutPopularDuplicate = normalized.filter(
    (category) => !isPopularCategory(category)
  );

  return [TRENDING_CATEGORY, ...withoutPopularDuplicate];
}

function categoriesChanged(
  oldCategories: MenuCategoryTab[],
  newCategories: MenuCategoryTab[]
) {
  return JSON.stringify(oldCategories) !== JSON.stringify(newCategories);
}

export default function Categories({
  storeSlug = "",
  initialCategories = [],
}: CategoriesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const normalizedInitialCategories = useMemo(() => {
    return withTrending(initialCategories);
  }, [initialCategories]);

  const [categories, setCategories] = useState<MenuCategoryTab[]>(
    normalizedInitialCategories
  );

  const [active, setActive] = useState(
    normalizedInitialCategories[0]?.id || "trending"
  );

  useEffect(() => {
    setCategories(normalizedInitialCategories);
  }, [normalizedInitialCategories]);

  useEffect(() => {
    if (!categories.length) return;

    const activeExists = categories.some((category) => category.id === active);

    if (!activeExists) {
      setActive(categories[0]?.id || "trending");
    }
  }, [categories, active]);

  useEffect(() => {
    if (!storeSlug) return;

    let cancelled = false;
    let controller: AbortController | null = null;

    async function loadLatestCategories() {
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch(
          `/api/public/menu/categories/${storeSlug}?t=${Date.now()}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              "Cache-Control": "no-cache",
            },
          }
        );

        if (!response.ok) {
          return;
        }

        let data: any = null;

        try {
          data = await response.json();
        } catch {
          return;
        }

        const latestCategories = withTrending(
          Array.isArray(data?.categories) ? data.categories : []
        );

        if (cancelled) return;

        setCategories((currentCategories) => {
          if (categoriesChanged(currentCategories, latestCategories)) {
            return latestCategories;
          }

          return currentCategories;
        });
      } catch (error: any) {
        if (isExpectedNetworkError(error)) {
          return;
        }

        console.error("Auto category refresh failed:", error);
      }
    }

    loadLatestCategories();

    const interval = window.setInterval(loadLatestCategories, POLLING_MS);

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, [storeSlug]);

  const handleCategoryClick = (
    id: string,
    e: MouseEvent<HTMLButtonElement>
  ) => {
    setActive(id);

    const target = e.currentTarget;
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
      const y =
        section.getBoundingClientRect().top + window.pageYOffset + yOffset;

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
                onClick={(e) => handleCategoryClick(cat.id, e)}
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