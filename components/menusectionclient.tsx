"use client";

import { useMemo } from "react";
import MenuSection from "@/components/menusection";
import { useSearchStore } from "@/lib/data/useSearchStore";

export type MenuCategoryTab = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  sortOrder?: number;
};

type MenuSectionsClientProps = {
  storeSlug: string;
  categories: MenuCategoryTab[];
  initialProducts: any[];
};

const POPULAR_CATEGORY: MenuCategoryTab = {
  id: "trending",
  slug: "trending",
  name: "Popular Menu Items",
  description: "",
  image: "",
  sortOrder: -1,
};

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

function cleanBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();

    if (["true", "yes", "1", "active", "popular", "featured"].includes(lower)) {
      return true;
    }

    if (["false", "no", "0", "inactive", "off", "hidden"].includes(lower)) {
      return false;
    }
  }

  return fallback;
}

function cleanNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = cleanString(value).replace(/[^0-9.]/g, "");
  const number = Number(raw || 0);

  return Number.isFinite(number) ? number : 0;
}

function normalizeStoreId(value: unknown) {
  return cleanString(value).toLowerCase();
}

function isPopularCategory(category: Partial<MenuCategoryTab>) {
  const id = slugify(category.id);
  const slug = slugify(category.slug);
  const name = slugify(category.name);

  return (
    id === "trending" ||
    slug === "trending" ||
    name === "trending" ||
    name === "popular-menu-items" ||
    name === "popular-items" ||
    name === "popular-menu-item"
  );
}

function isMenuCouponsCategory(category: Partial<MenuCategoryTab>) {
  const keys = [category.id, category.slug, category.name]
    .filter(Boolean)
    .map((value) => slugify(value));

  return keys.some((key) => MENU_COUPON_CATEGORY_KEYS.has(key));
}

function normalizeCategory(category: MenuCategoryTab): MenuCategoryTab {
  const name = cleanString(category.name);
  const slug = cleanString(category.slug) || slugify(name);

  return {
    id: cleanString(category.id || slug),
    name,
    slug,
    description: cleanString(category.description),
    image: cleanString(category.image),
    sortOrder: Number(category.sortOrder || 0),
  };
}

function normalizeRealCategories(categories: MenuCategoryTab[]) {
  const seen = new Set<string>();

  return (categories || [])
    .map(normalizeCategory)
    .filter((category) => {
      if (!category.id || !category.name) return false;
      if (isPopularCategory(category)) return false;
      if (isMenuCouponsCategory(category)) return false;

      const key = slugify(category.slug || category.name || category.id);

      if (!key) return false;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function buildMenuCategories(categories: MenuCategoryTab[]) {
  return [POPULAR_CATEGORY, ...normalizeRealCategories(categories || [])];
}

function getCategorySectionId(category: MenuCategoryTab) {
  return slugify(category.slug || category.name || category.id);
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

function productBelongsToCategory(product: any, category: MenuCategoryTab) {
  const categoryKeys = [
    category.id,
    category.slug,
    category.name,
    slugify(category.id),
    slugify(category.slug || ""),
    slugify(category.name),
  ]
    .filter(Boolean)
    .map((value) => slugify(value));

  const productCategoryKeys = getProductCategoryKeys(product);

  return categoryKeys.some((key) => productCategoryKeys.includes(key));
}

function isMenuCouponProduct(product: any) {
  const productCategoryKeys = getProductCategoryKeys(product);

  return productCategoryKeys.some((key) => MENU_COUPON_CATEGORY_KEYS.has(key));
}

function isProductPopular(product: any, storeSlug: string) {
  const matchedStoreConfig = getMatchingStoreConfig(product, storeSlug);
  const storeConfigs = Array.isArray(product?.storeConfigs) ? product.storeConfigs : [];

  const matchedStorePopular = matchedStoreConfig
    ? cleanBoolean(matchedStoreConfig.isPopular) ||
      cleanBoolean(matchedStoreConfig.showInPopular)
    : false;

  const anyStorePopular = storeConfigs.some((config: any) => {
    const configStoreId = normalizeStoreId(
      config?.storeId || config?.storeSlug || config?.store
    );
    const sameStore = !storeSlug || configStoreId === normalizeStoreId(storeSlug);

    return (
      sameStore &&
      (cleanBoolean(config?.isPopular) || cleanBoolean(config?.showInPopular))
    );
  });

  return (
    matchedStorePopular ||
    anyStorePopular ||
    cleanBoolean(product?.isPopular) ||
    cleanBoolean(product?.popular) ||
    cleanBoolean(product?.isFeatured) ||
    cleanBoolean(product?.featured) ||
    cleanBoolean(product?.showInPopular) ||
    cleanBoolean(product?.showInPopularMenu) ||
    cleanBoolean(product?.store?.isPopular)
  );
}

function normalizeProduct(product: any, storeSlug: string) {
  const storeConfig = getMatchingStoreConfig(product, storeSlug);

  return {
    ...product,
    storeConfig,

    id: cleanString(product?.id || product?._id),
    _id: product?._id,

    title: cleanString(product?.title || product?.name),
    name: cleanString(product?.name || product?.title),

    isPopular: isProductPopular(product, storeSlug),

    categoryId: cleanString(
      storeConfig?.categoryId ||
        product?.categoryId ||
        product?.categoryID ||
        product?.category_id ||
        product?.category?.id ||
        product?.category?._id
    ),

    categorySlug: cleanString(
      storeConfig?.categorySlug ||
        product?.categorySlug ||
        product?.category?.slug ||
        product?.category ||
        product?.categoryName
    ),

    categoryName: cleanString(
      storeConfig?.categoryName ||
        product?.categoryName ||
        product?.categoryTitle ||
        product?.category?.name ||
        product?.category
    ),

    price: cleanNumber(storeConfig?.price ?? product?.price ?? 0),
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

function searchProduct(product: any, query: string) {
  const searchableText = [
    product?.title,
    product?.name,
    product?.description,
    product?.category,
    product?.categoryId,
    product?.categorySlug,
    product?.categoryName,
    product?.categoryTitle,
    product?.slug,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

export default function MenuSectionsClient({
  storeSlug,
  categories,
  initialProducts,
}: MenuSectionsClientProps) {
  const searchQuery = useSearchStore((state) => state.searchQuery);

  const liveCategories = useMemo(
    () => buildMenuCategories(categories || []),
    [categories]
  );

  const liveProducts = useMemo(
    () => (initialProducts || []).map((product) => normalizeProduct(product, storeSlug)),
    [initialProducts, storeSlug]
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return liveProducts;

    return liveProducts.filter((product) => searchProduct(product, query));
  }, [liveProducts, searchQuery]);

  const normalMenuProducts = useMemo(() => {
    return filteredProducts.filter((product) => !isMenuCouponProduct(product));
  }, [filteredProducts]);

  const visibleSections = useMemo(() => {
    return liveCategories
      .map((category) => {
        const sectionProducts = isPopularCategory(category)
          ? normalMenuProducts.filter((product) => product.isPopular === true)
          : normalMenuProducts.filter((product) =>
              productBelongsToCategory(product, category)
            );

        return {
          category,
          products: sectionProducts,
        };
      })
      .filter((section) => section.products.length > 0);
  }, [liveCategories, normalMenuProducts]);

  const hasSearch = searchQuery.trim().length > 0;

  const hasSearchResults =
    visibleSections.reduce((total, section) => {
      return total + section.products.length;
    }, 0) > 0;

  return (
    <div className="w-full">
      {hasSearch && (
        <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 md:px-6">
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Search results for{" "}
            <span className="font-black text-black dark:text-white">
              “{searchQuery.trim()}”
            </span>
          </p>
        </div>
      )}

      {hasSearch && !hasSearchResults && (
        <div className="mx-auto w-full max-w-[1400px] px-4 py-16 text-center md:px-6">
          <h2 className="text-2xl font-black text-black dark:text-white">
            No menu items found
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Try searching pizza, wings, subs, drinks, or another menu item.
          </p>
        </div>
      )}

      {visibleSections.map(({ category, products }) => {
        const sectionId = getCategorySectionId(category);

        return (
          <MenuSection
            key={sectionId}
            id={sectionId}
            title={category.name}
            products={products}
          />
        );
      })}
    </div>
  );
}
