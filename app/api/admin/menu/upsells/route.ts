import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import UpsellRule from "@/models/upsellrule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyObject = Record<string, any>;

let adminUpsellIndexesPromise: Promise<void> | null = null;

async function ensureAdminUpsellIndexes() {
  if (!adminUpsellIndexesPromise) {
    adminUpsellIndexesPromise = Promise.all([
      UpsellRule.collection.createIndex({ storeId: 1 }),
      UpsellRule.collection.createIndex({ storeIds: 1 }),
      UpsellRule.collection.createIndex({ "storeConfigs.storeId": 1 }),
      UpsellRule.collection.createIndex({ name: 1 }),
      UpsellRule.collection.createIndex({ sortOrder: 1, createdAt: -1 }),
    ]).then(() => undefined);
  }

  return adminUpsellIndexesPromise;
}

const UPSELL_LIST_PROJECTION = {
  storeId: 1,
  storeIds: 1,
  storeConfigs: 1,
  name: 1,
  image: 1,
  description: 1,
  categoryId: 1,
  categoryName: 1,
  categoryType: 1,
  triggerCategoryId: 1,
  triggerCategoryName: 1,
  offerProductIds: 1,
  trigger: 1,
  offer: 1,
  appliesToCategories: 1,
  appliesToProducts: 1,
  sortOrder: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
};

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => cleanString(item)).filter(Boolean))
  );
}

function cleanStatus(value: unknown) {
  const status = cleanString(value);
  if (["Active", "Paused", "Inactive"].includes(status)) return status;
  return "Active";
}

function cleanBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (["true", "yes", "1", "active"].includes(lower)) return true;
    if (["false", "no", "0", "inactive", "off"].includes(lower)) return false;
  }
  return fallback;
}

function cleanStoreConfigs(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((config: any, index: number) => {
      const storeId = cleanString(config?.storeId).toLowerCase();
      if (!storeId) return null;

      const available = cleanBoolean(config?.available, true);
      const status = available ? cleanStatus(config?.status || "Active") : "Inactive";

      return {
        ...(config._id ? { _id: cleanString(config._id) } : {}),
        ...(config.id ? { id: cleanString(config.id) } : {}),
        ...(config.upsellId ? { upsellId: cleanString(config.upsellId) } : {}),
        storeId,
        categoryId: cleanString(config?.categoryId),
        categoryName: cleanString(config?.categoryName),
        available,
        status,
        sortOrder: Number(config?.sortOrder ?? index),
      };
    })
    .filter(Boolean);
}

function buildUpsellPayload(body: any) {
  const storeConfigs = cleanStoreConfigs(body.storeConfigs);
  const storeIds = cleanStringArray(body.storeIds).map((item) => item.toLowerCase());

  const activeConfigs = storeConfigs.filter(
    (config: any) => config.available && config.status !== "Inactive"
  );

  const primaryConfig = activeConfigs[0] || storeConfigs[0];

  const storeId = cleanString(
    body.storeId || primaryConfig?.storeId || storeIds[0] || "towson"
  ).toLowerCase();

  const categoryId = cleanString(
    body.categoryId || primaryConfig?.categoryId || body.triggerCategoryId || ""
  );

  const categoryName = cleanString(
    body.categoryName ||
      primaryConfig?.categoryName ||
      body.categoryType ||
      body.triggerCategoryName ||
      ""
  );

  const name =
    cleanString(body.name) ||
    (categoryName ? `${categoryName} Upsells` : "Upsell Item");

  return {
    storeId,
    storeIds: storeIds.length
      ? storeIds
      : activeConfigs.map((c: any) => c.storeId).filter(Boolean),
    storeConfigs,
    name,
    image: cleanString(body.image),
    description: cleanString(body.description),
    categoryId,
    categoryName,
    categoryType: categoryName,
    triggerCategoryId: categoryId,
    triggerCategoryName: categoryName,
    offerProductIds: [],
    trigger: categoryName,
    offer: name,
    appliesToCategories: categoryName ? [categoryName] : [],
    appliesToProducts: [],
    sortOrder: Number(body.sortOrder || 0),
    status: cleanStatus(body.status),
  };
}

function getErrorMessage(error: any) {
  if (error?.code === 11000) return "Upsell with this name already exists";
  if (error?.message) return error.message;
  return "Something went wrong";
}

export async function GET(req: Request) {
  try {
    await connectDB();
    await ensureAdminUpsellIndexes();

    const { searchParams } = new URL(req.url);
    const storeId = cleanString(searchParams.get("storeId")).toLowerCase();
    const search = cleanString(searchParams.get("search"));

    const query: AnyObject = {};

    if (storeId && storeId !== "all") {
      query.$or = [
        { storeId },
        { storeIds: storeId },
        { "storeConfigs.storeId": storeId },
      ];
    }

    if (search) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { offer: { $regex: search, $options: "i" } },
            { categoryName: { $regex: search, $options: "i" } },
          ],
        },
      ];
    }

    const upsellRules = await UpsellRule.find(query)
      .select(UPSELL_LIST_PROJECTION)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: upsellRules,
      upsellRules,
    });
  } catch (error) {
    console.error("GET UPSELL RULES ERROR:", error);
    return NextResponse.json(
      { success: false, data: [], upsellRules: [], message: "Failed to fetch upsell rules" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const payload = buildUpsellPayload(body);

    if (!payload.name) {
      return NextResponse.json(
        { success: false, message: "Upsell name is required" },
        { status: 400 }
      );
    }

    if (!payload.storeId) {
      return NextResponse.json(
        { success: false, message: "Store is required" },
        { status: 400 }
      );
    }

    if (!payload.storeConfigs.length) {
      return NextResponse.json(
        { success: false, message: "At least one store config is required" },
        { status: 400 }
      );
    }

    const upsellRule = await UpsellRule.create(payload);

    return NextResponse.json(
      { success: true, data: upsellRule, upsellRule },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST UPSELL RULE ERROR:", error);

    return NextResponse.json(
      { success: false, message: getErrorMessage(error) || "Failed to create upsell" },
      { status: error?.code === 11000 ? 409 : 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const id = cleanString(body.id || body._id);

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Upsell ID is required" },
        { status: 400 }
      );
    }

    const payload = buildUpsellPayload(body);

    if (!payload.name) {
      return NextResponse.json(
        { success: false, message: "Upsell name is required" },
        { status: 400 }
      );
    }

    const upsellRule = await UpsellRule.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!upsellRule) {
      return NextResponse.json(
        { success: false, message: "Upsell not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: upsellRule, upsellRule });
  } catch (error: any) {
    console.error("PATCH UPSELL RULE ERROR:", error);

    return NextResponse.json(
      { success: false, message: getErrorMessage(error) || "Failed to update upsell" },
      { status: error?.code === 11000 ? 409 : 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const id = cleanString(searchParams.get("id"));

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Upsell ID is required" },
        { status: 400 }
      );
    }

    const deletedUpsellRule = await UpsellRule.findByIdAndDelete(id);

    if (!deletedUpsellRule) {
      return NextResponse.json(
        { success: false, message: "Upsell not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Upsell deleted successfully",
    });
  } catch (error) {
    console.error("DELETE UPSELL RULE ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete upsell" },
      { status: 500 }
    );
  }
}
