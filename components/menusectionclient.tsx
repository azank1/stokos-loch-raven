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
  categories?: MenuCategoryTab[] | null;
  initialProducts?: any[] | null;
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

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const number = Number(cleanString(value).replace(/[^0-9.-]/g, "") || 0);
  return Number.isFinite(number) ? number : 0;
}

function cleanBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (["true", "yes", "1", "active", "popular", "featured"].includes(lower)) return true;
    if (["false", "no", "0", "inactive", "off", "hidden"].includes(lower)) return false;
  }

  return fallback;
}

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  return [category.id, category.slug, category.name]
    .filter(Boolean)
    .map((value) => slugify(value))
    .some((key) => MENU_COUPON_CATEGORY_KEYS.has(key));
}

function normalizeCategory(category: Partial<MenuCategoryTab>): MenuCategoryTab {
  const name = cleanString(category.name);
  const cleanSlug = slugify(category.slug || category.id || name);

  return {
    id: cleanSlug,
    slug: cleanSlug,
    name,
    description: cleanString(category.description),
    image: cleanString(category.image),
    sortOrder: cleanNumber(category.sortOrder),
  };
}

function normalizeRealCategories(categories: Partial<MenuCategoryTab>[]) {
  const seen = new Set<string>();

  return (Array.isArray(categories) ? categories : [])
    .map((category) => normalizeCategory(category))
    .filter((category) => {
      if (!category.id || !category.name) return false;
      if (isPopularCategory(category)) return false;
      if (isMenuCouponsCategory(category)) return false;

      const key = slugify(category.slug || category.id || category.name);
      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function getProductCategoryName(product: any) {
  if (typeof product?.category === "string") return cleanString(product.category);

  return cleanString(
    product?.categoryName ||
      product?.categoryTitle ||
      product?.category?.name ||
      product?.category?.title ||
      ""
  );
}

function getProductCategorySlug(product: any) {
  if (typeof product?.category === "string") return slugify(product.category);

  return slugify(
    product?.categorySlug ||
      product?.category?.slug ||
      product?.category?.id ||
      product?.category?._id ||
      getProductCategoryName(product) ||
      product?.categoryId
  );
}

function deriveCategoriesFromProducts(products: any[]): MenuCategoryTab[] {
  const seen = new Set<string>();

  return (Array.isArray(products) ? products : [])
    .map((product) => {
      const categoryName = getProductCategoryName(product);
      const categorySlug = getProductCategorySlug(product);

      return {
        id: categorySlug,
        slug: categorySlug,
        name: categoryName || categorySlug,
        description: "",
        image: "",
        sortOrder: cleanNumber(product?.categorySortOrder || 9999),
      };
    })
    .filter((category) => {
      if (!category.id || !category.name) return false;
      if (isPopularCategory(category)) return false;
      if (isMenuCouponsCategory(category)) return false;
      if (seen.has(category.id)) return false;

      seen.add(category.id);
      return true;
    });
}

function buildMenuCategories(inputCategories: Partial<MenuCategoryTab>[], products: any[]) {
  const seen = new Set<string>();

  const realCategories = [
    ...normalizeRealCategories(inputCategories),
    ...deriveCategoriesFromProducts(products),
  ].filter((category) => {
    const key = slugify(category.slug || category.id || category.name);
    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });

  const hasPopularProducts = products.some((product) => isProductPopular(product));

  return hasPopularProducts ? [POPULAR_CATEGORY, ...realCategories] : realCategories;
}

function getCategorySectionId(category: MenuCategoryTab) {
  return slugify(category.slug || category.id || category.name);
}

function getProductCategoryKeys(product: any) {
  const categoryString = typeof product?.category === "string" ? product.category : "";

  return [
    product?.categoryId,
    product?.categorySlug,
    product?.categoryName,
    product?.categoryTitle,
    categoryString,
    product?.category?.id,
    product?.category?._id,
    product?.category?.slug,
    product?.category?.name,
    product?.category?.title,
  ]
    .filter(Boolean)
    .map((value) => slugify(value));
}

function productBelongsToCategory(product: any, category: MenuCategoryTab) {
  const categoryKeys = [category.id, category.slug, category.name, getCategorySectionId(category)]
    .filter(Boolean)
    .map((value) => slugify(value));

  const productKeys = getProductCategoryKeys(product);

  return categoryKeys.some((key) => productKeys.includes(key));
}

function isProductPopular(product: any) {
  return (
    cleanBoolean(product?.isPopular) ||
    cleanBoolean(product?.showInPopular) ||
    cleanBoolean(product?.popular) ||
    cleanBoolean(product?.featured)
  );
}

function isProductActive(product: any) {
  const status = cleanString(product?.status || "Active").toLowerCase();
  return !status || status === "active" || status === "published" || status === "available";
}

function normalizeProduct(product: any, storeSlug: string) {
  const title = cleanString(product?.title || product?.name || "Menu Item");
  const productId = cleanString(product?.id || product?.productId || product?._id || product?.slug || slugify(title));
  const categoryName = getProductCategoryName(product);
  const categorySlug = getProductCategorySlug(product);
  const price = cleanNumber(product?.price ?? product?.numericPrice);
  const popular = isProductPopular(product);

  return {
    ...product,
    id: productId,
    productId: cleanString(product?.productId || productId),
    slug: cleanString(product?.slug || slugify(title)),
    title,
    name: title,
    description: cleanString(product?.description),
    image: cleanString(product?.image || "/images/placeholder-food.png"),
    price,
    numericPrice: cleanNumber(product?.numericPrice ?? price),
    categoryId: cleanString(product?.categoryId || categorySlug),
    categoryName,
    categorySlug,
    category: categorySlug || categoryName,
    storeSlug: cleanString(product?.storeSlug || storeSlug),
    sortOrder: cleanNumber(product?.sortOrder),
    isPopular: popular,
    showInPopular: popular,
    status: cleanString(product?.status || "Active"),
  };
}

function normalizeProducts(products: any[], storeSlug: string) {
  return (Array.isArray(products) ? products : [])
    .map((product) => normalizeProduct(product, storeSlug))
    .filter((product) => {
      if (!product.id || !product.title) return false;
      if (!isProductActive(product)) return false;

      const categoryKey = slugify(product.categorySlug || product.categoryName || product.category);
      if (MENU_COUPON_CATEGORY_KEYS.has(categoryKey)) return false;

      return true;
    })
    .sort((a, b) => {
      const categorySort = cleanString(a.categorySlug).localeCompare(cleanString(b.categorySlug));
      if (categorySort !== 0) return categorySort;

      return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    });
}

export default function MenuSectionsClient({
  storeSlug,
  categories = [],
  initialProducts = [],
}: MenuSectionsClientProps) {
  const { searchQuery } = useSearchStore();

  const products = useMemo(
    () => normalizeProducts(initialProducts || [], storeSlug),
    [initialProducts, storeSlug]
  );

  const menuCategories = useMemo(
    () => buildMenuCategories(categories || [], products),
    [categories, products]
  );

  const visibleCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return menuCategories;

    return menuCategories.filter((category) => {
      if (isPopularCategory(category)) {
        return products.some(
          (product) =>
            isProductPopular(product) &&
            cleanString(product.title || product.name).toLowerCase().includes(query)
        );
      }

      return products.some(
        (product) =>
          productBelongsToCategory(product, category) &&
          cleanString(product.title || product.name).toLowerCase().includes(query)
      );
    });
  }, [menuCategories, products, searchQuery]);

  if (!products.length) {
    return (
      <section className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-5 md:px-6 xl:px-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <p className="text-sm font-black uppercase tracking-widest text-zinc-500">
            No products found for this store.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      {visibleCategories.map((category) => {
        const popularCategory = isPopularCategory(category);
        const sectionProducts = popularCategory
          ? products.filter((product) => isProductPopular(product))
          : products.filter((product) => productBelongsToCategory(product, category));

        if (!sectionProducts.length) return null;

        return (
          <MenuSection
            key={category.id}
            id={getCategorySectionId(category)}
            title={category.name}
            subtitle={category.description || ""}
            products={sectionProducts}
          />
        );
      })}
    </>
  );
}
