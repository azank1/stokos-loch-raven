"use client";

import { Fragment, useMemo, useState } from "react";
import type {
  Category,
  Product,
  ProductRelatedUpsell,
  UpsellRule,
} from "../types";
import { ActionButtons, EmptyBox, ImageBox, StatusBadge, TableHead } from "./ui";

type StoreItem = {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
};

type MongoObject = {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  offer?: string;
  slug?: string;
};

type ProductSize = {
  id?: string;
  name?: string;
  label?: string;
  sizeName?: string;
  price?: number;
};

type ProductStoreConfig = {
  _id?: string;
  id?: string;
  storeId?: string;
  category?: unknown;
  categoryId?: unknown;
  categoryName?: unknown;
  price?: number;
  sizes?: ProductSize[];
  modifierGroups?: unknown[];
  modifierGroupIds?: unknown[];
  modifiers?: unknown[];
  relatedUpsells?: Array<ProductRelatedUpsell | string>;
  upsell?: unknown;
  upsellName?: string;
  status?: string;
  sortOrder?: number;
};

type UpsellDisplayItem = {
  key: string;
  name: string;
  price: number | null;
};

function getItemId(item: unknown, fallback: string) {
  if (typeof item === "object" && item !== null) {
    const obj = item as MongoObject;
    return String(obj._id || obj.id || obj.slug || fallback);
  }

  return fallback;
}

function getTextValue(value: unknown, fallback = "Not selected") {
  if (!value) return fallback;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);

  if (typeof value === "object") {
    const obj = value as MongoObject;

    return String(
      obj.name ||
        obj.title ||
        obj.offer ||
        obj.slug ||
        obj._id ||
        obj.id ||
        fallback
    ).trim();
  }

  return fallback;
}

function normalizeValue(value: unknown) {
  return getTextValue(value, "").trim().toLowerCase();
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

function getStoreVariants(store: StoreItem) {
  return [store.slug, store._id, store.id, store.name]
    .filter(Boolean)
    .map((value) => String(value).trim());
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

function getStoreConfigs(product: Product): ProductStoreConfig[] {
  return Array.isArray((product as any).storeConfigs)
    ? ((product as any).storeConfigs as ProductStoreConfig[])
    : [];
}

function getVisibleStoreConfigs(
  product: Product,
  stores: StoreItem[],
  selectedStoreId?: string
): ProductStoreConfig[] {
  const configs = getStoreConfigs(product);

  const visibleConfigs =
    selectedStoreId && selectedStoreId !== "all"
      ? configs.filter((config) => {
          const configStoreId = String(config.storeId || "").trim();

          return (
            configStoreId === selectedStoreId ||
            isSameStore(configStoreId, selectedStoreId, stores)
          );
        })
      : configs;

  if (visibleConfigs.length) return visibleConfigs;

  const source = product as any;

  return [
    {
      storeId: getItemStoreId(product),
      category: source.category,
      categoryId: source.categoryId,
      categoryName: source.categoryName,
      price: source.price,
      sizes: source.sizes,
      modifierGroups: source.modifierGroups,
      modifierGroupIds: source.modifierGroupIds,
      modifiers: source.modifiers,
      relatedUpsells: source.relatedUpsells,
      upsell: source.upsell,
      upsellName: source.upsellName,
      status: source.status,
      sortOrder: source.sortOrder,
    },
  ];
}

function getStoreNameById(stores: StoreItem[], storeId: unknown) {
  const cleanStoreId = String(storeId || "").trim();

  if (!cleanStoreId) return "No Store";

  const foundStore = stores.find((store) => {
    const variants = getStoreVariants(store);
    return variants.includes(cleanStoreId);
  });

  return foundStore?.name || cleanStoreId;
}

function categoryMatchesValue(category: Category, value: string) {
  if (!value) return false;

  const categoryObj = category as Category & {
    _id?: string;
    id?: string;
    slug?: string;
  };

  const categoryValues = [
    categoryObj._id,
    categoryObj.id,
    categoryObj.name,
    categoryObj.slug,
  ]
    .map((item) => normalizeValue(item))
    .filter(Boolean);

  return categoryValues.includes(value);
}

function getConfigCategoryName(
  categories: Category[],
  config: ProductStoreConfig,
  stores: StoreItem[]
) {
  const directCategoryName = String(config.categoryName || "").trim();

  if (directCategoryName) return directCategoryName;

  const configStoreId = String(config.storeId || "").trim();

  const categoryValues = [config.categoryId, config.category]
    .map((item) => normalizeValue(item))
    .filter(Boolean);

  const sameStoreCategory = categories.find((category) => {
    const categoryStoreId = getItemStoreId(category);

    const matchesCategory = categoryValues.some((value) =>
      categoryMatchesValue(category, value)
    );

    const matchesStore =
      !configStoreId ||
      !categoryStoreId ||
      isSameStore(configStoreId, categoryStoreId, stores);

    return matchesCategory && matchesStore;
  });

  if (sameStoreCategory?.name) return sameStoreCategory.name;

  const anyCategory = categories.find((category) =>
    categoryValues.some((value) => categoryMatchesValue(category, value))
  );

  return (
    anyCategory?.name ||
    getTextValue(config.categoryName, "") ||
    getTextValue(config.category, "") ||
    getTextValue(config.categoryId, "No Category")
  );
}

function getCleanSizes(source: ProductStoreConfig | Product) {
  const sizes = Array.isArray((source as any).sizes)
    ? ((source as any).sizes as ProductSize[])
    : [];

  return sizes
    .map((size) => ({
      name: String(size.name || size.label || size.sizeName || "").trim(),
      price: Number(size.price || 0),
    }))
    .filter((size) => size.name);
}

function getPriceNumbers(source: ProductStoreConfig | Product) {
  const sizes = getCleanSizes(source);

  if (sizes.length) {
    return sizes
      .map((size) => size.price)
      .filter((price) => Number.isFinite(price));
  }

  const price = Number((source as any).price || 0);

  return Number.isFinite(price) ? [price] : [];
}

function getPriceRangeLabel(sources: Array<ProductStoreConfig | Product>) {
  const prices = sources.flatMap((source) => getPriceNumbers(source));

  if (!prices.length) return "$0.00";

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) return `$${minPrice.toFixed(2)}`;

  return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
}

function getSourcePriceLabel(source: ProductStoreConfig | Product) {
  return getPriceRangeLabel([source]);
}

function getSizeSummary(source: ProductStoreConfig | Product) {
  const sizes = getCleanSizes(source);

  if (!sizes.length) return "No sizes";

  if (sizes.length <= 2) {
    return sizes
      .map((size) => `${size.name}: $${size.price.toFixed(2)}`)
      .join(" · ");
  }

  const firstTwo = sizes
    .slice(0, 2)
    .map((size) => `${size.name}: $${size.price.toFixed(2)}`)
    .join(" · ");

  return `${firstTwo} · +${sizes.length - 2} more`;
}

function getModifierGroups(source: ProductStoreConfig | Product) {
  const directGroups = Array.isArray((source as any).modifierGroups)
    ? ((source as any).modifierGroups as unknown[])
    : [];

  const idGroups = Array.isArray((source as any).modifierGroupIds)
    ? ((source as any).modifierGroupIds as unknown[])
    : [];

  const oldModifiers = Array.isArray((source as any).modifiers)
    ? ((source as any).modifiers as unknown[])
    : [];

  return directGroups.length
    ? directGroups
    : idGroups.length
    ? idGroups
    : oldModifiers;
}

function getModifierSummary(source: ProductStoreConfig | Product) {
  const modifierGroups = getModifierGroups(source);

  if (!modifierGroups.length) return "No modifiers";

  const names = modifierGroups
    .map((group) => getTextValue(group, "Modifier Group"))
    .filter(Boolean);

  if (names.length <= 1) return names[0] || "No modifiers";

  return `${names[0]} +${names.length - 1} more`;
}

function formatMoney(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : "$0.00";
}

function getUpsellRuleName(rule: UpsellRule) {
  return String(rule.name || rule.offer || rule.slug || "Upsell Offer").trim();
}

function getUpsellRuleSearchValues(rule: UpsellRule, fallback: string) {
  const obj = rule as UpsellRule & { _id?: string };

  return [obj._id, obj.id, obj.slug, obj.name, obj.offer, fallback]
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
}

function findUpsellRuleByValue(upsellRules: UpsellRule[], value: unknown) {
  const cleanValue = String(value || "").trim().toLowerCase();

  if (!cleanValue) return undefined;

  return upsellRules.find((rule, index) =>
    getUpsellRuleSearchValues(rule, `upsell-${index}`).includes(cleanValue)
  );
}

function getLegacyUpsellText(source: ProductStoreConfig | Product) {
  return String(
    (source as any).upsellName || (source as any).upsell || ""
  ).trim();
}

function getUpsellSummary(
  source: ProductStoreConfig | Product,
  upsellRules: UpsellRule[]
): UpsellDisplayItem[] {
  const relatedUpsells = Array.isArray((source as any).relatedUpsells)
    ? ((source as any).relatedUpsells as Array<ProductRelatedUpsell | string>)
    : [];

  if (relatedUpsells.length > 0) {
    return relatedUpsells
      .map((item, index) => {
        if (typeof item === "string") {
          const upsellId = item.trim();
          const matchedRule = findUpsellRuleByValue(upsellRules, upsellId);

          return {
            key: `${upsellId || "upsell"}-${index}`,
            name: matchedRule ? getUpsellRuleName(matchedRule) : upsellId,
            price: null,
          };
        }

        if (!item || typeof item !== "object") return null;

        const obj = item as ProductRelatedUpsell & {
          _id?: string;
          id?: string;
          offer?: string;
        };

        const upsellId = String(
          obj.upsellId || obj.id || obj._id || ""
        ).trim();

        const savedName = String(obj.name || obj.offer || "").trim();

        const matchedRule =
          findUpsellRuleByValue(upsellRules, upsellId) ||
          findUpsellRuleByValue(upsellRules, savedName);

        const name = matchedRule
          ? getUpsellRuleName(matchedRule)
          : savedName && savedName !== upsellId
          ? savedName
          : upsellId || "Upsell";

        return {
          key: `${upsellId || name || "upsell"}-${index}`,
          name,
          price: Number(obj.price || 0),
        };
      })
      .filter(Boolean) as UpsellDisplayItem[];
  }

  const legacyUpsell = getLegacyUpsellText(source);

  if (!legacyUpsell) {
    return [
      {
        key: "no-upsell",
        name: "No upsell",
        price: null,
      },
    ];
  }

  const matchedRule = findUpsellRuleByValue(upsellRules, legacyUpsell);

  return [
    {
      key: legacyUpsell,
      name: matchedRule ? getUpsellRuleName(matchedRule) : legacyUpsell,
      price: null,
    },
  ];
}

function getStatusLabel(source: ProductStoreConfig | Product) {
  return String((source as any).status || "Active");
}

function getProductStatusSummary(
  configs: ProductStoreConfig[],
  product: Product
) {
  const statuses = configs.length
    ? configs.map((config) => getStatusLabel(config))
    : [getStatusLabel(product)];

  const uniqueStatuses = Array.from(new Set(statuses));

  if (uniqueStatuses.length === 1) return uniqueStatuses[0];

  return "Mixed";
}

function getStoreLabels(
  product: Product,
  stores: StoreItem[],
  selectedStoreId?: string
) {
  const configs = getVisibleStoreConfigs(product, stores, selectedStoreId);

  const labels = configs.map((config) =>
    getStoreNameById(stores, config.storeId || getItemStoreId(product))
  );

  return Array.from(new Set(labels.filter(Boolean)));
}

function getLimitedStoreLabels(storeLabels: string[]) {
  const visibleLabels = storeLabels.slice(0, 3);
  const hiddenCount = Math.max(storeLabels.length - visibleLabels.length, 0);

  return {
    visibleLabels,
    hiddenCount,
  };
}

function getConfigWarnings(
  config: ProductStoreConfig,
  categoryName: string,
  priceLabel: string
) {
  const warnings: string[] = [];

  if (!config.storeId) warnings.push("Missing store");
  if (!categoryName || categoryName === "No Category") {
    warnings.push("Missing category");
  }
  if (priceLabel === "$0.00") warnings.push("Price missing");
  if (!getModifierGroups(config).length) warnings.push("No modifiers");

  return warnings;
}

export default function ProductTable({
  products,
  categories = [],
  stores = [],
  upsellRules = [],
  selectedStoreId = "all",
  onEdit,
  onDelete,
}: {
  products: Product[];
  categories?: Category[];
  stores?: StoreItem[];
  upsellRules?: UpsellRule[];
  selectedStoreId?: string;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null
  );

  const productCountLabel = useMemo(() => {
    return `${products.length} product${products.length === 1 ? "" : "s"}`;
  }, [products.length]);

  if (!products.length) return <EmptyBox message="No products found." />;

  return (
    <div className="overflow-hidden rounded-[26px] border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 bg-zinc-50/80 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-zinc-950">Products</h3>
            <p className="mt-1 text-sm font-medium text-zinc-500">
              Summary table with compact store-wise details for review.
            </p>
          </div>

          <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-zinc-600 shadow-sm ring-1 ring-zinc-200">
            {productCountLabel}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1150px] text-left">
          <thead className="border-b border-zinc-200 bg-white">
            <tr>
              <TableHead>Product</TableHead>
              <TableHead>Stores</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Modifiers</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {products.map((product, index) => {
              const productId = getItemId(
                product,
                `${product.name || "product"}-${index}`
              );

              const configs = getVisibleStoreConfigs(
                product,
                stores,
                selectedStoreId
              );

              const storeLabels = getStoreLabels(
                product,
                stores,
                selectedStoreId
              );

              const { visibleLabels, hiddenCount } =
                getLimitedStoreLabels(storeLabels);

              const isExpanded = expandedProductId === productId;
              const statusSummary = getProductStatusSummary(configs, product);
              const priceSummary = getPriceRangeLabel(configs);
              const modifierSummary = getModifierSummary(configs[0] || product);

              return (
                <Fragment key={productId}>
                  <tr className="transition hover:bg-green-50/40">
                    <td className="px-5 py-5 align-middle">
                      <div className="flex items-center gap-3">
                        <ImageBox src={product.image} alt={product.name} />

                        <div className="min-w-0">
                          <p className="truncate font-black text-zinc-950">
                            {product.name}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-zinc-500">
                            Master product
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-5 align-middle">
                      <div className="flex max-w-[280px] flex-wrap gap-2">
                        {visibleLabels.length ? (
                          <>
                            {visibleLabels.map((storeName) => (
                              <span
                                key={`${productId}-store-${storeName}`}
                                className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-800"
                              >
                                {storeName}
                              </span>
                            ))}

                            {hiddenCount > 0 && (
                              <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-black text-zinc-600">
                                +{hiddenCount} more
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-zinc-400">
                            No store
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-xs font-semibold text-zinc-400">
                        {configs.length} config
                        {configs.length === 1 ? "" : "s"}
                      </p>
                    </td>

                    <td className="px-5 py-5 align-middle">
                      <p className="text-sm font-black text-zinc-950">
                        {priceSummary}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-zinc-500">
                        Store-wise pricing
                      </p>
                    </td>

                    <td className="px-5 py-5 align-middle">
                      <span className="inline-flex max-w-[260px] items-center rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-black text-green-800">
                        <span className="truncate">{modifierSummary}</span>
                      </span>
                    </td>

                    <td className="px-5 py-5 align-middle">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProductId(isExpanded ? null : productId)
                        }
                        className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-black text-zinc-700 shadow-sm transition hover:border-green-200 hover:bg-green-50 hover:text-green-800"
                      >
                        {isExpanded ? "Hide Details" : "View Details"}
                      </button>
                    </td>

                    <td className="px-5 py-5 align-middle">
                      {statusSummary === "Mixed" ? (
                        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                          Mixed
                        </span>
                      ) : (
                        <StatusBadge status={statusSummary} />
                      )}
                    </td>

                    <td className="px-5 py-5 align-middle">
                      <ActionButtons
                        onEdit={() => onEdit(product)}
                        onDelete={() => onDelete(productId)}
                      />
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-zinc-50/70">
                      <td colSpan={7} className="px-5 py-4">
                        <div className="rounded-[22px] border border-zinc-200 bg-white shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                            <div>
                              <h4 className="text-sm font-black text-zinc-950">
                                Store comparison
                              </h4>

                              <p className="mt-1 text-xs font-semibold text-zinc-500">
                                Review category, prices, sizes, modifiers,
                                upsell, and issues in one compact table.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => onEdit(product)}
                              className="rounded-full bg-green-700 px-4 py-2 text-xs font-black text-white transition hover:bg-green-800"
                            >
                              Edit Product
                            </button>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[1000px] text-left">
                              <thead className="bg-zinc-50">
                                <tr>
                                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-zinc-500">
                                    Store
                                  </th>
                                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-zinc-500">
                                    Category
                                  </th>
                                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-zinc-500">
                                    Price
                                  </th>
                                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-zinc-500">
                                    Sizes
                                  </th>
                                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-zinc-500">
                                    Modifiers
                                  </th>
                                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-zinc-500">
                                    Upsell
                                  </th>
                                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-zinc-500">
                                    Issues
                                  </th>
                                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-zinc-500">
                                    Status
                                  </th>
                                </tr>
                              </thead>

                              <tbody className="divide-y divide-zinc-100">
                                {configs.map((config, configIndex) => {
                                  const configId = getItemId(
                                    config,
                                    `${productId}-config-${configIndex}`
                                  );

                                  const storeName = getStoreNameById(
                                    stores,
                                    config.storeId || getItemStoreId(product)
                                  );

                                  const categoryName = getConfigCategoryName(
                                    categories,
                                    config,
                                    stores
                                  );

                                  const priceLabel = getSourcePriceLabel(config);
                                  const sizeSummary = getSizeSummary(config);
                                  const modifierLabel =
                                    getModifierSummary(config);
                                  const upsellItems = getUpsellSummary(
                                    config,
                                    upsellRules
                                  );
                                  const status = getStatusLabel(config);

                                  const warnings = getConfigWarnings(
                                    config,
                                    categoryName,
                                    priceLabel
                                  );

                                  return (
                                    <tr
                                      key={`${productId}-detail-${configId}-${configIndex}`}
                                      className="align-top hover:bg-green-50/30"
                                    >
                                      <td className="px-5 py-4">
                                        <p className="font-black text-zinc-950">
                                          {storeName}
                                        </p>

                                        {/* <p className="mt-1 text-xs font-semibold text-zinc-400">
                                          Config #{configIndex + 1}
                                        </p> */}
                                      </td>

                                      <td className="px-5 py-4">
                                        <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-black text-zinc-700">
                                          {categoryName}
                                        </span>
                                      </td>

                                      <td className="px-5 py-4">
                                        <p className="font-black text-zinc-950">
                                          {priceLabel}
                                        </p>
                                      </td>

                                      <td className="px-5 py-4">
                                        <p className="max-w-[260px] text-xs font-bold leading-5 text-zinc-700">
                                          {sizeSummary}
                                        </p>
                                      </td>

                                      <td className="px-5 py-4">
                                        <p className="max-w-[260px] text-xs font-bold leading-5 text-green-800">
                                          {modifierLabel}
                                        </p>
                                      </td>

                                      <td className="px-5 py-4">
                                        <div className="max-w-[280px] space-y-1">
                                          {upsellItems.map((upsell) => (
                                            <p
                                              key={upsell.key}
                                              className="text-xs font-bold leading-5 text-zinc-700"
                                            >
                                              <span className="text-green-800">
                                                {upsell.name}
                                              </span>

                                              {upsell.price !== null ? (
                                                <span className="ml-1 font-black text-zinc-950">
                                                  {formatMoney(upsell.price)}
                                                </span>
                                              ) : null}
                                            </p>
                                          ))}
                                        </div>
                                      </td>

                                      <td className="px-5 py-4">
                                        {warnings.length ? (
                                          <div className="flex max-w-[240px] flex-wrap gap-2">
                                            {warnings.map((warning) => (
                                              <span
                                                key={`${productId}-${configId}-warning-${warning}`}
                                                className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700"
                                              >
                                                {warning}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-800">
                                            Looks good
                                          </span>
                                        )}
                                      </td>

                                      <td className="px-5 py-4">
                                        <StatusBadge status={status} />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}