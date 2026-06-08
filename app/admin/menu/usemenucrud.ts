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

type MongoItem = {
  _id?: string;
  id?: string;
  configId?: string;
  storeConfigId?: string;
  categoryId?: string;
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

  return String(obj._id || obj.id || obj.slug || obj.name || obj.offer || "");
}

function getCategoryDeleteIds(item: unknown): string[] {
  if (!item || typeof item !== "object") return [];

  const obj = item as MongoItem;

  return [
    obj.storeConfigId,
    obj.configId,
    obj._id,
    obj.id,
    obj.categoryId,
    obj.slug,
    obj.name,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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
      console.warn(`Failed to load ${type}`, json);
      return [];
    }

    return getArrayFromResponse<T>(json, type);
  } catch (error) {
    console.warn(`Failed to load ${type}`, error);
    return [];
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
    console.warn(`CREATE ${type} ERROR:`, json);
    throw new Error(json?.message || `Failed to create ${type}`);
  }

  return getItemFromResponse<T>(json, type, payload);
}

async function apiUpdate<T extends object>(
  type: MenuEntity,
  payload: T
): Promise<T> {
  const mongoId = getMongoId(payload);

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
    console.warn(`UPDATE ${type} ERROR:`, json);
    throw new Error(json?.message || `Failed to update ${type}`);
  }

  return getItemFromResponse<T>(json, type, payload);
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
    console.warn(`DELETE ${type} ERROR:`, json);
    throw new Error(json?.message || `Failed to delete ${type}`);
  }
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
    return String(value).trim();
  }

  if (typeof value === "object") {
    const obj = value as {
      _id?: string;
      id?: string;
      slug?: string;
      name?: string;
    };

    return String(obj.slug || obj._id || obj.id || obj.name || "").trim();
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
    relatedUpsells: safeArray<string>(obj.relatedUpsells),
    upsell: String(obj.upsell || ""),
    status: obj.status || "Active",
    sortOrder: Number(obj.sortOrder || 0),
  };
}

function getPrimaryStoreConfig(product: Product) {
  const configs = safeArray<unknown>((product as any).storeConfigs)
    .map((config) => normalizeStoreConfig(config, product))
    .filter(Boolean) as any[];

  return configs[0] || null;
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
    .filter(Boolean) as any[];

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
    relatedUpsells: safeArray<string>(sourceForStoreFields.relatedUpsells),
    upsell: String(sourceForStoreFields.upsell || ""),
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

function normalizeCategory(
  category: CategoryWithMultiStore
): CategoryWithMultiStore {
  return {
    ...category,
    storeId: String(category.storeId || "").trim(),
    sortOrder: Number(category.sortOrder || 1),
  };
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

function normalizeUpsell(upsell: UpsellRule): UpsellRule {
  const triggerCategoryId = String(
    (upsell as any).triggerCategoryId || ""
  ).trim();

  const triggerCategoryName = String(
    (upsell as any).triggerCategoryName ||
      safeArray<string>((upsell as any).appliesToCategories)[0] ||
      ""
  ).trim();

  const offerProductIds = safeArray<unknown>(
    (upsell as any).offerProductIds
  )
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return {
    ...upsell,
    triggerCategoryId,
    triggerCategoryName,
    offerProductIds,
    trigger:
      upsell.trigger ||
      (triggerCategoryName ? `Any ${triggerCategoryName}` : "Any Category Product"),
    offer:
      upsell.offer ||
      `${offerProductIds.length} offer product${
        offerProductIds.length === 1 ? "" : "s"
      }`,
    appliesToCategories: triggerCategoryName ? [triggerCategoryName] : [],
    status: upsell.status || "Active",
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

  const category = String(obj.categoryId || obj.category || "")
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

export function useMenuCrud() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [upsellRules, setUpsellRules] = useState<UpsellRule[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const firstLoadDone = useRef(false);

  const loadMenu = useCallback(async () => {
    if (!firstLoadDone.current) {
      setIsLoaded(false);
    }

    const [productsData, categoriesData, modifiersData, upsellsData] =
      await Promise.all([
        apiGet<Product>("products"),
        apiGet<Category>("categories"),
        apiGet<ModifierGroup>("modifier-groups"),
        apiGet<UpsellRule>("upsells"),
      ]);

    setProducts(productsData.map(normalizeProduct));
    setCategories(
      sortBySortOrder(categoriesData.map(normalizeCategory) as Category[])
    );
    setModifierGroups(modifiersData.map(normalizeModifier));
    setUpsellRules(upsellsData.map(normalizeUpsell));

    firstLoadDone.current = true;
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    loadMenu();
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

    setProducts((prev) =>
      prev.map((item) => (getMongoId(item) === productId ? payload : item))
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
    const storeIds = Array.isArray(category.storeIds)
      ? category.storeIds.filter(Boolean)
      : [];

    const targetStoreIds = Array.from(
      new Set(
        storeIds.length
          ? storeIds
          : ([category.storeId].filter(Boolean) as string[])
      )
    ) as string[];

    if (!targetStoreIds.length) {
      throw new Error("Please select at least one store.");
    }

    const baseCategory = { ...category };
    delete baseCategory.storeIds;

    const categoryPayloads: Category[] = [];

    targetStoreIds.forEach((storeId) => {
      const nextSortOrder = getNextCategorySortOrder(
        storeId,
        categories,
        categoryPayloads
      );

      categoryPayloads.push(
        normalizeCategory({
          ...baseCategory,
          storeId,
          sortOrder: nextSortOrder,
        }) as Category
      );
    });

    const tempCategories = categoryPayloads.map((payload, index) => {
      const tempId = `temp-category-${Date.now()}-${index}`;
      return addTempId(payload, tempId) as Category;
    });

    setCategories((prev) => sortBySortOrder([...prev, ...tempCategories]));

    try {
      const savedCategories = await Promise.all(
        categoryPayloads.map(async (payload, index) => {
          const savedCategory = normalizeCategory(
            await apiCreate<Category>("categories", payload)
          ) as Category;

          const tempId = getMongoId(tempCategories[index]);

          setCategories((prev) =>
            sortBySortOrder(replaceTempOrMerge(prev, savedCategory, tempId))
          );

          return savedCategory;
        })
      );

      return savedCategories;
    } catch (error) {
      const tempIds = tempCategories.map((item) => getMongoId(item));

      setCategories((prev) =>
        prev.filter((item) => !tempIds.includes(getMongoId(item)))
      );

      throw error;
    }
  };

  const updateCategory = async (category: Category) => {
    const payload = normalizeCategory(category) as Category;
    const categoryId = getMongoId(payload);
    const oldCategories = categories;

    setCategories((prev) =>
      sortBySortOrder(
        prev.map((item) => (getMongoId(item) === categoryId ? payload : item))
      )
    );

    try {
      const savedCategory = normalizeCategory(
        await apiUpdate<Category>("categories", payload)
      ) as Category;

      setCategories((prev) =>
        sortBySortOrder(updateLocalItem(prev, savedCategory))
      );

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

  // Instant frontend remove
  setCategories((prev) =>
    prev.filter((item: any) => {
      const itemIds = [
        getMongoId(item),
        item.storeConfigId,
        item.configId,
        item._id,
        item.id,
        item.categoryId,
        item.slug,
        item.name,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      return !itemIds.includes(cleanId);
    })
  );

  try {
    await apiDelete("categories", cleanId);

    // Final sync from database so UI updates without browser refresh
    const freshCategories = await apiGet<Category>("categories");

    setCategories(
      sortBySortOrder(freshCategories.map(normalizeCategory) as Category[])
    );
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

    reloadMenu: loadMenu,
  };
}