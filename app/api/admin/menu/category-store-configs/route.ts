import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { revalidateTag } from "next/cache";
import connectDB from "@/lib/mongodb";
import CategoryStoreConfig from "@/models/categorystoreconfig";
import { invalidateMenuCategories } from "@/lib/server/menu-cache";

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

function buildConfigPayload(body: any) {
  const categoryId = cleanString(body.categoryId);
  const storeId = normalizeStoreId(body.storeId || body.storeSlug || body.store);

  if (!categoryId || !storeId) {
    throw new Error("categoryId and storeId are required");
  }

  const available = body.available !== false && body.isAvailable !== false;

  return {
    categoryId,
    storeId,
    categoryName: cleanString(body.categoryName || body.name || body.title),
    categorySlug: slugify(body.categorySlug || body.slug || body.categoryName || body.name),
    available,
    isAvailable: available,
    status: cleanStatus(body.status),
    sortOrder: cleanNumber(body.sortOrder),
  };
}

async function cleanupDuplicateCategoryStoreConfigs(
  categoryId: string,
  categorySlug?: string
) {
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
          isAvailable: doc.available !== false && doc.isAvailable !== false,
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
    const payload = buildConfigPayload(body);

    const config = await CategoryStoreConfig.findOneAndUpdate(
      { categoryId: payload.categoryId, storeId: payload.storeId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    await cleanupDuplicateCategoryStoreConfigs(payload.categoryId, payload.categorySlug);
    invalidateCategoryCache();

    return NextResponse.json({ success: true, data: config }, { status: 201 });
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
