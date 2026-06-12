"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import DealProductModal from "./dealsproductmodel";

type StoreSlug = "towson" | "york" | "liberty";

type MenuCategoryTab = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  sortOrder?: number;
};

type DealProduct = {
  id: string;
  _id?: string;
  deal: string;
  slug?: string;
  category: "deals";
  title: string;
  name: string;
  description: string;
  price: string;
  image: string;
  storeSlug?: StoreSlug;
  storeConfig?: any;
  sizes?: any[];
  modifierGroups?: any[];
  relatedUpsells?: any[];
  [key: string]: any;
};

type DealsSectionProps = {
  storeSlug?: StoreSlug | string;
  categories?: MenuCategoryTab[];
  initialProducts?: any[];
};

const validStores: StoreSlug[] = ["towson", "york", "liberty"];

const MENU_COUPON_CATEGORY_KEYS = new Set([
  "menu-coupons",
  "menu-coupon",
  "menu-coupon-category",
  "coupons",
  "coupon",
  "deals",
  "deal",
  "menu-deals",
  "menu-deal",
]);

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function normalizeStoreId(value: unknown) {
  return cleanString(value).toLowerCase();
}

function getMatchingStoreConfig(product: any, storeSlug: string) {
  const cleanStoreSlug = normalizeStoreId(storeSlug);
  const configs = Array.isArray(product?.storeConfigs) ? product.storeConfigs : [];

  if (!configs.length) return product?.storeConfig || null;

  const matched = configs.find((config: any) => {
    const configStoreId = normalizeStoreId(
      config?.storeId || config?.storeSlug || config?.store
    );

    return configStoreId === cleanStoreSlug;
  });

  return matched || product?.storeConfig || configs[0] || null;
}

function isMenuCouponCategory(category: Partial<MenuCategoryTab>) {
  const keys = [category.id, category.slug, category.name]
    .filter(Boolean)
    .map((value) => slugify(value));

  return keys.some((key) => MENU_COUPON_CATEGORY_KEYS.has(key));
}

function getMenuCouponCategoryKeys(categories: MenuCategoryTab[]) {
  const keys = new Set<string>(MENU_COUPON_CATEGORY_KEYS);

  (categories || []).forEach((category) => {
    if (!isMenuCouponCategory(category)) return;

    [category.id, category.slug, category.name].forEach((value) => {
      const key = slugify(value);
      if (key) keys.add(key);
    });
  });

  return keys;
}

function getProductCategoryKeys(product: any) {
  const storeConfig = product?.storeConfig || null;

  return [
    product?.categoryId,
    product?.categoryID,
    product?.category_id,
    product?.category,
    product?.categorySlug,
    product?.categoryName,
    product?.categoryTitle,

    storeConfig?.categoryId,
    storeConfig?.categorySlug,
    storeConfig?.categoryName,

    product?.category?.id,
    product?.category?._id,
    product?.category?.slug,
    product?.category?.name,
  ]
    .filter(Boolean)
    .map((value) => slugify(value));
}

function isMenuCouponProduct(product: any, categories: MenuCategoryTab[]) {
  const couponCategoryKeys = getMenuCouponCategoryKeys(categories);
  const productCategoryKeys = getProductCategoryKeys(product);

  return productCategoryKeys.some((key) => couponCategoryKeys.has(key));
}

function getFirstSizePrice(product: any, storeConfig: any) {
  const sizes = Array.isArray(storeConfig?.sizes)
    ? storeConfig.sizes
    : Array.isArray(product?.sizes)
    ? product.sizes
    : [];

  const firstSizeWithPrice = sizes.find((size: any) => {
    const value = Number(size?.price ?? size?.upcharge ?? size?.amount);
    return Number.isFinite(value) && value > 0;
  });

  return firstSizeWithPrice?.price ?? firstSizeWithPrice?.upcharge ?? firstSizeWithPrice?.amount;
}

function formatPrice(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? `$${value.toFixed(2)}` : "$0.00";
  }

  const raw = cleanString(value);
  if (!raw) return "$0.00";

  if (raw.includes("$")) return raw;

  const number = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : raw;
}

function getDealImage(product: any, storeConfig: any) {
  return (
    cleanString(storeConfig?.image) ||
    cleanString(storeConfig?.imageUrl) ||
    cleanString(product?.image) ||
    cleanString(product?.imageUrl) ||
    cleanString(product?.thumbnail) ||
    cleanString(product?.photo) ||
    "/images/placeholder-food.png"
  );
}

function normalizeDealProduct(product: any, storeSlug: StoreSlug): DealProduct {
  const storeConfig = getMatchingStoreConfig(product, storeSlug);

  const id = cleanString(product?.id || product?._id || product?.slug);
  const title = cleanString(product?.title || product?.name || "Menu Coupon");
  const slug = cleanString(product?.slug) || slugify(title || id);
  const priceValue =
    storeConfig?.price ??
    product?.price ??
    product?.basePrice ??
    getFirstSizePrice(product, storeConfig) ??
    0;

  return {
    ...product,
    storeConfig,
    id: id || slug,
    _id: product?._id,
    deal: cleanString(product?.deal || slug || id),
    slug,
    category: "deals",
    title,
    name: title,
    description: cleanString(product?.description),
    price: formatPrice(priceValue),
    image: getDealImage(product, storeConfig),
    storeSlug,
    sizes: Array.isArray(storeConfig?.sizes) ? storeConfig.sizes : product?.sizes || [],
    relatedUpsells: Array.isArray(storeConfig?.relatedUpsells)
      ? storeConfig.relatedUpsells
      : product?.relatedUpsells || [],
    modifierGroups:
      Array.isArray(storeConfig?.modifierGroups) && storeConfig.modifierGroups.length > 0
        ? storeConfig.modifierGroups
        : Array.isArray(product?.modifierGroups) && product.modifierGroups.length > 0
        ? product.modifierGroups
        : Array.isArray(product?.attachedModifierGroups)
        ? product.attachedModifierGroups
        : [],
  };
}

export default function DealsSection({
  storeSlug: storeSlugProp,
  categories = [],
  initialProducts = [],
}: DealsSectionProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  const [selectedDeal, setSelectedDeal] = useState<DealProduct | null>(null);
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);

  const currentSlug = cleanString(storeSlugProp);

  const storeSlug: StoreSlug = validStores.includes(currentSlug as StoreSlug)
    ? (currentSlug as StoreSlug)
    : "towson";

  const deals = useMemo(() => {
    return (initialProducts || [])
      .map((product) => {
        const storeConfig = getMatchingStoreConfig(product, storeSlug);
        return {
          ...product,
          storeConfig,
        };
      })
      .filter((product) => isMenuCouponProduct(product, categories))
      .map((product) => normalizeDealProduct(product, storeSlug));
  }, [initialProducts, categories, storeSlug]);

  const selectedDealSlug = searchParams.get("deal");

  const openDealModal = (deal: DealProduct) => {
    setSelectedDeal({
      ...deal,
      storeSlug,
    });
    setIsDealModalOpen(true);
  };

  const closeDealModal = () => {
    setIsDealModalOpen(false);
    setSelectedDeal(null);
  };

  useEffect(() => {
    if (!selectedDealSlug) return;
    if (!deals.length) return;

    const cleanDealSlug = slugify(selectedDealSlug);

    const matchedDeal = deals.find((item) => {
      return [item.deal, item.id, item._id, item.slug, item.title]
        .filter(Boolean)
        .some((value) => slugify(value) === cleanDealSlug);
    });

    if (!matchedDeal) return;

    window.requestAnimationFrame(() => {
      const dealsSection = document.getElementById("deals");

      if (dealsSection) {
        const top = dealsSection.getBoundingClientRect().top + window.scrollY - 120;

        window.scrollTo({
          top,
          behavior: "smooth",
        });
      }

      openDealModal(matchedDeal);
    });
  }, [selectedDealSlug, storeSlug, deals]);

  const scroll = (direction: "left" | "right") => {
    if (!sliderRef.current) return;

    const scrollAmount = sliderRef.current.clientWidth * 0.85;

    sliderRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (!deals.length) return null;

  return (
    <>
      <section
        id="deals"
        className="w-full overflow-hidden scroll-mt-[120px] py-5 md:py-8 lg:py-10"
      >
        <div
          className="
            mx-auto w-full max-w-[1600px]
            px-4
            sm:px-5
            md:px-6
            lg:px-8
            xl:px-10
            2xl:px-0
          "
        >
          <div className="mb-4 flex items-center justify-between gap-4 md:mb-6">
            <h2
              className="
                text-[26px] font-black uppercase leading-none tracking-tight
                text-black dark:text-white
                sm:text-[30px]
                md:text-[34px]
                lg:text-4xl
              "
            >
              Explore More Deals
            </h2>

            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => scroll("left")}
                aria-label="Previous deals"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-black transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
              >
                <ChevronLeft size={20} />
              </button>

              <button
                type="button"
                onClick={() => scroll("right")}
                aria-label="Next deals"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-black transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div
            ref={sliderRef}
            className="
              no-scrollbar flex snap-x snap-mandatory overflow-x-auto
              scroll-smooth pb-3

              gap-4
              scroll-px-4

              md:gap-5
              md:scroll-px-6

              lg:gap-6
              lg:scroll-px-8
            "
          >
            {deals.map((deal) => (
              <article
                key={deal.id}
                className="
                  group shrink-0 snap-start overflow-hidden rounded-[20px]
                  bg-white ring-1 ring-black/5 transition duration-300
                  hover:-translate-y-1
                  dark:bg-[#121b13] dark:ring-white/10

                  w-[84vw]
                  sm:w-[380px]
                  md:w-[calc((100%-20px)/2)]
                  lg:w-[410px]
                "
              >
                <button
                  type="button"
                  onClick={() => openDealModal(deal)}
                  className="
                    relative block w-full overflow-hidden bg-neutral-100
                    text-left dark:bg-[#050505]

                    h-[205px]
                    md:h-[225px]
                  "
                >
                  <Image
                    src={deal.image}
                    alt={deal.title}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 84vw, (max-width: 1024px) 50vw, 410px"
                  />

                  <div className="absolute left-4 top-4 rounded-full bg-[#DA3327] px-4 py-2 text-[12px] font-black uppercase tracking-wide text-white">
                    Deal
                  </div>

                  <div className="pointer-events-none absolute inset-0 hidden bg-black/5 dark:block" />
                </button>

                <div className="p-5 md:p-6">
                  <h3
                    className="
                      text-[21px] font-black leading-tight tracking-[-0.03em]
                      text-black transition-colors duration-300 dark:text-white
                      md:text-[22px]
                    "
                  >
                    {deal.title}
                  </h3>

                  <p className="mt-3 min-h-[52px] text-[14px] font-medium leading-[1.55] text-neutral-700 transition-colors duration-300 dark:text-neutral-300">
                    {deal.description || "Special menu coupon deal."}
                  </p>

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <p className="shrink-0 text-[26px] font-black leading-none tracking-[-0.04em] text-black dark:text-white">
                      {deal.price}
                    </p>

                    <button
                      type="button"
                      onClick={() => openDealModal(deal)}
                      className="
                        inline-flex h-[42px] shrink-0 items-center justify-center
                        rounded-full bg-[#DA3327] px-5 text-[12px]
                        font-black uppercase tracking-wide text-white
                        transition hover:bg-[#DA2337] active:scale-[0.98]
                        md:px-6
                      "
                    >
                      Order Deal
                    </button>
                  </div>
                </div>
              </article>
            ))}

            <div className="h-1 w-1 shrink-0" />
          </div>
        </div>
      </section>

      {selectedDeal && (
        <DealProductModal
          product={selectedDeal}
          isOpen={isDealModalOpen}
          onClose={closeDealModal}
        />
      )}
    </>
  );
}
