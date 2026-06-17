import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import CategoryStoreConfig from "@/models/categorystoreconfig";
import { rebuildStoreMenusAfterAdminChange } from "@/lib/server/storemenu-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isValidObjectId = (value: string) =>
  mongoose.Types.ObjectId.isValid(value);

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function normalizeStoreId(value: unknown) {
  return cleanString(value).toLowerCase();
}

function cleanStatus(value: unknown) {
  const status = cleanString(value);
  if (["Active", "Hidden", "Inactive"].includes(status)) return status;
  return "Active";
}

function categoryIdValues(categoryId: string) {
  const cleanCategoryId = cleanString(categoryId);
  const values: any[] = [];

  if (cleanCategoryId) values.push(cleanCategoryId);
  if (cleanCategoryId && isValidObjectId(cleanCategoryId)) {
    values.push(new mongoose.Types.ObjectId(cleanCategoryId));
  }

  return values;
}

function categoryIdMatch(categoryId: string) {
  const values = categoryIdValues(categoryId);
  return values.length ? { categoryId: { $in: values } } : { categoryId: "" };
}

async function cleanupDuplicateCategoryStoreConfigs(categoryId: string, categorySlug?: string) {
  const match: any = categoryIdMatch(categoryId);

  if (categorySlug) {
    match.$or = [categoryIdMatch(categoryId), { categorySlug }];
    delete match.categoryId;
  }

  const docs = await CategoryStoreConfig.collection
    .find(match)
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
    if (String(doc.categoryId || "") !== categoryId || String(doc.storeId || "") !== storeId) {
      await CategoryStoreConfig.collection.updateOne(
        { _id: doc._id },
        { $set: { categoryId, storeId } }
      );
    }
  }
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
    const query: any = {};

    if (storeId && storeId !== "all") query.storeId = storeId;
    if (categoryId) Object.assign(query, categoryIdMatch(categoryId));

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
    const categoryId = cleanString(body.categoryId);
    const storeId = normalizeStoreId(body.storeId);

    if (!categoryId || !storeId) {
      return NextResponse.json(
        { success: false, message: "categoryId and storeId are required" },
        { status: 400 }
      );
    }

    const payload = {
      categoryId,
      storeId,
      categoryName: cleanString(body.categoryName),
      categorySlug: cleanString(body.categorySlug),
      available: body.available !== false,
      status: cleanStatus(body.status),
      sortOrder: Number(body.sortOrder || 0),
    };

    const previousConfig = await CategoryStoreConfig.findOne({ categoryId, storeId }).lean();

    const config = await CategoryStoreConfig.findOneAndUpdate(
      { categoryId, storeId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true }
    );

    await cleanupDuplicateCategoryStoreConfigs(categoryId, payload.categorySlug);
    await rebuildStoreMenusAfterAdminChange(
      { storeId, reason: "category-store-config-save" },
      body,
      previousConfig,
      payload,
      config
    );

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
    const categoryId = cleanString(searchParams.get("categoryId"));
    const storeId = normalizeStoreId(searchParams.get("storeId"));

    if (!categoryId || !storeId) {
      return NextResponse.json(
        { success: false, message: "categoryId and storeId are required" },
        { status: 400 }
      );
    }

    const previousConfigs = await CategoryStoreConfig.collection
      .find({
        ...categoryIdMatch(categoryId),
        storeId,
      })
      .toArray();

    await CategoryStoreConfig.collection.deleteMany({
      ...categoryIdMatch(categoryId),
      storeId,
    });

    await cleanupDuplicateCategoryStoreConfigs(categoryId);
    await rebuildStoreMenusAfterAdminChange(
      { storeId, reason: "category-store-config-delete" },
      previousConfigs,
      { categoryId, storeId }
    );

    return NextResponse.json({ success: true, message: "Category config deleted" });
  } catch (error: any) {
    console.error("DELETE CATEGORY STORE CONFIG ERROR:", error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
