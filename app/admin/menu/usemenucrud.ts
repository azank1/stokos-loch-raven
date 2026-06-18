"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Category,
  ModifierGroup,
  ModifierGroupAssignment,
  ModifierOption,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
  ProductRelatedUpsell,
  ProductSize,
  UpsellRule,
} from "./types";

type MenuEntity = "products" | "categories" | "modifier-groups" | "upsells";

const API_ROUTES: Record<MenuEntity, string> = {
  products: "products",
  categories: "categories",
  "modifier-groups": "modifier-groups",
  upsells: "upsells",
};

const RESPONSE_KEYS: Record<MenuEntity, string[]> = {
  products: ["product", "products"],
  categories: ["category", "categories"],
  "modifier-groups": [
    "modifierGroup",
    "modifierGroups",
    "modifier",
    "modifiers",
  ],
  upsells: ["upsellRule", "upsellRules", "upsell", "upsells"],
};

export type MenuCrudInitialData = {
  loaded?: boolean;
  products?: Product[];
  categories?: Category[];
  modifierGroups?: ModifierGroup[];
  upsellRules?: UpsellRule[];
};

type MenuBootstrapPayload = Required<Omit<MenuCrudInitialData, "loaded">>;

type MongoItem = {
  _id?: string;
  id?: string;
  configId?: string;
  storeConfigId?: string;
  categoryId?: string;
  storeId?: string;
  slug?: string;
  name?: string;
  offer?: string;
};

type CategoryWithMultiStore = Category & {
  storeId?: string;
  storeIds?: string[];
};

type ModifierGroupPayload = ModifierGroup & {
  assignments?: ModifierGroupAssignment[];
};

function getMongoId(item: unknown): string {
  if (!item || typeof item !== "object") return "";

  const obj = item as MongoItem;

  return String(
    obj.storeConfigId ||
      obj.configId ||
      obj._id ||
      obj.id ||
      obj.slug ||
      obj.name ||
      obj.offer ||
      ""
  );
}

function getCategoryMasterId(item: unknown): string {
  if (!item || typeof item !== "object") return "";

  const obj = item as MongoItem;

  return String(obj.categoryId || obj._id || obj.id || obj.slug || obj.name || "").trim();
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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

function getArrayFromResponse<T>(json: any, type: MenuEntity): T[] {
  const keys = ["items", ...RESPONSE_KEYS[type]];

  const sources = [
    json,
    json?.data,
    json?.result,
    json?.payload,
    json?.data?.data,
    json?.result?.data,
    json?.payload?.data,
  ];

  for (const source of sources) {
    if (Array.isArray(source)) return source as T[];

    if (source && typeof source === "object") {
      for (const key of keys) {
        if (Array.isArray(source[key])) {
          return source[key] as T[];
        }
      }
    }
  }

  return [];
}

function getItemFromResponse<T>(json: any, type: MenuEntity, fallback: T): T {
  const keys = ["item", ...RESPONSE_KEYS[type]];

  const sources = [
    json?.data,
    json?.result,
    json?.payload,
    json,
    json?.data?.data,
    json?.result?.data,
    json?.payload?.data,
  ];

  for (const source of sources) {
    if (!source) continue;

    if (Array.isArray(source)) {
      return {
        ...(fallback as object),
        ...(source[0] as object),
      } as T;
    }

    if (typeof source === "object") {
      for (const key of keys) {
        if (source[key]) {
          const item = Array.isArray(source[key])
            ? source[key][0]
            : source[key];

          return {
            ...(fallback as object),
            ...(item as object),
          } as T;
        }
      }

      if (source._id || source.id || source.slug) {
        return {
          ...(fallback as object),
          ...(source as object),
        } as T;
      }
    }
  }

  return fallback;
}

function getApiUrl(type: MenuEntity) {
  return `/api/admin/menu/${API_ROUTES[type]}`;
}

async function apiRebuildStoreMenuSnapshot(
  type: MenuEntity,
  source?: unknown,
  fallback?: unknown
) {
  if (type === "categories") return;

  try {
    const res = await fetch("/api/admin/storemenus/rebuild", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        type,
        source,
        fallback,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || json?.success === false) {
      console.warn("Store menu snapshot rebuild failed:", json);
    }
  } catch (error) {
    console.warn("Store menu snapshot rebuild request failed:", error);
  }
}

async function apiGet<T>(type: MenuEntity): Promise<T[]> {
  try {
    const res = await fetch(`${getApiUrl(type)}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || json?.success === false) {
      console.error(`Failed to load ${type}`, json);
      return [];
    }

    return getArrayFromResponse<T>(json, type);
  } catch (error) {
    console.error(`Failed to load ${type}`, error);
    return [];
  }
}

function getBootstrapArray<T>(
  json: any,
  key: keyof MenuBootstrapPayload
): T[] {
  const sources = [json?.data, json?.payload, json?.result, json];

  for (const source of sources) {
    if (source && Array.isArray(source[key])) {
      return source[key] as T[];
    }
  }

  return [];
}

async function apiGetBootstrap(): Promise<MenuBootstrapPayload> {
  try {
    const res = await fetch(`/api/admin/menu/bootstrap?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || "Failed to load admin menu bootstrap");
    }

    return {
      products: getBootstrapArray<Product>(json, "products"),
      categories: getBootstrapArray<Category>(json, "categories"),
      modifierGroups: getBootstrapArray<ModifierGroup>(json, "modifierGroups"),
      upsellRules: getBootstrapArray<UpsellRule>(json, "upsellRules"),
    };
  } catch (error) {
    console.error(
      "Admin menu bootstrap failed, falling back to split endpoints:",
      error
    );

    const [products, categories, modifierGroups, upsellRules] =
      await Promise.all([
        apiGet<Product>("products"),
        apiGet<Category>("categories"),
        apiGet<ModifierGroup>("modifier-groups"),
        apiGet<UpsellRule>("upsells"),
      ]);

    return {
      products,
      categories,
      modifierGroups,
      upsellRules,
    };
  }
}

async function apiCreate<T>(type: MenuEntity, payload: T): Promise<T> {
  const res = await fetch(getApiUrl(type), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || json?.success === false) {
    console.error(`CREATE ${type} ERROR:`, json);
    throw new Error(json?.message || `Failed to create ${type}`);
  }

  const item = getItemFromResponse<T>(json, type, payload);
  await apiRebuildStoreMenuSnapshot(type, item, payload);

  return item;
}

async function apiUpdate<T extends object>(
  type: MenuEntity,
  payload: T
): Promise<T> {
  const mongoId =
    type === "categories" ? getCategoryMasterId(payload) : getMongoId(payload);

  if (!mongoId) {
    throw new Error(`Missing MongoDB ID for ${type} update`);
  }

  const res = await fetch(getApiUrl(type), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      id: mongoId,
      _id: mongoId,
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || json?.success === false) {
    console.error(`UPDATE ${type} ERROR:`, json);
    throw new Error(json?.message || `Failed to update ${type}`);
  }

  const item = getItemFromResponse<T>(json, type, payload);
  await apiRebuildStoreMenuSnapshot(type, item, payload);

  return item;
}

async function apiDelete(type: MenuEntity, id: string): Promise<void> {
  if (!id) {
    throw new Error(`Missing MongoDB ID for ${type} delete`);
  }

  const res = await fetch(`${getApiUrl(type)}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || json?.success === false) {
    console.error(`DELETE ${type} ERROR:`, json);
    throw new Error(json?.message || `Failed to delete ${type}`);
  }

  await apiRebuildStoreMenuSnapshot(type, json, { id });
}

function sortBySortOrder<T extends { sortOrder?: number }>(items: T[]) {
  return [...items].sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );
}

function addTempId<T extends object>(item: T, tempId: string): T {
  const obj = item as MongoItem;

  if (obj._id || obj.id) return item;

  return {
    ...item,
    id: tempId,
  } as T;
}

function normalizeStoreValue(value: unknown) {
  if (!value) return "";

  if (typeof value === "string" || typeof value === "number") {
    return slugifyValue(String(value || ""));
  }

  if (typeof value === "object") {
    const obj = value as {
      _id?: string;
      id?: string;
      slug?: string;
      name?: string;
    };

    return slugifyValue(String(obj.slug || obj._id || obj.id || obj.name || ""));
  }

  return "";
}

function getCategoryStoreId(category: unknown) {
  if (!category || typeof category !== "object") return "";

  const obj = category as {
    storeId?: unknown;
    storeSlug?: unknown;
    store?: unknown;
  };

  return (
    normalizeStoreValue(obj.storeId) ||
    normalizeStoreValue(obj.storeSlug) ||
    normalizeStoreValue(obj.store)
  );
}

function getCategoryRowKeys(category: unknown) {
  if (!category || typeof category !== "object") return [];

  const obj = category as {
    _id?: unknown;
    id?: unknown;
    categoryId?: unknown;
    name?: unknown;
    categoryName?: unknown;
    slug?: unknown;
    categorySlug?: unknown;
  };

  const categoryId = String(obj.categoryId || obj._id || obj.id || "").trim();
  const slug = slugifyValue(String(obj.slug || obj.categorySlug || "").trim());
  const name = slugifyValue(String(obj.name || obj.categoryName || "").trim());

  const keys: string[] = [];

  if (categoryId && !categoryId.startsWith("temp-category")) {
    keys.push(`category-id:${categoryId}`);
  }

  if (slug) keys.push(`category-slug:${slug}`);
  if (name) keys.push(`category-name:${name}`);

  return keys.filter(Boolean);
}

function sameCategoryRow(first: unknown, second: unknown) {
  const firstKeys = getCategoryRowKeys(first);
  const secondKeys = getCategoryRowKeys(second);

  return firstKeys.some((key) => secondKeys.includes(key));
}

function upsertCategoryRows(currentRows: Category[], nextRows: Category[]) {
  if (!nextRows.length) return currentRows;

  const mergedRows = [...currentRows];

  nextRows.forEach((nextRow) => {
    const existingIndex = mergedRows.findIndex((currentRow) =>
      sameCategoryRow(currentRow, nextRow)
    );

    if (existingIndex >= 0) {
      mergedRows[existingIndex] = {
        ...(mergedRows[existingIndex] as object),
        ...(nextRow as object),
      } as Category;

      return;
    }

    mergedRows.push(nextRow);
  });

  return sortBySortOrder(mergedRows);
}

function isDuplicateCategoryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return message.toLowerCase().includes("category already exists");
}

function getNextCategorySortOrder(
  storeId: string,
  existingCategories: Category[],
  pendingCategories: Category[] = []
) {
  const allCategories = [...existingCategories, ...pendingCategories];

  const maxSortOrder = allCategories.reduce((max, category) => {
    const categoryStoreId = getCategoryStoreId(category);

    if (String(categoryStoreId) !== String(storeId)) return max;

    return Math.max(max, Number(category.sortOrder || 0));
  }, 0);

  return maxSortOrder + 1;
}

function getNextModifierSortOrder(existingModifierGroups: ModifierGroup[]) {
  const maxSortOrder = existingModifierGroups.reduce((max, modifier) => {
    return Math.max(max, Number(modifier.sortOrder || 0));
  }, 0);

  return maxSortOrder + 1;
}

function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function normalizePriceNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeRelatedUpsells(value: unknown): ProductRelatedUpsell[] {
  const rawItems = safeArray<unknown>(value);
  const unique = new Map<string, ProductRelatedUpsell>();

  rawItems.forEach((item: any, index) => {
    if (typeof item === "string" || typeof item === "number") {
      const upsellId = String(item || "").trim();
      if (!upsellId) return;

      unique.set(upsellId, {
        upsellId,
        name: upsellId,
        price: 0,
      });
      return;
    }

    if (!item || typeof item !== "object") return;

    const name = String(
      item.name || item.offer || item.title || item.label || item.upsellName || ""
    ).trim();
    const upsellId = String(
      item.upsellId || item._id || item.id || item.slug || slugifyValue(name)
    ).trim();

    if (!upsellId && !name) return;

    const key = upsellId || slugifyValue(name) || `upsell-${index + 1}`;

    unique.set(key, {
      upsellId: key,
      name: name || key,
      price: normalizePriceNumber(item.price),
    });
  });

  return Array.from(unique.values());
}

function normalizeProductSizes(value: unknown, fallbackPrice: unknown): ProductSize[] {
  const rawSizes = safeArray<unknown>(value);

  const sizes = rawSizes
    .map((size: any, index) => {
      const name = String(size?.name || "").trim();

      if (!name) return null;

      return {
        id: String(size?.id || slugifyValue(name) || `size-${index + 1}`),
        name,
        price: normalizePriceNumber(size?.price),
        sortOrder: Number(size?.sortOrder ?? index),
      };
    })
    .filter(Boolean) as ProductSize[];

  if (sizes.length > 0) return sizes;

  return [
    {
      id: "regular",
      name: "Regular",
      price: normalizePriceNumber(fallbackPrice),
      sortOrder: 0,
    },
  ];
}

function normalizePricesBySize(value: unknown, sizes: ProductSize[]) {
  const prices: Record<string, number> = {};

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, price]) => {
      const cleanKey = String(key || "").trim();

      if (!cleanKey) return;

      prices[cleanKey] = normalizePriceNumber(price);
    });
  }

  sizes.forEach((size) => {
    const sizeName = String(size.name || "").trim();

    if (!sizeName) return;

    if (!(sizeName in prices)) {
      prices[sizeName] = 0;
    }
  });

  Object.keys(prices).forEach((key) => {
    const exists = sizes.some((size) => String(size.name || "").trim() === key);

    if (!exists) {
      delete prices[key];
    }
  });

  return prices;
}

function normalizeProductModifierOption(
  option: unknown,
  sizes: ProductSize[],
  index: number
): ProductModifierOption | null {
  if (typeof option === "string" || typeof option === "number") {
    const name = String(option || "").trim();

    if (!name) return null;

    const id = slugifyValue(name) || `option-${index + 1}`;

    return {
      id,
      optionId: id,
      name,
      status: "Active",
      pricesBySize: normalizePricesBySize({}, sizes),
    };
  }

  if (!option || typeof option !== "object") return null;

  const obj = option as {
    id?: unknown;
    _id?: unknown;
    optionId?: unknown;
    name?: unknown;
    label?: unknown;
    title?: unknown;
    value?: unknown;
    status?: unknown;
    pricesBySize?: unknown;
  };

  const name = String(
    obj.name || obj.label || obj.title || obj.value || ""
  ).trim();

  if (!name) return null;

  const optionId = String(
    obj.optionId || obj.id || obj._id || slugifyValue(name) || ""
  ).trim();

  return {
    id: String(obj.id || optionId || `option-${index + 1}`),
    optionId,
    name,
    status: obj.status === "Inactive" ? "Inactive" : "Active",
    pricesBySize: normalizePricesBySize(obj.pricesBySize, sizes),
  };
}

function normalizeProductModifierGroup(
  group: unknown,
  sizes: ProductSize[],
  index: number
): ProductModifierGroup | null {
  if (typeof group === "string" || typeof group === "number") {
    const name = String(group || "").trim();

    if (!name) return null;

    return {
      modifierGroupId: "",
      name,
      required: false,
      minSelect: 0,
      maxSelect: 0,
      sortOrder: index,
      status: "Active",
      options: [],
    };
  }

  if (!group || typeof group !== "object") return null;

  const obj = group as ProductModifierGroup & {
    _id?: string;
    id?: string;
    groupId?: string;
    slug?: string;
    title?: string;
    label?: string;
  };

  const name = String(obj.name || obj.title || obj.label || "").trim();
  const modifierGroupId = String(
    obj.modifierGroupId || obj.groupId || obj._id || obj.id || obj.slug || ""
  ).trim();

  if (!name && !modifierGroupId) return null;

  return {
    modifierGroupId,
    name: name || modifierGroupId,
    required: Boolean(obj.required),
    minSelect: Number(obj.minSelect || 0),
    maxSelect: Number(obj.maxSelect || 0),
    sortOrder: Number(obj.sortOrder ?? index),
    status: obj.status === "Inactive" ? "Inactive" : "Active",
    options: safeArray<unknown>(obj.options)
      .map((option, optionIndex) =>
        normalizeProductModifierOption(option, sizes, optionIndex)
      )
      .filter(Boolean) as ProductModifierOption[],
  };
}

function normalizeProductModifierGroups(
  value: unknown,
  sizes: ProductSize[]
): ProductModifierGroup[] {
  return safeArray<unknown>(value)
    .map((group, index) => normalizeProductModifierGroup(group, sizes, index))
    .filter(Boolean) as ProductModifierGroup[];
}

function isStoreConfigVisible(config: any) {
  if (!config || typeof config !== "object") return false;

  const available =
    config.isAvailable !== false &&
    config.available !== false &&
    config.enabled !== false;

  const status = String(config.status || "Active").trim();
  const active = status !== "Inactive";

  return available && active;
}

function normalizeStoreConfig(config: unknown, fallbackProduct?: Product) {
  if (!config || typeof config !== "object") return null;

  const obj = config as any;
  const sizes = normalizeProductSizes(obj.sizes, obj.price ?? fallbackProduct?.price);
  const modifierGroups = normalizeProductModifierGroups(obj.modifierGroups, sizes);

  return {
    ...obj,
    _id: obj._id ? String(obj._id) : obj._id,
    id: String(obj._id || obj.id || ""),
    productId: String(obj.productId || obj.product || ""),
    storeId: String(obj.storeId || obj.storeSlug || obj.store || "").trim(),
    category: String(obj.category || obj.categoryId || "").trim(),
    categoryId: String(obj.categoryId || obj.category || "").trim(),
    categoryName: String(obj.categoryName || "").trim(),
    price: Number(sizes[0]?.price || obj.price || 0),
    sizes,
    modifierGroups,
    modifierGroupIds: Array.from(
      new Set([
        ...safeArray<string>(obj.modifierGroupIds),
        ...modifierGroups
          .map((group) => String(group.modifierGroupId || "").trim())
          .filter(Boolean),
      ])
    ),
    relatedUpsells: normalizeRelatedUpsells(obj.relatedUpsells),
    upsell: String(obj.upsell || ""),
    isAvailable: obj.isAvailable !== false && obj.available !== false,
    available: obj.isAvailable !== false && obj.available !== false,
    isPopular: cleanBoolean(obj.isPopular, cleanBoolean(obj.showInPopular)),
    showInPopular: cleanBoolean(obj.isPopular, cleanBoolean(obj.showInPopular)),
    status: obj.status || "Active",
    sortOrder: Number(obj.sortOrder || 0),
  };
}

function getPrimaryStoreConfig(product: Product) {
  const configs = safeArray<unknown>((product as any).storeConfigs)
    .map((config) => normalizeStoreConfig(config, product))
    .filter(Boolean) as any[];

  return configs.filter(isStoreConfigVisible)[0] || null;
}

function normalizeProduct(product: Product): Product {
  const productObj = product as Product & {
    categoryName?: unknown;
    categoryId?: unknown;
    sizes?: unknown;
    storeConfigs?: unknown;
  };

  const storeConfigs = safeArray<unknown>(productObj.storeConfigs)
    .map((config) => normalizeStoreConfig(config, product))
    .filter(Boolean)
    .filter(isStoreConfigVisible) as any[];

  const primaryConfig = storeConfigs[0] || getPrimaryStoreConfig(product);

  const productSizes = primaryConfig
    ? normalizeProductSizes(primaryConfig.sizes, primaryConfig.price)
    : normalizeProductSizes(productObj.sizes, product.price);

  const modifierGroups = primaryConfig
    ? normalizeProductModifierGroups(primaryConfig.modifierGroups, productSizes)
    : normalizeProductModifierGroups((product as any).modifierGroups, productSizes);

  const sourceForStoreFields = (primaryConfig || product) as any;

  const modifierGroupIds = Array.from(
    new Set([
      ...safeArray<string>(sourceForStoreFields.modifierGroupIds),
      ...modifierGroups
        .map((group) => String(group.modifierGroupId || "").trim())
        .filter(Boolean),
    ])
  );

  return {
    ...product,
    storeConfigs,
    storeId: String(primaryConfig?.storeId || product.storeId || "").trim(),
    category: String(primaryConfig?.category || primaryConfig?.categoryId || productObj.category || productObj.categoryId || "").trim(),
    categoryId: String(primaryConfig?.categoryId || productObj.categoryId || productObj.category || "").trim(),
    categoryName: String(primaryConfig?.categoryName || productObj.categoryName || "").trim(),
    price: Number(productSizes[0]?.price || primaryConfig?.price || product.price || 0),
    sizes: productSizes,
    image: product.image || "",
    modifierGroups,
    modifierGroupIds,
    relatedUpsells: normalizeRelatedUpsells(sourceForStoreFields.relatedUpsells),
    upsell: String(sourceForStoreFields.upsell || ""),
    isPopular: cleanBoolean(
      primaryConfig?.isPopular,
      cleanBoolean(primaryConfig?.showInPopular, cleanBoolean((product as any).isPopular))
    ),
    showInPopular: cleanBoolean(
      primaryConfig?.isPopular,
      cleanBoolean(primaryConfig?.showInPopular, cleanBoolean((product as any).showInPopular))
    ),
    status: primaryConfig?.status || product.status || "Active",
    sortOrder: Number(primaryConfig?.sortOrder || product.sortOrder || 0),
    updatedAt: product.updatedAt || "Today",
  } as Product;
}

function buildProductApiPayload(product: Product): Product {
  const normalized = normalizeProduct(product) as Product & {
    storeConfigs?: unknown;
    replaceStoreConfigs?: unknown;
  };

  const raw = product as Product & {
    storeConfigs?: unknown;
    replaceStoreConfigs?: unknown;
  };

  const rawStoreConfigs = safeArray<unknown>(raw.storeConfigs);
  const normalizedStoreConfigs = safeArray<unknown>(normalized.storeConfigs);

  return {
    ...normalized,
    ...raw,
    storeConfigs: rawStoreConfigs.length ? rawStoreConfigs : normalizedStoreConfigs,
    replaceStoreConfigs: raw.replaceStoreConfigs !== false,
  } as Product;
}

function uniqueNormalizedStoreIds(values: unknown[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  function add(value: unknown) {
    const storeId = normalizeStoreValue(value);

    if (!storeId || storeId === "all" || seen.has(storeId)) return;

    seen.add(storeId);
    output.push(storeId);
  }

  values.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }

    add(value);
  });

  return output;
}

function normalizeCategoryStoreConfig(config: unknown, fallbackCategory?: any) {
  if (!config || typeof config !== "object") return null;

  const obj = config as any;
  const storeId = normalizeStoreValue(obj.storeId || obj.storeSlug || obj.store);

  if (!storeId || storeId === "all") return null;

  const available = obj.available !== false && obj.isAvailable !== false;

  return {
    ...obj,
    _id: obj._id ? String(obj._id) : obj._id,
    id: String(obj.storeConfigId || obj.configId || obj._id || obj.id || ""),
    storeConfigId: String(obj.storeConfigId || obj.configId || obj._id || obj.id || ""),
    configId: String(obj.configId || obj.storeConfigId || obj._id || obj.id || ""),
    categoryId: String(
      obj.categoryId ||
        fallbackCategory?.categoryId ||
        fallbackCategory?._id ||
        fallbackCategory?.id ||
        ""
    ).trim(),
    storeId,
    storeSlug: storeId,
    categoryName: String(
      obj.categoryName || fallbackCategory?.name || fallbackCategory?.categoryName || ""
    ).trim(),
    categorySlug: slugifyValue(
      String(obj.categorySlug || fallbackCategory?.slug || fallbackCategory?.name || "")
    ),
    available,
    isAvailable: available,
    status: obj.status === "Inactive" ? "Inactive" : obj.status || "Active",
    sortOrder: Number(obj.sortOrder ?? fallbackCategory?.sortOrder ?? 0),
  };
}

function normalizeCategory(
  category: CategoryWithMultiStore
): CategoryWithMultiStore {
  const categoryObj = category as any;

  const storeConfigs = safeArray<unknown>(categoryObj.storeConfigs)
    .map((config) => normalizeCategoryStoreConfig(config, categoryObj))
    .filter(Boolean) as any[];

  const storeIds = uniqueNormalizedStoreIds([
    categoryObj.storeIds,
    categoryObj.storeSlugs,
    categoryObj.stores,
    categoryObj.selectedStores,
    categoryObj.selectedStoreIds,
    categoryObj.selectedStoreSlugs,
    storeConfigs.map((config) => config.storeId),
    categoryObj.storeId,
    categoryObj.storeSlug,
    categoryObj.store,
  ]);

  const primaryStoreId = storeIds[0] || "";
  const categoryId = String(
    categoryObj.categoryId || categoryObj._id || categoryObj.id || ""
  ).trim();

  const name = String(categoryObj.name || categoryObj.categoryName || "").trim();
  const slug = slugifyValue(String(categoryObj.slug || categoryObj.categorySlug || name));

  return {
    ...category,
    _id: categoryObj._id,
    id: String(categoryObj.id || categoryId || slug || name || "").trim(),
    categoryId,
    name,
    slug,
    storeId: primaryStoreId,
    storeSlug: primaryStoreId,
    storeIds,
    storeSlugs: storeIds,
    stores: storeIds,
    selectedStores: storeIds,
    selectedStoreIds: storeIds,
    selectedStoreSlugs: storeIds,
    storeConfigs,
    storeConfigId: String(categoryObj.storeConfigId || storeConfigs[0]?.storeConfigId || ""),
    configId: String(categoryObj.configId || storeConfigs[0]?.configId || ""),
    storeConfigIds: storeConfigs.map((config) => config.storeConfigId).filter(Boolean),
    configIds: storeConfigs.map((config) => config.configId).filter(Boolean),
    available: categoryObj.available !== false && categoryObj.isAvailable !== false,
    isAvailable: categoryObj.available !== false && categoryObj.isAvailable !== false,
    status: category.status || "Active",
    sortOrder: Number(category.sortOrder || 1),
  } as CategoryWithMultiStore;
}

function normalizeModifierOption(
  option: unknown,
  index: number
): ModifierOption | null {
  if (typeof option === "string" || typeof option === "number") {
    const name = String(option || "").trim();

    if (!name) return null;

    return {
      id:
        name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "") || `option-${index + 1}`,
      name,
      status: "Active",
    };
  }

  if (!option || typeof option !== "object") return null;

  const obj = option as {
    id?: unknown;
    name?: unknown;
    label?: unknown;
    title?: unknown;
    value?: unknown;
    status?: unknown;
  };

  const name = String(
    obj.name || obj.label || obj.title || obj.value || ""
  ).trim();

  if (!name) return null;

  return {
    id: String(
      obj.id ||
        name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "") ||
        `option-${index + 1}`
    ),
    name,
    status: obj.status === "Inactive" ? "Inactive" : "Active",
  };
}

function normalizeModifierAssignment(
  assignment: unknown,
  index: number
): ModifierGroupAssignment | null {
  if (!assignment || typeof assignment !== "object") return null;

  const obj = assignment as ModifierGroupAssignment & {
    _id?: string;
    id?: string;
    storeSlug?: string;
    category?: string;
    appliesTo?: string;
  };

  const storeId = String(obj.storeId || obj.storeSlug || "").trim();

  const categoryId = String(obj.categoryId || obj.category || "").trim();

  const categoryName = String(obj.categoryName || obj.appliesTo || "").trim();

  if (!storeId || !categoryId || !categoryName) return null;

  return {
    ...obj,
    id: String(obj._id || obj.id || ""),
    storeId,
    categoryId,
    categoryName,
    sortOrder: Number(obj.sortOrder ?? index),
    status: obj.status === "Inactive" ? "Inactive" : "Active",
  };
}

function normalizeModifier(modifier: ModifierGroup): ModifierGroup {
  const options = safeArray<unknown>((modifier as any).options)
    .map((option, index) => normalizeModifierOption(option, index))
    .filter(Boolean) as ModifierOption[];

  const directAssignments = safeArray<unknown>((modifier as any).assignments)
    .map((assignment, index) => normalizeModifierAssignment(assignment, index))
    .filter(Boolean) as ModifierGroupAssignment[];

  const legacyStoreId = String((modifier as any).storeId || "").trim();

  const legacyCategoryId = String(
    (modifier as any).categoryId ||
      (modifier as any).category ||
      safeArray<string>((modifier as any).appliesToCategories)[0] ||
      ""
  ).trim();

  const legacyCategoryName = String(
    (modifier as any).categoryName || (modifier as any).appliesTo || ""
  ).trim();

  const legacyAssignment =
    !directAssignments.length && legacyStoreId && legacyCategoryId && legacyCategoryName
      ? [
          {
            storeId: legacyStoreId,
            categoryId: legacyCategoryId,
            categoryName: legacyCategoryName,
            status: modifier.status || "Active",
            sortOrder: 0,
          } as ModifierGroupAssignment,
        ]
      : [];

  return {
    ...modifier,
    name: String(modifier.name || "").trim(),
    options,
    assignments: directAssignments.length ? directAssignments : legacyAssignment,
    required: Boolean(modifier.required),
    minSelect: Number(modifier.minSelect || 0),
    maxSelect: Number(modifier.maxSelect || 0),
    sortOrder: Number(modifier.sortOrder || 0),
    status: modifier.status || "Active",
  };
}

function normalizeUpsellStoreConfig(config: unknown, index: number) {
  if (!config || typeof config !== "object") return null;

  const obj = config as {
    _id?: unknown;
    id?: unknown;
    upsellId?: unknown;
    storeId?: unknown;
    storeSlug?: unknown;
    store?: unknown;
    categoryId?: unknown;
    category?: unknown;
    categoryName?: unknown;
    categoryType?: unknown;
    triggerCategoryName?: unknown;
    available?: unknown;
    status?: unknown;
    sortOrder?: unknown;
  };

  const storeId = normalizeStoreValue(
    obj.storeId || obj.storeSlug || obj.store
  );

  if (!storeId) return null;

  const status = ["Active", "Paused", "Inactive"].includes(
    String(obj.status || "")
  )
    ? (String(obj.status) as UpsellRule["status"])
    : "Active";

  const categoryName = String(
    obj.categoryName || obj.categoryType || obj.triggerCategoryName || ""
  ).trim();

  return {
    _id: obj._id ? String(obj._id) : undefined,
    id: String(obj._id || obj.id || "").trim(),
    upsellId: String(obj.upsellId || "").trim(),
    storeId,
    categoryId: String(obj.categoryId || obj.category || "").trim(),
    categoryName,
    available: obj.available !== false && status !== "Inactive",
    status,
    sortOrder: Number(obj.sortOrder ?? index),
  };
}

function normalizeUpsellStoreConfigs(upsell: UpsellRule) {
  const directConfigs = safeArray<unknown>((upsell as any).storeConfigs)
    .map((config, index) => normalizeUpsellStoreConfig(config, index))
    .filter(Boolean) as Array<{
    _id?: string;
    id?: string;
    upsellId?: string;
    storeId: string;
    categoryId: string;
    categoryName: string;
    available: boolean;
    status: UpsellRule["status"];
    sortOrder?: number;
  }>;

  if (directConfigs.length > 0) {
    return directConfigs;
  }

  const fallbackCategoryId = String(
    (upsell as any).categoryId || (upsell as any).triggerCategoryId || ""
  ).trim();

  const fallbackCategoryName = String(
    (upsell as any).categoryName ||
      (upsell as any).categoryType ||
      (upsell as any).triggerCategoryName ||
      safeArray<string>((upsell as any).appliesToCategories)[0] ||
      ""
  ).trim();

  const storeIds = safeArray<unknown>((upsell as any).storeIds)
    .map((storeId) => normalizeStoreValue(storeId))
    .filter(Boolean);

  if (storeIds.length > 0) {
    return Array.from(new Set(storeIds)).map((storeId, index) => ({
      storeId,
      categoryId: fallbackCategoryId,
      categoryName: fallbackCategoryName,
      available: true,
      status: "Active" as UpsellRule["status"],
      sortOrder: index,
    }));
  }

  const storeId = normalizeStoreValue((upsell as any).storeId || "towson");

  return storeId
    ? [
        {
          storeId,
          categoryId: fallbackCategoryId,
          categoryName: fallbackCategoryName,
          available: true,
          status: "Active" as UpsellRule["status"],
          sortOrder: 0,
        },
      ]
    : [];
}

function normalizeUpsell(upsell: UpsellRule): UpsellRule {
  const storeConfigs = normalizeUpsellStoreConfigs(upsell);

  const activeStoreIds = Array.from(
    new Set(
      storeConfigs
        .filter((config) => config.available && config.status !== "Inactive")
        .map((config) => config.storeId)
        .filter(Boolean)
    )
  );

  const allStoreIds = Array.from(
    new Set(storeConfigs.map((config) => config.storeId).filter(Boolean))
  );

  const firstActiveConfig =
    storeConfigs.find((config) => config.available && config.status !== "Inactive") ||
    storeConfigs[0];

  const categoryId = String(
    (upsell as any).categoryId ||
      firstActiveConfig?.categoryId ||
      (upsell as any).triggerCategoryId ||
      ""
  ).trim();

  const categoryName = String(
    (upsell as any).categoryName ||
      firstActiveConfig?.categoryName ||
      (upsell as any).categoryType ||
      (upsell as any).triggerCategoryName ||
      safeArray<string>((upsell as any).appliesToCategories)[0] ||
      ""
  ).trim();

  const name = String(
    (upsell as any).name || (upsell as any).offer || "Upsell Item"
  ).trim();

  return {
    ...upsell,

    storeId: String(
      (upsell as any).storeId || activeStoreIds[0] || allStoreIds[0] || "towson"
    ).trim(),
    storeIds: activeStoreIds.length ? activeStoreIds : allStoreIds,
    storeConfigs,

    name,
    image: String((upsell as any).image || "").trim(),
    description: String((upsell as any).description || "").trim(),

    categoryId,
    categoryName,
    categoryType: String((upsell as any).categoryType || categoryName || "").trim(),

    triggerCategoryId: String((upsell as any).triggerCategoryId || categoryId || "").trim(),
    triggerCategoryName: String((upsell as any).triggerCategoryName || categoryName || "").trim(),
    offerProductIds: [],
    trigger: categoryName,
    offer: name,
    appliesToCategories: categoryName ? [categoryName] : [],
    appliesToProducts: [],

    sortOrder: Number((upsell as any).sortOrder || 0),
    status: upsell.status || "Active",
    updatedAt: (upsell as any).updatedAt || new Date().toISOString(),
  } as UpsellRule;
}

function getEntityKey(item: unknown) {
  if (!item || typeof item !== "object") return "";

  const obj = item as {
    storeId?: unknown;
    name?: unknown;
    offer?: unknown;
    category?: unknown;
    categoryId?: unknown;
    categoryName?: unknown;
    categoryType?: unknown;
    appliesTo?: unknown;
    appliesToCategories?: unknown;
    price?: unknown;
    slug?: unknown;
    storeConfigs?: unknown;
  };

  const storeConfigs = safeArray<any>(obj.storeConfigs);
  const storeIds = storeConfigs
    .map((config) => normalizeStoreValue(config?.storeId))
    .filter(Boolean)
    .join(",");

  const storeId = storeIds || normalizeStoreValue(obj.storeId);

  const name = String(obj.name || obj.offer || "")
    .trim()
    .toLowerCase();

  const configCategories = storeConfigs
    .map((config) => String(config?.categoryName || config?.categoryId || "").trim().toLowerCase())
    .filter(Boolean)
    .join(",");

  const category = String(
    obj.categoryName || obj.categoryType || obj.categoryId || obj.category || configCategories || ""
  )
    .trim()
    .toLowerCase();

  const appliesTo = String(obj.appliesTo || "")
    .trim()
    .toLowerCase();

  const appliesToCategories = Array.isArray(obj.appliesToCategories)
    ? obj.appliesToCategories
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean)
        .join(",")
    : "";

  const price = String(obj.price || "").trim();

  const slug = String(obj.slug || "")
    .trim()
    .toLowerCase();

  return [
    storeId,
    name,
    category,
    appliesTo,
    appliesToCategories,
    price,
    slug,
  ]
    .filter(Boolean)
    .join("|");
}

function replaceTempOrMerge<T extends object>(
  items: T[],
  savedItem: T,
  tempId: string
) {
  const savedId = getMongoId(savedItem);
  const savedKey = getEntityKey(savedItem);

  let replaced = false;

  const next = items.map((item) => {
    const itemId = getMongoId(item);
    const itemKey = getEntityKey(item);

    if (
      itemId === tempId ||
      (savedId && itemId === savedId) ||
      (savedKey && itemKey === savedKey)
    ) {
      replaced = true;

      return {
        ...(item as object),
        ...(savedItem as object),
      } as T;
    }

    return item;
  });

  if (!replaced) {
    return [savedItem, ...next];
  }

  return next;
}

function updateLocalItem<T extends object>(items: T[], savedItem: T) {
  const savedId = getMongoId(savedItem);
  const savedKey = getEntityKey(savedItem);

  return items.map((item) => {
    const itemId = getMongoId(item);
    const itemKey = getEntityKey(item);

    if ((savedId && itemId === savedId) || (savedKey && itemKey === savedKey)) {
      return {
        ...(item as object),
        ...(savedItem as object),
      } as T;
    }

    return item;
  });
}

export function useMenuCrud(initialData?: MenuCrudInitialData) {
  const hasInitialData = initialData?.loaded === true;

  const [products, setProducts] = useState<Product[]>(() =>
    safeArray<Product>(initialData?.products).map(normalizeProduct)
  );

  const [categories, setCategories] = useState<Category[]>(() =>
    sortBySortOrder(
      safeArray<Category>(initialData?.categories).map(
        normalizeCategory
      ) as Category[]
    )
  );

  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>(() =>
    safeArray<ModifierGroup>(initialData?.modifierGroups).map(normalizeModifier)
  );

  const [upsellRules, setUpsellRules] = useState<UpsellRule[]>(() =>
    safeArray<UpsellRule>(initialData?.upsellRules).map(normalizeUpsell)
  );

  // Important: true rakho taake MenuManagementClient full loading screen na dikhaye
  const [isLoaded, setIsLoaded] = useState(true);

  const firstLoadDone = useRef(hasInitialData);
  const isLoadingRef = useRef(false);

  const loadMenu = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (isLoadingRef.current) return;

      isLoadingRef.current = true;

      try {
        // Products ko sab se pehle load karo
        const productsData = await apiGet<Product>("products");

        setProducts(productsData.map(normalizeProduct));

        firstLoadDone.current = true;
        setIsLoaded(true);

        // Baqi data background mein parallel load hoga
        const [categoriesData, modifiersData, upsellsData] = await Promise.all([
          apiGet<Category>("categories"),
          apiGet<ModifierGroup>("modifier-groups"),
          apiGet<UpsellRule>("upsells"),
        ]);

        setCategories(
          sortBySortOrder(
            categoriesData.map(normalizeCategory) as Category[]
          )
        );

        setModifierGroups(modifiersData.map(normalizeModifier));
        setUpsellRules(upsellsData.map(normalizeUpsell));
      } catch (error) {
        console.error("Menu load failed:", error);
        setIsLoaded(true);
      } finally {
        isLoadingRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    void loadMenu({ silent: true });
  }, [loadMenu]);
  const addProduct = async (product: Product) => {
    const tempId = `temp-product-${Date.now()}`;
    const payload = buildProductApiPayload(product);
    const optimisticProduct = addTempId(normalizeProduct(payload), tempId);

    setProducts((prev) => [optimisticProduct, ...prev]);

    try {
      const savedProduct = normalizeProduct(
        await apiCreate<Product>("products", payload)
      );

      setProducts((prev) => replaceTempOrMerge(prev, savedProduct, tempId));

      return savedProduct;
    } catch (error) {
      setProducts((prev) => prev.filter((item) => getMongoId(item) !== tempId));
      throw error;
    }
  };

  const updateProduct = async (product: Product) => {
    const payload = buildProductApiPayload(product);
    const productId = getMongoId(payload);
    const oldProducts = products;

    const optimisticProduct = normalizeProduct(payload);

    setProducts((prev) =>
      prev.map((item) =>
        getMongoId(item) === productId ? optimisticProduct : item
      )
    );

    try {
      const savedProduct = normalizeProduct(
        await apiUpdate<Product>("products", payload)
      );

      setProducts((prev) => updateLocalItem(prev, savedProduct));

      return savedProduct;
    } catch (error) {
      setProducts(oldProducts);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    const oldProducts = products;

    setProducts((prev) =>
      prev.filter((item) => getMongoId(item) !== String(id))
    );

    try {
      await apiDelete("products", id);
    } catch (error) {
      setProducts(oldProducts);
      throw error;
    }
  };

  const addCategory = async (category: CategoryWithMultiStore) => {
    const oldCategories = categories;

    const targetStoreIds = uniqueNormalizedStoreIds([
      category.storeIds,
      (category as any).storeSlugs,
      (category as any).stores,
      (category as any).selectedStores,
      (category as any).selectedStoreIds,
      (category as any).selectedStoreSlugs,
      category.storeId,
      (category as any).storeSlug,
      (category as any).store,
    ]);

    if (!targetStoreIds.length) {
      throw new Error("Please select at least one store.");
    }

    const nextSortOrder = getNextCategorySortOrder(
      targetStoreIds[0],
      categories,
      []
    );

    const tempId = `temp-category-${Date.now()}`;

    const payload = normalizeCategory({
      ...category,
      id: String((category as any).id || tempId),
      storeId: targetStoreIds[0],
      storeIds: targetStoreIds,
      storeSlugs: targetStoreIds,
      stores: targetStoreIds,
      selectedStores: targetStoreIds,
      selectedStoreIds: targetStoreIds,
      selectedStoreSlugs: targetStoreIds,
      sortOrder: Number(category.sortOrder || nextSortOrder),
    } as CategoryWithMultiStore) as Category;

    const optimisticCategory = addTempId(payload, tempId) as Category;

    setCategories((prev) => upsertCategoryRows(prev, [optimisticCategory]));

    try {
      const savedCategory = normalizeCategory(
        await apiCreate<Category>("categories", payload)
      ) as Category;

      setCategories((prev) =>
        upsertCategoryRows(
          prev.filter((item: any) => String(item.id || "") !== tempId),
          [savedCategory]
        )
      );

      return savedCategory;
    } catch (error) {
      setCategories(oldCategories);
      throw error;
    }
  };

  // FIX: updateCategory now always sends selectedStoreIds as an explicit array
  // in the PATCH payload. This is the defence-in-depth counterpart to the
  // hasExplicitStoreSelection fix in categories/route.ts.
  //
  // Previously, when a category was edited (e.g. name change only), normalizeCategory
  // set storeIds correctly, but the old hasExplicitStoreSelection in the route
  // treated even a single storeId field as an explicit store deselection, causing
  // other store configs to be deleted. The route fix is the primary fix; this
  // ensures the payload intent is always unambiguous regardless.
  const updateCategory = async (category: Category) => {
    const normalized = normalizeCategory(category) as CategoryWithMultiStore;

    // Always send the full storeIds array so the PATCH route can distinguish
    // "intentional multi-store update" from "incidental storeId field".
    const payload = {
      ...normalized,
      // Guarantee selectedStoreIds is always an array (never undefined/null).
      selectedStoreIds: (normalized.storeIds ?? []),
      storeIds: (normalized.storeIds ?? []),
    } as Category;

    const oldCategories = categories;

    setCategories((prev) =>
      sortBySortOrder(
        prev.map((item) => (sameCategoryRow(item, payload) ? payload : item))
      )
    );

    try {
      const savedCategory = normalizeCategory(
        await apiUpdate<Category>("categories", payload)
      ) as Category;

      setCategories((prev) => upsertCategoryRows(prev, [savedCategory]));

      return savedCategory;
    } catch (error) {
      setCategories(oldCategories);
      throw error;
    }
  };

  const deleteCategory = async (id: string) => {
    const oldCategories = categories;
    const cleanId = String(id || "").trim();

    if (!cleanId) {
      throw new Error("Missing category ID for delete");
    }

    const matchedCategory = categories.find((item: any) => {
      const itemIds = [
        item._id,
        item.id,
        item.categoryId,
        item.storeConfigId,
        item.configId,
        getMongoId(item),
        ...safeArray<string>(item.storeConfigIds),
        ...safeArray<string>(item.configIds),
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      return itemIds.includes(cleanId);
    });

    const masterCategoryId = getCategoryMasterId(matchedCategory || { id: cleanId });

    if (!masterCategoryId) {
      throw new Error("Missing master category ID for delete");
    }

    setCategories((prev) =>
      prev.filter((item: any) => {
        const itemMasterId = getCategoryMasterId(item);
        return itemMasterId !== masterCategoryId && !sameCategoryRow(item, matchedCategory);
      })
    );

    try {
      await apiDelete("categories", masterCategoryId);
    } catch (error) {
      setCategories(oldCategories);
      throw error;
    }
  };

  const addModifier = async (modifier: ModifierGroupPayload) => {
    const nextSortOrder = getNextModifierSortOrder(modifierGroups);

    const payload = normalizeModifier({
      ...modifier,
      sortOrder: Number(modifier.sortOrder || nextSortOrder),
    } as ModifierGroup);

    const tempId = `temp-modifier-${Date.now()}`;
    const optimisticModifier = addTempId(payload, tempId);

    setModifierGroups((prev) => [optimisticModifier, ...prev]);

    try {
      const savedModifier = normalizeModifier(
        await apiCreate<ModifierGroup>("modifier-groups", payload)
      );

      setModifierGroups((prev) =>
        replaceTempOrMerge(prev, savedModifier, tempId)
      );

      return savedModifier;
    } catch (error) {
      setModifierGroups((prev) =>
        prev.filter((item) => getMongoId(item) !== tempId)
      );

      throw error;
    }
  };

  const updateModifier = async (modifier: ModifierGroup) => {
    const payload = normalizeModifier(modifier);
    const modifierId = getMongoId(payload);
    const oldModifierGroups = modifierGroups;

    setModifierGroups((prev) =>
      prev.map((item) => (getMongoId(item) === modifierId ? payload : item))
    );

    try {
      const savedModifier = normalizeModifier(
        await apiUpdate<ModifierGroup>("modifier-groups", payload)
      );

      setModifierGroups((prev) => updateLocalItem(prev, savedModifier));

      return savedModifier;
    } catch (error) {
      setModifierGroups(oldModifierGroups);
      throw error;
    }
  };

  const deleteModifier = async (id: string) => {
    const oldModifierGroups = modifierGroups;

    setModifierGroups((prev) =>
      prev.filter((item) => getMongoId(item) !== String(id))
    );

    try {
      await apiDelete("modifier-groups", id);
    } catch (error) {
      setModifierGroups(oldModifierGroups);
      throw error;
    }
  };

  const addUpsell = async (upsell: UpsellRule) => {
    const tempId = `temp-upsell-${Date.now()}`;
    const payload = normalizeUpsell(upsell);
    const optimisticUpsell = addTempId(payload, tempId);

    setUpsellRules((prev) => [optimisticUpsell, ...prev]);

    try {
      const savedUpsell = normalizeUpsell(
        await apiCreate<UpsellRule>("upsells", payload)
      );

      setUpsellRules((prev) => replaceTempOrMerge(prev, savedUpsell, tempId));

      return savedUpsell;
    } catch (error) {
      setUpsellRules((prev) =>
        prev.filter((item) => getMongoId(item) !== tempId)
      );
      throw error;
    }
  };

  const updateUpsell = async (upsell: UpsellRule) => {
    const payload = normalizeUpsell(upsell);
    const upsellId = getMongoId(payload);
    const oldUpsellRules = upsellRules;

    setUpsellRules((prev) =>
      prev.map((item) => (getMongoId(item) === upsellId ? payload : item))
    );

    try {
      const savedUpsell = normalizeUpsell(
        await apiUpdate<UpsellRule>("upsells", payload)
      );

      setUpsellRules((prev) => updateLocalItem(prev, savedUpsell));

      return savedUpsell;
    } catch (error) {
      setUpsellRules(oldUpsellRules);
      throw error;
    }
  };

  const deleteUpsell = async (id: string) => {
    const oldUpsellRules = upsellRules;

    setUpsellRules((prev) =>
      prev.filter((item) => getMongoId(item) !== String(id))
    );

    try {
      await apiDelete("upsells", id);
    } catch (error) {
      setUpsellRules(oldUpsellRules);
      throw error;
    }
  };

  return {
    isLoaded,

    products,
    categories,
    modifierGroups,
    upsellRules,

    addProduct,
    updateProduct,
    deleteProduct,

    addCategory,
    updateCategory,
    deleteCategory,

    addModifier,
    updateModifier,
    deleteModifier,

    addUpsell,
    updateUpsell,
    deleteUpsell,

    reloadMenu: () => loadMenu({ silent: true }),
  };
}
