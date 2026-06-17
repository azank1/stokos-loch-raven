import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { revalidateTag } from "next/cache";
import connectDB from "@/lib/mongodb";
import Category from "@/models/category";
import CategoryStoreConfig from "@/models/categorystoreconfig";
import { invalidateMenuCategories } from "@/lib/server/menu-cache";
import { ensureCategoryStoreConfigIndexes } from "@/lib/server/category-store-config-indexes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isValidObjectId = (value: string) =>
  mongoose.Types.ObjectId.isValid(value);

function cleanString(value: unknown) {
  return String(value || "").trim();
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
  return slugify(value);
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

function cleanNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const number = Number(cleanString(value).replace(/[^0-9.-]/g, "") || 0);
  return Number.isFinite(number) ? number : 0;
}

function cleanStatus(value: unknown) {
  const status = cleanString(value);
  if (["Active", "Hidden", "Inactive"].includes(status)) return status;
  return "Active";
}

function categoryIdValues(categoryId: unknown) {
  const cleanCategoryId = cleanString(categoryId);
  const values: any[] = [];

  if (cleanCategoryId) values.push(cleanCategoryId);
  if (cleanCategoryId && isValidObjectId(cleanCategoryId)) {
    values.push(new mongoose.Types.ObjectId(cleanCategoryId));
  }

  return values;
}

function categoryIdMatch(categoryId: unknown) {
  const values = categoryIdValues(categoryId);
  return values.length ? { categoryId: { $in: values } } : { categoryId: "" };
}

async function getCategoryByIdOrSlug(
  categoryId: string,
  categorySlug?: string,
) {
  if (categoryId && isValidObjectId(categoryId)) {
    const category = await Category.findById(categoryId);
    if (category) return category;
  }

  const slug = slugify(categorySlug);
  if (slug) {
    const category = await Category.findOne({ slug }).sort({
      updatedAt: -1,
      createdAt: -1,
    });
    if (category) return category;
  }

  return null;
}

function buildConfigPayload(body: any, category?: any) {
  const cleanCategory = category?.toObject
    ? category.toObject()
    : category || {};
  const categoryId = cleanString(
    cleanCategory._id || body.categoryId || body.id || body._id,
  );
  const storeId = normalizeStoreId(
    body.storeId || body.storeSlug || body.store,
  );

  if (!categoryId || !storeId) {
    throw new Error("categoryId and storeId are required");
  }

  const categoryName = cleanString(
    cleanCategory.name || body.categoryName || body.name || body.title,
  );
  const categorySlug = slugify(
    cleanCategory.slug || body.categorySlug || body.slug || categoryName,
  );
  const available = body.available !== false && body.isAvailable !== false;

  return {
    categoryId,
    storeId,
    categoryName,
    categorySlug,
    available,
    isAvailable: available,
    status: cleanStatus(body.status),
    sortOrder: cleanNumber(body.sortOrder),
  };
}

function latestDate(doc: any) {
  const time = new Date(
    doc?.updatedAt || doc?.createdAt || doc?._id?.getTimestamp?.() || 0,
  ).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function cleanupDuplicateCategoryStoreConfigs(
  categoryId: string,
  categorySlug?: string,
) {
  const cleanCategoryId = cleanString(categoryId);
  const cleanCategorySlug = slugify(categorySlug);
  const orQuery: any[] = [];

  if (cleanCategoryId) orQuery.push(categoryIdMatch(cleanCategoryId));
  if (cleanCategorySlug) orQuery.push({ categorySlug: cleanCategorySlug });

  if (!orQuery.length) return [];

  const docs = await CategoryStoreConfig.collection
    .find({ $or: orQuery })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .toArray();

  const keepByStore = new Map<string, any>();
  const deleteIds: any[] = [];

  docs
    .sort((a: any, b: any) => latestDate(b) - latestDate(a))
    .forEach((doc: any) => {
      const storeId = normalizeStoreId(doc.storeId);

      if (!storeId) {
        deleteIds.push(doc._id);
        return;
      }

      if (!keepByStore.has(storeId)) {
        keepByStore.set(storeId, doc);
        return;
      }

      deleteIds.push(doc._id);
    });

  if (deleteIds.length > 0) {
    await CategoryStoreConfig.collection.deleteMany({
      _id: { $in: deleteIds },
    });
  }

  for (const [storeId, doc] of keepByStore.entries()) {
    const available = doc.available !== false && doc.isAvailable !== false;

    await CategoryStoreConfig.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          categoryId: cleanCategoryId,
          storeId,
          categorySlug:
            cleanCategorySlug || slugify(doc.categorySlug || doc.categoryName),
          categoryName: cleanString(doc.categoryName),
          available,
          isAvailable: available,
          status: cleanStatus(doc.status),
          sortOrder: cleanNumber(doc.sortOrder),
        },
      },
    );
  }

  return CategoryStoreConfig.find(categoryIdMatch(cleanCategoryId))
    .sort({ storeId: 1, sortOrder: 1 })
    .lean<any[]>();
}

function formatConfig(config: any) {
  const storeId = normalizeStoreId(config?.storeId);
  const available =
    config?.available !== false && config?.isAvailable !== false;

  return {
    ...config,
    _id: cleanString(config?._id),
    id: cleanString(config?._id || config?.id),
    storeConfigId: cleanString(
      config?._id || config?.storeConfigId || config?.configId,
    ),
    configId: cleanString(
      config?._id || config?.configId || config?.storeConfigId,
    ),
    categoryId: cleanString(config?.categoryId),
    storeId,
    storeSlug: storeId,
    categoryName: cleanString(config?.categoryName),
    categorySlug: slugify(config?.categorySlug || config?.categoryName),
    available,
    isAvailable: available,
    status: cleanStatus(config?.status),
    sortOrder: cleanNumber(config?.sortOrder),
  };
}

function invalidateCategoryCache() {
  invalidateMenuCategories();
  // FIX: revalidateTag only accepts one argument in Next.js 13+.
  revalidateTag("store-menu-categories" , "max");
  revalidateTag("store-menu" , "max");
}

function getErrorMessage(error: any) {
  if (error?.code === 11000) {
    const keys = Object.keys(error?.keyPattern || {}).join(", ");
    return keys
      ? `MongoDB duplicate index blocked this save (${keys}). Run scripts/mongodb-indexes.js, then save again.`
      : "MongoDB duplicate index blocked this save. Run scripts/mongodb-indexes.js, then save again.";
  }

  if (error?.message) return error.message;
  return "Something went wrong.";
}

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const storeId = normalizeStoreId(searchParams.get("storeId"));
    const categoryId = cleanString(searchParams.get("categoryId"));
    const categorySlug = slugify(searchParams.get("categorySlug"));
    const query: any = {};

    if (storeId && storeId !== "all") query.storeId = storeId;
    if (categoryId) Object.assign(query, categoryIdMatch(categoryId));
    if (categorySlug) query.categorySlug = categorySlug;

    const configs = await CategoryStoreConfig.collection
      .find(query)
      .sort({ storeId: 1, sortOrder: 1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: configs.map(formatConfig),
    });
  } catch (error: any) {
    console.error("GET CATEGORY STORE CONFIGS ERROR:", error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    await ensureCategoryStoreConfigIndexes();
    const body = await req.json();
    const category = await getCategoryByIdOrSlug(
      cleanString(body.categoryId || body.id || body._id),
      cleanString(
        body.categorySlug || body.slug || body.categoryName || body.name,
      ),
    );
    const storeIds = extractStoreIds(body);

    if (!storeIds.length) {
      return NextResponse.json(
        { success: false, message: "At least one store is required" },
        { status: 400 },
      );
    }

    const savedConfigs: any[] = [];
    let lastPayload: any = null;

    for (const storeId of storeIds) {
      const payload = buildConfigPayload({ ...body, storeId }, category);
      lastPayload = payload;

      let config: any;

      try {
        config = await CategoryStoreConfig.findOneAndUpdate(
          { categoryId: payload.categoryId, storeId: payload.storeId },
          { $set: payload },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        );
      } catch (error: any) {
        if (error?.code !== 11000) throw error;

        await cleanupDuplicateCategoryStoreConfigs(
          payload.categoryId,
          payload.categorySlug,
        );
        config = await CategoryStoreConfig.findOneAndUpdate(
          { categoryId: payload.categoryId, storeId: payload.storeId },
          { $set: payload },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        );
      }

      savedConfigs.push(config?.toObject ? config.toObject() : config);
    }

    const freshConfigs = lastPayload
      ? await cleanupDuplicateCategoryStoreConfigs(
          lastPayload.categoryId,
          lastPayload.categorySlug,
        )
      : savedConfigs;
    const freshByStore = new Map(
      freshConfigs.map((config: any) => [normalizeStoreId(config.storeId), config]),
    );
    const responseConfigs = storeIds
      .map((storeId) => freshByStore.get(storeId))
      .filter(Boolean);

    invalidateCategoryCache();

    return NextResponse.json(
      {
        success: true,
        data:
          responseConfigs.length === 1
            ? formatConfig(responseConfigs[0])
            : responseConfigs.map(formatConfig),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("POST CATEGORY STORE CONFIG ERROR:", error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: error?.code === 11000 ? 409 : 400 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB();
    await ensureCategoryStoreConfigIndexes();
    const { searchParams } = new URL(req.url);
    const id = cleanString(
      searchParams.get("id") || searchParams.get("configId"),
    );
    const categoryId = cleanString(searchParams.get("categoryId"));
    const storeId = normalizeStoreId(searchParams.get("storeId"));

    if (id && isValidObjectId(id)) {
      const config = await CategoryStoreConfig.findById(id).lean<any>();
      await CategoryStoreConfig.deleteOne({
        _id: new mongoose.Types.ObjectId(id),
      });

      if (config?.categoryId) {
        await cleanupDuplicateCategoryStoreConfigs(
          config.categoryId,
          config.categorySlug,
        );
      }

      invalidateCategoryCache();
      return NextResponse.json({
        success: true,
        message: "Category config deleted",
      });
    }

    if (!categoryId || !storeId) {
      return NextResponse.json(
        { success: false, message: "categoryId and storeId are required" },
        { status: 400 },
      );
    }

    await CategoryStoreConfig.collection.deleteMany({
      ...categoryIdMatch(categoryId),
      storeId,
    });

    await cleanupDuplicateCategoryStoreConfigs(categoryId);
    invalidateCategoryCache();

    return NextResponse.json({
      success: true,
      message: "Category config deleted",
    });
  } catch (error: any) {
    console.error("DELETE CATEGORY STORE CONFIG ERROR:", error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
