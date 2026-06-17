import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { revalidateTag } from "next/cache";
import connectDB from "@/lib/mongodb";
import Category from "@/models/category";
import CategoryStoreConfig from "@/models/categorystoreconfig";
import { invalidateMenuCategories } from "@/lib/server/menu-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoreConfigDoc = {
  _id?: unknown;
  id?: unknown;
  categoryId?: unknown;
  storeId?: unknown;
  storeSlug?: unknown;
  categoryName?: unknown;
  categorySlug?: unknown;
  available?: unknown;
  isAvailable?: unknown;
  status?: unknown;
  sortOrder?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const isValidObjectId = (value: string) => mongoose.Types.ObjectId.isValid(value);

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function slugify(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeStoreId(value: unknown) {
  return slugify(value);
}

function cleanNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  const number = Number(cleanString(value).replace(/[^0-9.-]/g, "") || fallback);
  return Number.isFinite(number) ? number : fallback;
}

function cleanStatus(value: unknown) {
  const status = cleanString(value);
  if (["Active", "Hidden", "Inactive"].includes(status)) return status;
  return "Active";
}

function plainDoc(value: any) {
  if (!value) return value;
  if (typeof value.toObject === "function") return value.toObject();
  return value;
}

function uniqueStrings(values: unknown[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  values.forEach((value) => {
    const clean = cleanString(value);
    if (!clean || seen.has(clean)) return;

    seen.add(clean);
    output.push(clean);
  });

  return output;
}

function addStoreValue(value: unknown, output: unknown[]) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item) => addStoreValue(item, output));
    return;
  }

  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    addStoreValue(item.storeId || item.storeSlug || item.slug || item.id || item._id || item.name, output);
    return;
  }

  output.push(value);
}

function extractStoreIds(body: any) {
  const rawValues = [
    body?.storeIds,
    body?.storeSlugs,
    body?.stores,
    body?.selectedStores,
    body?.selectedStoreIds,
    body?.selectedStoreSlugs,
    body?.storeId,
    body?.storeSlug,
    body?.store,
  ];

  const values: unknown[] = [];
  rawValues.forEach((value) => addStoreValue(value, values));

  return uniqueStrings(
    values
      .map(normalizeStoreId)
      .filter((storeId) => storeId && !["all", "all-store", "all-stores"].includes(storeId))
  );
}

function hasExplicitStoreSelection(body: any) {
  return [
    "storeIds",
    "storeSlugs",
    "stores",
    "selectedStores",
    "selectedStoreIds",
    "selectedStoreSlugs",
    "storeId",
    "storeSlug",
    "store",
  ].some((key) => body && Object.prototype.hasOwnProperty.call(body, key));
}

function getCategoryIdValues(categoryId: unknown) {
  const value = cleanString(categoryId);
  if (!value) return [];

  const values: any[] = [value];

  if (isValidObjectId(value)) {
    values.push(new mongoose.Types.ObjectId(value));
  }

  return values;
}

function categoryIdMatch(categoryId: unknown) {
  const values = getCategoryIdValues(categoryId);
  return values.length > 0 ? { categoryId: { $in: values } } : { categoryId: "" };
}

function buildCategoryPayload(body: any) {
  const name = cleanString(body?.name || body?.categoryName || body?.title);

  if (!name) {
    throw new Error("Category name is required");
  }

  return {
    name,
    slug: slugify(body?.slug || body?.categorySlug || name),
    description: cleanString(body?.description),
    image: cleanString(body?.image || body?.imageUrl || body?.thumbnail),
    status: cleanStatus(body?.status),
    sortOrder: cleanNumber(body?.sortOrder, 0),
  };
}

function getCategoryMasterId(category: any, body?: any) {
  const cleanCategory = plainDoc(category) || {};
  return cleanString(cleanCategory._id || cleanCategory.id || body?.categoryId || body?.id || body?._id);
}

function buildConfigPayload(category: any, body: any, storeId: string) {
  const cleanCategory = plainDoc(category) || {};
  const categoryId = getCategoryMasterId(cleanCategory, body);
  const categoryName = cleanString(cleanCategory.name || body?.name || body?.categoryName);
  const categorySlug = slugify(cleanCategory.slug || body?.slug || body?.categorySlug || categoryName);
  const available = body?.available !== false && body?.isAvailable !== false;

  if (!categoryId) throw new Error("Category ID is required");
  if (!storeId) throw new Error("Store ID is required");

  return {
    categoryId,
    storeId,
    categoryName,
    categorySlug,
    available,
    isAvailable: available,
    status: cleanStatus(body?.status),
    sortOrder: cleanNumber(body?.sortOrder, 0),
  };
}

async function upsertStoreConfigs(category: any, body: any, storeIds: string[]) {
  const operations = storeIds.map((storeId) => {
    const configPayload = buildConfigPayload(category, body, storeId);

    return {
      updateOne: {
        filter: {
          categoryId: configPayload.categoryId,
          storeId: configPayload.storeId,
        },
        update: {
          $set: configPayload,
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    };
  });

  if (!operations.length) return;

  await CategoryStoreConfig.bulkWrite(operations, { ordered: false });
}

async function cleanupDuplicateConfigsForCategory(category: any) {
  const cleanCategory = plainDoc(category) || {};
  const categoryId = cleanString(cleanCategory._id || cleanCategory.id);
  const categoryName = cleanString(cleanCategory.name);
  const categorySlug = slugify(cleanCategory.slug || categoryName);

  const orQuery: any[] = [];
  if (categoryId) orQuery.push(categoryIdMatch(categoryId));
  if (categorySlug) orQuery.push({ categorySlug });

  if (!orQuery.length) return;

  const configs = await CategoryStoreConfig.collection
    .find({ $or: orQuery })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .toArray();

  const keepByStore = new Map<string, any>();
  const deleteIds: any[] = [];

  configs.forEach((config: any) => {
    const storeId = normalizeStoreId(config.storeId);

    if (!storeId) {
      deleteIds.push(config._id);
      return;
    }

    if (!keepByStore.has(storeId)) {
      keepByStore.set(storeId, config);
      return;
    }

    deleteIds.push(config._id);
  });

  if (deleteIds.length > 0) {
    await CategoryStoreConfig.collection.deleteMany({ _id: { $in: deleteIds } });
  }

  for (const [storeId, config] of keepByStore.entries()) {
    await CategoryStoreConfig.collection.updateOne(
      { _id: config._id },
      {
        $set: {
          categoryId,
          storeId,
          categoryName: cleanString(config.categoryName || categoryName),
          categorySlug,
          available: config.available !== false && config.isAvailable !== false,
          isAvailable: config.available !== false && config.isAvailable !== false,
          status: cleanStatus(config.status),
          sortOrder: cleanNumber(config.sortOrder, cleanCategory.sortOrder || 0),
          updatedAt: new Date(),
        },
      }
    );
  }
}

function formatStoreConfig(config: StoreConfigDoc) {
  const cleanConfig = plainDoc(config) || {};
  const storeId = normalizeStoreId(cleanConfig.storeId || cleanConfig.storeSlug);
  const available = cleanConfig.available !== false && cleanConfig.isAvailable !== false;
  const configId = cleanString(cleanConfig._id || cleanConfig.id);

  return {
    _id: configId,
    id: configId,
    storeConfigId: configId,
    configId,
    categoryId: cleanString(cleanConfig.categoryId),
    storeId,
    storeSlug: storeId,
    categoryName: cleanString(cleanConfig.categoryName),
    categorySlug: slugify(cleanConfig.categorySlug || cleanConfig.categoryName),
    available,
    isAvailable: available,
    status: cleanStatus(cleanConfig.status),
    sortOrder: cleanNumber(cleanConfig.sortOrder, 0),
  };
}

function formatCategoryWithConfigs(category: any, configs: StoreConfigDoc[] = []) {
  const cleanCategory = plainDoc(category) || {};
  const cleanConfigs = configs.map(formatStoreConfig).filter((config) => config.storeId);
  const firstConfig = cleanConfigs[0] || null;

  const categoryId = cleanString(cleanCategory._id || cleanCategory.id || firstConfig?.categoryId);
  const name = cleanString(cleanCategory.name || firstConfig?.categoryName);
  const slug = slugify(cleanCategory.slug || firstConfig?.categorySlug || name);
  const storeIds = uniqueStrings(cleanConfigs.map((config) => config.storeId));

  return {
    ...cleanCategory,
    _id: categoryId,
    id: categoryId,
    categoryId,
    name,
    title: name,
    slug,
    description: cleanString(cleanCategory.description),
    image: cleanString(cleanCategory.image),
    status: cleanStatus(cleanCategory.status || firstConfig?.status),
    sortOrder: cleanNumber(cleanCategory.sortOrder ?? firstConfig?.sortOrder, 0),

    // Old UI compatibility fields. Do not treat storeId as the only source.
    storeId: firstConfig?.storeId || "",
    storeSlug: firstConfig?.storeId || "",
    storeIds,
    storeSlugs: storeIds,
    stores: storeIds,
    selectedStores: storeIds,
    selectedStoreIds: storeIds,
    selectedStoreSlugs: storeIds,

    storeConfigId: firstConfig?.storeConfigId || "",
    configId: firstConfig?.configId || "",
    storeConfigIds: cleanConfigs.map((config) => config.storeConfigId).filter(Boolean),
    configIds: cleanConfigs.map((config) => config.configId).filter(Boolean),
    storeConfigs: cleanConfigs,

    categoryName: cleanString(firstConfig?.categoryName || name),
    categorySlug: slugify(firstConfig?.categorySlug || slug),
    available: firstConfig ? firstConfig.available : true,
    isAvailable: firstConfig ? firstConfig.isAvailable : true,
  };
}

async function findCategoryBySlug(slug: string, ignoreCategoryId?: string) {
  const query: any = { slug };

  if (ignoreCategoryId && isValidObjectId(ignoreCategoryId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(ignoreCategoryId) };
  }

  return Category.findOne(query);
}

async function getCategoryRows(storeId?: string | null) {
  const cleanStoreId = normalizeStoreId(storeId);
  const configQuery: any = {};

  if (cleanStoreId && cleanStoreId !== "all") {
    configQuery.storeId = cleanStoreId;
  }

  const configs = await CategoryStoreConfig.find(configQuery)
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean<StoreConfigDoc[]>();

  if (!configs.length) return [];

  const categoryIds = uniqueStrings(configs.map((config: any) => config.categoryId));
  const objectIds = categoryIds
    .filter(isValidObjectId)
    .map((categoryId) => new mongoose.Types.ObjectId(categoryId));

  const categories = objectIds.length
    ? await Category.find({ _id: { $in: objectIds } }).lean<any[]>()
    : [];

  const categoriesById = new Map<string, any>();
  categories.forEach((category: any) => {
    categoriesById.set(cleanString(category._id), category);
  });

  const groupedByCategory = new Map<string, { category: any; configs: StoreConfigDoc[] }>();

  configs.forEach((config: any) => {
    const categoryId = cleanString(config.categoryId);
    const category = categoriesById.get(categoryId) || {
      _id: categoryId,
      name: cleanString(config.categoryName),
      slug: slugify(config.categorySlug || config.categoryName),
      description: "",
      image: "",
      status: cleanStatus(config.status),
      sortOrder: cleanNumber(config.sortOrder, 0),
    };

    const groupKey = cleanString(category._id) || slugify(category.slug || config.categorySlug || config.categoryName);
    if (!groupKey) return;

    if (!groupedByCategory.has(groupKey)) {
      groupedByCategory.set(groupKey, { category, configs: [] });
    }

    groupedByCategory.get(groupKey)?.configs.push(config);
  });

  return Array.from(groupedByCategory.values())
    .map(({ category, configs }) => formatCategoryWithConfigs(category, configs))
    .sort((a, b) => {
      const sortDiff = cleanNumber(a.sortOrder, 0) - cleanNumber(b.sortOrder, 0);
      if (sortDiff !== 0) return sortDiff;
      return cleanString(a.name).localeCompare(cleanString(b.name));
    });
}

function getErrorMessage(error: any) {
  if (error?.code === 11000) return "Category already exists for this store.";

  if (error?.name === "ValidationError") {
    const messages = Object.values(error.errors || {})
      .map((item: any) => item?.message)
      .filter(Boolean);

    return messages.length > 0 ? messages.join(", ") : "Category validation failed.";
  }

  if (error?.message) return error.message;
  return "Something went wrong.";
}

function invalidateCategoryCache() {
  invalidateMenuCategories();
  revalidateTag("store-menu-categories", "max");
  revalidateTag("store-menu", "max");
}

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");

    const data = await getCategoryRows(storeId);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("GET CATEGORIES ERROR:", error);

    return NextResponse.json(
      { success: false, message: getErrorMessage(error) || "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const categoryPayload = buildCategoryPayload(body);
    const storeIds = extractStoreIds(body);

    if (!storeIds.length) {
      return NextResponse.json(
        { success: false, message: "At least one store is required" },
        { status: 400 }
      );
    }

    let category = await Category.findOne({ slug: categoryPayload.slug });

    if (!category) {
      category = await Category.create(categoryPayload);
    } else {
      category = await Category.findByIdAndUpdate(
        category._id,
        {
          name: categoryPayload.name,
          slug: categoryPayload.slug,
          description: categoryPayload.description,
          image: categoryPayload.image,
          status: categoryPayload.status,
          sortOrder: categoryPayload.sortOrder,
          storeId: "",
        },
        { new: true, runValidators: true }
      );
    }

    await upsertStoreConfigs(category, body, storeIds);
    await cleanupDuplicateConfigsForCategory(category);

    const freshConfigs = await CategoryStoreConfig.find(categoryIdMatch(String(category._id)))
      .sort({ storeId: 1, sortOrder: 1 })
      .lean<StoreConfigDoc[]>();

    invalidateCategoryCache();

    return NextResponse.json(
      { success: true, data: formatCategoryWithConfigs(category, freshConfigs) },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST CATEGORY ERROR:", error);

    return NextResponse.json(
      { success: false, message: getErrorMessage(error) || "Failed to create category" },
      { status: error?.code === 11000 ? 409 : 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const categoryId = cleanString(body.categoryId || body.id || body._id);
    const categoryPayload = buildCategoryPayload(body);
    const storeIds = extractStoreIds(body);

    if (!categoryId || !isValidObjectId(categoryId)) {
      return NextResponse.json(
        { success: false, message: "Valid category ID is required" },
        { status: 400 }
      );
    }

    const duplicateMaster = await findCategoryBySlug(categoryPayload.slug, categoryId);

    if (duplicateMaster) {
      return NextResponse.json(
        {
          success: false,
          message: "A category with this name already exists. Use the existing category instead of renaming this one.",
        },
        { status: 409 }
      );
    }

    const category = await Category.findByIdAndUpdate(
      categoryId,
      { ...categoryPayload, storeId: "" },
      { new: true, runValidators: true }
    );

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Category not found" },
        { status: 404 }
      );
    }

    if (hasExplicitStoreSelection(body)) {
      if (!storeIds.length) {
        await CategoryStoreConfig.deleteMany(categoryIdMatch(categoryId));
      } else {
        await upsertStoreConfigs(category, body, storeIds);

        await CategoryStoreConfig.deleteMany({
          ...categoryIdMatch(categoryId),
          storeId: { $nin: storeIds },
        });
      }
    }

    await cleanupDuplicateConfigsForCategory(category);

    const freshConfigs = await CategoryStoreConfig.find(categoryIdMatch(categoryId))
      .sort({ storeId: 1, sortOrder: 1 })
      .lean<StoreConfigDoc[]>();

    invalidateCategoryCache();

    return NextResponse.json({ success: true, data: formatCategoryWithConfigs(category, freshConfigs) });
  } catch (error: any) {
    console.error("PATCH CATEGORY ERROR:", error);

    return NextResponse.json(
      { success: false, message: getErrorMessage(error) || "Failed to update category" },
      { status: error?.code === 11000 ? 409 : 400 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const id = cleanString(searchParams.get("id"));
    const storeId = normalizeStoreId(searchParams.get("storeId"));
    const configId = cleanString(searchParams.get("storeConfigId") || searchParams.get("configId"));

    if (configId && isValidObjectId(configId)) {
      const config = await CategoryStoreConfig.findById(configId);

      if (!config) {
        return NextResponse.json(
          { success: false, message: "Category store config not found" },
          { status: 404 }
        );
      }

      await CategoryStoreConfig.deleteOne({ _id: config._id });
      invalidateCategoryCache();

      return NextResponse.json({ success: true, message: "Category removed from this store successfully" });
    }

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Valid category ID is required" },
        { status: 400 }
      );
    }

    const category = await Category.findById(id);

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Category not found" },
        { status: 404 }
      );
    }

    if (storeId) {
      await CategoryStoreConfig.deleteMany({
        ...categoryIdMatch(String(category._id)),
        storeId,
      });

      invalidateCategoryCache();

      return NextResponse.json({ success: true, message: "Category removed from this store successfully" });
    }

    await CategoryStoreConfig.deleteMany(categoryIdMatch(String(category._id)));
    await Category.deleteOne({ _id: category._id });

    invalidateCategoryCache();

    return NextResponse.json({ success: true, message: "Category deleted successfully" });
  } catch (error: any) {
    console.error("DELETE CATEGORY ERROR:", error);

    return NextResponse.json(
      { success: false, message: getErrorMessage(error) || "Failed to delete category" },
      { status: 500 }
    );
  }
}
