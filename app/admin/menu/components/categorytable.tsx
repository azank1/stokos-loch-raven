"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { Category, Product } from "../types";
import { EmptyBox, StatusBadge, TableHead } from "./ui";

const ITEMS_PER_PAGE = 10;

type StoreItem = {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
};

type MongoObject = {
  _id?: string;
  id?: string;
  configId?: string;
  storeConfigId?: string;
  categoryId?: string;
  name?: string;
  title?: string;
  offer?: string;
  slug?: string;
};

type StoreConfigLike = MongoObject & {
  storeId?: unknown;
  storeSlug?: unknown;
  store?: unknown;
  isAvailable?: boolean;
  available?: boolean;
  status?: string;
  categoryName?: unknown;
  categorySlug?: unknown;
};

type CategoryRow = {
  category: Category;
  categoryId: string;
  deleteId: string;
  storeId: string;
  storeName: string;
  productsCount: number;
};

type CategoryGroup = {
  key: string;
  name: string;
  rows: CategoryRow[];
  totalProducts: number;
  sortOrders: number[];
};

function getItemId(item: unknown, fallback: string) {
  if (typeof item === "object" && item !== null) {
    const obj = item as MongoObject;

    return String(
      obj._id || obj.id || obj.categoryId || obj.slug || fallback
    ).trim();
  }

  return fallback;
}

function getCategoryDeleteId(item: unknown) {
  if (typeof item === "object" && item !== null) {
    const obj = item as MongoObject;

    return String(obj.storeConfigId || obj.configId || "").trim();
  }

  return "";
}

function getConfigDeleteId(config: unknown) {
  if (typeof config === "object" && config !== null) {
    const obj = config as MongoObject;

    return String(obj.storeConfigId || obj.configId || obj._id || obj.id || "").trim();
  }

  return "";
}

function getTextValue(value: unknown, fallback = "") {
  if (!value) return fallback;

  if (typeof value === "string") return value.trim();

  if (typeof value === "number") return String(value);

  if (typeof value === "object") {
    const obj = value as MongoObject;

    return String(
      obj.name || obj.title || obj.offer || obj.slug || obj._id || obj.id || fallback
    ).trim();
  }

  return fallback;
}

function normalizeValue(value: unknown) {
  return getTextValue(value, "").toLowerCase();
}

function getStoreVariants(store: StoreItem) {
  return [store.slug, store._id, store.id, store.name]
    .filter(Boolean)
    .map((value) => String(value).trim());
}

function normalizeStoreValue(value: unknown) {
  if (!value) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const obj = value as MongoObject;
    return String(obj.slug || obj._id || obj.id || obj.name || "").trim();
  }

  return "";
}

function getItemStoreId(item: unknown) {
  if (!item || typeof item !== "object") return "";

  const obj = item as {
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

function isSameStore(
  firstStoreId: string,
  secondStoreId: string,
  stores: StoreItem[]
) {
  if (!firstStoreId || !secondStoreId) return false;

  if (firstStoreId === secondStoreId) return true;

  return stores.some((store) => {
    const variants = getStoreVariants(store);
    return variants.includes(firstStoreId) && variants.includes(secondStoreId);
  });
}

function getStoreNameFromId(stores: StoreItem[], storeId: string) {
  if (!storeId) return "No Store";

  const foundStore = stores.find((store) => {
    const variants = getStoreVariants(store);
    return variants.includes(storeId);
  });

  return foundStore?.name || storeId;
}

function getStoreName(stores: StoreItem[], item: unknown) {
  const storeId = getItemStoreId(item);

  if (!storeId) return "No Store";

  return getStoreNameFromId(stores, storeId);
}

function isActiveStoreConfig(config: StoreConfigLike) {
  return (
    config.isAvailable !== false &&
    config.available !== false &&
    config.status !== "Inactive"
  );
}

function getStoreConfigs(item: unknown): StoreConfigLike[] {
  if (!item || typeof item !== "object") return [];

  const obj = item as { storeConfigs?: unknown };

  if (!Array.isArray(obj.storeConfigs)) return [];

  return obj.storeConfigs
    .filter((config): config is StoreConfigLike => {
      return typeof config === "object" && config !== null;
    })
    .filter(isActiveStoreConfig);
}

function getStoreIdFromConfig(config: StoreConfigLike) {
  return (
    normalizeStoreValue(config.storeId) ||
    normalizeStoreValue(config.storeSlug) ||
    normalizeStoreValue(config.store)
  );
}

function getCategoryStoreIds(category: Category) {
  const categoryObj = category as Category & {
    storeIds?: unknown[];
    selectedStoreIds?: unknown[];
    storeSlugs?: unknown[];
    selectedStoreSlugs?: unknown[];
    stores?: unknown[];
    selectedStores?: unknown[];
  };

  const configs = getStoreConfigs(category);
  const ids: string[] = [];

  function addStoreId(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(addStoreId);
      return;
    }

    const storeId = normalizeStoreValue(value);

    if (!storeId || storeId === "all") return;
    if (ids.includes(storeId)) return;

    ids.push(storeId);
  }

  if (configs.length) {
    configs.forEach((config) => addStoreId(getStoreIdFromConfig(config)));
  } else {
    addStoreId(categoryObj.storeIds);
    addStoreId(categoryObj.selectedStoreIds);
    addStoreId(categoryObj.storeSlugs);
    addStoreId(categoryObj.selectedStoreSlugs);
    addStoreId(categoryObj.stores);
    addStoreId(categoryObj.selectedStores);
    addStoreId(getItemStoreId(category));
  }

  return ids;
}

function productHasStore(product: Product, storeId: string, stores: StoreItem[]) {
  if (!storeId) return false;

  const configs = getStoreConfigs(product);

  if (configs.length) {
    return configs.some((config) => {
      const configStoreId = getStoreIdFromConfig(config);

      return (
        configStoreId === storeId ||
        isSameStore(configStoreId, storeId, stores)
      );
    });
  }

  const productStoreId = getItemStoreId(product);

  return (
    productStoreId === storeId ||
    isSameStore(productStoreId, storeId, stores)
  );
}

function productBelongsToCategory(product: Product, category: Category) {
  const productObj = product as Product & {
    category?: unknown;
    categoryId?: unknown;
    categorySlug?: unknown;
    categoryName?: unknown;
    storeConfigs?: unknown;
  };

  const categoryObj = category as Category & {
    _id?: string;
    id?: string;
    slug?: string;
    categoryId?: string;
  };

  const productCategoryValues = [
    productObj.categoryId,
    productObj.category,
    productObj.categorySlug,
    productObj.categoryName,
  ]
    .map((value) => normalizeValue(value))
    .filter(Boolean);

  const productConfigs = getStoreConfigs(product);

  productConfigs.forEach((config) => {
    productCategoryValues.push(
      ...[
        config.categoryId,
        config.categoryName,
        config.categorySlug,
      ]
        .map((value) => normalizeValue(value))
        .filter(Boolean)
    );
  });

  const categoryValues = [
    categoryObj.categoryId,
    categoryObj._id,
    categoryObj.id,
    categoryObj.name,
    categoryObj.slug,
  ]
    .map((value) => normalizeValue(value))
    .filter(Boolean);

  return productCategoryValues.some((productValue) =>
    categoryValues.includes(productValue)
  );
}

function getCategoryProductsCount(
  category: Category,
  products: Product[],
  stores: StoreItem[],
  storeIdOverride = ""
) {
  const categoryStoreId = storeIdOverride || getItemStoreId(category);

  if (!categoryStoreId) return 0;

  return products.filter((product) => {
    return (
      productHasStore(product, categoryStoreId, stores) &&
      productBelongsToCategory(product, category)
    );
  }).length;
}

function buildCategoryRows(
  category: Category,
  products: Product[],
  stores: StoreItem[],
  fallback: string,
  selectedStoreId = "all"
): CategoryRow[] {
  const categoryId = getItemId(category, fallback);
  const configs = getStoreConfigs(category);
  const targetStoreId =
    selectedStoreId && selectedStoreId !== "all" ? selectedStoreId : "";

  const rows: CategoryRow[] = [];

  if (configs.length) {
    configs.forEach((config, index) => {
      const storeId = getStoreIdFromConfig(config);

      if (!storeId) return;

      if (
        targetStoreId &&
        storeId !== targetStoreId &&
        !isSameStore(storeId, targetStoreId, stores)
      ) {
        return;
      }

      rows.push({
        category,
        categoryId,
        deleteId: getConfigDeleteId(config),
        storeId,
        storeName: getStoreNameFromId(stores, storeId),
        productsCount: getCategoryProductsCount(category, products, stores, storeId),
      });
    });
  }

  if (!rows.length) {
    const storeIds = getCategoryStoreIds(category);

    storeIds.forEach((storeId) => {
      if (
        targetStoreId &&
        storeId !== targetStoreId &&
        !isSameStore(storeId, targetStoreId, stores)
      ) {
        return;
      }

      rows.push({
        category,
        categoryId,
        deleteId: getCategoryDeleteId(category),
        storeId,
        storeName: getStoreNameFromId(stores, storeId),
        productsCount: getCategoryProductsCount(category, products, stores, storeId),
      });
    });
  }

  if (!rows.length) {
    const storeName = getStoreName(stores, category);
    const storeId = getItemStoreId(category) || storeName;

    rows.push({
      category,
      categoryId,
      deleteId: getCategoryDeleteId(category),
      storeId,
      storeName,
      productsCount: getCategoryProductsCount(category, products, stores, storeId),
    });
  }

  const uniqueRows = new Map<string, CategoryRow>();

  rows.forEach((row) => {
    const key = row.storeId || row.storeName;

    if (!uniqueRows.has(key)) {
      uniqueRows.set(key, row);
    }
  });

  return Array.from(uniqueRows.values());
}

function RowActionButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:border-green-700 hover:bg-green-50 hover:text-green-700"
        aria-label="Edit category"
      >
        <Pencil size={17} />
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 transition hover:border-red-200 hover:bg-red-100 hover:text-red-600"
        aria-label="Delete category"
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}

function StoreDeleteBadge({
  storeName,
  onDelete,
}: {
  storeName: string;
  onDelete: () => void;
}) {
  return (
    <span className="inline-flex items-center overflow-hidden rounded-full bg-green-50 text-xs font-black text-green-800">
      <span className="px-3 py-1.5">{storeName}</span>

      <button
        type="button"
        onClick={onDelete}
        className="flex h-7 w-7 items-center justify-center border-l border-green-100 text-red-500 transition hover:bg-red-50 hover:text-red-700"
        aria-label={`Delete ${storeName} category`}
        title={`Delete from ${storeName}`}
      >
        <Trash2 size={13} />
      </button>
    </span>
  );
}

function StoreBadge({ storeName }: { storeName: string }) {
  return (
    <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-800">
      {storeName}
    </span>
  );
}

function buildGroupedCategories(
  categories: Category[],
  products: Product[],
  stores: StoreItem[]
): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();

  categories
    .slice()
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .forEach((category, index) => {
      const key = String(category.name || "untitled-category")
        .trim()
        .toLowerCase();

      const rows = buildCategoryRows(
        category,
        products,
        stores,
        `${category.name}-${index}`,
        "all"
      );

      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          key,
          name: category.name || "Untitled Category",
          rows: [],
          totalProducts: 0,
          sortOrders: [Number(category.sortOrder || 0)],
        });
      } else {
        existing.sortOrders.push(Number(category.sortOrder || 0));
      }

      const group = map.get(key);

      if (!group) return;

      rows.forEach((row) => {
        const alreadyExists = group.rows.some((existingRow) => {
          return (
            existingRow.storeId === row.storeId ||
            isSameStore(existingRow.storeId, row.storeId, stores)
          );
        });

        if (alreadyExists) return;

        group.rows.push(row);
        group.totalProducts += row.productsCount;
      });
    });

  return Array.from(map.values()).sort((a, b) => {
    const aSort = Math.min(...a.sortOrders);
    const bSort = Math.min(...b.sortOrders);

    return aSort - bSort;
  });
}

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= ITEMS_PER_PAGE) return null;

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-zinc-500">
        Showing <span className="font-black text-zinc-950">{startItem}</span>{" "}
        to <span className="font-black text-zinc-950">{endItem}</span> of{" "}
        <span className="font-black text-zinc-950">{totalItems}</span>{" "}
        categories
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="flex h-9 items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} />
          Prev
        </button>

        <div className="flex items-center gap-1">
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black transition ${
                currentPage === page
                  ? "bg-green-700 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="flex h-9 items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function CategoryTable({
  categories,
  products,
  stores = [],
  hideEdit = false,
  hideActions = false,
  selectedStoreId = "all",
  onEdit,
  onDelete,
}: {
  categories: Category[];
  products: Product[];
  stores?: StoreItem[];
  hideEdit?: boolean;
  hideActions?: boolean;
  selectedStoreId?: string;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const isAllStoresView = hideEdit || hideActions;

  const groupedCategories = useMemo(() => {
    return buildGroupedCategories(categories, products, stores);
  }, [categories, products, stores]);

  const sortedCategories = useMemo(() => {
    return categories
      .slice()
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }, [categories]);

  const totalItems = isAllStoresView
    ? groupedCategories.length
    : sortedCategories.length;

  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage((prevPage) => {
      if (prevPage > totalPages) return totalPages;
      if (prevPage < 1) return 1;
      return prevPage;
    });
  }, [isAllStoresView, totalPages]);

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  const paginatedGroups = groupedCategories.slice(startIndex, endIndex);
  const paginatedCategories = sortedCategories.slice(startIndex, endIndex);

  if (!categories.length) return <EmptyBox message="No categories found." />;

  return (
    <div className="overflow-hidden rounded-[26px] border border-zinc-200">
      <div className="border-b border-zinc-200 bg-zinc-50 p-4">
        <h3 className="text-lg font-black">Categories</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Manage menu sections by store.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table
          className={`w-full text-left ${
            isAllStoresView ? "min-w-[640px]" : "min-w-[820px]"
          }`}
        >
          <thead className="border-b border-zinc-200 bg-white">
            <tr>
              <TableHead>Category</TableHead>
              <TableHead>Store</TableHead>

              {!isAllStoresView && (
                <>
                  <TableHead>Products</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {isAllStoresView
              ? paginatedGroups.map((group, groupIndex) => (
                  <tr
                    key={`${group.key}-${startIndex + groupIndex}`}
                    className="transition hover:bg-green-50/50"
                  >
                    <td className="px-5 py-5">
                      <p className="font-black text-zinc-950">{group.name}</p>
                    </td>

                    <td className="px-5 py-5">
                      <div className="flex flex-wrap gap-2">
                        {group.rows.map((row, rowIndex) => (
                          <StoreDeleteBadge
                            key={`${
                              group.key
                            }-${row.deleteId || row.categoryId}-${
                              row.storeId
                            }-${rowIndex}`}
                            storeName={row.storeName}
                            onDelete={() => {
                              if (!row.deleteId) {
                                alert(
                                  `Store config ID missing for ${row.storeName}. Please refresh data or check categories API.`
                                );
                                return;
                              }

                              onDelete(row.deleteId);
                            }}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              : paginatedCategories.map((category, index) => {
                  const categoryId = getItemId(
                    category,
                    `${category.name}-${startIndex + index}`
                  );

                  const rows = buildCategoryRows(
                    category,
                    products,
                    stores,
                    `${category.name}-${startIndex + index}`,
                    selectedStoreId
                  );

                  const primaryRow = rows[0];
                  const deleteId =
                    primaryRow?.deleteId || getCategoryDeleteId(category);
                  const storeName = primaryRow?.storeName || getStoreName(stores, category);

                  const categoryProductsCount = rows.reduce(
                    (total, row) => total + row.productsCount,
                    0
                  );

                  return (
                    <tr
                      key={`${
                        deleteId || categoryId
                      }-${primaryRow?.storeId || getItemStoreId(category) || storeName}-${
                        startIndex + index
                      }`}
                      className="transition hover:bg-green-50/50"
                    >
                      <td className="px-5 py-5">
                        <p className="font-black text-zinc-950">
                          {category.name}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <div className="flex flex-wrap gap-2">
                          {rows.map((row, rowIndex) => (
                            <StoreBadge
                              key={`${row.storeId}-${rowIndex}`}
                              storeName={row.storeName}
                            />
                          ))}
                        </div>
                      </td>

                      <td className="px-5 py-5 text-sm font-black">
                        {categoryProductsCount}
                      </td>

                      <td className="px-5 py-5">
                        <StatusBadge status={category.status} />
                      </td>

                      <td className="px-5 py-5">
                        <RowActionButtons
                          onEdit={() => onEdit(category)}
                          onDelete={() => {
                            if (!deleteId) {
                              alert(
                                `Store config ID missing for ${storeName}. Please refresh data or check categories API.`
                              );
                              return;
                            }

                            onDelete(deleteId);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}