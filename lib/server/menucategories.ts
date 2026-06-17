import "server-only";

import mongoose from "mongoose";
import { unstable_cache } from "next/cache";
import connectDB from "@/lib/mongodb";
import Category from "@/models/category";
import CategoryStoreConfig from "@/models/categorystoreconfig";

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

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

function isActiveStatus(value: unknown) {
  const status = cleanString(value).toLowerCase();
  return !status || status === "active";
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

function normalizeCategoryFromConfig(config: any, category: any): FrontendMenuCategory | null {
  if (!config) return null;

  const categoryName = cleanString(
    category?.name || category?.title || config?.categoryName
  );
  const categorySlug = slugify(
    category?.slug || category?.id || category?._id || config?.categorySlug || categoryName
  );

  if (!categoryName || !categorySlug) return null;

  return {
    id: categorySlug,
    name: categoryName,
    slug: categorySlug,
    description: cleanString(category?.description),
    image: cleanString(category?.image || category?.imageUrl || category?.thumbnail),
    sortOrder: cleanNumber(config?.sortOrder ?? category?.sortOrder),
  };
}

export async function getStoreMenuCategoriesFromDB(
  storeSlug: string
): Promise<FrontendMenuCategory[]> {
  const cleanStoreSlug = normalizeStoreSlug(storeSlug);

  if (!cleanStoreSlug) return [];

  await connectDB();

  // Store-wise categories must come from CategoryStoreConfig only.
  // StoreMenu snapshots/rebuilds are intentionally ignored here.
  const configs = await CategoryStoreConfig.find({
    storeId: cleanStoreSlug,
    $and: [
      {
        $or: [
          { status: "Active" },
          { status: { $exists: false } },
          { status: "" },
          { status: null },
        ],
      },
      {
        $or: [
          { available: true },
          { available: { $exists: false } },
          { available: null },
        ],
      },
      {
        $or: [
          { isAvailable: true },
          { isAvailable: { $exists: false } },
          { isAvailable: null },
        ],
      },
    ],
  })
    .select({
      _id: 1,
      categoryId: 1,
      categoryName: 1,
      categorySlug: 1,
      storeId: 1,
      available: 1,
      isAvailable: 1,
      status: 1,
      sortOrder: 1,
      updatedAt: 1,
    })
    .sort({ sortOrder: 1, categoryName: 1, updatedAt: -1 })
    .lean<any[]>();

  if (!configs.length) return [];

  const categoryIds = Array.from(
    new Set(configs.map((config) => cleanString(config.categoryId)).filter(Boolean))
  );

  const objectIds = categoryIds
    .filter(isValidObjectId)
    .map((categoryId) => new mongoose.Types.ObjectId(categoryId));

  const categories = objectIds.length
    ? await Category.find({
        _id: { $in: objectIds },
        $or: [
          { status: "Active" },
          { status: { $exists: false } },
          { status: "" },
          { status: null },
        ],
      })
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
        .lean<any[]>()
    : [];

  const categoriesById = new Map<string, any>();
  categories.forEach((category: any) => {
    categoriesById.set(cleanString(category._id), category);
  });

  return uniqueBySlug(
    configs
      .filter((config) => isActiveStatus(config?.status))
      .map((config) => normalizeCategoryFromConfig(config, categoriesById.get(cleanString(config.categoryId))))
      .filter(Boolean) as FrontendMenuCategory[]
  ).sort((a, b) => {
    const sortDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (sortDiff !== 0) return sortDiff;
    return a.name.localeCompare(b.name);
  });
}

const getCachedStoreMenuCategories = unstable_cache(
  getStoreMenuCategoriesFromDB,
  ["store-menu-categories-from-category-store-config-v1"],
  {
    revalidate: 30,
    tags: ["store-menu-categories", "store-menu"],
  }
);

export async function getStoreMenuCategories(storeSlug: string) {
  return getCachedStoreMenuCategories(normalizeStoreSlug(storeSlug));
}
