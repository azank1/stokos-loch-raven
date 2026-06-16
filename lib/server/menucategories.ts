import "server-only";

import mongoose from "mongoose";
import { unstable_cache } from "next/cache";
import connectDB from "@/lib/mongodb";
import Store from "@/models/store";
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

function normalizeStoreId(value: unknown) {
  return cleanString(value).toLowerCase();
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

function buildStoreKeys(store: any, storeSlug: string) {
  return Array.from(
    new Set(
      [
        store?._id ? String(store._id) : "",
        store?.id ? String(store.id) : "",
        store?.slug ? String(store.slug) : "",
        storeSlug,
      ]
        .map((value) => normalizeStoreId(value))
        .filter(Boolean)
    )
  );
}

function getObjectIds(keys: string[]) {
  return keys
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

function addCategoryToMap(map: Map<string, any>, category: any) {
  const keys = [
    category?._id ? String(category._id) : "",
    category?.id,
    category?.slug,
    category?.name,
  ]
    .map((value) => cleanString(value))
    .filter(Boolean);

  keys.forEach((key) => {
    map.set(key, category);
    map.set(slugify(key), category);
  });
}

function isActiveQuery() {
  return {
    $or: [{ status: "Active" }, { status: { $exists: false } }, { status: "" }],
  };
}

function isAvailableQuery() {
  return {
    $or: [
      { available: true },
      { isAvailable: true },
      {
        available: { $exists: false },
        isAvailable: { $exists: false },
      },
    ],
  };
}

function buildConfigStoreQuery(
  cleanStoreSlug: string,
  storeKeys: string[],
  storeObjectIds: mongoose.Types.ObjectId[]
) {
  const query: any[] = [
    { storeId: { $in: storeKeys } },
    { storeSlug: cleanStoreSlug },
    { store: { $in: storeKeys } },
    { "store.slug": cleanStoreSlug },
  ];

  if (storeObjectIds.length) {
    query.push({ storeId: { $in: storeObjectIds } });
    query.push({ store: { $in: storeObjectIds } });
    query.push({ "store._id": { $in: storeObjectIds } });
  }

  return query;
}

function buildCategoryStoreQuery(
  cleanStoreSlug: string,
  storeKeys: string[],
  storeObjectIds: mongoose.Types.ObjectId[]
) {
  const query: any[] = [
    { storeId: { $in: storeKeys } },
    { storeIds: { $in: storeKeys } },
    { storeSlug: cleanStoreSlug },
    { storeSlugs: cleanStoreSlug },
    { storeSlugs: { $in: [cleanStoreSlug] } },
    { stores: { $in: storeKeys } },
    { store: { $in: storeKeys } },
    { "store.slug": cleanStoreSlug },
    { "stores.slug": cleanStoreSlug },
  ];

  if (storeObjectIds.length) {
    query.push({ storeId: { $in: storeObjectIds } });
    query.push({ storeIds: { $in: storeObjectIds } });
    query.push({ store: { $in: storeObjectIds } });
    query.push({ stores: { $in: storeObjectIds } });
    query.push({ "store._id": { $in: storeObjectIds } });
    query.push({ "stores._id": { $in: storeObjectIds } });
  }

  return query;
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

function normalizeCategoryFromConfig(
  config: any,
  categoryMap: Map<string, any>
): FrontendMenuCategory | null {
  const categoryId = cleanString(config.categoryId);
  const categorySlug = cleanString(config.categorySlug);
  const categoryName = cleanString(config.categoryName);

  const category =
    categoryMap.get(categoryId) ||
    categoryMap.get(slugify(categoryId)) ||
    categoryMap.get(categorySlug) ||
    categoryMap.get(slugify(categorySlug)) ||
    categoryMap.get(categoryName) ||
    categoryMap.get(slugify(categoryName));

  const name = cleanString(category?.name || categoryName || categorySlug || categoryId);
  const slug = slugify(category?.slug || categorySlug || name || categoryId);

  if (!name || !slug) return null;

  return {
    id: slug,
    name,
    slug,
    description: cleanString(category?.description),
    image: cleanString(category?.image || category?.imageUrl || category?.thumbnail),
    sortOrder: cleanNumber(config.sortOrder ?? category?.sortOrder ?? 0),
  };
}

export async function getStoreMenuCategoriesFromDB(
  storeSlug: string
): Promise<FrontendMenuCategory[]> {
  const cleanStoreSlug = normalizeStoreId(storeSlug);

  if (!cleanStoreSlug) return [];

  await connectDB();

  const store = await Store.findOne({
    slug: cleanStoreSlug,
    status: "Active",
  })
    .select({ _id: 1, id: 1, slug: 1, status: 1 })
    .lean<any>();

  if (!store) return [];

  const storeKeys = buildStoreKeys(store, cleanStoreSlug);
  const storeObjectIds = getObjectIds(storeKeys);

  const configs = await CategoryStoreConfig.find({
    $and: [
      { $or: buildConfigStoreQuery(cleanStoreSlug, storeKeys, storeObjectIds) },
      isActiveQuery(),
      isAvailableQuery(),
    ],
  })
    .select({
      categoryId: 1,
      categoryName: 1,
      categorySlug: 1,
      storeId: 1,
      storeSlug: 1,
      store: 1,
      status: 1,
      available: 1,
      isAvailable: 1,
      sortOrder: 1,
      updatedAt: 1,
    })
    .sort({ sortOrder: 1, updatedAt: -1 })
    .lean<any[]>();

  const configCategoryKeys = Array.from(
    new Set(
      configs
        .flatMap((config) => [
          config.categoryId,
          config.categorySlug,
          config.categoryName,
        ])
        .map((value) => cleanString(value))
        .filter(Boolean)
    )
  );

  const categoryObjectIds = getObjectIds(configCategoryKeys);
  const categorySlugKeys = configCategoryKeys.map((key) => slugify(key));

  const categoryOrQuery: any[] = [
    { id: { $in: configCategoryKeys } },
    { slug: { $in: [...configCategoryKeys, ...categorySlugKeys] } },
    { name: { $in: configCategoryKeys } },
    { $or: buildCategoryStoreQuery(cleanStoreSlug, storeKeys, storeObjectIds) },
  ];

  if (categoryObjectIds.length) {
    categoryOrQuery.push({ _id: { $in: categoryObjectIds } });
  }

  const categories = await Category.find({
    $and: [isActiveQuery(), { $or: categoryOrQuery }],
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
      storeId: 1,
      storeIds: 1,
      storeSlug: 1,
      storeSlugs: 1,
      store: 1,
      stores: 1,
      updatedAt: 1,
    })
    .sort({ sortOrder: 1, updatedAt: -1 })
    .lean<any[]>();

  const categoryMap = new Map<string, any>();
  categories.forEach((category) => addCategoryToMap(categoryMap, category));

  const fromConfigs = configs
    .map((config) => normalizeCategoryFromConfig(config, categoryMap))
    .filter(Boolean) as FrontendMenuCategory[];

  const fromCategoryDocs = categories
    .map((category) => normalizeCategoryFromCategoryDoc(category))
    .filter(Boolean) as FrontendMenuCategory[];

  return uniqueBySlug([...fromConfigs, ...fromCategoryDocs]).sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );
}

const getCachedStoreMenuCategories = unstable_cache(
  getStoreMenuCategoriesFromDB,
  ["store-menu-categories-v10"],
  {
    revalidate: 30,
    tags: ["store-menu-categories", "store-menu"],
  }
);

export async function getStoreMenuCategories(storeSlug: string) {
  return getCachedStoreMenuCategories(normalizeStoreId(storeSlug));
}