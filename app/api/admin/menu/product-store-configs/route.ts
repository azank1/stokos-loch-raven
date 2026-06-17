import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import ProductStoreConfig from "@/models/productstoreconfig";
import UpsellRule from "@/models/upsellrule";
import Category from "@/models/category";
import CategoryStoreConfig from "@/models/categorystoreconfig";
import { rebuildStoreMenusAfterAdminChange } from "@/lib/server/storemenu-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const isValidObjectId = (value: string) =>
  mongoose.Types.ObjectId.isValid(value);

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function normalizeStoreId(value: unknown) {
  return cleanString(value).toLowerCase();
}

function cleanNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function cleanBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();

    if (["true", "yes", "1", "active", "popular", "featured"].includes(lower)) {
      return true;
    }

    if (["false", "no", "0", "inactive", "off", "hidden"].includes(lower)) {
      return false;
    }
  }

  return fallback;
}

function productIdValues(productId: string) {
  const cleanProductId = cleanString(productId);
  const values: any[] = [];

  if (cleanProductId) values.push(cleanProductId);
  if (cleanProductId && isValidObjectId(cleanProductId)) {
    values.push(new mongoose.Types.ObjectId(cleanProductId));
  }

  return values;
}

function productIdMatch(productId: string) {
  const values = productIdValues(productId);
  return values.length ? { productId: { $in: values } } : { productId: "" };
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

function cleanProductStatus(value: unknown) {
  const status = cleanString(value);
  if (["Active", "Draft", "Hidden", "Inactive"].includes(status)) return status;
  return "Active";
}

type ProductRelatedUpsellPayload = {
  upsellId: string;
  name: string;
  price: number;
};

async function resolveRelatedUpsells(
  value: unknown
): Promise<ProductRelatedUpsellPayload[]> {
  const rawItems = Array.isArray(value) ? value : [];
  const normalized = rawItems
    .map((item: any, index): ProductRelatedUpsellPayload | null => {
      if (typeof item === "string" || typeof item === "number") {
        const upsellId = cleanString(item);
        if (!upsellId) return null;
        return { upsellId, name: "", price: 0 };
      }

      if (!item || typeof item !== "object") return null;

      const name = cleanString(
        item.name || item.offer || item.title || item.label || item.upsellName
      );
      const upsellId = cleanString(
        item.upsellId || item._id || item.id || item.slug || slugify(name)
      );

      if (!upsellId && !name) return null;

      return {
        upsellId: upsellId || slugify(name) || `upsell-${index + 1}`,
        name,
        price: cleanNumber(item.price),
      };
    })
    .filter(Boolean) as ProductRelatedUpsellPayload[];

  const objectIds = normalized
    .map((item) => item.upsellId)
    .filter((id) => isValidObjectId(id));

  const rules = objectIds.length
    ? await UpsellRule.find({ _id: { $in: objectIds } })
        .select("name offer slug")
        .lean()
    : [];

  const namesById = new Map<string, string>();

  rules.forEach((rule: any) => {
    const id = cleanString(rule._id);
    const name = cleanString(rule.name || rule.offer || rule.slug);
    if (id && name) namesById.set(id, name);
  });

  const unique = new Map<string, ProductRelatedUpsellPayload>();

  normalized.forEach((item) => {
    unique.set(item.upsellId, {
      upsellId: item.upsellId,
      name: item.name || namesById.get(item.upsellId) || item.upsellId,
      price: cleanNumber(item.price),
    });
  });

  return Array.from(unique.values());
}

function cleanSizes(value: unknown, fallbackPrice: unknown) {
  const rawSizes = Array.isArray(value) ? value : [];

  const sizes = rawSizes
    .map((size: any, index) => {
      const name = cleanString(size?.name);
      if (!name) return null;

      return {
        id: cleanString(size?.id) || slugify(name) || `size-${index + 1}`,
        name,
        price: cleanNumber(size?.price),
        sortOrder: Number(size?.sortOrder ?? index),
      };
    })
    .filter(Boolean);

  if (sizes.length) return sizes;

  return [
    {
      id: "regular",
      name: "Regular",
      price: cleanNumber(fallbackPrice),
      sortOrder: 0,
    },
  ];
}

async function resolveCategory(body: any) {
  const categoryId = cleanString(body.categoryId || body.category);

  if (categoryId && isValidObjectId(categoryId)) {
    const found = await Category.findById(categoryId);
    if (found) return found;
  }

  const categoryName = cleanString(body.categoryName || body.category);
  if (!categoryName) throw new Error("Category is required");

  const categorySlug = slugify(categoryName);

  return Category.findOneAndUpdate(
    { slug: categorySlug },
    {
      $setOnInsert: {
        name: categoryName,
        slug: categorySlug,
        description: "",
        image: "",
      },
    },
    { new: true, upsert: true }
  );
}

async function cleanupDuplicateCategoryStoreConfigs(categoryId: string, categorySlug?: string) {
  const values = categoryIdValues(categoryId);
  const match: any = { categoryId: { $in: values } };

  if (categorySlug) {
    match.$or = [{ categoryId: { $in: values } }, { categorySlug }];
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

async function cleanupDuplicateProductStoreConfigs(productId: string) {
  const docs = await ProductStoreConfig.collection
    .find(productIdMatch(productId))
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
    await ProductStoreConfig.collection.deleteMany({ _id: { $in: deleteIds } });
  }

  for (const [storeId, doc] of keepByStore.entries()) {
    if (String(doc.productId || "") !== productId || String(doc.storeId || "") !== storeId) {
      await ProductStoreConfig.collection.updateOne(
        { _id: doc._id },
        { $set: { productId, storeId } }
      );
    }
  }
}

async function syncCategoryStoreConfig(category: any, storeId: string) {
  try {
    const categoryId = String(category._id || category.id || "");
    const cleanStoreId = normalizeStoreId(storeId);

    if (!categoryId || !cleanStoreId) return;

    await CategoryStoreConfig.findOneAndUpdate(
      { categoryId, storeId: cleanStoreId },
      {
        $set: {
          categoryId,
          storeId: cleanStoreId,
          categoryName: String(category.name || ""),
          categorySlug: String(category.slug || slugify(String(category.name || ""))),
          available: true,
          status: "Active",
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    await cleanupDuplicateCategoryStoreConfigs(categoryId, String(category.slug || slugify(String(category.name || ""))));
  } catch (error) {
    console.error("CATEGORY STORE CONFIG SYNC WARNING:", error);
  }
}

async function buildPayload(body: any) {
  const productId = cleanString(body.productId);
  const storeId = normalizeStoreId(body.storeId);

  if (!productId) throw new Error("productId is required");
  if (!storeId) throw new Error("storeId is required");

  const category = await resolveCategory(body);
  await syncCategoryStoreConfig(category, storeId);

  const sizes = cleanSizes(body.sizes, body.price);
  const modifierGroups = Array.isArray(body.modifierGroups) ? body.modifierGroups : [];

  return {
    productId,
    storeId,
    categoryId: String(category._id),
    categoryName: String(category.name || ""),
    categorySlug: String(category.slug || slugify(String(category.name || ""))),
    price: cleanNumber((sizes[0] as any)?.price || body.price),
    sizes,
    modifierGroups,
    modifierGroupIds: Array.from(
      new Set(
        [
          ...(Array.isArray(body.modifierGroupIds) ? body.modifierGroupIds : []),
          ...modifierGroups.map((group: any) => group?.modifierGroupId),
        ]
          .map((item) => cleanString(item))
          .filter(Boolean)
      )
    ),
    relatedUpsells: await resolveRelatedUpsells(body.relatedUpsells),
    upsell: body.upsell || "",
    isAvailable: body.isAvailable !== false && body.available !== false,
    available: body.isAvailable !== false && body.available !== false,
    isPopular: cleanBoolean(body.isPopular, cleanBoolean(body.showInPopular)),
    showInPopular: cleanBoolean(body.isPopular, cleanBoolean(body.showInPopular)),
    status: cleanProductStatus(body.status),
    sortOrder: Number(body.sortOrder || 0),
  };
}

function getErrorMessage(error: any) {
  if (error?.code === 11000) return "Store config already exists.";
  if (error?.message) return error.message;
  return "Something went wrong.";
}

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const productId = cleanString(searchParams.get("productId"));
    const storeId = normalizeStoreId(searchParams.get("storeId"));
    const query: any = {};

    if (productId) Object.assign(query, productIdMatch(productId));
    if (storeId && storeId !== "all") query.storeId = storeId;

    const configs = await ProductStoreConfig.collection
      .find(query)
      .sort({ storeId: 1, sortOrder: 1 })
      .toArray();

    return NextResponse.json({ success: true, data: configs });
  } catch (error: any) {
    console.error("GET PRODUCT STORE CONFIGS ERROR:", error);
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
    const payload = await buildPayload(body);

    const config = await ProductStoreConfig.findOneAndUpdate(
      { productId: payload.productId, storeId: payload.storeId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true }
    );

    await cleanupDuplicateProductStoreConfigs(payload.productId);
    await rebuildStoreMenusAfterAdminChange(body, payload, config);

    return NextResponse.json({ success: true, data: config }, { status: 201 });
  } catch (error: any) {
    console.error("POST PRODUCT STORE CONFIG ERROR:", error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: error?.code === 11000 ? 409 : 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const id = cleanString(body.id || body._id);
    const payload = await buildPayload(body);

    let config = null;
    let previousConfig = null;

    if (id && isValidObjectId(id)) {
      previousConfig = await ProductStoreConfig.findById(id).lean();
      config = await ProductStoreConfig.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
      });
    } else {
      previousConfig = await ProductStoreConfig.findOne({
        productId: payload.productId,
        storeId: payload.storeId,
      }).lean();

      config = await ProductStoreConfig.findOneAndUpdate(
        { productId: payload.productId, storeId: payload.storeId },
        { $set: payload },
        { new: true, upsert: true, runValidators: true }
      );
    }

    await cleanupDuplicateProductStoreConfigs(payload.productId);
    await rebuildStoreMenusAfterAdminChange(body, previousConfig, payload, config);

    return NextResponse.json({ success: true, data: config });
  } catch (error: any) {
    console.error("PATCH PRODUCT STORE CONFIG ERROR:", error);
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
    const id = cleanString(searchParams.get("id"));
    const productId = cleanString(searchParams.get("productId"));
    const storeId = normalizeStoreId(searchParams.get("storeId"));

    let previousConfig = null;

    if (id && isValidObjectId(id)) {
      previousConfig = await ProductStoreConfig.findById(id).lean();
      await ProductStoreConfig.findByIdAndDelete(id);
    } else if (productId && storeId) {
      previousConfig = await ProductStoreConfig.findOne({
        ...productIdMatch(productId),
        storeId,
      }).lean();

      await ProductStoreConfig.collection.deleteMany({
        ...productIdMatch(productId),
        storeId,
      });
      await cleanupDuplicateProductStoreConfigs(productId);
    } else {
      return NextResponse.json(
        { success: false, message: "Config ID or productId + storeId required" },
        { status: 400 }
      );
    }

    await rebuildStoreMenusAfterAdminChange(previousConfig, { productId, storeId });

    return NextResponse.json({ success: true, message: "Config deleted" });
  } catch (error: any) {
    console.error("DELETE PRODUCT STORE CONFIG ERROR:", error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
