import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Category from "@/models/category";
import CategoryStoreConfig from "@/models/categorystoreconfig";

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

function plainDoc(value: any) {
  if (!value) return value;
  if (typeof value.toObject === "function") return value.toObject();
  return value;
}

function getCategoryIdValues(categoryId: unknown) {
  const value = cleanString(categoryId);
  if (!value) return [];

  const values = [value];

  if (isValidObjectId(value)) {
    values.push(new mongoose.Types.ObjectId(value) as any);
  }

  return values;
}

function categoryIdMatch(categoryId: unknown) {
  const values = getCategoryIdValues(categoryId);
  return values.length > 0 ? { categoryId: { $in: values } } : { categoryId: "" };
}

function buildCategoryPayload(body: any) {
  const name = cleanString(body.name || body.categoryName);

  if (!name) {
    throw new Error("Category name is required");
  }

  return {
    name,
    slug: slugify(body.slug || name),
    description: cleanString(body.description),
    image: cleanString(body.image),
    status: body.status === "Inactive" || body.status === "Hidden" ? body.status : "Active",
  };
}

function buildConfigPayload(category: any, body: any) {
  const storeId = normalizeStoreId(body.storeId || body.storeSlug || body.store);

  if (!storeId) {
    throw new Error("Store ID is required");
  }

  const cleanCategory = plainDoc(category) || {};
  const categoryName = cleanString(cleanCategory.name || body.name || body.categoryName);
  const categorySlug = slugify(cleanCategory.slug || body.slug || categoryName);

  return {
    categoryId: String(cleanCategory._id || body.categoryId || body.id || body._id),
    storeId,
    categoryName,
    categorySlug,
    available: body.available !== false,
    status: body.status === "Inactive" || body.status === "Hidden" ? body.status : "Active",
    sortOrder: Number(body.sortOrder || 1),
  };
}

async function upsertStoreConfig(category: any, body: any) {
  const configPayload = buildConfigPayload(category, body);

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
    }
  );
}

async function findDuplicateStoreConfig(params: {
  categoryId: string;
  storeId: string;
  ignoreConfigId?: string;
}) {
  const query: any = {
    ...categoryIdMatch(params.categoryId),
    storeId: normalizeStoreId(params.storeId),
  };

  if (params.ignoreConfigId && isValidObjectId(params.ignoreConfigId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(params.ignoreConfigId) };
  }

  return CategoryStoreConfig.findOne(query).lean();
}

async function findCategoryBySlug(slug: string, ignoreCategoryId?: string) {
  const query: any = { slug };

  if (ignoreCategoryId && isValidObjectId(ignoreCategoryId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(ignoreCategoryId) };
  }

  return Category.findOne(query);
}

async function cleanupDuplicateCategoryMasters() {
  const categories = await Category.find({}).sort({ createdAt: 1 }).lean();
  const groups = new Map<string, any[]>();

  categories.forEach((category: any) => {
    const slug = slugify(category.slug || category.name || "");
    if (!slug) return;

    groups.set(slug, [...(groups.get(slug) || []), category]);
  });

  for (const [slug, docs] of groups.entries()) {
    const master = docs[0];
    if (!master) continue;

    const masterId = String(master._id);
    const masterName = cleanString(master.name);

    if (master.slug !== slug) {
      await Category.updateOne({ _id: master._id }, { $set: { slug } });
    }

    for (const doc of docs) {
      const docId = String(doc._id);
      const legacyStoreId = normalizeStoreId(doc.storeId);

      if (legacyStoreId) {
        const existingConfig = await CategoryStoreConfig.findOne({
          categoryId: masterId,
          storeId: legacyStoreId,
        });

        if (!existingConfig) {
          await CategoryStoreConfig.create({
            categoryId: masterId,
            storeId: legacyStoreId,
            categoryName: masterName,
            categorySlug: slug,
            available: true,
            status:
              doc.status === "Inactive" || doc.status === "Hidden"
                ? doc.status
                : "Active",
            sortOrder: Number(doc.sortOrder || 1),
          });
        }
      }

      const oldConfigs = await CategoryStoreConfig.find(categoryIdMatch(docId));

      for (const config of oldConfigs) {
        const configStoreId = normalizeStoreId(config.storeId);
        const conflict = await CategoryStoreConfig.findOne({
          categoryId: masterId,
          storeId: configStoreId,
          _id: { $ne: config._id },
        });

        if (conflict) {
          if (String(config.categoryId) !== masterId) {
            await CategoryStoreConfig.deleteOne({ _id: config._id });
          }

          continue;
        }

        await CategoryStoreConfig.updateOne(
          { _id: config._id },
          {
            $set: {
              categoryId: masterId,
              categoryName: masterName,
              categorySlug: slug,
              storeId: configStoreId,
            },
          }
        );
      }

      if (docId !== masterId) {
        await Category.deleteOne({ _id: doc._id });
      }
    }
  }
}

function formatCategoryWithConfig(category: any, config: any = null) {
  const cleanCategory = plainDoc(category) || {};
  const cleanConfig = plainDoc(config) || {};

  const categoryId = cleanString(cleanCategory._id);
  const storeConfigId = cleanString(cleanConfig._id);
  const name = cleanString(cleanCategory.name || cleanConfig.categoryName);
  const slug = slugify(cleanCategory.slug || cleanConfig.categorySlug || name);

  return {
    ...cleanCategory,
    _id: categoryId,
    id: categoryId,
    categoryId,
    storeConfigId,
    configId: storeConfigId,
    name,
    slug,
    description: cleanString(cleanCategory.description),
    image: cleanString(cleanCategory.image),
    storeId: normalizeStoreId(cleanConfig.storeId || cleanCategory.storeId),
    categoryName: cleanString(cleanConfig.categoryName || name),
    categorySlug: cleanString(cleanConfig.categorySlug || slug),
    available: cleanConfig.available !== false,
    status: cleanConfig.status || cleanCategory.status || "Active",
    sortOrder: Number(cleanConfig.sortOrder ?? cleanCategory.sortOrder ?? 1),
  };
}

function dedupeCategoryRows(rows: any[]) {
  const map = new Map<string, any>();

  rows.forEach((row) => {
    const key = [
      slugify(row.slug || row.categorySlug || row.name || row.categoryName || ""),
      normalizeStoreId(row.storeId),
    ]
      .filter(Boolean)
      .join("|");

    if (!key) return;

    if (!map.has(key)) {
      map.set(key, row);
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );
}

async function getCategoryRows(storeId?: string | null) {
  const cleanStoreId = normalizeStoreId(storeId);
  const configQuery: any = {};

  if (cleanStoreId && cleanStoreId !== "all") {
    configQuery.storeId = cleanStoreId;
  }

  const configs = await CategoryStoreConfig.find(configQuery)
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  const categoryIds = Array.from(
    new Set(configs.map((config: any) => cleanString(config.categoryId)).filter(Boolean))
  );

  const categoryObjectIds = categoryIds
    .filter((categoryId) => isValidObjectId(categoryId))
    .map((categoryId) => new mongoose.Types.ObjectId(categoryId));

  const categories = categoryObjectIds.length
    ? await Category.find({ _id: { $in: categoryObjectIds } }).lean()
    : [];

  const categoriesById = new Map<string, any>();

  categories.forEach((category: any) => {
    categoriesById.set(String(category._id), category);
  });

  const rows = configs
    .map((config: any) => {
      const category = categoriesById.get(cleanString(config.categoryId));
      if (!category) return null;

      return formatCategoryWithConfig(category, config);
    })
    .filter(Boolean) as any[];

  // Legacy fallback: show old category rows if store configs have not been created yet.
  if (rows.length === 0) {
    const legacyQuery: any = {};

    if (cleanStoreId && cleanStoreId !== "all") {
      legacyQuery.storeId = cleanStoreId;
    }

    const legacyCategories = await Category.find(legacyQuery)
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    return dedupeCategoryRows(
      legacyCategories.map((category: any) =>
        formatCategoryWithConfig(category, {
          _id: "",
          categoryId: String(category._id),
          storeId: category.storeId,
          categoryName: category.name,
          categorySlug: category.slug,
          available: true,
          status: category.status,
          sortOrder: category.sortOrder,
        })
      )
    );
  }

  return dedupeCategoryRows(rows);
}

function getErrorMessage(error: any) {
  if (error?.code === 11000) {
    return "Category already exists for this store.";
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
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const categoryPayload = buildCategoryPayload(body);
    const storeId = normalizeStoreId(body.storeId);

    if (!storeId) {
      return NextResponse.json(
        { success: false, message: "Store ID is required" },
        { status: 400 }
      );
    }

    let category = await Category.findOne({ slug: categoryPayload.slug });

    if (!category) {
      category = await Category.create({
        ...categoryPayload,
        // Keep legacy fields optional only. Store-specific data lives in CategoryStoreConfig.
        storeId: "",
        sortOrder: 0,
      });
    }

    const existingConfig =
      (await findDuplicateStoreConfig({
        categoryId: String(category._id),
        storeId,
      })) ||
      (await CategoryStoreConfig.findOne({
        storeId,
        categorySlug: categoryPayload.slug,
      }).lean());

    if (existingConfig) {
      return NextResponse.json(
        {
          success: true,
          message: "Category already linked to this store.",
          data: formatCategoryWithConfig(category, existingConfig),
        },
        { status: 200 }
      );
    }

    const config = await CategoryStoreConfig.create(
      buildConfigPayload(category, {
        ...body,
        storeId,
        status: body.status || "Active",
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: formatCategoryWithConfig(category, config),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST CATEGORY ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error) || "Failed to create category",
      },
      { status: error?.code === 11000 ? 409 : 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const configId = cleanString(body.storeConfigId || body.configId);
    const categoryId = cleanString(body.categoryId || body.id || body._id);
    const categoryPayload = buildCategoryPayload(body);
    const storeId = normalizeStoreId(body.storeId);

    if (!categoryId || !isValidObjectId(categoryId)) {
      return NextResponse.json(
        { success: false, message: "Valid category ID is required" },
        { status: 400 }
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { success: false, message: "Store ID is required" },
        { status: 400 }
      );
    }

    const duplicateMaster = await findCategoryBySlug(
      categoryPayload.slug,
      categoryId
    );

    if (duplicateMaster) {
      const duplicateConfig = await findDuplicateStoreConfig({
        categoryId: String(duplicateMaster._id),
        storeId,
        ignoreConfigId: configId,
      });

      if (duplicateConfig) {
        return NextResponse.json(
          {
            success: false,
            message: "This category already exists for this store.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message:
            "A category with this name already exists. Use the existing category instead of renaming this one.",
        },
        { status: 409 }
      );
    }

    const category = await Category.findByIdAndUpdate(
      categoryId,
      categoryPayload,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Category not found" },
        { status: 404 }
      );
    }

    const config = configId && isValidObjectId(configId)
      ? await CategoryStoreConfig.findByIdAndUpdate(
          configId,
          buildConfigPayload(category, body),
          { new: true, runValidators: true }
        )
      : await upsertStoreConfig(category, body);

    if (!config) {
      return NextResponse.json(
        { success: false, message: "Category store config not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: formatCategoryWithConfig(category, config),
    });
  } catch (error: any) {
    console.error("PATCH CATEGORY ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error) || "Failed to update category",
      },
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

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Valid category ID is required" },
        { status: 400 }
      );
    }

    const config = await CategoryStoreConfig.findById(id);

    if (config) {
      const configStoreId = normalizeStoreId(config.storeId);
      const configCategoryId = cleanString(config.categoryId);
      const configCategorySlug = cleanString(config.categorySlug);
      const duplicateCleanupQuery: any = {
        storeId: configStoreId,
        $or: [{ _id: config._id }],
      };

      if (configCategoryId) {
        duplicateCleanupQuery.$or.push(categoryIdMatch(configCategoryId));
      }

      if (configCategorySlug) {
        duplicateCleanupQuery.$or.push({ categorySlug: configCategorySlug });
      }

      await CategoryStoreConfig.deleteMany(duplicateCleanupQuery);

      return NextResponse.json({
        success: true,
        message: "Category removed from this store successfully",
        data: formatCategoryWithConfig({}, config),
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Category not found" },
        { status: 404 }
      );
    }

    if (storeId) {
      await CategoryStoreConfig.deleteOne({
        ...categoryIdMatch(String(category._id)),
        storeId,
      });

      return NextResponse.json({
        success: true,
        message: "Category removed from this store successfully",
      });
    }

    await CategoryStoreConfig.deleteMany(categoryIdMatch(String(category._id)));
    await Category.deleteOne({ _id: category._id });

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
      { status: 500 }
    );
  }
}
