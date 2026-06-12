"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import type {
  Category,
  ModifierGroup,
  ModifierOption,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
  ProductRelatedUpsell,
  ProductSize,
  ProductStatus,
  UpsellRule,
} from "../menu/types";

import { FormInput, FormSelect } from "../menu/components/ui";
import ImageUploadBox from "../adminmenumodel/imageuploadbox";
import { normalizeStringArray } from "../utils/menuhelpers";

export type ProductFormRef = {
  submit: () => void;
};

type StoreItem = {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  status?: string;
};

type ProductWithStoreConfigs = Omit<
  Product,
  "relatedUpsells" | "storeConfigs"
> & {
  _id?: string;
  description?: string;
  tags?: string[];
  badge?: string;
  storeConfigs?: ProductStoreConfigState[];
  relatedUpsells?: ProductRelatedUpsell[];
};

type CategoryWithMongo = Category & {
  _id?: string;
  id?: string;
  slug?: string;
  storeId?: string;
  storeIds?: string[];
  storeConfigs?: Array<{
    storeId?: string;
    available?: boolean;
    status?: string;
    sortOrder?: number;
  }>;
};

type ModifierGroupWithMongo = ModifierGroup & {
  _id?: string;
};

type UpsellRuleWithCategories = UpsellRule & {
  _id?: string;
  name?: string;
  appliesToCategories?: string[];
};

type ProductStoreConfigState = {
  _id?: string;
  id?: string;
  productId?: string;
  storeId: string;
  storeName?: string;
  isAvailable: boolean;
  isPopular: boolean;
  category: string;
  categoryId: string;
  categoryName: string;
  price: number;
  sizes: ProductSize[];
  modifierGroups: ProductModifierGroup[];
  modifierGroupIds?: string[];
  relatedUpsells?: ProductRelatedUpsell[];
  upsell?: string;
  status: ProductStatus;
  sortOrder: number;
};

type ProductFormState = ProductWithStoreConfigs & {
  name: string;
  description?: string;
  image?: string;
  storeConfigs: ProductStoreConfigState[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Typing ke waqt decimal point preserve karta hai.
 * Example:
 * 10.  => 10.
 * 10.99 => 10.99
 * 10..99 => 10.99
 * -10 => 10
 */
function sanitizePositiveDecimalInput(value: unknown) {
  const raw = String(value ?? "");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDotIndex = cleaned.indexOf(".");

  if (firstDotIndex === -1) return cleaned;

  const beforeDot = cleaned.slice(0, firstDotIndex);
  const afterDot = cleaned.slice(firstDotIndex + 1).replace(/\./g, "");

  return `${beforeDot}.${afterDot}`;
}

/**
 * State ke liye string preserve karta hai, lekin type ProductSize.price number hai,
 * is liye cast use kiya gaya hai.
 */
function decimalInputState(value: unknown) {
  return sanitizePositiveDecimalInput(value) as unknown as number;
}

/**
 * Submit/calculation ke waqt final numeric value.
 */
function cleanNumber(value: unknown) {
  const cleaned = sanitizePositiveDecimalInput(value);
  const number = Number(cleaned || 0);

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, number);
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

function blockBadNumberKeys(event: KeyboardEvent<HTMLInputElement>) {
  if (["-", "+", "e", "E"].includes(event.key)) {
    event.preventDefault();
  }
}

function getInputValue(value: unknown) {
  return String(value ?? "");
}

function normalizePriceByMode(
  value: unknown,
  mode: "state" | "submit" = "state"
) {
  return mode === "submit" ? cleanNumber(value) : decimalInputState(value);
}

const SIZE_BASED_CATEGORY_KEYWORDS = [
  "pizza",
  "specialty pizza",
  "stromboli",
  "calzone",
  "hot sub",
  "cold sub",
  "seafood sub",
  "chicken",
  "wing",
];

function isSizeBasedProductCategory(value: unknown) {
  const name = String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .trim();

  return SIZE_BASED_CATEGORY_KEYWORDS.some((keyword) =>
    name.includes(keyword)
  );
}

function createRegularProductSize(price: unknown): ProductSize[] {
  return [
    {
      id: "regular",
      name: "Regular",
      price: decimalInputState(price),
      sortOrder: 0,
    },
  ];
}

function normalizeProductSizes(
  value: unknown,
  fallbackPrice: unknown
): ProductSize[] {
  const rawSizes = Array.isArray(value) ? value : [];

  const sizes = rawSizes
    .map((size: any, index) => {
      const name = String(size?.name ?? "").trim();

      if (!name) return null;

      return {
        id: String(size?.id || slugify(name) || `size-${index + 1}`),
        name,
        price: decimalInputState(size?.price),
        sortOrder: Number(size?.sortOrder ?? index),
      };
    })
    .filter(Boolean) as ProductSize[];

  if (sizes.length > 0) return sizes;

  return createRegularProductSize(fallbackPrice);
}

/**
 * Editing ke waqt size name ko trim/filter nahi karta.
 * Is se admin trailing space, middle space, aur empty text temporarily type kar sakta hai.
 * Submit ke waqt clean/validate alag hota hai.
 */
function normalizeProductSizesForEditing(
  value: unknown,
  fallbackPrice: unknown
): ProductSize[] {
  const rawSizes = Array.isArray(value) ? value : [];

  const sizes = rawSizes.map((size: any, index) => {
    const rawName = String(size?.name ?? "");

    return {
      id:
        String(size?.id || "").trim() ||
        slugify(rawName) ||
        `size-${index + 1}`,
      name: rawName,
      price: decimalInputState(size?.price),
      sortOrder: Number(size?.sortOrder ?? index),
    };
  }) as ProductSize[];

  if (sizes.length > 0) return sizes;

  return createRegularProductSize(fallbackPrice);
}

function getFirstSizePrice(value: unknown, fallbackPrice: unknown) {
  const sizes = normalizeProductSizes(value, fallbackPrice);
  return decimalInputState(sizes[0]?.price ?? fallbackPrice);
}

function getProductSizeNames(sizes: ProductSize[]) {
  return sizes
    .map((size) => String(size.name || "").trim())
    .filter(Boolean);
}

function normalizePricesBySize(
  value: unknown,
  sizes: ProductSize[],
  oldSizeName?: string,
  newSizeName?: string,
  mode: "state" | "submit" = "state"
) {
  const prices: Record<string, number> = {};

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, price]) => {
      const cleanKey = String(key || "").trim();

      if (!cleanKey) return;

      prices[cleanKey] = normalizePriceByMode(price, mode);
    });
  }

  const sizeNames = getProductSizeNames(sizes);

  sizeNames.forEach((sizeName) => {
    if (sizeName in prices) return;

    if (
      oldSizeName &&
      newSizeName &&
      sizeName === newSizeName.trim() &&
      oldSizeName.trim() in prices
    ) {
      prices[sizeName] = normalizePriceByMode(
        prices[oldSizeName.trim()],
        mode
      );
      return;
    }

    prices[sizeName] = mode === "submit" ? 0 : decimalInputState(0);
  });

  Object.keys(prices).forEach((key) => {
    if (!sizeNames.includes(key)) {
      delete prices[key];
    }
  });

  return prices;
}

function getStoreId(store: StoreItem | null | undefined) {
  if (!store) return "";
  return String(store.slug || store._id || store.id || "").trim();
}

function getStoreName(stores: StoreItem[], storeId: string) {
  const found = stores.find((store) => getStoreId(store) === storeId);
  return found?.name || storeId;
}

function getCategoryId(category?: CategoryWithMongo | null) {
  if (!category) return "";
  return String(category._id || category.id || category.slug || "").trim();
}

function categoryMatchesStore(category: CategoryWithMongo, storeId: string) {
  const cleanStoreId = String(storeId || "").trim();
  const storeConfigs = Array.isArray(category.storeConfigs)
    ? category.storeConfigs
    : [];

  if (storeConfigs.length > 0) {
    return storeConfigs.some((config) => {
      const configStoreId = String(config.storeId || "").trim();
      const available = config.available !== false && (config as any).isAvailable !== false;
      const active = config.status !== "Inactive" && config.status !== "Hidden";

      return configStoreId === cleanStoreId && available && active;
    });
  }

  const legacyStoreId = String(category.storeId || "").trim();

  if (legacyStoreId) {
    return legacyStoreId === cleanStoreId;
  }

  if (Array.isArray(category.storeIds) && category.storeIds.length > 0) {
    return category.storeIds
      .map((item) => String(item || "").trim())
      .includes(cleanStoreId);
  }

  return true;
}

function findSelectedCategory(
  categories: CategoryWithMongo[],
  value: unknown,
  categoryId?: unknown,
  categoryName?: unknown
) {
  const selectedValues = [value, categoryId, categoryName]
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);

  return categories.find((category) => {
    const categoryValues = [
      category._id,
      category.id,
      category.slug,
      category.name,
    ]
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);

    return selectedValues.some((item) => categoryValues.includes(item));
  });
}

function getCategoriesForStore(
  categories: CategoryWithMongo[],
  storeId: string
) {
  const uniqueByName = new Map<string, CategoryWithMongo>();

  categories.forEach((category) => {
    if (!categoryMatchesStore(category, storeId)) return;

    const cleanName = String(category.name || "").trim();
    if (!cleanName) return;

    const key = cleanName.toLowerCase();

    if (!uniqueByName.has(key)) {
      uniqueByName.set(key, category);
    }
  });

  return Array.from(uniqueByName.values()).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function getGlobalModifierGroupId(
  group: ModifierGroupWithMongo,
  fallback: string
) {
  return String(
    group._id || group.id || group.slug || group.name || fallback
  ).trim();
}

function getProductModifierGroupId(group: unknown) {
  if (!group || typeof group !== "object") return "";

  const obj = group as {
    modifierGroupId?: unknown;
    groupId?: unknown;
    _id?: unknown;
    id?: unknown;
    slug?: unknown;
  };

  return String(
    obj.modifierGroupId || obj.groupId || obj._id || obj.id || obj.slug || ""
  ).trim();
}

function getProductModifierGroupName(group: unknown) {
  if (typeof group === "string") return group.trim();
  if (!group || typeof group !== "object") return "";

  const obj = group as {
    name?: unknown;
    title?: unknown;
    label?: unknown;
    slug?: unknown;
  };

  return String(obj.name || obj.title || obj.label || obj.slug || "").trim();
}

function getModifierGroupKeys(group: unknown) {
  return [
    getProductModifierGroupId(group),
    getProductModifierGroupName(group),
  ]
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function findMatchingProductOption(
  existingOptions: unknown[],
  option: ModifierOption,
  fallback: string
) {
  const optionId = String(option.id || fallback).trim().toLowerCase();
  const optionName = String(option.name || "").trim().toLowerCase();

  return existingOptions.find((item) => {
    if (typeof item === "string") {
      return item.trim().toLowerCase() === optionName;
    }

    if (!item || typeof item !== "object") return false;

    const obj = item as {
      optionId?: unknown;
      id?: unknown;
      _id?: unknown;
      name?: unknown;
      label?: unknown;
      title?: unknown;
    };

    const values = [
      obj.optionId,
      obj.id,
      obj._id,
      obj.name,
      obj.label,
      obj.title,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);

    return values.includes(optionId) || values.includes(optionName);
  });
}

function getExistingOptionPrices(option: unknown) {
  if (!option || typeof option !== "object") return {};
  return (option as { pricesBySize?: unknown }).pricesBySize || {};
}

function createProductModifierGroupFromAssigned(
  assignedGroup: ModifierGroupWithMongo,
  sizes: ProductSize[],
  groupIndex: number,
  existingGroup?: unknown
): ProductModifierGroup {
  const groupId = getGlobalModifierGroupId(
    assignedGroup,
    `modifier-${groupIndex}`
  );

  const existingOptions =
    existingGroup && typeof existingGroup === "object"
      ? Array.isArray((existingGroup as any).options)
        ? (existingGroup as any).options
        : []
      : [];

  const options = Array.isArray(assignedGroup.options)
    ? assignedGroup.options
        .map((option, optionIndex) => {
          const optionName = String(option.name || "").trim();

          if (!optionName) return null;

          const fallbackOptionId =
            slugify(optionName) || `option-${optionIndex + 1}`;

          const existingOption = findMatchingProductOption(
            existingOptions,
            option,
            fallbackOptionId
          );

          return {
            id: String(option.id || fallbackOptionId),
            optionId: String(option.id || fallbackOptionId),
            name: optionName,
            status: option.status === "Inactive" ? "Inactive" : "Active",
            pricesBySize: normalizePricesBySize(
              getExistingOptionPrices(existingOption),
              sizes
            ),
          };
        })
        .filter(Boolean)
    : [];

  return {
    modifierGroupId: groupId,
    name: assignedGroup.name,
    required: Boolean(assignedGroup.required),
    minSelect: Number(assignedGroup.minSelect || 0),
    maxSelect: Number(assignedGroup.maxSelect || 0),
    sortOrder: Number(assignedGroup.sortOrder ?? groupIndex),
    status: assignedGroup.status === "Inactive" ? "Inactive" : "Active",
    options: options as ProductModifierOption[],
  };
}

function normalizeLegacyProductModifierGroup(
  group: unknown,
  sizes: ProductSize[],
  index: number
): ProductModifierGroup | null {
  if (typeof group === "string") {
    const name = group.trim();
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
  };

  const name = String(obj.name || "").trim();
  const modifierGroupId = String(
    obj.modifierGroupId || obj.groupId || obj._id || obj.id || ""
  ).trim();

  if (!name && !modifierGroupId) return null;

  const options = Array.isArray(obj.options)
    ? obj.options
        .map((option: any, optionIndex) => {
          if (typeof option === "string") {
            const optionName = option.trim();
            if (!optionName) return null;

            return {
              id: slugify(optionName) || `option-${optionIndex + 1}`,
              optionId: slugify(optionName) || `option-${optionIndex + 1}`,
              name: optionName,
              status: "Active",
              pricesBySize: normalizePricesBySize({}, sizes),
            };
          }

          if (!option || typeof option !== "object") return null;

          const optionName = String(option.name || "").trim();
          if (!optionName) return null;

          const optionId = String(
            option.optionId || option.id || slugify(optionName) || ""
          ).trim();

          return {
            id: String(option.id || optionId || `option-${optionIndex + 1}`),
            optionId,
            name: optionName,
            status: option.status === "Inactive" ? "Inactive" : "Active",
            pricesBySize: normalizePricesBySize(option.pricesBySize, sizes),
          };
        })
        .filter(Boolean)
    : [];

  return {
    modifierGroupId,
    name: name || modifierGroupId,
    required: Boolean(obj.required),
    minSelect: Number(obj.minSelect || 0),
    maxSelect: Number(obj.maxSelect || 0),
    sortOrder: Number(obj.sortOrder ?? index),
    status: obj.status === "Inactive" ? "Inactive" : "Active",
    options: options as ProductModifierOption[],
  };
}

function normalizeProductModifierGroups(
  value: unknown,
  sizes: ProductSize[],
  assignedGroups: ModifierGroupWithMongo[],
  defaultToAssignedGroups: boolean
) {
  const rawGroups = Array.isArray(value) ? value : [];

  const normalizedRawGroups = rawGroups
    .map((group, index) =>
      normalizeLegacyProductModifierGroup(group, sizes, index)
    )
    .filter(Boolean) as ProductModifierGroup[];

  if (normalizedRawGroups.length === 0 && defaultToAssignedGroups) {
    return assignedGroups.map((group, index) =>
      createProductModifierGroupFromAssigned(group, sizes, index)
    );
  }

  if (assignedGroups.length === 0) {
    return normalizedRawGroups;
  }

  return normalizedRawGroups.map((existingGroup, index) => {
    const matchedAssignedGroup = assignedGroups.find((assignedGroup) => {
      const fallback = `modifier-${index}`;
      const assignedId = getGlobalModifierGroupId(
        assignedGroup,
        fallback
      ).toLowerCase();
      const assignedName = String(assignedGroup.name || "")
        .trim()
        .toLowerCase();
      const existingKeys = getModifierGroupKeys(existingGroup);

      return (
        existingKeys.includes(assignedId) ||
        existingKeys.includes(assignedName)
      );
    });

    if (!matchedAssignedGroup) {
      return {
        ...existingGroup,
        options: existingGroup.options.map((option) => ({
          ...option,
          pricesBySize: normalizePricesBySize(option.pricesBySize, sizes),
        })),
      };
    }

    return createProductModifierGroupFromAssigned(
      matchedAssignedGroup,
      sizes,
      index,
      existingGroup
    );
  });
}

function getAssignmentStoreId(assignment: unknown) {
  if (!assignment || typeof assignment !== "object") return "";

  const obj = assignment as {
    storeId?: unknown;
    storeSlug?: unknown;
    store?: unknown;
  };

  return String(obj.storeId || obj.storeSlug || obj.store || "").trim();
}

const ALL_CATEGORY_ASSIGNMENT_KEYS = new Set([
  "all",
  "all-categories",
  "all-category",
  "every-category",
  "any-category",
  "*",
]);

function normalizeCategoryMatchValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9*]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isAllCategoryAssignmentValue(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  const normalized = normalizeCategoryMatchValue(value);

  return (
    ALL_CATEGORY_ASSIGNMENT_KEYS.has(raw) ||
    ALL_CATEGORY_ASSIGNMENT_KEYS.has(normalized)
  );
}

function assignmentMatchesCategory(
  assignment: unknown,
  categoryId: string,
  categoryName: string
) {
  if (!assignment || typeof assignment !== "object") return false;

  const obj = assignment as {
    categoryId?: unknown;
    category?: unknown;
    categoryName?: unknown;
    appliesTo?: unknown;
  };

  const assignmentValues = [
    obj.categoryId,
    obj.category,
    obj.categoryName,
    obj.appliesTo,
  ]
    .map((item) => normalizeCategoryMatchValue(item))
    .filter(Boolean);

  if (assignmentValues.some((value) => isAllCategoryAssignmentValue(value))) {
    return true;
  }

  const categoryValues = [categoryId, categoryName]
    .map((item) => normalizeCategoryMatchValue(item))
    .filter(Boolean);

  return categoryValues.some((value) => assignmentValues.includes(value));
}

function getAssignedModifierGroups(
  modifierGroups: ModifierGroupWithMongo[],
  selectedStoreId: string,
  categoryId: string,
  categoryName: string
) {
  const cleanStoreId = String(selectedStoreId || "").trim();

  if (!cleanStoreId || (!categoryId && !categoryName)) return [];

  return modifierGroups
    .filter((group) => {
      if (group.status === "Inactive") return false;

      const assignments = Array.isArray(group.assignments)
        ? group.assignments
        : [];

      if (assignments.length > 0) {
        return assignments.some((assignment) => {
          if (assignment.status === "Inactive") return false;

          const storeId = getAssignmentStoreId(assignment);

          const storeMatch =
            storeId === cleanStoreId ||
            storeId.toLowerCase() === cleanStoreId.toLowerCase();

          return (
            storeMatch &&
            assignmentMatchesCategory(assignment, categoryId, categoryName)
          );
        });
      }

      const legacyStoreId = String((group as any).storeId || "").trim();

      const storeMatch =
        !legacyStoreId ||
        legacyStoreId === cleanStoreId ||
        legacyStoreId.toLowerCase() === cleanStoreId.toLowerCase();

      const legacyCategoryValues = [
        (group as any).categoryId,
        (group as any).category,
        (group as any).categoryName,
        (group as any).appliesTo,
        ...(Array.isArray((group as any).appliesToCategories)
          ? (group as any).appliesToCategories
          : []),
      ]
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean);

      const selectedCategoryValues = [categoryId, categoryName]
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean);

      const categoryMatch =
        legacyCategoryValues.length === 0 ||
        legacyCategoryValues.some((value) => isAllCategoryAssignmentValue(value)) ||
        selectedCategoryValues.some((value) =>
          legacyCategoryValues.includes(value)
        );

      return storeMatch && categoryMatch;
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function syncModifierGroupsWithSizes(
  groups: ProductModifierGroup[],
  sizes: ProductSize[],
  oldSizeName?: string,
  newSizeName?: string
) {
  return groups.map((group) => ({
    ...group,
    options: group.options.map((option) => ({
      ...option,
      pricesBySize: normalizePricesBySize(
        option.pricesBySize,
        sizes,
        oldSizeName,
        newSizeName
      ),
    })),
  }));
}

function getGroupSelected(
  selectedGroups: ProductModifierGroup[],
  assignedGroup: ModifierGroupWithMongo,
  fallback: string
) {
  const groupId = getGlobalModifierGroupId(
    assignedGroup,
    fallback
  ).toLowerCase();
  const groupName = String(assignedGroup.name || "").trim().toLowerCase();

  return selectedGroups.some((group) => {
    const keys = getModifierGroupKeys(group);
    return keys.includes(groupId) || keys.includes(groupName);
  });
}

function getSelectedProductGroup(
  selectedGroups: ProductModifierGroup[],
  assignedGroup: ModifierGroupWithMongo,
  fallback: string
) {
  const groupId = getGlobalModifierGroupId(
    assignedGroup,
    fallback
  ).toLowerCase();
  const groupName = String(assignedGroup.name || "").trim().toLowerCase();

  return selectedGroups.find((group) => {
    const keys = getModifierGroupKeys(group);
    return keys.includes(groupId) || keys.includes(groupName);
  });
}

function cleanProductSizesForSubmit(sizes: ProductSize[], fallbackPrice: number) {
  return normalizeProductSizes(sizes, fallbackPrice).map((size, index) => ({
    ...size,
    id: String(size.id || slugify(size.name) || `size-${index + 1}`),
    name: String(size.name || "").trim(),
    price: cleanNumber(size.price),
    sortOrder: Number(size.sortOrder ?? index),
  }));
}

function cleanProductModifierGroupsForSubmit(
  groups: ProductModifierGroup[],
  sizes: ProductSize[]
) {
  return groups
    .map((group, groupIndex) => {
      const name = String(group.name || "").trim();

      if (!name) return null;

      return {
        modifierGroupId: String(group.modifierGroupId || "").trim(),
        name,
        required: Boolean(group.required),
        minSelect: Number(group.minSelect || 0),
        maxSelect: Number(group.maxSelect || 0),
        sortOrder: Number(group.sortOrder ?? groupIndex),
        status: group.status === "Inactive" ? "Inactive" : "Active",
        options: Array.isArray(group.options)
          ? group.options
              .map((option, optionIndex) => {
                const optionName = String(option.name || "").trim();

                if (!optionName) return null;

                return {
                  id:
                    String(option.id || "").trim() ||
                    slugify(optionName) ||
                    `option-${optionIndex + 1}`,
                  optionId:
                    String(option.optionId || option.id || "").trim() ||
                    slugify(optionName) ||
                    `option-${optionIndex + 1}`,
                  name: optionName,
                  status: option.status === "Inactive" ? "Inactive" : "Active",
                  pricesBySize: normalizePricesBySize(
                    option.pricesBySize,
                    sizes,
                    undefined,
                    undefined,
                    "submit"
                  ),
                };
              })
              .filter(Boolean)
          : [],
      };
    })
    .filter(Boolean);
}

function findConfigForStore(configs: ProductStoreConfigState[], storeId: string) {
  return configs.find(
    (config) =>
      String(config.storeId || "").trim() === String(storeId || "").trim()
  );
}

function getProductRecordId(product: unknown) {
  if (!product || typeof product !== "object") return "";

  const obj = product as { _id?: unknown; id?: unknown; productId?: unknown };
  return String(obj._id || obj.id || obj.productId || "").trim();
}

function productNameKey(value: unknown) {
  return slugify(String(value || "").trim());
}

async function productNameAlreadyExists(name: string, currentProductId?: string) {
  const cleanName = String(name || "").trim();
  if (!cleanName || typeof window === "undefined") return false;

  try {
    const response = await fetch(
      `/api/admin/menu/products?search=${encodeURIComponent(cleanName)}`,
      { cache: "no-store" }
    );

    if (!response.ok) return false;

    const json = await response.json();
    const products = Array.isArray(json?.data) ? json.data : [];
    const currentId = String(currentProductId || "").trim();
    const targetNameKey = productNameKey(cleanName);

    return products.some((product: any) => {
      const productId = getProductRecordId(product);
      const sameRecord = currentId && productId === currentId;
      if (sameRecord) return false;

      const productKey = productNameKey(product?.name || product?.slug);
      return productKey === targetNameKey;
    });
  } catch (error) {
    return false;
  }
}

function getUpsellId(rule: UpsellRuleWithCategories, fallback: string) {
  return String(rule._id || rule.id || rule.slug || fallback).trim();
}

function getUpsellName(rule: UpsellRuleWithCategories) {
  return String(rule.name || rule.offer || rule.slug || "Upsell Offer").trim();
}

function findUpsellRuleById(
  upsellRules: UpsellRuleWithCategories[],
  upsellId: string
) {
  const cleanId = String(upsellId || "").trim().toLowerCase();

  return upsellRules.find((rule, index) => {
    const ruleId = getUpsellId(rule, `upsell-${index}`).toLowerCase();
    return ruleId === cleanId;
  });
}

function normalizeProductRelatedUpsells(
  value: unknown,
  upsellRules: UpsellRuleWithCategories[] = [],
  mode: "state" | "submit" = "state"
): ProductRelatedUpsell[] {
  const rawUpsells = Array.isArray(value) ? value : [];

  const normalized = rawUpsells
    .map((item, index) => {
      if (typeof item === "string") {
        const upsellId = item.trim();
        if (!upsellId) return null;

        const matchedRule = findUpsellRuleById(upsellRules, upsellId);

        return {
          upsellId,
          name: matchedRule ? getUpsellName(matchedRule) : upsellId,
          price: mode === "submit" ? 0 : decimalInputState(0),
        };
      }

      if (!item || typeof item !== "object") return null;

      const obj = item as {
        upsellId?: unknown;
        id?: unknown;
        _id?: unknown;
        name?: unknown;
        offer?: unknown;
        price?: unknown;
      };

      const upsellId = String(
        obj.upsellId || obj.id || obj._id || `upsell-${index}`
      ).trim();

      if (!upsellId) return null;

      const matchedRule = findUpsellRuleById(upsellRules, upsellId);

      const name =
        String(obj.name || obj.offer || "").trim() ||
        (matchedRule ? getUpsellName(matchedRule) : upsellId);

      return {
        upsellId,
        name,
        price: normalizePriceByMode(obj.price, mode),
      };
    })
    .filter(Boolean) as ProductRelatedUpsell[];

  const unique = new Map<string, ProductRelatedUpsell>();

  normalized.forEach((upsell) => {
    if (!upsell.upsellId) return;
    unique.set(upsell.upsellId, upsell);
  });

  return Array.from(unique.values());
}

function getSelectedRelatedUpsell(
  relatedUpsells: ProductRelatedUpsell[] | undefined,
  upsellId: string
) {
  return (relatedUpsells || []).find(
    (item) =>
      String(item.upsellId || "").trim() === String(upsellId || "").trim()
  );
}

function upsellMatchesStoreAndCategory(params: {
  rule: UpsellRuleWithCategories;
  storeId: string;
  categoryId: string;
  categoryName: string;
  category: string;
}) {
  const { rule, storeId, categoryId, categoryName, category } = params;

  if (rule.status === "Paused" || rule.status === "Inactive") return false;

  const cleanStoreId = String(storeId || "").trim();
  const categoryValues = [categoryId, categoryName, category]
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);

  const storeConfigs = Array.isArray(rule.storeConfigs)
    ? rule.storeConfigs
    : [];

  if (storeConfigs.length > 0) {
    return storeConfigs.some((config) => {
      const configStoreId = String(config.storeId || "").trim();
      const storeMatch =
        configStoreId === cleanStoreId ||
        configStoreId.toLowerCase() === cleanStoreId.toLowerCase();

      const active =
        config.available !== false &&
        config.status !== "Inactive" &&
        config.status !== "Paused";

      const configCategoryValues = [config.categoryId, config.categoryName]
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean);

      const categoryMatch =
        configCategoryValues.length === 0 ||
        categoryValues.some((value) => configCategoryValues.includes(value));

      return storeMatch && active && categoryMatch;
    });
  }

  const selectedCategories = Array.isArray(rule.appliesToCategories)
    ? rule.appliesToCategories
    : [];

  if (selectedCategories.length > 0) {
    const cleanSelectedCategories = selectedCategories.map((item) =>
      String(item || "").trim().toLowerCase()
    );

    return categoryValues.some((value) =>
      cleanSelectedCategories.includes(value)
    );
  }

  const trigger = String(rule.trigger || "").toLowerCase();
  const currentCategory = String(categoryName || category || "").toLowerCase();

  return (
    trigger.includes("all") ||
    trigger.includes("any") ||
    trigger.includes(currentCategory) ||
    trigger.includes(currentCategory.replace(/s$/, ""))
  );
}

function normalizeStoreConfig(params: {
  rawConfig?: any;
  storeId: string;
  storeName?: string;
  categories: CategoryWithMongo[];
  modifierGroups: ModifierGroupWithMongo[];
  upsellRules: UpsellRuleWithCategories[];
  selectedStoreId: string;
  legacyProduct?: any;
  isNewProduct: boolean;
}): ProductStoreConfigState {
  const raw = params.rawConfig || {};
  const legacy = params.legacyProduct || {};
  const useLegacy = !params.rawConfig && legacy.storeId === params.storeId;

  const categorySource = useLegacy ? legacy : raw;
  const storeCategories = getCategoriesForStore(params.categories, params.storeId);
  const matchedCategory = findSelectedCategory(
    storeCategories,
    categorySource.category,
    categorySource.categoryId,
    categorySource.categoryName
  );

  const categoryId =
    getCategoryId(matchedCategory) ||
    String(categorySource.categoryId || "").trim();

  const categoryName =
    matchedCategory?.name ||
    String(categorySource.categoryName || categorySource.category || "").trim();

  const price = decimalInputState(useLegacy ? legacy.price : raw.price);
  const sizes = normalizeProductSizes(useLegacy ? legacy.sizes : raw.sizes, price);

  const assignedGroups = getAssignedModifierGroups(
    params.modifierGroups,
    params.storeId,
    categoryId,
    categoryName
  );

  const isAvailable = params.rawConfig
    ? raw.isAvailable !== false && raw.available !== false
    : params.isNewProduct
    ? params.storeId === params.selectedStoreId
    : useLegacy;

  return {
    _id: raw._id,
    id: raw.id,
    productId: raw.productId,
    storeId: params.storeId,
    storeName: params.storeName,
    isAvailable,
    isPopular: cleanBoolean(
      raw.isPopular,
      cleanBoolean(raw.showInPopular, useLegacy ? cleanBoolean(legacy.isPopular) : false)
    ),
    category: categoryId || categoryName,
    categoryId,
    categoryName,
    price: decimalInputState(sizes[0]?.price ?? price ?? 0),
    sizes,
    modifierGroups: normalizeProductModifierGroups(
      useLegacy ? legacy.modifierGroups : raw.modifierGroups,
      sizes,
      assignedGroups,
      false
    ),
    modifierGroupIds: normalizeStringArray(
      useLegacy ? legacy.modifierGroupIds : raw.modifierGroupIds
    ),
    relatedUpsells: normalizeProductRelatedUpsells(
      useLegacy ? legacy.relatedUpsells : raw.relatedUpsells,
      params.upsellRules
    ),
    upsell: String(useLegacy ? legacy.upsell || "" : raw.upsell || ""),
    status: (raw.status || legacy.status || "Active") as ProductStatus,
    sortOrder: Number(raw.sortOrder ?? legacy.sortOrder ?? 0),
  };
}

function buildStoreConfigs(params: {
  item: ProductWithStoreConfigs | null;
  stores: StoreItem[];
  categories: CategoryWithMongo[];
  modifierGroups: ModifierGroupWithMongo[];
  upsellRules: UpsellRuleWithCategories[];
  selectedStoreId: string;
}) {
  const rawConfigs = Array.isArray(params.item?.storeConfigs)
    ? params.item?.storeConfigs || []
    : [];

  const baseStores = params.stores.length
    ? params.stores
    : [
        {
          id: params.selectedStoreId || params.item?.storeId || "towson",
          slug: params.selectedStoreId || params.item?.storeId || "towson",
          name: params.selectedStoreId || params.item?.storeId || "Towson",
        },
      ];

  return baseStores.map((store) => {
    const storeId = getStoreId(store);
    const rawConfig = rawConfigs.find(
      (config) => String(config.storeId || "").trim() === storeId
    );

    return normalizeStoreConfig({
      rawConfig,
      storeId,
      storeName: store.name,
      categories: params.categories,
      modifierGroups: params.modifierGroups,
      upsellRules: params.upsellRules,
      selectedStoreId: params.selectedStoreId || getStoreId(baseStores[0]),
      legacyProduct: params.item,
      isNewProduct: !params.item,
    });
  });
}

type ProductFormProps = {
  item: Product | null;
  categories: Category[];
  modifierGroups: ModifierGroup[];
  upsellRules?: UpsellRule[];
  selectedStoreId?: string;
  stores?: StoreItem[];
  onSave: (value: any) => void;
};

const ProductForm = forwardRef<ProductFormRef, ProductFormProps>(
  function ProductForm(
    {
      item,
      categories,
      modifierGroups,
      upsellRules = [],
      selectedStoreId = "",
      stores = [],
      onSave,
    },
    ref
  ) {
    const safeCategories = Array.isArray(categories)
      ? (categories as CategoryWithMongo[])
      : [];

    const safeModifierGroups = Array.isArray(modifierGroups)
      ? (modifierGroups as ModifierGroupWithMongo[])
      : [];

    const safeUpsellRules = Array.isArray(upsellRules)
      ? (upsellRules as UpsellRuleWithCategories[])
      : [];

    const safeStores = Array.isArray(stores) ? stores : [];

    const [form, setForm] = useState<ProductFormState>(() => {
      const product = item as ProductWithStoreConfigs | null;
      const storeConfigs = buildStoreConfigs({
        item: product,
        stores: safeStores,
        categories: safeCategories,
        modifierGroups: safeModifierGroups,
        upsellRules: safeUpsellRules,
        selectedStoreId,
      });

      const firstActiveConfig =
        storeConfigs.find((config) => config.isAvailable) || storeConfigs[0];

      return {
        ...(product || ({} as ProductWithStoreConfigs)),
        id: product?.id || "",
        _id: product?._id,
        storeId: firstActiveConfig?.storeId || selectedStoreId,
        name: product?.name || "",
        description: product?.description || "",
        image: product?.image || "",
        tags: Array.isArray(product?.tags) ? product?.tags : [],
        badge: product?.badge || "",
        category: firstActiveConfig?.category || "",
        categoryId: firstActiveConfig?.categoryId || "",
        categoryName: firstActiveConfig?.categoryName || "",
        price: firstActiveConfig?.price || decimalInputState(0),
        sizes: firstActiveConfig?.sizes || createRegularProductSize(0),
        modifierGroups: firstActiveConfig?.modifierGroups || [],
        modifierGroupIds: firstActiveConfig?.modifierGroupIds || [],
        relatedUpsells: firstActiveConfig?.relatedUpsells || [],
        upsell: firstActiveConfig?.upsell || "",
        status: (firstActiveConfig?.status || "Active") as ProductStatus,
        updatedAt: product?.updatedAt || "Today",
        storeConfigs,
      };
    });

    const activeStoreConfigs = useMemo(
      () => form.storeConfigs.filter((config) => config.isAvailable),
      [form.storeConfigs]
    );

    const [activeStoreId, setActiveStoreId] = useState(() => {
      const firstAvailable = form.storeConfigs.find(
        (config) => config.isAvailable
      );

      return (
        firstAvailable?.storeId ||
        form.storeConfigs[0]?.storeId ||
        selectedStoreId ||
        ""
      );
    });

    const [expandedModifierKey, setExpandedModifierKey] = useState("");

    const activeStoreConfig = useMemo(() => {
      return (
        findConfigForStore(form.storeConfigs, activeStoreId) ||
        form.storeConfigs.find((config) => config.isAvailable) ||
        form.storeConfigs[0] ||
        null
      );
    }, [activeStoreId, form.storeConfigs]);

    const toggleStoreAvailability = (storeId: string) => {
      setForm((prev) => ({
        ...prev,
        storeConfigs: prev.storeConfigs.map((config) =>
          config.storeId === storeId
            ? { ...config, isAvailable: !config.isAvailable }
            : config
        ),
      }));
    };

    const updateStoreConfig = (
      storeId: string,
      updater: (config: ProductStoreConfigState) => ProductStoreConfigState
    ) => {
      setForm((prev) => ({
        ...prev,
        storeConfigs: prev.storeConfigs.map((config) =>
          config.storeId === storeId ? updater(config) : config
        ),
      }));
    };

    const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Please upload a valid image file.");
        event.target.value = "";
        return;
      }

      const maxSize = 1.5 * 1024 * 1024;

      if (file.size > maxSize) {
        alert("Image is too large. Please upload an image under 1.5MB.");
        event.target.value = "";
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result !== "string") return;

        setForm((prev) => ({
          ...prev,
          image: reader.result as string,
        }));
      };

      reader.readAsDataURL(file);
      event.target.value = "";
    };

    const handleCategoryChange = (storeId: string, value: string) => {
      const storeCategories = getCategoriesForStore(safeCategories, storeId);
      const selectedCategory = findSelectedCategory(storeCategories, value);
      const selectedCategoryId = getCategoryId(selectedCategory);
      const selectedCategoryName = selectedCategory?.name || value;
      const nextCategoryUsesSizes =
        isSizeBasedProductCategory(selectedCategoryName);

      updateStoreConfig(storeId, (config) => {
        const currentSizes = normalizeProductSizesForEditing(
          config.sizes,
          config.price
        );
        const nextBasePrice = getFirstSizePrice(currentSizes, config.price);
        const nextSizes = nextCategoryUsesSizes
          ? currentSizes
          : createRegularProductSize(nextBasePrice);

        const nextAssignedGroups = getAssignedModifierGroups(
          safeModifierGroups,
          storeId,
          selectedCategoryId,
          selectedCategoryName
        );

        return {
          ...config,
          category: selectedCategoryId || selectedCategoryName,
          categoryId: selectedCategoryId,
          categoryName: selectedCategoryName,
          price: decimalInputState(nextSizes[0]?.price ?? 0),
          sizes: nextSizes,
          relatedUpsells: [],
          modifierGroups: normalizeProductModifierGroups(
            [],
            nextSizes,
            nextAssignedGroups,
            false
          ),
          modifierGroupIds: [],
        };
      });
    };

    const updateSize = (
      storeId: string,
      index: number,
      field: "name" | "price",
      value: string
    ) => {
      updateStoreConfig(storeId, (config) => {
        const currentSizes = normalizeProductSizesForEditing(
          config.sizes,
          config.price
        );

        const oldSizeName = currentSizes[index]?.name || "";

        const nextSizes = currentSizes.map((size, sizeIndex) => {
          if (sizeIndex !== index) return size;

          if (field === "name") {
            return {
              ...size,
              name: value,
            };
          }

          return {
            ...size,
            price: decimalInputState(value),
          };
        });

        const nextPrice =
          index === 0 && field === "price"
            ? decimalInputState(value)
            : decimalInputState(nextSizes[0]?.price ?? config.price ?? 0);

        return {
          ...config,
          price: nextPrice,
          sizes: nextSizes,
          modifierGroups: syncModifierGroupsWithSizes(
            config.modifierGroups,
            nextSizes,
            oldSizeName,
            field === "name" ? value : oldSizeName
          ),
        };
      });
    };

    const addSize = (storeId: string) => {
      updateStoreConfig(storeId, (config) => {
        const currentSizes = normalizeProductSizesForEditing(
          config.sizes,
          config.price
        );
        const nextIndex = currentSizes.length + 1;
        const newSizeName = `Size ${nextIndex}`;

        const nextSizes = [
          ...currentSizes,
          {
            id: `size-${Date.now()}-${nextIndex}`,
            name: newSizeName,
            price: decimalInputState(0),
            sortOrder: currentSizes.length,
          },
        ];

        return {
          ...config,
          sizes: nextSizes,
          modifierGroups: syncModifierGroupsWithSizes(
            config.modifierGroups,
            nextSizes
          ),
        };
      });
    };

    const removeSize = (storeId: string, index: number) => {
      updateStoreConfig(storeId, (config) => {
        const currentSizes = normalizeProductSizesForEditing(
          config.sizes,
          config.price
        );

        if (currentSizes.length <= 1) {
          alert("At least one size is required.");
          return config;
        }

        const nextSizes = currentSizes.filter(
          (_, sizeIndex) => sizeIndex !== index
        );

        return {
          ...config,
          price: decimalInputState(nextSizes[0]?.price ?? 0),
          sizes: nextSizes,
          modifierGroups: syncModifierGroupsWithSizes(
            config.modifierGroups,
            nextSizes
          ),
        };
      });
    };

    const toggleModifier = (
      storeId: string,
      group: ModifierGroupWithMongo,
      index: number,
      sizes: ProductSize[]
    ) => {
      updateStoreConfig(storeId, (config) => {
        const selected = getGroupSelected(
          config.modifierGroups,
          group,
          `modifier-${index}`
        );

        if (selected) {
          const groupId = getGlobalModifierGroupId(
            group,
            `modifier-${index}`
          ).toLowerCase();

          const groupName = String(group.name || "").trim().toLowerCase();

          return {
            ...config,
            modifierGroups: config.modifierGroups.filter((item) => {
              const keys = getModifierGroupKeys(item);
              return !keys.includes(groupId) && !keys.includes(groupName);
            }),
          };
        }

        const nextGroup = createProductModifierGroupFromAssigned(
          group,
          sizes,
          index
        );

        return {
          ...config,
          modifierGroups: [...config.modifierGroups, nextGroup],
        };
      });
    };

    const updateModifierOptionPrice = (
      storeId: string,
      groupIndex: number,
      optionIndex: number,
      sizeName: string,
      value: string
    ) => {
      updateStoreConfig(storeId, (config) => {
        const nextGroups = config.modifierGroups.map(
          (group, currentGroupIndex) => {
            if (currentGroupIndex !== groupIndex) return group;

            return {
              ...group,
              options: group.options.map((option, currentOptionIndex) => {
                if (currentOptionIndex !== optionIndex) return option;

                return {
                  ...option,
                  pricesBySize: {
                    ...option.pricesBySize,
                    [sizeName.trim()]: decimalInputState(value),
                  },
                };
              }),
            };
          }
        );

        return {
          ...config,
          modifierGroups: nextGroups,
        };
      });
    };

    const toggleUpsell = (
      storeId: string,
      rule: UpsellRuleWithCategories,
      fallback: string
    ) => {
      const upsellId = getUpsellId(rule, fallback);
      const upsellName = getUpsellName(rule);

      updateStoreConfig(storeId, (config) => {
        const current = normalizeProductRelatedUpsells(
          config.relatedUpsells,
          safeUpsellRules
        );

        const exists = current.some((item) => item.upsellId === upsellId);

        return {
          ...config,
          relatedUpsells: exists
            ? current.filter((item) => item.upsellId !== upsellId)
            : [
                ...current,
                {
                  upsellId,
                  name: upsellName,
                  price: decimalInputState(0),
                },
              ],
        };
      });
    };

    const updateUpsellPrice = (
      storeId: string,
      upsellId: string,
      value: string
    ) => {
      updateStoreConfig(storeId, (config) => {
        const current = normalizeProductRelatedUpsells(
          config.relatedUpsells,
          safeUpsellRules
        );

        return {
          ...config,
          relatedUpsells: current.map((item) =>
            item.upsellId === upsellId
              ? {
                  ...item,
                  price: decimalInputState(value),
                }
              : item
          ),
        };
      });
    };

    const WIZARD_STEPS = [
      { key: "basic", label: "Details", description: "Name/description" },
      { key: "stores", label: "Stores", description: "Availability" },
      { key: "pricing", label: "Pricing", description: "Sizes/prices" },
      { key: "extras", label: "Extras", description: "Upsells/modifiers" },
      { key: "review", label: "Review", description: "Save" },
    ] as const;

    type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

    type StepValidationError = {
      step: WizardStepKey;
      message: string;
      storeId?: string;
    };

    const [wizardStep, setWizardStep] = useState<WizardStepKey>("basic");
    const [stepError, setStepError] = useState("");

    const wizardStepIndex = Math.max(
      WIZARD_STEPS.findIndex((step) => step.key === wizardStep),
      0
    );

    const getStoreLabel = (config: ProductStoreConfigState) =>
      config.storeName || getStoreName(safeStores, config.storeId) || config.storeId;

    const getSelectedCategoryNameForConfig = (
      config: ProductStoreConfigState
    ) => {
      const selectedCategory = findSelectedCategory(
        safeCategories,
        config.category,
        config.categoryId,
        config.categoryName
      );

      return (
        selectedCategory?.name ||
        String(config.categoryName || config.category || "").trim()
      );
    };

    const getStepValidationError = (
      step: WizardStepKey
    ): StepValidationError | null => {
      if (step === "basic") {
        if (!form.name.trim()) {
          return {
            step: "basic",
            message: "Product name required.",
          };
        }

        if (!String(form.description || "").trim()) {
          return {
            step: "basic",
            message: "Product description required.",
          };
        }

        return null;
      }

      if (step === "stores") {
        if (activeStoreConfigs.length === 0) {
          return {
            step: "stores",
            message: "Select at least one store for this product.",
          };
        }

        for (const config of activeStoreConfigs) {
          const selectedCategoryName = getSelectedCategoryNameForConfig(config);

          if (!selectedCategoryName) {
            return {
              step: "stores",
              storeId: config.storeId,
              message: `Category required for ${getStoreLabel(config)} store.`,
            };
          }
        }

        return null;
      }

      if (step === "pricing") {
        for (const config of activeStoreConfigs) {
          const selectedCategoryName = getSelectedCategoryNameForConfig(config);

          if (!selectedCategoryName) {
            return {
              step: "stores",
              storeId: config.storeId,
              message: `Category required for ${getStoreLabel(config)} store.`,
            };
          }

          const categoryUsesSizes = isSizeBasedProductCategory(
            selectedCategoryName || config.category
          );

          const editableSizes = categoryUsesSizes
            ? normalizeProductSizesForEditing(config.sizes, config.price)
            : createRegularProductSize(
                getFirstSizePrice(config.sizes, config.price)
              );

          if (categoryUsesSizes) {
            if (editableSizes.length === 0) {
              return {
                step: "pricing",
                storeId: config.storeId,
                message: `At least one size is required for ${getStoreLabel(
                  config
                )} store.`,
              };
            }

            const sizeNames = editableSizes.map((size) =>
              String(size.name || "").trim()
            );

            if (sizeNames.some((name) => !name)) {
              return {
                step: "pricing",
                storeId: config.storeId,
                message: `Size name required for ${getStoreLabel(config)} store.`,
              };
            }

            const uniqueSizeNames = new Set(
              sizeNames.map((name) => name.toLowerCase())
            );

            if (sizeNames.length !== uniqueSizeNames.size) {
              return {
                step: "pricing",
                storeId: config.storeId,
                message: `Size names must be unique for ${getStoreLabel(
                  config
                )} store.`,
              };
            }

            const invalidSize = editableSizes.find(
              (size) => cleanNumber(size.price) <= 0
            );

            if (invalidSize) {
              return {
                step: "pricing",
                storeId: config.storeId,
                message: `Price required for ${String(
                  invalidSize.name || "size"
                ).trim()} in ${getStoreLabel(config)} store.`,
              };
            }
          } else {
            const basePrice = getFirstSizePrice(config.sizes, config.price);

            if (cleanNumber(basePrice) <= 0) {
              return {
                step: "pricing",
                storeId: config.storeId,
                message: `Base price required for ${getStoreLabel(config)} store.`,
              };
            }
          }
        }

        return null;
      }

      if (step === "extras") {
        for (const config of activeStoreConfigs) {
          const relatedUpsells = normalizeProductRelatedUpsells(
            config.relatedUpsells,
            safeUpsellRules
          );

          const invalidUpsell = relatedUpsells.find(
            (upsell) => cleanNumber(upsell.price) <= 0
          );

          if (invalidUpsell) {
            return {
              step: "extras",
              storeId: config.storeId,
              message: `Upsell price required for ${invalidUpsell.name} in ${getStoreLabel(
                config
              )} store.`,
            };
          }
        }

        return null;
      }

      return null;
    };

    const validateWizardStepsBeforeIndex = (targetIndex: number) => {
      for (let index = 0; index < targetIndex; index += 1) {
        const step = WIZARD_STEPS[index];
        if (!step || step.key === "review") continue;

        const validationError = getStepValidationError(step.key);
        if (validationError) return validationError;
      }

      return null;
    };

    const handleStepValidationFailure = (error: StepValidationError) => {
      setStepError(error.message);

      if (error.storeId) {
        setActiveStoreId(error.storeId);
      }

      setWizardStep(error.step);
      alert(error.message);
    };

    const goToStep = (step: WizardStepKey) => {
      const targetIndex = Math.max(
        WIZARD_STEPS.findIndex((item) => item.key === step),
        0
      );

      if (targetIndex <= wizardStepIndex) {
        setStepError("");
        setWizardStep(step);
        return;
      }

      const validationError = validateWizardStepsBeforeIndex(targetIndex);

      if (validationError) {
        handleStepValidationFailure(validationError);
        return;
      }

      setStepError("");
      setWizardStep(step);
    };

    const goToNextStep = () => {
      const nextIndex = Math.min(wizardStepIndex + 1, WIZARD_STEPS.length - 1);

      if (nextIndex === wizardStepIndex) return;

      const validationError = validateWizardStepsBeforeIndex(nextIndex);

      if (validationError) {
        handleStepValidationFailure(validationError);
        return;
      }

      const nextStep = WIZARD_STEPS[nextIndex]?.key || "review";
      setStepError("");
      setWizardStep(nextStep);
    };

    const goToPreviousStep = () => {
      const previousIndex = Math.max(wizardStepIndex - 1, 0);
      const previousStep = WIZARD_STEPS[previousIndex]?.key || "basic";
      setStepError("");
      setWizardStep(previousStep);
    };

    const submit = async () => {
      if (wizardStep !== "review") {
        goToNextStep();
        return;
      }

      const finalValidationError = validateWizardStepsBeforeIndex(
        WIZARD_STEPS.length - 1
      );

      if (finalValidationError) {
        handleStepValidationFailure(finalValidationError);
        return;
      }

      const cleanProductName = form.name.trim();

      if (!cleanProductName) return alert("Product name required");

      const currentProductId = String(form._id || form.id || "").trim();
      const duplicateProductExists = await productNameAlreadyExists(
        cleanProductName,
        currentProductId
      );

      if (duplicateProductExists) {
        return alert(
          "This product already exists. Please edit the existing product instead of adding it again."
        );
      }

      if (activeStoreConfigs.length === 0) {
        return alert("Select at least one store for this product.");
      }

      try {
        const cleanStoreConfigs = form.storeConfigs.map((config) => {
          if (!config.isAvailable) {
            return {
              ...config,
              isAvailable: false,
              isPopular: false,
            };
          }

          const selectedCategory = findSelectedCategory(
            safeCategories,
            config.category,
            config.categoryId,
            config.categoryName
          );

          const selectedCategoryId =
            getCategoryId(selectedCategory) ||
            String(config.categoryId || "").trim();

          const selectedCategoryName =
            selectedCategory?.name ||
            String(config.categoryName || config.category || "").trim();

          if (!selectedCategoryName) {
            throw new Error(
              `Category required for ${config.storeName || config.storeId}`
            );
          }

          const submitCategoryUsesSizes =
            isSizeBasedProductCategory(selectedCategoryName);

          const editableSizes = normalizeProductSizesForEditing(
            config.sizes,
            config.price
          );

          if (
            submitCategoryUsesSizes &&
            editableSizes.some((size) => !String(size.name || "").trim())
          ) {
            throw new Error(
              `Size name required for ${config.storeName || config.storeId}.`
            );
          }

          const cleanSizes = submitCategoryUsesSizes
            ? cleanProductSizesForSubmit(editableSizes, cleanNumber(config.price))
            : createRegularProductSize(
                cleanNumber(getFirstSizePrice(config.sizes, config.price))
              ).map((size) => ({
                ...size,
                price: cleanNumber(size.price),
              }));

          const sizeNames = getProductSizeNames(cleanSizes);
          const uniqueSizeNames = new Set(
            sizeNames.map((size) => size.toLowerCase())
          );

          if (sizeNames.length !== uniqueSizeNames.size) {
            throw new Error(
              `Size names must be unique for ${
                config.storeName || config.storeId
              }.`
            );
          }

          const cleanRelatedUpsells = normalizeProductRelatedUpsells(
            config.relatedUpsells,
            safeUpsellRules,
            "submit"
          ).map((upsell) => ({
            upsellId: String(upsell.upsellId || "").trim(),
            name: String(upsell.name || "").trim(),
            price: cleanNumber(upsell.price),
          }));

          const cleanModifierGroups = cleanProductModifierGroupsForSubmit(
            config.modifierGroups,
            cleanSizes
          ) as ProductModifierGroup[];

          const modifierGroupIds = cleanModifierGroups
            .map((group) => String(group.modifierGroupId || "").trim())
            .filter(Boolean);

          const upsellSummary = cleanRelatedUpsells
            .map((upsell) => `${upsell.name} ($${upsell.price.toFixed(2)})`)
            .join(", ");

          return {
            ...config,
            isAvailable: true,
            isPopular: Boolean(config.isPopular),
            category: selectedCategoryId || selectedCategoryName,
            categoryId: selectedCategoryId,
            categoryName: selectedCategoryName,
            price: cleanNumber(cleanSizes[0]?.price || config.price || 0),
            sizes: cleanSizes,
            modifierGroups: cleanModifierGroups,
            modifierGroupIds,
            upsell: upsellSummary,
            relatedUpsells: cleanRelatedUpsells,
            status: config.status || "Active",
            sortOrder: Number(config.sortOrder || 0),
          };
        });

        const firstActiveConfig = cleanStoreConfigs.find(
          (config) => config.isAvailable
        );

        onSave({
          ...form,
          name: cleanProductName,
          description: String(form.description || "").trim(),
          image: form.image || "",
          storeId: firstActiveConfig?.storeId || "",
          category: firstActiveConfig?.category || "",
          categoryId: firstActiveConfig?.categoryId || "",
          categoryName: firstActiveConfig?.categoryName || "",
          price: firstActiveConfig?.price || 0,
          sizes: firstActiveConfig?.sizes || [],
          modifierGroups: firstActiveConfig?.modifierGroups || [],
          modifierGroupIds: firstActiveConfig?.modifierGroupIds || [],
          relatedUpsells: firstActiveConfig?.relatedUpsells || [],
          upsell: firstActiveConfig?.upsell || "",
          status: firstActiveConfig?.status || "Active",
          sortOrder: firstActiveConfig?.sortOrder || 0,
          storeConfigs: cleanStoreConfigs,
          replaceStoreConfigs: true,
        });
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Product form has invalid data."
        );
      }
    };

    useImperativeHandle(ref, () => ({ submit }));

    const renderStepHeader = () => (
      <div className="rounded-[24px] border border-zinc-200 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-5">
          {WIZARD_STEPS.map((step, index) => {
            const active = step.key === wizardStep;
            const done = index < wizardStepIndex;

            return (
              <button
                type="button"
                key={step.key}
                onClick={() => goToStep(step.key)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-green-700 bg-green-50 shadow-sm"
                    : done
                    ? "border-green-100 bg-white"
                    : "border-zinc-200 bg-white hover:border-green-200"
                }`}
              >
                <span
                  className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                    active || done
                      ? "bg-green-700 text-white"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="block text-xs font-black text-zinc-950">
                  {step.label}
                </span>
                <span className="mt-1 block text-[11px] font-bold text-zinc-400">
                  {step.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );

    const renderStoreTabs = () => {
      if (form.storeConfigs.length === 0) {
        return (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-sm font-bold text-zinc-500">
            No stores found. Please add stores first.
          </div>
        );
      }

      return (
        <div className="grid gap-2 md:grid-cols-3">
          {form.storeConfigs.map((config) => {
            const active = activeStoreConfig?.storeId === config.storeId;
            const previewPrice = getFirstSizePrice(config.sizes, config.price);

            return (
              <button
                type="button"
                key={config.storeId}
                onClick={() => setActiveStoreId(config.storeId)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-green-700 bg-white shadow-sm"
                    : "border-zinc-200 bg-white hover:border-green-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-zinc-950">
                    {config.storeName || getStoreName(safeStores, config.storeId)}
                  </span>

                  <div className="flex items-center gap-1">
                    {config.isPopular && config.isAvailable ? (
                      <span className="rounded-full bg-pink-100 px-2 py-1 text-[10px] font-black text-pink-700">
                        Popular
                      </span>
                    ) : null}

                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-black ${
                        config.isAvailable
                          ? "bg-green-100 text-green-800"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {config.isAvailable ? "Available" : "Off"}
                    </span>
                  </div>
                </div>

                <p className="mt-1 truncate text-xs font-bold text-zinc-400">
                  {config.categoryName || "No category selected"}
                </p>

                <p className="mt-2 text-xs font-black text-zinc-700">
                  Base: ${getInputValue(previewPrice || 0)}
                </p>
              </button>
            );
          })}
        </div>
      );
    };

    const renderActiveStoreHeader = (config: ProductStoreConfigState) => (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-zinc-950">
            {config.storeName || getStoreName(safeStores, config.storeId)} Store
          </p>
          <p className="text-xs font-bold text-zinc-400">{config.storeId}</p>
        </div>

        <button
          type="button"
          onClick={() => toggleStoreAvailability(config.storeId)}
          className={`rounded-full px-4 py-2 text-xs font-black transition ${
            config.isAvailable
              ? "bg-green-700 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          {config.isAvailable ? "Available" : "Not Available"}
        </button>
      </div>
    );

    const renderStoreSetupStep = () => {
      if (!activeStoreConfig) return null;

      const config = activeStoreConfig;
      const categoriesForStore = getCategoriesForStore(
        safeCategories,
        config.storeId
      );

      return (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-4">
              <h3 className="text-base font-black text-zinc-900">
                Store Availability
              </h3>
              <p className="mt-1 text-xs font-bold text-zinc-500">
                Select store tab, turn availability on/off, then set that store category and status.
              </p>
            </div>
            {renderStoreTabs()}
          </div>

          <div className="rounded-[22px] border border-zinc-200 bg-white p-4">
            {renderActiveStoreHeader(config)}

            {config.isAvailable ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <FormSelect
                    label="Category *"
                    value={String(config.categoryName || "")}
                    onChange={(value) => handleCategoryChange(config.storeId, value)}
                    options={Array.from(
                      new Set(
                        categoriesForStore
                          .map((item) => String(item.name || "").trim())
                          .filter(Boolean)
                      )
                    )}
                  />

                  <FormSelect
                    label="Status"
                    value={config.status}
                    onChange={(value) =>
                      updateStoreConfig(config.storeId, (prevConfig) => ({
                        ...prevConfig,
                        status: value as ProductStatus,
                      }))
                    }
                    options={["Active", "Draft", "Hidden", "Inactive"]}
                  />

                  <FormInput
                    label="Sort Order"
                    value={String(config.sortOrder || 0)}
                    onChange={(value) =>
                      updateStoreConfig(config.storeId, (prevConfig) => ({
                        ...prevConfig,
                        sortOrder: cleanNumber(value),
                      }))
                    }
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>

                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-pink-100 bg-pink-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-black text-zinc-950">
                      Popular Menu Item
                    </p>
                    <p className="mt-1 text-xs font-semibold text-zinc-500">
                      Is store mein product ko Popular Menu Items section mein bhi show karo.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={Boolean(config.isPopular)}
                    onChange={(event) =>
                      updateStoreConfig(config.storeId, (prevConfig) => ({
                        ...prevConfig,
                        isPopular: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 shrink-0 accent-green-700"
                  />
                </label>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm font-bold text-zinc-500">
                This product is disabled for this store. Turn on Available if this store should sell it.
              </div>
            )}
          </div>
        </div>
      );
    };

    const renderPricingStep = () => {
      if (!activeStoreConfig) return null;

      const config = activeStoreConfig;
      const categoryUsesSizes = isSizeBasedProductCategory(
        config.categoryName || config.category
      );

      const productSizes = categoryUsesSizes
        ? normalizeProductSizesForEditing(config.sizes, config.price)
        : createRegularProductSize(getFirstSizePrice(config.sizes, config.price));

      return (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-4">
              <h3 className="text-base font-black text-zinc-900">
                Store Pricing
              </h3>
              <p className="mt-1 text-xs font-bold text-zinc-500">
                Pick a store tab, then add base price or size-wise prices for that store.
              </p>
            </div>
            {renderStoreTabs()}
          </div>

          <div className="rounded-[22px] border border-zinc-200 bg-white p-4">
            {renderActiveStoreHeader(config)}

            {config.isAvailable ? (
              categoryUsesSizes ? (
                <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-sm font-black text-zinc-700">
                        Product Sizes & Base Prices
                      </label>
                      <p className="mt-1 text-xs font-semibold text-zinc-500">
                        Pizza/sub/wing type categories can use multiple sizes.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => addSize(config.storeId)}
                      className="rounded-full bg-green-700 px-4 py-2 text-xs font-black text-white transition hover:bg-green-800"
                    >
                      Add Size
                    </button>
                  </div>

                  <div className="space-y-3">
                    {productSizes.map((size, index) => (
                      <div
                        key={size.id || `size-${index}`}
                        className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-3 md:grid-cols-[1fr_150px_auto]"
                      >
                        <input
                          value={size.name}
                          onChange={(event) =>
                            updateSize(config.storeId, index, "name", event.target.value)
                          }
                          placeholder="Small"
                          className="h-11 rounded-xl border border-zinc-200 px-3 text-sm font-bold outline-none transition focus:border-green-700"
                        />

                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*[.]?[0-9]*"
                          onKeyDown={blockBadNumberKeys}
                          value={getInputValue(size.price)}
                          onChange={(event) =>
                            updateSize(config.storeId, index, "price", event.target.value)
                          }
                          placeholder="0.00"
                          className="h-11 rounded-xl border border-zinc-200 px-3 text-sm font-bold outline-none transition focus:border-green-700"
                        />

                        <button
                          type="button"
                          onClick={() => removeSize(config.storeId, index)}
                          className="h-11 rounded-xl border border-red-100 px-4 text-xs font-black text-red-600 transition hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <FormInput
                  label="Base Price *"
                  value={getInputValue(productSizes[0]?.price ?? config.price ?? 0)}
                  onChange={(value) =>
                    updateStoreConfig(config.storeId, (prevConfig) => {
                      const nextPrice = decimalInputState(value);
                      const nextSizes = createRegularProductSize(nextPrice);

                      return {
                        ...prevConfig,
                        price: nextPrice,
                        sizes: nextSizes,
                        modifierGroups: syncModifierGroupsWithSizes(
                          prevConfig.modifierGroups,
                          nextSizes
                        ),
                      };
                    })
                  }
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  onKeyDown={blockBadNumberKeys}
                  placeholder="8.99"
                />
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm font-bold text-zinc-500">
                This product is disabled for this store. Turn on Available from the Stores step first.
              </div>
            )}
          </div>
        </div>
      );
    };

    const renderExtrasStep = () => {
      if (!activeStoreConfig) return null;

      const config = activeStoreConfig;
      const categoryUsesSizes = isSizeBasedProductCategory(
        config.categoryName || config.category
      );

      const productSizes = categoryUsesSizes
        ? normalizeProductSizesForEditing(config.sizes, config.price)
        : createRegularProductSize(getFirstSizePrice(config.sizes, config.price));

      const assignedModifierGroups = getAssignedModifierGroups(
        safeModifierGroups,
        config.storeId,
        config.categoryId,
        config.categoryName || config.category
      );

      const categoryBasedUpsells = safeUpsellRules.filter((rule) =>
        upsellMatchesStoreAndCategory({
          rule,
          storeId: config.storeId,
          categoryId: config.categoryId,
          categoryName: config.categoryName,
          category: config.category,
        })
      );

      return (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-4">
              <h3 className="text-base font-black text-zinc-900">
                Upsells & Modifiers
              </h3>
              <p className="mt-1 text-xs font-bold text-zinc-500">
                Pick a store tab, then attach category-based upsells and modifier groups.
              </p>
            </div>
            {renderStoreTabs()}
          </div>

          <div className="rounded-[22px] border border-zinc-200 bg-white p-4">
            {renderActiveStoreHeader(config)}

            {config.isAvailable ? (
              <div className="space-y-4">
                <details className="rounded-[22px] border border-zinc-200 bg-white p-4" open>
                  <summary className="cursor-pointer list-none text-sm font-black text-zinc-700">
                    Related Upsells with Price
                  </summary>

                  <div className="mt-3">
                    {categoryBasedUpsells.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm font-bold text-zinc-500">
                        No upsell items found for this store/category.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {categoryBasedUpsells.map((rule, index) => {
                          const ruleId = getUpsellId(rule, `upsell-${index}`);
                          const selectedUpsell = getSelectedRelatedUpsell(
                            config.relatedUpsells,
                            ruleId
                          );
                          const selected = Boolean(selectedUpsell);

                          return (
                            <div
                              key={ruleId}
                              className={`rounded-2xl border p-3 transition ${
                                selected
                                  ? "border-green-700 bg-green-50"
                                  : "border-zinc-200 bg-white"
                              }`}
                            >
                              <div className="grid gap-3 md:grid-cols-[1fr_150px_auto]">
                                <button
                                  type="button"
                                  onClick={() => toggleUpsell(config.storeId, rule, `upsell-${index}`)}
                                  className={`rounded-xl px-4 py-3 text-left text-sm font-black transition ${
                                    selected
                                      ? "bg-green-700 text-white"
                                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                                  }`}
                                >
                                  <span className="block truncate">{getUpsellName(rule)}</span>
                                  <span className="mt-1 block text-[11px] font-bold opacity-75">
                                    {selected ? "Selected" : "Click to add"}
                                  </span>
                                </button>

                                <input
                                  type="text"
                                  inputMode="decimal"
                                  pattern="[0-9]*[.]?[0-9]*"
                                  disabled={!selected}
                                  onKeyDown={blockBadNumberKeys}
                                  value={getInputValue(selectedUpsell?.price ?? 0)}
                                  onChange={(event) =>
                                    updateUpsellPrice(config.storeId, ruleId, event.target.value)
                                  }
                                  placeholder="0.00"
                                  className="h-12 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-green-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                                />

                                <button
                                  type="button"
                                  onClick={() => toggleUpsell(config.storeId, rule, `upsell-${index}`)}
                                  className={`h-12 rounded-xl px-4 text-xs font-black transition ${
                                    selected
                                      ? "border border-red-100 bg-white text-red-600 hover:bg-red-50"
                                      : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                                  }`}
                                >
                                  {selected ? "Remove" : "Add"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </details>

                <details className="rounded-[22px] border border-zinc-200 bg-white p-4" open>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black text-zinc-700">
                        Assigned Modifier Groups
                      </span>

                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-600">
                        {config.modifierGroups.length} selected
                      </span>
                    </div>
                  </summary>

                  <div className="mt-4">
                    {assignedModifierGroups.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm font-bold text-zinc-500">
                        No modifier group is assigned to this store/category yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {assignedModifierGroups.map((group, index) => {
                          const groupId = getGlobalModifierGroupId(group, `modifier-${index}`);
                          const selected = getGroupSelected(
                            config.modifierGroups,
                            group,
                            `modifier-${index}`
                          );
                          const selectedGroup = getSelectedProductGroup(
                            config.modifierGroups,
                            group,
                            `modifier-${index}`
                          );
                          const selectedGroupIndex = config.modifierGroups.findIndex(
                            (item) => item === selectedGroup
                          );
                          const editorKey = `${config.storeId}-${groupId}`;
                          const editorOpen = expandedModifierKey === editorKey;

                          return (
                            <div
                              key={groupId}
                              className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-3"
                            >
                              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleModifier(config.storeId, group, index, productSizes)
                                  }
                                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                                    selected
                                      ? "border-green-700 bg-green-50 text-green-800"
                                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                                  }`}
                                >
                                  <span>{group.name}</span>
                                  <span className="text-xs">
                                    {selected ? "Selected" : "Click to add"}
                                  </span>
                                </button>

                                {selected && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedModifierKey((current) =>
                                        current === editorKey ? "" : editorKey
                                      )
                                    }
                                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs font-black text-zinc-700 transition hover:bg-zinc-50"
                                  >
                                    {editorOpen ? "Hide Prices" : "Edit Prices"}
                                  </button>
                                )}
                              </div>

                              {selected && selectedGroup && editorOpen && (
                                <div className="mt-4 space-y-3">
                                  <div className="grid gap-2 text-xs font-black text-zinc-500 md:grid-cols-[160px_1fr]">
                                    <span>Option</span>
                                    <span>Price by Size</span>
                                  </div>

                                  {selectedGroup.options.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-4 text-sm font-bold text-zinc-500">
                                      No options found in this modifier group.
                                    </div>
                                  ) : (
                                    selectedGroup.options.map((option, optionIndex) => {
                                      if (option.status === "Inactive") return null;

                                      return (
                                        <div
                                          key={`${option.optionId || option.id || option.name}-${optionIndex}`}
                                          className="grid gap-3 rounded-2xl border border-zinc-100 bg-white p-3 md:grid-cols-[160px_1fr]"
                                        >
                                          <div className="flex items-center text-sm font-black text-zinc-800">
                                            {option.name}
                                          </div>

                                          <div className="grid gap-2 sm:grid-cols-2">
                                            {productSizes.map((size) => (
                                              <label
                                                key={`${config.storeId}-${option.name}-${size.id}`}
                                                className="block"
                                              >
                                                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-zinc-500">
                                                  {size.name}
                                                </span>

                                                <input
                                                  type="text"
                                                  inputMode="decimal"
                                                  pattern="[0-9]*[.]?[0-9]*"
                                                  onKeyDown={blockBadNumberKeys}
                                                  value={getInputValue(
                                                    option.pricesBySize?.[
                                                      String(size.name || "").trim()
                                                    ] ?? 0
                                                  )}
                                                  onChange={(event) =>
                                                    updateModifierOptionPrice(
                                                      config.storeId,
                                                      selectedGroupIndex,
                                                      optionIndex,
                                                      size.name,
                                                      event.target.value
                                                    )
                                                  }
                                                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-green-700"
                                                />
                                              </label>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </details>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm font-bold text-zinc-500">
                This product is disabled for this store. Turn on Available from the Stores step first.
              </div>
            )}
          </div>
        </div>
      );
    };

    const renderReviewStep = () => (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-4">
          <h3 className="text-base font-black text-zinc-900">Review Product</h3>
          <p className="mt-1 text-xs font-bold text-zinc-500">
            Check product details and store-wise setup. Use Back or step buttons if anything needs changes.
          </p>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-black text-zinc-950">
              {form.name || "Product name not added"}
            </p>
            <p className="mt-1 text-xs font-bold text-zinc-500">
              {String(form.description || "No description added")}
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="text-base font-black text-zinc-900">Store Summary</h3>

          <div className="mt-4 space-y-3">
            {form.storeConfigs.map((config) => {
              const previewPrice = getFirstSizePrice(config.sizes, config.price);
              const sizeNames = normalizeProductSizesForEditing(
                config.sizes,
                config.price
              )
                .map((size) => `${size.name || "Size"}: $${getInputValue(size.price)}`)
                .join(" • ");

              return (
                <div
                  key={config.storeId}
                  className="rounded-2xl border border-zinc-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-zinc-950">
                        {config.storeName || getStoreName(safeStores, config.storeId)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-zinc-500">
                        {config.categoryName || "No category selected"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {config.isPopular && config.isAvailable ? (
                        <span className="rounded-full bg-pink-100 px-3 py-1 text-[11px] font-black text-pink-700">
                          Popular
                        </span>
                      ) : null}

                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-black ${
                          config.isAvailable
                            ? "bg-green-100 text-green-800"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {config.isAvailable ? "Available" : "Off"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs font-bold text-zinc-600 md:grid-cols-2">
                    <p>Base: ${getInputValue(previewPrice || 0)}</p>
                    <p>Status: {config.status}</p>
                    <p>Popular: {config.isPopular && config.isAvailable ? "Yes" : "No"}</p>
                    <p className="md:col-span-2">Sizes: {sizeNames || "Regular"}</p>
                    <p>Modifiers: {config.modifierGroups.length}</p>
                    <p>Upsells: {(config.relatedUpsells || []).length}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );

    const renderStepContent = () => {
      if (wizardStep === "basic") {
        return (
          <div className="space-y-5 rounded-[24px] border border-zinc-200 bg-white p-4">
            <ImageUploadBox
              label="Product Image"
              image={form.image}
              alt={form.name || "Product"}
              onUpload={handleImageUpload}
              onRemove={() => setForm((prev) => ({ ...prev, image: "" }))}
            />

            <FormInput
              label="Product Name *"
              value={form.name}
              onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
              placeholder="Large Cheese Pizza"
            />

            <FormInput
              label="Description *"
              value={String(form.description || "")}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, description: value }))
              }
              placeholder="Short product description"
            />
          </div>
        );
      }

      if (wizardStep === "stores") return renderStoreSetupStep();
      if (wizardStep === "pricing") return renderPricingStep();
      if (wizardStep === "extras") return renderExtrasStep();

      return renderReviewStep();
    };

    return (
      <div className="space-y-5">
        {renderStepHeader()}

        {stepError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
            {stepError}
          </div>
        ) : null}

        {renderStepContent()}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-zinc-200 bg-white p-4">
          <button
            type="button"
            onClick={goToPreviousStep}
            disabled={wizardStepIndex === 0}
            className="rounded-full bg-zinc-100 px-5 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>

          <div className="text-center text-xs font-bold text-zinc-500">
            Step {wizardStepIndex + 1} of {WIZARD_STEPS.length}
          </div>

          <button
            type="button"
            onClick={wizardStep === "review" ? submit : goToNextStep}
            className="rounded-full bg-green-800 px-5 py-3 text-sm font-black text-white transition hover:bg-green-900"
          >
            {wizardStep === "review" ? "Save Product" : "Next"}
          </button>
        </div>
      </div>
    );

  }
);

ProductForm.displayName = "ProductForm";

export default ProductForm;