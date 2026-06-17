import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import UpsellStoreConfig from "@/models/upsellstoreconfig";
import { rebuildStoreMenusAfterAdminChange } from "@/lib/server/storemenu-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanStatus(value: unknown) {
  const status = cleanString(value);

  if (["Active", "Paused", "Inactive"].includes(status)) {
    return status;
  }

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

function normalizeConfig(input: any) {
  const available = cleanBoolean(input?.available, true);

  return {
    upsellId: cleanString(input?.upsellId),
    storeId: cleanString(input?.storeId),
    categoryId: cleanString(input?.categoryId),
    categoryName: cleanString(input?.categoryName),
    available,
    status: available ? cleanStatus(input?.status) : "Inactive",
    sortOrder: Number(input?.sortOrder || 0),
  };
}

export async function GET(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    const upsellId = cleanString(searchParams.get("upsellId"));
    const storeId = cleanString(searchParams.get("storeId"));
    const categoryId = cleanString(searchParams.get("categoryId"));
    const status = cleanString(searchParams.get("status"));
    const available = searchParams.get("available");

    const filter: Record<string, any> = {};

    if (upsellId) filter.upsellId = upsellId;
    if (storeId && storeId !== "all") filter.storeId = storeId;
    if (categoryId) filter.categoryId = categoryId;
    if (status && status !== "all") filter.status = status;

    if (available !== null && available !== "") {
      filter.available = cleanBoolean(available, true);
    }

    const data = await UpsellStoreConfig.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET upsell-store-configs error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch upsell store configs.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    const configs = Array.isArray(body?.configs)
      ? body.configs
      : Array.isArray(body)
      ? body
      : [body];

    const savedConfigs = [];
    const previousConfigs = [];

    for (const rawConfig of configs) {
      const config = normalizeConfig(rawConfig);

      if (!config.upsellId) {
        return NextResponse.json(
          {
            success: false,
            message: "upsellId is required.",
          },
          { status: 400 }
        );
      }

      if (!config.storeId) {
        return NextResponse.json(
          {
            success: false,
            message: "storeId is required.",
          },
          { status: 400 }
        );
      }

      if (!config.categoryId || !config.categoryName) {
        return NextResponse.json(
          {
            success: false,
            message: "categoryId and categoryName are required.",
          },
          { status: 400 }
        );
      }

      const previousConfig = await UpsellStoreConfig.findOne({
        upsellId: config.upsellId,
        storeId: config.storeId,
      }).lean();

      if (previousConfig) previousConfigs.push(previousConfig);

      const savedConfig = await UpsellStoreConfig.findOneAndUpdate(
        {
          upsellId: config.upsellId,
          storeId: config.storeId,
        },
        {
          $set: config,
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      ).lean();

      savedConfigs.push(savedConfig);
    }

    await rebuildStoreMenusAfterAdminChange(
      { reason: "upsell-store-config-save" },
      body,
      previousConfigs,
      savedConfigs
    );

    return NextResponse.json({
      success: true,
      data: Array.isArray(body?.configs) || Array.isArray(body)
        ? savedConfigs
        : savedConfigs[0],
    });
  } catch (error: any) {
    console.error("POST upsell-store-configs error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.code === 11000
            ? "This upsell store config already exists."
            : "Failed to save upsell store config.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const id = cleanString(body?._id || body?.id);

    const config = normalizeConfig(body);

    if (!id && (!config.upsellId || !config.storeId)) {
      return NextResponse.json(
        {
          success: false,
          message: "_id or upsellId + storeId is required.",
        },
        { status: 400 }
      );
    }

    const filter = id
      ? { _id: id }
      : {
          upsellId: config.upsellId,
          storeId: config.storeId,
        };

    const previousConfig = await UpsellStoreConfig.findOne(filter).lean();

    const updatedConfig = await UpsellStoreConfig.findOneAndUpdate(
      filter,
      {
        $set: config,
      },
      {
        new: true,
        upsert: !id,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    await rebuildStoreMenusAfterAdminChange(
      { reason: "upsell-store-config-update" },
      body,
      previousConfig,
      updatedConfig
    );

    return NextResponse.json({
      success: true,
      data: updatedConfig,
    });
  } catch (error: any) {
    console.error("PUT upsell-store-configs error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.code === 11000
            ? "This upsell store config already exists."
            : "Failed to update upsell store config.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  return PUT(request);
}

export async function DELETE(request: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    const id = cleanString(searchParams.get("id"));
    const upsellId = cleanString(searchParams.get("upsellId"));
    const storeId = cleanString(searchParams.get("storeId"));

    if (!id && (!upsellId || !storeId)) {
      return NextResponse.json(
        {
          success: false,
          message: "id or upsellId + storeId is required.",
        },
        { status: 400 }
      );
    }

    const filter = id
      ? { _id: id }
      : {
          upsellId,
          storeId,
        };

    const previousConfig = await UpsellStoreConfig.findOne(filter).lean();
    await UpsellStoreConfig.deleteOne(filter);

    await rebuildStoreMenusAfterAdminChange(
      { reason: "upsell-store-config-delete" },
      previousConfig,
      { upsellId, storeId }
    );

    return NextResponse.json({
      success: true,
      message: "Upsell store config deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE upsell-store-configs error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete upsell store config.",
      },
      { status: 500 }
    );
  }
}
