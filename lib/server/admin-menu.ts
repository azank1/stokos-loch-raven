import "server-only";

import connectDB from "@/lib/mongodb";
import Product from "@/models/product";
import ProductStoreConfig from "@/models/productstoreconfig";
import Category from "@/models/category";
import CategoryStoreConfig from "@/models/categorystoreconfig";
import ModifierGroup from "@/models/modifiergroup";
import ModifierGroupAssignment from "@/models/modifiergroupassignment";
import UpsellRule from "@/models/upsellrule";

export type AdminMenuPayload = {
  loaded: true;
  products: any[];
  categories: any[];
  modifierGroups: any[];
  upsellRules: any[];
};

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

function cleanNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  const number = Number(cleanString(value).replace(/[^0-9.-]/g, "") || fallback);
  return Number.isFinite(number) ? number : fallback;
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

function cleanCategoryStatus(value: unknown) {
  const status = cleanString(value);
  if (["Active", "Hidden", "Inactive"].includes(status)) return status;
  return "Active";
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
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

function formatRelatedUpsells(value: unknown) {
  const rawItems = Array.isArray(value) ? value : [];
  const unique = new Map<string, { upsellId: string; name: string; price: number }>();

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

function getConfigStoreId(config: any) {
  return normalizeStoreId(config?.storeId || config?.storeSlug || config?.store);
}

function formatProductConfig(config: any) {
  const clean = toPlain(config || {});

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

function formatProductWithConfigs(product: any, configs: any[]) {
  const cleanProduct = toPlain(product || {});
  const cleanConfigs = configs.map(formatProductConfig);
  const primaryConfig = cleanConfigs[0] || null;

  return {
    ...cleanProduct,
    _id: cleanProduct._id ? String(cleanProduct._id) : cleanProduct._id,
    id: cleanProduct._id ? String(cleanProduct._id) : cleanProduct.id,
    storeConfigs: cleanConfigs,

    storeId: primaryConfig?.storeId || cleanProduct.storeId || "",
    category: primaryConfig?.categoryId || cleanProduct.category || "",
    categoryId: primaryConfig?.categoryId || cleanProduct.categoryId || "",
    categoryName: primaryConfig?.categoryName || cleanProduct.categoryName || "",
    price: Number(primaryConfig?.price ?? cleanProduct.price ?? 0),
    sizes: primaryConfig?.sizes || cleanProduct.sizes || [],
    modifierGroups: primaryConfig?.modifierGroups || cleanProduct.modifierGroups || [],
    modifierGroupIds: primaryConfig?.modifierGroupIds || cleanProduct.modifierGroupIds || [],
    relatedUpsells:
      primaryConfig?.relatedUpsells || formatRelatedUpsells(cleanProduct.relatedUpsells),
    upsell: primaryConfig?.upsell || cleanProduct.upsell || "",
    isPopular: cleanBoolean(primaryConfig?.isPopular, cleanBoolean(cleanProduct.isPopular)),
    showInPopular: cleanBoolean(
      primaryConfig?.isPopular,
      cleanBoolean(cleanProduct.showInPopular)
    ),
    sortOrder: Number(primaryConfig?.sortOrder ?? cleanProduct.sortOrder ?? 0),
    status: primaryConfig?.status || cleanProduct.status || "Active",
    updatedAt: cleanProduct.updatedAt || "Today",
  };
}

function formatCategoryStoreConfig(config: any) {
  const cleanConfig = toPlain(config || {});
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
    available: cleanConfig.available !== false && cleanConfig.isAvailable !== false,
    isAvailable: cleanConfig.available !== false && cleanConfig.isAvailable !== false,
    status: cleanCategoryStatus(cleanConfig.status),
    sortOrder: cleanNumber(cleanConfig.sortOrder, 0),
  };
}

function configDateValue(config: any) {
  const updated = new Date(
    config?.updatedAt || config?.createdAt || config?._id?.getTimestamp?.() || 0
  ).getTime();

  return Number.isFinite(updated) ? updated : 0;
}

function formatCategoryWithConfigs(category: any, configs: any[] = []) {
  const cleanCategory = toPlain(category || {});
  const cleanConfigs = configs
    .map(formatCategoryStoreConfig)
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
    status: cleanCategoryStatus(cleanCategory.status || firstConfig?.status),
    sortOrder: cleanNumber(cleanCategory.sortOrder ?? firstConfig?.sortOrder, 0),

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
    storeConfigIds: cleanConfigs.map((config) => config.storeConfigId).filter(Boolean),
    configIds: cleanConfigs.map((config) => config.configId).filter(Boolean),
    storeConfigs: cleanConfigs,

    categoryName: cleanString(firstConfig?.categoryName || name),
    categorySlug: slugify(firstConfig?.categorySlug || slug),
    available: firstConfig ? firstConfig.available : true,
    isAvailable: firstConfig ? firstConfig.isAvailable : true,
  };
}

function buildCategoryRows(categoriesRaw: any[], configsRaw: any[]) {
  const categoriesById = new Map<string, any>();

  categoriesRaw.map(toPlain).forEach((category: any) => {
    categoriesById.set(cleanString(category._id), category);
  });

  const groupedBySlug = new Map<string, { category: any; configs: any[] }>();

  configsRaw.map(toPlain).forEach((config: any) => {
    const categoryId = cleanString(config.categoryId);
    const category = categoriesById.get(categoryId) || {
      _id: categoryId,
      name: cleanString(config.categoryName),
      slug: slugify(config.categorySlug || config.categoryName),
      description: "",
      image: "",
      status: cleanCategoryStatus(config.status),
      sortOrder: cleanNumber(config.sortOrder, 0),
    };

    const slugKey = slugify(category.slug || config.categorySlug || category.name || config.categoryName);
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
    .map(({ category, configs }) => formatCategoryWithConfigs(category, configs))
    .sort((a, b) => {
      const sortDiff = cleanNumber(a.sortOrder, 0) - cleanNumber(b.sortOrder, 0);
      if (sortDiff !== 0) return sortDiff;
      return cleanString(a.name).localeCompare(cleanString(b.name));
    });
}

function getRecordId(value: unknown) {
  if (!value || typeof value !== "object") return "";

  const obj = value as any;
  return cleanString(obj._id || obj.id || obj.modifierGroupId);
}

function formatModifierGroups(groupsRaw: any[], assignmentsRaw: any[]) {
  const assignmentsByGroup = new Map<string, any[]>();

  assignmentsRaw.map(toPlain).forEach((assignment: any) => {
    const groupId = cleanString(assignment.modifierGroupId);
    if (!assignmentsByGroup.has(groupId)) assignmentsByGroup.set(groupId, []);
    assignmentsByGroup.get(groupId)?.push(assignment);
  });

  return groupsRaw.map(toPlain).map((group: any) => {
    const id = getRecordId(group);

    return {
      ...group,
      _id: group._id ? String(group._id) : group._id,
      id,
      modifierGroupId: id,
      assignments: assignmentsByGroup.get(id) || [],
    };
  });
}

function formatUpsellRules(upsellsRaw: any[]) {
  return upsellsRaw.map(toPlain).map((upsell: any) => ({
    ...upsell,
    _id: upsell._id ? String(upsell._id) : upsell._id,
    id: upsell._id ? String(upsell._id) : upsell.id,
  }));
}

export async function getAdminMenuPayload(): Promise<AdminMenuPayload> {
  await connectDB();

  const [
    productsRaw,
    productConfigsRaw,
    categoriesRaw,
    categoryConfigsRaw,
    modifierGroupsRaw,
    modifierAssignmentsRaw,
    upsellRulesRaw,
  ] = await Promise.all([
    Product.find({}).sort({ name: 1, createdAt: -1 }).lean(),
    ProductStoreConfig.collection
      .find({})
      .sort({ storeId: 1, sortOrder: 1, createdAt: -1 })
      .toArray(),
    Category.find({}).sort({ sortOrder: 1, name: 1 }).lean(),
    CategoryStoreConfig.collection
      .find({})
      .sort({ sortOrder: 1, createdAt: 1 })
      .toArray(),
    ModifierGroup.find({}).sort({ sortOrder: 1, name: 1 }).lean(),
    ModifierGroupAssignment.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    UpsellRule.find({}).sort({ sortOrder: 1, createdAt: -1 }).lean(),
  ]);

  const configsByProduct = new Map<string, any[]>();

  productConfigsRaw.map(toPlain).forEach((config: any) => {
    const productId = cleanString(config.productId);
    if (!productId) return;

    configsByProduct.set(productId, [
      ...(configsByProduct.get(productId) || []),
      config,
    ]);
  });

  const products = productsRaw.map((product: any) =>
    formatProductWithConfigs(product, configsByProduct.get(cleanString(product._id)) || [])
  );

  return {
    loaded: true,
    products,
    categories: buildCategoryRows(categoriesRaw, categoryConfigsRaw),
    modifierGroups: formatModifierGroups(modifierGroupsRaw, modifierAssignmentsRaw),
    upsellRules: formatUpsellRules(upsellRulesRaw),
  };
}
