import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { revalidateTag } from "next/cache";
import connectDB from "@/lib/mongodb";
import CategoryStoreConfig from "@/models/categorystoreconfig";
import { invalidateMenuCategories } from "@/lib/server/menu-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const values: unknown[] = [];

  [
    body?.storeIds,
    body?.storeSlugs,
    body?.stores,
    body?.selectedStores,
    body?.selectedStoreIds,
    body?.selectedStoreSlugs,
    body?.storeId,
    body?.storeSlug,
    body?.store,
  ].forEach((value) => addStoreValue(value, values));

  return uniqueStrings(
    values
      .map(normalizeStoreId)
      .filter((storeId) => storeId && !["all", "all-store", "all-stores"].includes(storeId))
  );
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

function buildConfigPayload(body: any, storeId: string) {
  const categoryId = cleanString(body.categoryId || body.id || body._id);
  const cleanStoreId = normalizeStoreId(storeId || body.storeId || body.storeSlug || body.store);

  if (!categoryId || !cleanStoreId) {
    throw new Error("categoryId and storeId are required");
  }

  const categoryName = cleanString(body.categoryName || body.name || body.title);
  const categorySlug = slugify(body.categorySlug || body.slug || categoryName);
  const available = body.available !== false && body.isAvailable !== false;

  return {
    categoryId,
    storeId: cleanStoreId,
    categoryName,
    categorySlug,
    available,
    isAvailable: available,
    status: cleanStatus(body.status),
    sortOrder: cleanNumber(body.sortOrder),
  };
}

async function cleanupDuplicateCategoryStoreConfigs(categoryId: string, categorySlug?: string) {
  const cleanCategoryId = cleanString(categoryId);
  const cleanCategorySlug = slugify(categorySlug);
  const orQuery: any[] = [];

  if (cleanCategoryId) orQuery.push(categoryIdMatch(cleanCategoryId));
  if (cleanCategorySlug) orQuery.push({ categorySlug: cleanCategorySlug });

  if (!orQuery.length) return;

  const docs = await CategoryStoreConfig.collection
    .find({ $or: orQuery })
    .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
    .toArray();

  const keepByStore = new Map<string, any>();
  const deleteIds: any[] = [];

  docs.forEach((doc: any) => {
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
    await CategoryStoreConfig.collection.deleteMany({ _id: { $in: deleteIds } });
  }

  for (const [storeId, doc] of keepByStore.entries()) {
    await CategoryStoreConfig.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          categoryId: cleanCategoryId,
          storeId,
          categorySlug: cleanCategorySlug || slugify(doc.categorySlug || doc.categoryName),
          available: doc.available !== false && doc.isAvailable !== false,
          isAvailable: doc.available !== false && doc.isAvailable !== false,
          status: cleanStatus(doc.status),
          sortOrder: cleanNumber(doc.sortOrder),
          updatedAt: new Date(),
        },
      }
    );
  }
}

function invalidateCategoryCache() {
  invalidateMenuCategories();
  revalidateTag("store-menu-categories", "max");
  revalidateTag("store-menu", "max");
}

function getErrorMessage(error: any) {
  if (error?.code === 11000) return "Category config already exists.";
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

    return NextResponse.json({ success: true, data: configs });
  } catch (error: any) {
    console.error("GET CATEGORY STORE CONFIGS ERROR:", error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const storeIds = extractStoreIds(body);

    if (!storeIds.length) {
      return NextResponse.json(
        { success: false, message: "At least one store is required" },
        { status: 400 }
      );
    }

    const operations = storeIds.map((storeId) => {
      const payload = buildConfigPayload(body, storeId);

      return {
        updateOne: {
          filter: { categoryId: payload.categoryId, storeId: payload.storeId },
          update: {
            $set: payload,
            $setOnInsert: { createdAt: new Date() },
          },
          upsert: true,
        },
      };
    });

    await CategoryStoreConfig.bulkWrite(operations, { ordered: false });

    const firstPayload = buildConfigPayload(body, storeIds[0]);
    await cleanupDuplicateCategoryStoreConfigs(firstPayload.categoryId, firstPayload.categorySlug);

    const configs = await CategoryStoreConfig.find(categoryIdMatch(firstPayload.categoryId))
      .sort({ storeId: 1, sortOrder: 1 })
      .lean<any[]>();

    invalidateCategoryCache();

    return NextResponse.json({ success: true, data: configs }, { status: 201 });
  } catch (error: any) {
    console.error("POST CATEGORY STORE CONFIG ERROR:", error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: error?.code === 11000 ? 409 : 400 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const id = cleanString(searchParams.get("id") || searchParams.get("configId"));
    const categoryId = cleanString(searchParams.get("categoryId"));
    const storeId = normalizeStoreId(searchParams.get("storeId"));

    if (id && isValidObjectId(id)) {
      await CategoryStoreConfig.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
      invalidateCategoryCache();
      return NextResponse.json({ success: true, message: "Category config deleted" });
    }

    if (!categoryId || !storeId) {
      return NextResponse.json(
        { success: false, message: "categoryId and storeId are required" },
        { status: 400 }
      );
    }

    await CategoryStoreConfig.collection.deleteMany({
      ...categoryIdMatch(categoryId),
      storeId,
    });

    await cleanupDuplicateCategoryStoreConfigs(categoryId);
    invalidateCategoryCache();

    return NextResponse.json({ success: true, message: "Category config deleted" });
  } catch (error: any) {
    console.error("DELETE CATEGORY STORE CONFIG ERROR:", error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
