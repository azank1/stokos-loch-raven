import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Product from "@/models/product";
import ProductStoreConfig from "@/models/productstoreconfig";
import Category from "@/models/category";
import CategoryStoreConfig from "@/models/categorystoreconfig";
import ModifierGroup from "@/models/modifiergroup";
import UpsellRule from "@/models/upsellrule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let adminProductIndexesPromise: Promise<void> | null = null;

async function ensureAdminProductIndexes() {
  if (!adminProductIndexesPromise) {
    adminProductIndexesPromise = Promise.all([
      Product.collection.createIndex({ slug: 1 }),
      Product.collection.createIndex({ name: 1 }),
      ProductStoreConfig.collection.createIndex({ productId: 1 }),
      ProductStoreConfig.collection.createIndex({ storeId: 1, productId: 1 }),
      ProductStoreConfig.collection.createIndex({ storeId: 1, categoryId: 1 }),
      ProductStoreConfig.collection.createIndex({ storeId: 1, categoryName: 1 }),
    ]).then(() => undefined);
  }

  return adminProductIndexesPromise;
}

const PRODUCT_LIST_PROJECTION = {
  name: 1,
  slug: 1,
  description: 1,
  image: 1,
  tags: 1,
  badge: 1,
  price: 1,
  category: 1,
  categoryId: 1,
  categoryName: 1,
  storeId: 1,
  isPopular: 1,
  showInPopular: 1,
  sortOrder: 1,
  status: 1,
  updatedAt: 1,
  createdAt: 1,
};

const PRODUCT_DETAIL_PROJECTION = {
  name: 1,
  slug: 1,
  description: 1,
  image: 1,
  tags: 1,
  badge: 1,
  price: 1,
  sizes: 1,
  modifierGroups: 1,
  modifierGroupIds: 1,
  relatedUpsells: 1,
  upsell: 1,
  category: 1,
  categoryId: 1,
  categoryName: 1,
  storeId: 1,
  isPopular: 1,
  showInPopular: 1,
  sortOrder: 1,
  status: 1,
  updatedAt: 1,
  createdAt: 1,
};

const PRODUCT_CONFIG_LIGHT_PROJECTION = {
  productId: 1,
  storeId: 1,
  categoryId: 1,
  categoryName: 1,
  categorySlug: 1,
  price: 1,
  isPopular: 1,
  showInPopular: 1,
  isAvailable: 1,
  available: 1,
  sortOrder: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
};

const PRODUCT_CONFIG_DETAIL_PROJECTION = {
  productId: 1,
  storeId: 1,
  categoryId: 1,
  categoryName: 1,
  categorySlug: 1,
  price: 1,
  sizes: 1,
  modifierGroups: 1,
  modifierGroupIds: 1,
  relatedUpsells: 1,
  upsell: 1,
  isPopular: 1,
  showInPopular: 1,
  isAvailable: 1,
  available: 1,
  sortOrder: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
};

type ProductSizePayload = {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
};

type ProductModifierOptionPayload = {
  id: string;
  optionId: string;
  name: string;
  status: "Active" | "Inactive";
  pricesBySize: Record<string, number>;
};

type ProductModifierGroupInput = {
  modifierGroupId?: string;
  name?: string;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  sortOrder?: number;
  status?: "Active" | "Inactive";
  options?: ProductModifierOptionPayload[];
};

type ProductModifierGroupPayload = {
  modifierGroupId: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  status: "Active" | "Inactive";
  options: ProductModifierOptionPayload[];
};

type ProductRelatedUpsellPayload = {
  upsellId: string;
  name: string;
  price: number;
};

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

function getLegacyObjectId(value: string) {
  return isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;
}

function productIdValues(productId: string) {
  const cleanProductId = cleanString(productId);
  const values: any[] = [];

  if (cleanProductId) values.push(cleanProductId);

  const objectId = getLegacyObjectId(cleanProductId);
  if (objectId) values.push(objectId);

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

  const objectId = getLegacyObjectId(cleanCategoryId);
  if (objectId) values.push(objectId);

  return values;
}

function categoryIdMatch(categoryId: string) {
  const values = categoryIdValues(categoryId);
  return values.length ? { categoryId: { $in: values } } : { categoryId: "" };
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

function cleanStatus(value: unknown): "Active" | "Inactive" {
  return value === "Inactive" ? "Inactive" : "Active";
}

function cleanProductStatus(value: unknown) {
  const status = cleanString(value);

  if (["Active", "Draft", "Hidden", "Inactive"].includes(status)) {
    return status;
  }

  return "Active";
}

function cleanCategoryStatus(value: unknown) {
  const status = cleanString(value);

  if (["Active", "Hidden", "Inactive"].includes(status)) {
    return status;
  }

  return "Active";
}

function getIdString(value: unknown) {
  if (!value) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const obj = value as { _id?: unknown; id?: unknown; slug?: unknown; name?: unknown };
    return cleanString(obj._id || obj.id || obj.slug || obj.name);
  }

  return "";
}

function cleanPricesBySize(value: unknown, sizeNames: string[]) {
  const prices: Record<string, number> = {};

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, price]) => {
      const cleanKey = cleanString(key);
      if (!cleanKey) return;

      prices[cleanKey] = cleanNumber(price);
    });
  }

  sizeNames.forEach((sizeName) => {
    if (!(sizeName in prices)) {
      prices[sizeName] = 0;
    }
  });

  Object.keys(prices).forEach((key) => {
    if (!sizeNames.includes(key)) {
      delete prices[key];
    }
  });

  return prices;
}

function cleanSizes(value: unknown, fallbackPrice: unknown): ProductSizePayload[] {
  const rawSizes = Array.isArray(value) ? value : [];

  const sizes = rawSizes
    .map((size: any, index): ProductSizePayload | null => {
      const name = cleanString(size?.name);

      if (!name) return null;

      return {
        id: cleanString(size?.id) || slugify(name) || `size-${index + 1}`,
        name,
        price: cleanNumber(size?.price),
        sortOrder: Number(size?.sortOrder ?? index),
      };
    })
    .filter((size): size is ProductSizePayload => size !== null);

  if (sizes.length > 0) return sizes;

  return [
    {
      id: "regular",
      name: "Regular",
      price: cleanNumber(fallbackPrice),
      sortOrder: 0,
    },
  ];
}

function cleanModifierOptions(
  value: unknown,
  sizeNames: string[]
): ProductModifierOptionPayload[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((option: any, index): ProductModifierOptionPayload | null => {
      if (typeof option === "string") {
        const name = cleanString(option);
        if (!name) return null;

        const optionId = slugify(name) || `option-${index + 1}`;

        return {
          id: optionId,
          optionId,
          name,
          status: "Active",
          pricesBySize: cleanPricesBySize({}, sizeNames),
        };
      }

      if (!option || typeof option !== "object") return null;

      const name = cleanString(
        option.name || option.label || option.title || option.value
      );

      if (!name) return null;

      const optionId = cleanString(
        option.optionId || option.id || option._id || slugify(name)
      );

      return {
        id: cleanString(option.id) || optionId || `option-${index + 1}`,
        optionId: optionId || `option-${index + 1}`,
        name,
        status: cleanStatus(option.status),
        pricesBySize: cleanPricesBySize(option.pricesBySize, sizeNames),
      };
    })
    .filter((option): option is ProductModifierOptionPayload => option !== null);
}

function cleanModifierGroups(
  value: unknown,
  sizes: ProductSizePayload[]
): ProductModifierGroupInput[] {
  if (!Array.isArray(value)) return [];

  const sizeNames = sizes.map((size) => size.name).filter(Boolean);

  return value
    .map((group: any, index): ProductModifierGroupInput | null => {
      if (typeof group === "string") {
        const modifierGroupId = cleanString(group);

        if (!modifierGroupId) return null;

        return {
          modifierGroupId,
          name: "",
          required: false,
          minSelect: 0,
          maxSelect: 0,
          sortOrder: index,
          status: "Active",
          options: [],
        };
      }

      if (!group || typeof group !== "object") return null;

      const modifierGroupId = cleanString(
        group.modifierGroupId || group.groupId || group._id || group.id
      );

      const name = cleanString(group.name || group.title || group.label);

      if (!modifierGroupId && !name) return null;

      return {
        modifierGroupId,
        name,
        required: Boolean(group.required),
        minSelect: cleanNumber(group.minSelect),
        maxSelect: cleanNumber(group.maxSelect),
        sortOrder: Number(group.sortOrder ?? index),
        status: cleanStatus(group.status),
        options: cleanModifierOptions(group.options, sizeNames),
      };
    })
    .filter((group): group is ProductModifierGroupInput => group !== null);
}

async function resolveModifierGroups(
  values: ProductModifierGroupInput[] = [],
  sizes: ProductSizePayload[]
): Promise<ProductModifierGroupPayload[]> {
  const groups: ProductModifierGroupPayload[] = [];
  const sizeNames = sizes.map((size) => size.name).filter(Boolean);

  for (const item of values) {
    const modifierGroupId = cleanString(item.modifierGroupId);

    let globalGroup: any = null;

    if (modifierGroupId && isValidObjectId(modifierGroupId)) {
      globalGroup = await ModifierGroup.findById(modifierGroupId).lean();
    }

    const name = cleanString(item.name || globalGroup?.name);

    if (!name) continue;

    const options =
      Array.isArray(item.options) && item.options.length > 0
        ? item.options
        : cleanModifierOptions(globalGroup?.options, sizeNames);

    groups.push({
      modifierGroupId,
      name,
      required:
        typeof item.required === "boolean"
          ? item.required
          : Boolean(globalGroup?.required),
      minSelect:
        item.minSelect !== undefined
          ? cleanNumber(item.minSelect)
          : cleanNumber(globalGroup?.minSelect),
      maxSelect:
        item.maxSelect !== undefined
          ? cleanNumber(item.maxSelect)
          : cleanNumber(globalGroup?.maxSelect),
      sortOrder:
        item.sortOrder !== undefined
          ? cleanNumber(item.sortOrder)
          : cleanNumber(globalGroup?.sortOrder),
      status: cleanStatus(item.status || globalGroup?.status),
      options,
    });
  }

  return groups;
}

function cleanModifierGroupIds(
  rawIds: unknown,
  modifierGroups: ProductModifierGroupPayload[]
) {
  const fromRawIds = Array.isArray(rawIds)
    ? rawIds.map((id) => cleanString(id)).filter(Boolean)
    : [];

  const fromGroups = modifierGroups
    .map((group) => cleanString(group.modifierGroupId))
    .filter(Boolean);

  return Array.from(new Set([...fromRawIds, ...fromGroups]));
}

async function resolveCategory(raw: any) {
  const categoryId = cleanString(raw.categoryId || raw.category);

  if (categoryId && isValidObjectId(categoryId)) {
    const found = await Category.findById(categoryId);
    if (found) return found;
  }

  const categoryName = cleanString(raw.categoryName || raw.category);

  if (!categoryName) {
    throw new Error("Product category is required for every selected store.");
  }

  const categorySlug = slugify(categoryName);

  const category = await Category.findOneAndUpdate(
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

  return category;
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
    const needsNormalize =
      String(doc.categoryId || "") !== categoryId ||
      String(doc.storeId || "") !== storeId;

    if (needsNormalize) {
      await CategoryStoreConfig.collection.updateOne(
        { _id: doc._id },
        { $set: { categoryId, storeId } }
      );
    }
  }
}

async function cleanupDuplicateProductStoreConfigs(productId: string) {
  const match = productIdMatch(productId);
  const docs = await ProductStoreConfig.collection
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
    await ProductStoreConfig.collection.deleteMany({ _id: { $in: deleteIds } });
  }

  for (const [storeId, doc] of keepByStore.entries()) {
    const needsNormalize =
      String(doc.productId || "") !== productId ||
      String(doc.storeId || "") !== storeId;

    if (needsNormalize) {
      await ProductStoreConfig.collection.updateOne(
        { _id: doc._id },
        { $set: { productId, storeId } }
      );
    }
  }
}

async function upsertCategoryStoreConfig(params: {
  category: any;
  storeId: string;
  status?: unknown;
  sortOrder?: unknown;
}) {
  const categoryId = String(params.category._id || params.category.id || "");
  const categoryName = cleanString(params.category.name);
  const categorySlug = cleanString(params.category.slug) || slugify(categoryName);
  const storeId = normalizeStoreId(params.storeId);

  if (!categoryId || !storeId) return;

  // Category store config is helpful for category availability,
  // but it must not block product store config creation.
  try {
    await CategoryStoreConfig.findOneAndUpdate(
      { categoryId, storeId },
      {
        $set: {
          categoryId,
          storeId,
          categoryName,
          categorySlug,
          available: true,
          status: cleanCategoryStatus(params.status),
          sortOrder: cleanNumber(params.sortOrder),
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    await cleanupDuplicateCategoryStoreConfigs(categoryId, categorySlug);
  } catch (error) {
    console.error("CATEGORY STORE CONFIG SYNC WARNING:", error);
  }
}

async function resolveRelatedUpsells(
  values: any[] = []
): Promise<ProductRelatedUpsellPayload[]> {
  const rawItems = Array.isArray(values) ? values : [];
  const normalized = rawItems
    .map((item: any, index): ProductRelatedUpsellPayload | null => {
      if (typeof item === "string" || typeof item === "number") {
        const upsellId = cleanString(item);
        if (!upsellId) return null;

        return {
          upsellId,
          name: "",
          price: 0,
        };
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

  const validObjectIds = normalized
    .map((item) => item.upsellId)
    .filter((id) => isValidObjectId(id));

  const rules = validObjectIds.length
    ? await UpsellRule.find({ _id: { $in: validObjectIds } })
        .select("name offer slug")
        .lean()
    : [];

  const ruleNameById = new Map<string, string>();

  rules.forEach((rule: any) => {
    const id = cleanString(rule._id);
    const name = cleanString(rule.name || rule.offer || rule.slug);
    if (id && name) ruleNameById.set(id, name);
  });

  const unique = new Map<string, ProductRelatedUpsellPayload>();

  normalized.forEach((item) => {
    const name = item.name || ruleNameById.get(item.upsellId) || item.upsellId;
    unique.set(item.upsellId, {
      upsellId: item.upsellId,
      name,
      price: cleanNumber(item.price),
    });
  });

  return Array.from(unique.values());
}

function formatRelatedUpsells(value: unknown): ProductRelatedUpsellPayload[] {
  const rawItems = Array.isArray(value) ? value : [];
  const unique = new Map<string, ProductRelatedUpsellPayload>();

  rawItems.forEach((item: any, index) => {
    if (typeof item === "string" || typeof item === "number") {
      const upsellId = cleanString(item);
      if (!upsellId) return;

      unique.set(upsellId, { upsellId, name: upsellId, price: 0 });
      return;
    }

    if (!item || typeof item !== "object") return;

    const name = cleanString(
      item.name || item.offer || item.title || item.label || item.upsellName
    );
    const upsellId = cleanString(
      item.upsellId || item._id || item.id || item.slug || slugify(name)
    );

    if (!upsellId && !name) return;

    const key = upsellId || slugify(name) || `upsell-${index + 1}`;

    unique.set(key, {
      upsellId: key,
      name: name || key,
      price: cleanNumber(item.price),
    });
  });

  return Array.from(unique.values());
}

function buildProductMasterPayload(body: any) {
  const name = cleanString(body.name);

  if (!name) {
    throw new Error("Product name is required");
  }

  return {
    name,
    slug: cleanString(body.slug) || slugify(name),
    description: body.description || "",
    image: body.image || "",
    tags: Array.isArray(body.tags) ? body.tags : [],
    badge: body.badge || "",
    updatedAt: "Today",
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildProductDuplicateQuery(name: string, slug: string) {
  const cleanName = cleanString(name);
  const cleanSlug = cleanString(slug) || slugify(cleanName);

  return {
    $or: [
      { slug: cleanSlug },
      { name: { $regex: `^${escapeRegex(cleanName)}$`, $options: "i" } },
    ],
  };
}

async function cleanupDuplicateProductMastersBySlug(targetSlug?: string) {
  const match: any = targetSlug ? { slug: targetSlug } : {};

  const docs = await Product.collection
    .find(match)
    .sort({ lastSavedAt: -1, updatedAt: -1, createdAt: -1, _id: -1 })
    .toArray();

  const grouped = new Map<string, any[]>();

  docs.forEach((doc: any) => {
    const key = cleanString(doc.slug) || slugify(cleanString(doc.name));
    if (!key) return;

    grouped.set(key, [...(grouped.get(key) || []), doc]);
  });

  for (const products of grouped.values()) {
    if (products.length <= 1) continue;

    const [keepProduct, ...duplicates] = products;
    const keepProductId = String(keepProduct._id);

    for (const duplicateProduct of duplicates) {
      const duplicateProductId = String(duplicateProduct._id);

      await ProductStoreConfig.collection.updateMany(productIdMatch(duplicateProductId), {
        $set: { productId: keepProductId },
      });

      await Product.collection.deleteOne({ _id: duplicateProduct._id });
    }

    await cleanupDuplicateProductStoreConfigs(keepProductId);
  }
}

function getRawStoreConfigs(body: any) {
  if (Array.isArray(body.storeConfigs)) {
    return body.storeConfigs;
  }

  return [
    {
      storeId: body.storeId || "towson",
      category: body.category,
      categoryId: body.categoryId,
      categoryName: body.categoryName,
      price: body.price,
      sizes: body.sizes,
      modifierGroups: body.modifierGroups,
      modifierGroupIds: body.modifierGroupIds,
      relatedUpsells: body.relatedUpsells,
      upsellRules: body.upsellRules,
      upsell: body.upsell,
      status: body.status,
      sortOrder: body.sortOrder,
      isPopular: body.isPopular,
      showInPopular: body.showInPopular,
      isAvailable: true,
    },
  ];
}

async function buildProductStoreConfigPayload(raw: any, productId: string) {
  const storeId = normalizeStoreId(raw.storeId) || "towson";
  const category = await resolveCategory(raw);

  const sizes = cleanSizes(raw.sizes, raw.price);
  const modifierGroupInputs = cleanModifierGroups(raw.modifierGroups, sizes);
  const modifierGroups = await resolveModifierGroups(
    modifierGroupInputs,
    sizes
  );

  const modifierGroupIds = cleanModifierGroupIds(
    raw.modifierGroupIds,
    modifierGroups
  );

  const relatedUpsells = await resolveRelatedUpsells(
    Array.isArray(raw.relatedUpsells) ? raw.relatedUpsells : raw.upsellRules
  );

  await upsertCategoryStoreConfig({
    category,
    storeId,
    status: "Active",
    sortOrder: raw.categorySortOrder || 0,
  });

  return {
    productId,
    storeId,
    categoryId: String(category._id),
    categoryName: String(category.name || ""),
    categorySlug: String(category.slug || slugify(String(category.name || ""))),

    price: sizes[0]?.price ?? cleanNumber(raw.price),
    sizes,

    modifierGroups,
    modifierGroupIds,

    relatedUpsells,
    upsell: raw.upsell || "",

    isAvailable: raw.isAvailable !== false && raw.available !== false,
    available: raw.isAvailable !== false && raw.available !== false,
    isPopular: cleanBoolean(raw.isPopular, cleanBoolean(raw.showInPopular)),
    showInPopular: cleanBoolean(raw.isPopular, cleanBoolean(raw.showInPopular)),

    sortOrder: Number(raw.sortOrder || 0),
    status: cleanProductStatus(raw.status),
  };
}

async function saveStoreConfigs(productId: string, body: any) {
  const rawConfigs = getRawStoreConfigs(body);
  const configsByStore = new Map<string, any>();

  rawConfigs.forEach((rawConfig: any) => {
    const storeId = normalizeStoreId(rawConfig?.storeId);
    if (!storeId) return;

    // Last config wins. This prevents duplicate saves when the form sends
    // the same store twice because of old state or mixed-case store IDs.
    configsByStore.set(storeId, {
      ...rawConfig,
      storeId,
    });
  });

  const activeStoreIds: string[] = [];
  const savedConfigs: any[] = [];

  for (const rawConfig of Array.from(configsByStore.values())) {
    const storeId = normalizeStoreId(rawConfig?.storeId);
    if (!storeId) continue;

    const isAvailable = rawConfig?.isAvailable !== false && rawConfig?.available !== false;

    if (!isAvailable) {
      await ProductStoreConfig.collection.deleteMany({
        ...productIdMatch(productId),
        storeId: { $in: [storeId, cleanString(rawConfig?.storeId)] },
      });
      continue;
    }

    activeStoreIds.push(storeId);

    const payload = await buildProductStoreConfigPayload(
      { ...rawConfig, storeId },
      productId
    );

    const savedConfig = await ProductStoreConfig.findOneAndUpdate(
      { productId, storeId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    savedConfigs.push(savedConfig);
  }

  if (Array.isArray(body.storeConfigs) && body.replaceStoreConfigs !== false) {
    await ProductStoreConfig.collection.deleteMany({
      ...productIdMatch(productId),
      storeId: { $nin: activeStoreIds },
    });
  }

  await cleanupDuplicateProductStoreConfigs(productId);

  if (Array.isArray(body.storeConfigs)) {
    const intendedActiveConfigs = body.storeConfigs.filter((config: any) => {
      return (
        normalizeStoreId(config?.storeId) &&
        config?.isAvailable !== false &&
        config?.available !== false
      );
    });

    if (intendedActiveConfigs.length > 0 && savedConfigs.length === 0) {
      throw new Error(
        "Product master saved, but no store config was saved. Check storeConfigs payload."
      );
    }
  }

  return savedConfigs;
}

function plainDoc(value: any) {
  if (!value) return value;
  if (typeof value.toObject === "function") return value.toObject();
  return value;
}

function getConfigStoreId(config: any) {
  return normalizeStoreId(config?.storeId || config?.storeSlug || config?.store);
}

function formatConfig(config: any) {
  const clean = plainDoc(config) || {};

  return {
    ...clean,
    _id: clean._id ? String(clean._id) : clean._id,
    id: clean._id ? String(clean._id) : clean.id,
    productId: clean.productId ? String(clean.productId) : clean.productId,
    storeId: clean.storeId ? normalizeStoreId(clean.storeId) : clean.storeId,
    categoryId: clean.categoryId ? String(clean.categoryId) : clean.categoryId,
    isAvailable: clean.isAvailable !== false && clean.available !== false,
    available: clean.isAvailable !== false && clean.available !== false,
    isPopular: cleanBoolean(clean.isPopular, cleanBoolean(clean.showInPopular)),
    showInPopular: cleanBoolean(clean.isPopular, cleanBoolean(clean.showInPopular)),
    relatedUpsells: formatRelatedUpsells(clean.relatedUpsells),
  };
}

function formatProductWithConfigs(
  product: any,
  configs: any[],
  preferredStoreId?: string | null
) {
  const cleanProduct = plainDoc(product) || {};
  const cleanConfigs = configs.map(formatConfig);

  const preferredConfig = preferredStoreId
    ? cleanConfigs.find(
        (config) =>
          getConfigStoreId(config).toLowerCase() ===
          preferredStoreId.toLowerCase()
      )
    : null;

  const primaryConfig = preferredConfig || cleanConfigs[0] || null;

  return {
    ...cleanProduct,
    _id: cleanProduct._id ? String(cleanProduct._id) : cleanProduct._id,
    id: cleanProduct._id ? String(cleanProduct._id) : cleanProduct.id,
    storeConfigs: cleanConfigs,

    // Compatibility fields for old table/form code.
    storeId: primaryConfig?.storeId || cleanProduct.storeId || "",
    category: primaryConfig?.categoryId || cleanProduct.category || "",
    categoryId: primaryConfig?.categoryId || cleanProduct.categoryId || "",
    categoryName: primaryConfig?.categoryName || cleanProduct.categoryName || "",
    price: Number(primaryConfig?.price ?? cleanProduct.price ?? 0),
    sizes: primaryConfig?.sizes || cleanProduct.sizes || [],
    modifierGroups: primaryConfig?.modifierGroups || cleanProduct.modifierGroups || [],
    modifierGroupIds:
      primaryConfig?.modifierGroupIds || cleanProduct.modifierGroupIds || [],
    relatedUpsells:
      primaryConfig?.relatedUpsells || formatRelatedUpsells(cleanProduct.relatedUpsells),
    upsell: primaryConfig?.upsell || cleanProduct.upsell || "",
    isPopular: cleanBoolean(
      primaryConfig?.isPopular,
      cleanBoolean(cleanProduct.isPopular)
    ),
    showInPopular: cleanBoolean(
      primaryConfig?.isPopular,
      cleanBoolean(cleanProduct.showInPopular)
    ),
    sortOrder: Number(primaryConfig?.sortOrder ?? cleanProduct.sortOrder ?? 0),
    status: primaryConfig?.status || cleanProduct.status || "Active",
    updatedAt: cleanProduct.updatedAt || "Today",
  };
}

async function getProductConfigs(
  productIds: string[],
  query: any = {},
  options: { detail?: boolean } = {}
) {
  if (!productIds.length) return [];

  const productIdList = productIds.flatMap((productId) => productIdValues(productId));
  const rawQuery: any = {
    productId: { $in: productIdList },
    ...query,
  };

  if (query.storeId) {
    rawQuery.storeId = normalizeStoreId(query.storeId);
  }

  return ProductStoreConfig.collection
    .find(rawQuery, {
      projection: options.detail
        ? PRODUCT_CONFIG_DETAIL_PROJECTION
        : PRODUCT_CONFIG_LIGHT_PROJECTION,
    })
    .sort({ storeId: 1, sortOrder: 1, createdAt: -1 })
    .toArray();
}

function getErrorMessage(error: any) {
  if (error?.code === 11000) {
    return "Product config already exists for this store.";
  }

  if (error?.name === "ValidationError") {
    const messages = Object.values(error.errors || {})
      .map((item: any) => item?.message)
      .filter(Boolean);

    return messages.length > 0
      ? messages.join(", ")
      : "Product validation failed.";
  }

  if (error?.message) {
    return error.message;
  }

  return "Something went wrong.";
}

export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    const storeId = cleanString(searchParams.get("storeId"));
    const category = cleanString(searchParams.get("category"));
    const search = cleanString(searchParams.get("search"));
    const requestedId = cleanString(
      searchParams.get("id") || searchParams.get("productId")
    );

    const wantsDetail = Boolean(requestedId);

    const configQuery: any = {};

    if (storeId && storeId !== "all") {
      configQuery.storeId = normalizeStoreId(storeId);
    }

    if (category && category !== "All Categories") {
      if (isValidObjectId(category)) {
        configQuery.categoryId = category;
      } else {
        configQuery.categoryName = category;
      }
    }

    if (requestedId) {
      const productQuery = isValidObjectId(requestedId)
        ? { _id: new mongoose.Types.ObjectId(requestedId) }
        : {
            $or: [
              { id: requestedId },
              { slug: requestedId },
              { name: requestedId },
            ],
          };

      const product = await Product.findOne(productQuery)
        .select(PRODUCT_DETAIL_PROJECTION)
        .lean();

      if (!product) {
        return NextResponse.json(
          { success: false, message: "Product not found", data: null },
          { status: 404 }
        );
      }

      const configFilter = { ...configQuery };
      const configs = await getProductConfigs(
        [String(product._id)],
        configFilter,
        { detail: true }
      );

      const data = formatProductWithConfigs(
        product,
        configs,
        storeId && storeId !== "all" ? storeId : null
      );

      return NextResponse.json({ success: true, data, product: data });
    }

    const shouldFilterByConfig = Object.keys(configQuery).length > 0;
    let productIdsFromConfig: string[] | null = null;
    let filteredConfigs: any[] = [];

    if (shouldFilterByConfig) {
      filteredConfigs = await ProductStoreConfig.collection
        .find(configQuery, { projection: PRODUCT_CONFIG_LIGHT_PROJECTION })
        .sort({ sortOrder: 1, createdAt: -1 })
        .toArray();

      productIdsFromConfig = Array.from(
        new Set(filteredConfigs.map((item) => String(item.productId)).filter(Boolean))
      );

      if (!productIdsFromConfig.length) {
        return NextResponse.json({ success: true, data: [] });
      }
    }

    const productQuery: any = {};

    if (productIdsFromConfig) {
      const objectIds = productIdsFromConfig
        .filter((id) => isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      productQuery.$or = [
        ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
        { id: { $in: productIdsFromConfig } },
        { slug: { $in: productIdsFromConfig } },
      ];
    }

    if (search) {
      const searchQuery = { $regex: search, $options: "i" };

      productQuery.$and = [
        ...(productQuery.$and || []),
        {
          $or: [
            { name: searchQuery },
            { slug: searchQuery },
            { description: searchQuery },
          ],
        },
      ];
    }

    const products = await Product.find(productQuery)
      .select(wantsDetail ? PRODUCT_DETAIL_PROJECTION : PRODUCT_LIST_PROJECTION)
      .sort({ name: 1, createdAt: -1 })
      .lean();

    const productIds = products.map((item) => String(item._id));
    const configs = shouldFilterByConfig
      ? filteredConfigs.filter((config) =>
          productIds.includes(String(config.productId))
        )
      : await getProductConfigs(productIds, {}, { detail: false });

    const configsByProduct = new Map<string, any[]>();

    configs.forEach((config) => {
      const productId = String(config.productId);
      configsByProduct.set(productId, [
        ...(configsByProduct.get(productId) || []),
        config,
      ]);
    });

    const data = products.map((product) =>
      formatProductWithConfigs(
        product,
        configsByProduct.get(String(product._id)) || [],
        storeId && storeId !== "all" ? storeId : null
      )
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("GET PRODUCTS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error) || "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const payload = buildProductMasterPayload(body);

    await cleanupDuplicateProductMastersBySlug(payload.slug);

    const duplicateProduct = await Product.findOne(
      buildProductDuplicateQuery(payload.name, payload.slug)
    ).lean();

    if (duplicateProduct) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This product already exists. Please edit the existing product instead of adding it again.",
        },
        { status: 409 }
      );
    }

    const product = await Product.create(payload);

    await saveStoreConfigs(String(product._id), body);

    const configs = await getProductConfigs([String(product._id)], {}, { detail: true });
    const data = formatProductWithConfigs(product, configs, normalizeStoreId(body.storeId));

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    console.error("POST PRODUCT ERROR FULL:", error);

    const message = getErrorMessage(error);

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: error?.code === 11000 ? 409 : 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const id = cleanString(body.id || body._id || body.productId);

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Valid product ID is required" },
        { status: 400 }
      );
    }

    const payload = buildProductMasterPayload(body);

    await cleanupDuplicateProductMastersBySlug(payload.slug);

    const duplicateProduct = await Product.findOne({
      ...buildProductDuplicateQuery(payload.name, payload.slug),
      _id: { $ne: new mongoose.Types.ObjectId(id) },
    }).lean();

    if (duplicateProduct) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This product name already exists. Please use a different name or edit the existing product.",
        },
        { status: 409 }
      );
    }

    const product = await Product.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    await saveStoreConfigs(String(product._id), body);

    const configs = await getProductConfigs([String(product._id)], {}, { detail: true });
    const data = formatProductWithConfigs(product, configs, normalizeStoreId(body.storeId));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("PATCH PRODUCT ERROR FULL:", error);

    const message = getErrorMessage(error);

    return NextResponse.json(
      {
        success: false,
        message,
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

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Valid product ID is required" },
        { status: 400 }
      );
    }

    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    await ProductStoreConfig.collection.deleteMany(productIdMatch(id));

    return NextResponse.json({
      success: true,
      message: "Product and store configs deleted successfully",
    });
  } catch (error: any) {
    console.error("DELETE PRODUCT ERROR FULL:", error);

    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error) || "Failed to delete product",
      },
      { status: 500 }
    );
  }
}
