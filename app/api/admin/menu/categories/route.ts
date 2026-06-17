import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { revalidateTag } from "next/cache";
import connectDB from "@/lib/mongodb";
import Category from "@/models/category";
import CategoryStoreConfig from "@/models/categorystoreconfig";
import { invalidateMenuCategories } from "@/lib/server/menu-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slugify = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const isValidObjectId = (value: string) =>
  mongoose.Types.ObjectId.isValid(value);

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function normalizeStoreId(value: unknown) {
  return slugify(value);
}

function cleanNumber(value: unknown, fallback = 0) {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : fallback;

  const number = Number(
    cleanString(value).replace(/[^0-9.-]/g, "") || fallback,
  );
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

  function add(value: unknown) {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }

    if (typeof value === "object") {
      const item = value as Record<string, unknown>;
      add(
        item.storeId ||
          item.storeSlug ||
          item.slug ||
          item.id ||
          item._id ||
          item.name,
      );
      return;
    }

    values.push(value);
  }

  rawValues.forEach(add);

  return uniqueStrings(
    values
      .map(normalizeStoreId)
      .filter(
        (storeId) =>
          storeId && !["all", "all-stores", "all-store"].includes(storeId),
      ),
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
  return values.length > 0
    ? { categoryId: { $in: values } }
    : { categoryId: "" };
}

function relatedCategoryConfigQuery(
  categoryId: unknown,
  categorySlug: unknown,
  extraCategoryIds: unknown[] = [],
) {
  const values: any[] = [];

  [categoryId, ...extraCategoryIds].forEach((value) => {
    getCategoryIdValues(value).forEach((item) => values.push(item));
  });

  const orQuery: any[] = [];
  if (values.length) orQuery.push({ categoryId: { $in: values } });

  const cleanSlug = slugify(categorySlug);
  if (cleanSlug) orQuery.push({ categorySlug: cleanSlug });

  return orQuery.length ? { $or: orQuery } : { categoryId: "" };
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

function buildConfigPayload(category: any, body: any, storeId: string) {
  const cleanCategory = plainDoc(category) || {};
  const categoryId = cleanString(
    cleanCategory._id || body?.categoryId || body?.id || body?._id,
  );
  const categoryName = cleanString(
    cleanCategory.name || body?.name || body?.categoryName,
  );
  const categorySlug = slugify(
    cleanCategory.slug || body?.slug || body?.categorySlug || categoryName,
  );
  const available = body?.available !== false && body?.isAvailable !== false;

  if (!categoryId) {
    throw new Error("Category ID is required");
  }

  if (!storeId) {
    throw new Error("Store ID is required");
  }

  return {
    categoryId,
    storeId: normalizeStoreId(storeId),
    categoryName,
    categorySlug,
    available,
    isAvailable: available,
    status: cleanStatus(body?.status),
    sortOrder: cleanNumber(body?.sortOrder, 0),
  };
}

function configDateValue(config: any) {
  const updated = new Date(
    config?.updatedAt ||
      config?.createdAt ||
      config?._id?.getTimestamp?.() ||
      0,
  ).getTime();
  return Number.isFinite(updated) ? updated : 0;
}

async function getDuplicateCategoryIdsBySlug(
  categorySlug: string,
  masterCategoryId: string,
) {
  if (!categorySlug) return [];

  const duplicateCategories = await Category.find({
    slug: categorySlug,
    _id: { $ne: new mongoose.Types.ObjectId(masterCategoryId) },
  })
    .select({ _id: 1 })
    .lean<any[]>();

  return duplicateCategories
    .map((category) => cleanString(category._id))
    .filter(Boolean);
}

async function upsertStoreConfig(category: any, body: any, storeId: string) {
  const configPayload = buildConfigPayload(category, body, storeId);

  return CategoryStoreConfig.findOneAndUpdate(
    {
      categoryId: configPayload.categoryId,
      storeId: configPayload.storeId,
    },
    {
      $set: configPayload,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
}

async function dedupeAndRepairCategoryConfigs(
  category: any,
  selectedStoreIds?: string[],
) {
  const cleanCategory = plainDoc(category) || {};
  const categoryId = cleanString(cleanCategory._id);
  const categoryName = cleanString(cleanCategory.name);
  const categorySlug = slugify(cleanCategory.slug || categoryName);

  if (!categoryId) return [];

  const duplicateCategoryIds = await getDuplicateCategoryIdsBySlug(
    categorySlug,
    categoryId,
  );

  const relatedConfigs = await CategoryStoreConfig.collection
    .find(
      relatedCategoryConfigQuery(
        categoryId,
        categorySlug,
        duplicateCategoryIds,
      ),
    )
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .toArray();

  const selectedSet = selectedStoreIds?.length
    ? new Set(selectedStoreIds.map(normalizeStoreId).filter(Boolean))
    : null;

  const keepByStore = new Map<string, any>();
  const deleteIds: any[] = [];

  relatedConfigs
    .sort((a: any, b: any) => configDateValue(b) - configDateValue(a))
    .forEach((config: any) => {
      const storeId = normalizeStoreId(config.storeId);

      if (!storeId || (selectedSet && !selectedSet.has(storeId))) {
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
    await CategoryStoreConfig.collection.deleteMany({
      _id: { $in: deleteIds },
    });
  }

  for (const [storeId, config] of keepByStore.entries()) {
    const available =
      config.available !== false && config.isAvailable !== false;

    await CategoryStoreConfig.collection.updateOne(
      { _id: config._id },
      {
        $set: {
          categoryId,
          storeId,
          categoryName: cleanString(config.categoryName || categoryName),
          categorySlug,
          available,
          isAvailable: available,
          status: cleanStatus(config.status),
          sortOrder: cleanNumber(
            config.sortOrder,
            cleanNumber(cleanCategory.sortOrder, 0),
          ),
        },
      },
    );
  }

  if (selectedSet) {
    await CategoryStoreConfig.deleteMany({
      ...categoryIdMatch(categoryId),
      storeId: { $nin: Array.from(selectedSet) },
    });
  }

  const freshQuery: any = categoryIdMatch(categoryId);
  if (selectedSet) freshQuery.storeId = { $in: Array.from(selectedSet) };

  return CategoryStoreConfig.find(freshQuery)
    .sort({ storeId: 1, sortOrder: 1 })
    .lean<any[]>();
}

async function syncSelectedStoreConfigs(
  category: any,
  body: any,
  storeIds: string[],
) {
  const cleanStoreIds = uniqueStrings(
    storeIds.map(normalizeStoreId).filter(Boolean),
  );

  for (const storeId of cleanStoreIds) {
    try {
      await upsertStoreConfig(category, body, storeId);
    } catch (error: any) {
      // If an old bad unique index or duplicate legacy row blocks the insert,
      // repair duplicates once and retry this store.
      if (error?.code !== 11000) throw error;

      await dedupeAndRepairCategoryConfigs(category);
      await upsertStoreConfig(category, body, storeId);
    }
  }

  const freshConfigs = await dedupeAndRepairCategoryConfigs(
    category,
    cleanStoreIds,
  );
  const savedStores = new Set(
    freshConfigs.map((config: any) => normalizeStoreId(config.storeId)),
  );
  const missingStores = cleanStoreIds.filter(
    (storeId) => !savedStores.has(storeId),
  );

  if (missingStores.length > 0) {
    throw new Error(
      `Category saved only for ${savedStores.size} store(s). Missing store configs: ${missingStores.join(", ")}. Run the MongoDB index fix script and save again.`,
    );
  }

  return freshConfigs;
}

function formatStoreConfig(config: any) {
  const cleanConfig = plainDoc(config) || {};
  const storeId = normalizeStoreId(cleanConfig.storeId);

  return {
    _id: cleanString(cleanConfig._id),
    id: cleanString(cleanConfig._id),
    storeConfigId: cleanString(cleanConfig._id),
    configId: cleanString(cleanConfig._id),
    categoryId: cleanString(cleanConfig.categoryId),
    storeId,
    storeSlug: storeId,
    categoryName: cleanString(cleanConfig.categoryName),
    categorySlug: slugify(cleanConfig.categorySlug || cleanConfig.categoryName),
    available:
      cleanConfig.available !== false && cleanConfig.isAvailable !== false,
    isAvailable:
      cleanConfig.available !== false && cleanConfig.isAvailable !== false,
    status: cleanStatus(cleanConfig.status),
    sortOrder: cleanNumber(cleanConfig.sortOrder, 0),
  };
}

function formatCategoryWithConfigs(category: any, configs: any[] = []) {
  const cleanCategory = plainDoc(category) || {};
  const cleanConfigs = configs
    .map(formatStoreConfig)
    .filter((config) => config.storeId);
  const firstConfig = cleanConfigs[0] || null;

  const categoryId = cleanString(cleanCategory._id || firstConfig?.categoryId);
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
    sortOrder: cleanNumber(
      cleanCategory.sortOrder ?? firstConfig?.sortOrder,
      0,
    ),

    // Compatibility keys for old admin UI fields.
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
    storeConfigIds: cleanConfigs
      .map((config) => config.storeConfigId)
      .filter(Boolean),
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

  return Category.findOne(query).sort({ updatedAt: -1, createdAt: -1 });
}

async function findOrCreateMasterCategory(categoryPayload: any) {
  const existing = await Category.findOne({ slug: categoryPayload.slug }).sort({
    updatedAt: -1,
    createdAt: -1,
  });

  if (!existing) {
    return Category.create(categoryPayload);
  }

  return Category.findByIdAndUpdate(existing._id, categoryPayload, {
    new: true,
    runValidators: true,
  });
}

async function getCategoryRows(storeId?: string | null) {
  const cleanStoreId = normalizeStoreId(storeId);
  const configQuery: any = {};

  if (cleanStoreId && cleanStoreId !== "all") {
    configQuery.storeId = cleanStoreId;
  }

  const configs = await CategoryStoreConfig.find(configQuery)
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean<any[]>();

  if (!configs.length) return [];

  const categoryIds = uniqueStrings(
    configs.map((config: any) => config.categoryId),
  );
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

  // Important fix: group by category slug/name, not only categoryId.
  // Old DB data can have separate master category IDs per store. Grouping by ID makes
  // badges disappear/overwrite after refetch. Slug grouping keeps Towson/York/Liberty together.
  const groupedBySlug = new Map<string, { category: any; configs: any[] }>();

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

    const slugKey = slugify(
      category.slug ||
        config.categorySlug ||
        category.name ||
        config.categoryName,
    );
    const nameKey = slugify(category.name || config.categoryName);
    const groupKey = slugKey || nameKey || categoryId;

    if (!groupKey) return;

    if (!groupedBySlug.has(groupKey)) {
      groupedBySlug.set(groupKey, { category, configs: [] });
    }

    const group = groupedBySlug.get(groupKey);
    if (!group) return;

    const existingCategoryDate = configDateValue(group.category);
    const nextCategoryDate = configDateValue(category);
    if (!group.category?._id || nextCategoryDate > existingCategoryDate) {
      group.category = category;
    }

    group.configs.push(config);
  });

  return Array.from(groupedBySlug.values())
    .map(({ category, configs }) =>
      formatCategoryWithConfigs(category, configs),
    )
    .sort((a, b) => {
      const sortDiff =
        cleanNumber(a.sortOrder, 0) - cleanNumber(b.sortOrder, 0);
      if (sortDiff !== 0) return sortDiff;
      return cleanString(a.name).localeCompare(cleanString(b.name));
    });
}

function getErrorMessage(error: any) {
  if (error?.code === 11000) {
    const keys = Object.keys(error?.keyPattern || {}).join(", ");
    return keys
      ? `MongoDB duplicate index blocked this save (${keys}). Run scripts/mongodb-indexes.js, then save again.`
      : "MongoDB duplicate index blocked this save. Run scripts/mongodb-indexes.js, then save again.";
  }

  if (error?.name === "ValidationError") {
    const messages = Object.values(error.errors || {})
      .map((item: any) => item?.message)
      .filter(Boolean);

    return messages.length > 0
      ? messages.join(", ")
      : "Category validation failed.";
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

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("GET CATEGORIES ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error) || "Failed to fetch categories",
      },
      { status: 500 },
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
        { status: 400 },
      );
    }

    const category = await findOrCreateMasterCategory(categoryPayload);
    if (!category) throw new Error("Failed to save category master row");

    const freshConfigs = await syncSelectedStoreConfigs(
      category,
      body,
      storeIds,
    );

    invalidateCategoryCache();

    return NextResponse.json(
      {
        success: true,
        data: formatCategoryWithConfigs(category, freshConfigs),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("POST CATEGORY ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error) || "Failed to create category",
      },
      { status: error?.code === 11000 ? 409 : 400 },
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
        { status: 400 },
      );
    }

    const duplicateMaster = await findCategoryBySlug(
      categoryPayload.slug,
      categoryId,
    );

    if (duplicateMaster) {
      // Merge behavior: same slug means same logical category. Keep the edited category as master,
      // and configs will be repaired to this ID below.
      await CategoryStoreConfig.updateMany(
        categoryIdMatch(cleanString(duplicateMaster._id)),
        {
          $set: {
            categoryId,
            categoryName: categoryPayload.name,
            categorySlug: categoryPayload.slug,
          },
        },
      ).catch(() => null);
    }

    const category = await Category.findByIdAndUpdate(
      categoryId,
      categoryPayload,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Category not found" },
        { status: 404 },
      );
    }

    let freshConfigs: any[];

    if (hasExplicitStoreSelection(body)) {
      if (!storeIds.length) {
        await CategoryStoreConfig.deleteMany(
          relatedCategoryConfigQuery(categoryId, categoryPayload.slug),
        );
        freshConfigs = [];
      } else {
        freshConfigs = await syncSelectedStoreConfigs(category, body, storeIds);
      }
    } else {
      freshConfigs = await dedupeAndRepairCategoryConfigs(category);
    }

    invalidateCategoryCache();

    return NextResponse.json({
      success: true,
      data: formatCategoryWithConfigs(category, freshConfigs),
    });
  } catch (error: any) {
    console.error("PATCH CATEGORY ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error) || "Failed to update category",
      },
      { status: error?.code === 11000 ? 409 : 400 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const id = cleanString(searchParams.get("id"));
    const storeId = normalizeStoreId(searchParams.get("storeId"));
    const configId = cleanString(
      searchParams.get("storeConfigId") || searchParams.get("configId"),
    );

    if (configId && isValidObjectId(configId)) {
      const config = await CategoryStoreConfig.findById(configId);

      if (!config) {
        return NextResponse.json(
          { success: false, message: "Category store config not found" },
          { status: 404 },
        );
      }

      await CategoryStoreConfig.deleteOne({ _id: config._id });
      invalidateCategoryCache();

      return NextResponse.json({
        success: true,
        message: "Category removed from this store successfully",
      });
    }

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Valid category ID is required" },
        { status: 400 },
      );
    }

    const category = await Category.findById(id);

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Category not found" },
        { status: 404 },
      );
    }

    const categorySlug = slugify(
      (category as any).slug || (category as any).name,
    );

    if (storeId) {
      await CategoryStoreConfig.deleteMany({
        ...relatedCategoryConfigQuery(String(category._id), categorySlug),
        storeId,
      });

      await dedupeAndRepairCategoryConfigs(category);
      invalidateCategoryCache();

      return NextResponse.json({
        success: true,
        message: "Category removed from this store successfully",
      });
    }

    await CategoryStoreConfig.deleteMany(
      relatedCategoryConfigQuery(String(category._id), categorySlug),
    );
    await Category.deleteOne({ _id: category._id });

    invalidateCategoryCache();

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error: any) {
    console.error("DELETE CATEGORY ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error) || "Failed to delete category",
      },
      { status: 500 },
    );
  }
}
