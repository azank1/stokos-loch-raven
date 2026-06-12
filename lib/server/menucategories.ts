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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueBySlug(categories: FrontendMenuCategory[]) {
  const seen = new Set<string>();

  return categories.filter((category) => {
    if (!category.slug || seen.has(category.slug)) return false;
    seen.add(category.slug);
    return true;
  });
}

async function getStoreMenuCategoriesFromDB(
  storeSlug: string
): Promise<FrontendMenuCategory[]> {
  await connectDB();

  const store = await Store.findOne({
    slug: storeSlug,
    status: "Active",
  })
    .select({
      id: 1,
      slug: 1,
      status: 1,
    })
    .lean<any>();

  if (!store) {
    return [];
  }

  const storeKeys = Array.from(
    new Set(
      [
        store._id ? String(store._id) : "",
        store.id ? String(store.id) : "",
        store.slug ? String(store.slug) : "",
      ].filter(Boolean)
    )
  );

  const configs = await CategoryStoreConfig.find({
    storeId: { $in: storeKeys },
    $and: [
      {
        $or: [
          { status: "Active" },
          { status: { $exists: false } },
          { status: "" },
        ],
      },
      {
        $or: [
          { available: true },
          { isAvailable: true },
          {
            available: { $exists: false },
            isAvailable: { $exists: false },
          },
        ],
      },
    ],
  })
    .select({
      categoryId: 1,
      storeId: 1,
      status: 1,
      available: 1,
      isAvailable: 1,
      sortOrder: 1,
      updatedAt: 1,
    })
    .sort({ sortOrder: 1, updatedAt: -1 })
    .lean<any[]>();

  const categoryIds = Array.from(
    new Set(
      configs
        .map((config) => cleanString(config.categoryId))
        .filter(Boolean)
    )
  );

  if (!categoryIds.length) {
    return [];
  }

  const objectIds = categoryIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const categoryOrQuery: any[] = [
    { id: { $in: categoryIds } },
    { slug: { $in: categoryIds } },
  ];

  if (objectIds.length) {
    categoryOrQuery.push({ _id: { $in: objectIds } });
  }

  const categories = await Category.find({
    status: "Active",
    $or: categoryOrQuery,
  })
    .select({
      id: 1,
      name: 1,
      slug: 1,
      description: 1,
      image: 1,
      sortOrder: 1,
      status: 1,
      updatedAt: 1,
    })
    .sort({ sortOrder: 1, updatedAt: -1 })
    .lean<any[]>();

  const categoryMap = new Map<string, any>();

  categories.forEach((category) => {
    if (category._id) categoryMap.set(String(category._id), category);
    if (category.id) categoryMap.set(String(category.id), category);
    if (category.slug) categoryMap.set(String(category.slug), category);
  });

  const result = configs
    .map((config) => {
      const categoryId = cleanString(config.categoryId);
      const category = categoryMap.get(categoryId);

      if (!category) return null;

      const name = cleanString(category.name);
      const slug = cleanString(category.slug) || slugify(name);

      if (!name || !slug) return null;

      return {
        id: slug,
        name,
        slug,
        description: cleanString(category.description),
        image: cleanString(category.image),
        sortOrder: Number(config.sortOrder || category.sortOrder || 0),
      };
    })
    .filter(Boolean) as FrontendMenuCategory[];

  return uniqueBySlug(result).sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );
}

export const getStoreMenuCategories = unstable_cache(
  getStoreMenuCategoriesFromDB,
  ["store-menu-categories-v4"],
  {
    revalidate: 60,
    tags: ["store-menu-categories"],
  }
);
