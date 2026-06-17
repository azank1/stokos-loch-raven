import "server-only";

import { unstable_cache } from "next/cache";
import connectDB from "@/lib/mongodb";
import Category from "@/models/category";

export type FrontendMenuCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  sortOrder?: number;
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

function normalizeStoreSlug(value: unknown) {
  return slugify(value);
}

function isActiveQuery() {
  return {
    $or: [
      { status: "Active" },
      { status: { $exists: false } },
      { status: "" },
      { status: null },
    ],
  };
}

function normalizeCategoryFromCategoryDoc(
  category: any,
  fallbackSortOrder = 0
): FrontendMenuCategory | null {
  const name = cleanString(category?.name || category?.title);
  const slug = slugify(category?.slug || category?.id || category?._id || name);

  if (!name || !slug) return null;

  return {
    id: slug,
    name,
    slug,
    description: cleanString(category?.description),
    image: cleanString(category?.image || category?.imageUrl || category?.thumbnail),
    sortOrder: cleanNumber(category?.sortOrder ?? fallbackSortOrder),
  };
}

function uniqueBySlug(categories: FrontendMenuCategory[]) {
  const seen = new Set<string>();

  return categories.filter((category) => {
    const slug = slugify(category.slug || category.id || category.name);

    if (!slug || seen.has(slug)) return false;

    seen.add(slug);
    category.id = slug;
    category.slug = slug;
    return true;
  });
}

export async function getStoreMenuCategoriesFromDB(
  storeSlug: string
): Promise<FrontendMenuCategory[]> {
  const cleanStoreSlug = normalizeStoreSlug(storeSlug);

  if (!cleanStoreSlug) return [];

  await connectDB();

  // Important: frontend menu categories are global now.
  // They come only from the categories collection, not from StoreMenu products
  // and not from CategoryStoreConfig. StoreMenu products still decide which
  // products appear under each category for each store.
  const categories = await Category.find(isActiveQuery())
    .select({
      _id: 1,
      id: 1,
      name: 1,
      title: 1,
      slug: 1,
      description: 1,
      image: 1,
      imageUrl: 1,
      thumbnail: 1,
      sortOrder: 1,
      status: 1,
      updatedAt: 1,
    })
    .sort({ sortOrder: 1, name: 1, updatedAt: -1 })
    .lean<any[]>();

  return uniqueBySlug(
    categories
      .map((category, index) => normalizeCategoryFromCategoryDoc(category, index))
      .filter(Boolean) as FrontendMenuCategory[]
  ).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

const getCachedStoreMenuCategories = unstable_cache(
  getStoreMenuCategoriesFromDB,
  ["store-menu-categories-global-v1"],
  {
    revalidate: 30,
    tags: ["store-menu-categories", "store-menu"],
  }
);

export async function getStoreMenuCategories(storeSlug: string) {
  return getCachedStoreMenuCategories(normalizeStoreSlug(storeSlug));
}
