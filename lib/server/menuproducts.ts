import "server-only";

import mongoose from "mongoose";
import { unstable_cache } from "next/cache";
import connectDB from "@/lib/mongodb";
import Store from "@/models/store";
import Product from "@/models/product";
import Category from "@/models/category";
import ProductStoreConfig from "@/models/productstoreconfig";

export type FrontendMenuProduct = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  name: string;
  description: string;
  image: string;
  price: number;
  numericPrice: number;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  category: string;
  storeSlug: string;
  isPopular: boolean;
  showInPopular: boolean;
  sortOrder: number;
  status: string;
  updatedAt: string;
  hasDetails: boolean;
  sizes: any[];
  modifierGroups: any[];
  attachedModifierGroups: any[];
  relatedUpsells: any[];
  upsell: string;
};

export type FrontendMenuProductDetails = FrontendMenuProduct;

const FALLBACK_IMAGE = "/images/placeholder-food.png";
const MENU_CACHE_TTL_MS = 30_000;
const DETAIL_CACHE_TTL_MS = 20_000;
const MODIFIER_GROUP_COLLECTIONS = [
  "modifiergroups",
  "modifierGroups",
  "modifiergroup",
  "modifiergroupconfigs",
];

const memCache = new Map<string, { data: any; expiresAt: number }>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }

  return entry.data as T;
}

function memSet(key: string, data: any, ttlMs = MENU_CACHE_TTL_MS) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function clearStoreMenuProductsCache(storeSlug?: string) {
  if (!storeSlug) {
    memCache.clear();
    return;
  }

  const slug = normalizeStoreId(storeSlug);
  memCache.delete(`menu-products:${slug}`);

  Array.from(memCache.keys()).forEach((key) => {
    if (key.startsWith(`menu-product-detail:${slug}:`)) {
      memCache.delete(key);
    }
  });
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const number = Number(cleanString(value).replace(/[^0-9.-]/g, "") || 0);
  return Number.isFinite(number) ? number : 0;
}

function firstFilled(...values: unknown[]) {
  return values.find(
    (value) => value !== undefined && value !== null && cleanString(value) !== ""
  );
}

function cleanBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (["true", "yes", "1", "active", "popular", "featured"].includes(lower)) return true;
    if (["false", "no", "0", "inactive", "off", "hidden"].includes(lower)) return false;
  }

  return fallback;
}

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value || null));
}

function normalizeStoreId(value: unknown) {
  return cleanString(value).toLowerCase();
}

function buildStoreKeys(store: any, storeSlug: string) {
  return Array.from(
    new Set(
      [
        store?._id ? String(store._id) : "",
        store?.id ? String(store.id) : "",
        store?.slug ? String(store.slug) : "",
        storeSlug,
      ]
        .map((value) => normalizeStoreId(value))
        .filter(Boolean)
    )
  );
}

function getObjectIds(keys: string[]) {
  return keys
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

function buildProductMap(products: any[]) {
  const map = new Map<string, any>();

  products.forEach((product) => {
    if (product._id) map.set(String(product._id), product);
    if (product.id) map.set(String(product.id), product);
    if (product.slug) map.set(String(product.slug), product);
  });

  return map;
}

function addCategoryToMap(map: Map<string, any>, category: any) {
  const keys = [
    category?._id ? String(category._id) : "",
    category?.id,
    category?.slug,
    category?.name,
  ]
    .map((value) => cleanString(value))
    .filter(Boolean);

  keys.forEach((key) => {
    map.set(key, category);
    map.set(slugify(key), category);
  });
}

function getConfigProductKey(config: any) {
  return cleanString(config?.productId || config?.productID || config?.product_id);
}

function getCategoryKeys(config: any, product: any) {
  const productCategory = typeof product?.category === "string" ? product.category : "";

  return [
    config?.categoryId,
    config?.categorySlug,
    config?.categoryName,
    product?.categoryId,
    product?.categorySlug,
    product?.categoryName,
    product?.categoryTitle,
    productCategory,
    product?.category?.id,
    product?.category?._id,
    product?.category?.slug,
    product?.category?.name,
    product?.category?.title,
  ]
    .map((value) => cleanString(value))
    .filter(Boolean);
}

function pickArray(config: any, product: any, key: string, fallbackKey?: string) {
  const configValue = readArray(config?.[key]);
  if (configValue.length > 0) return configValue;

  if (fallbackKey) {
    const configFallbackValue = readArray(config?.[fallbackKey]);
    if (configFallbackValue.length > 0) return configFallbackValue;
  }

  const productValue = readArray(product?.[key]);
  if (productValue.length > 0) return productValue;

  if (fallbackKey) {
    const productFallbackValue = readArray(product?.[fallbackKey]);
    if (productFallbackValue.length > 0) return productFallbackValue;
  }

  return [];
}

async function findActiveStore(storeSlug: string) {
  const cleanSlug = normalizeStoreId(storeSlug);
  if (!cleanSlug) return null;

  return Store.findOne({ slug: cleanSlug, status: "Active" })
    .select({ _id: 1, id: 1, slug: 1, status: 1 })
    .lean<any>()
    .maxTimeMS(5000);
}

async function findCategoryDocs(keys: string[]) {
  const cleanKeys = Array.from(new Set(keys.map((key) => cleanString(key)).filter(Boolean)));
  if (!cleanKeys.length) return [];

  const objectIds = getObjectIds(cleanKeys);
  const slugKeys = cleanKeys.map((key) => slugify(key));

  const orQuery: any[] = [
    { id: { $in: cleanKeys } },
    { slug: { $in: [...cleanKeys, ...slugKeys] } },
    { name: { $in: cleanKeys } },
  ];

  if (objectIds.length) {
    orQuery.push({ _id: { $in: objectIds } });
  }

  return Category.find({
    $and: [
      {
        $or: [
          { status: "Active" },
          { status: { $exists: false } },
          { status: "" },
        ],
      },
      { $or: orQuery },
    ],
  })
    .select({
      _id: 1,
      id: 1,
      name: 1,
      slug: 1,
      status: 1,
      sortOrder: 1,
      updatedAt: 1,
    })
    .lean<any[]>()
    .maxTimeMS(5000);
}

function getCategoryDocForProduct(map: Map<string, any>, config: any, product: any) {
  return getCategoryKeys(config, product)
    .map((key) => map.get(key) || map.get(slugify(key)))
    .find(Boolean);
}

function makeBaseProduct(storeSlug: string, product: any, config: any, categoryDoc?: any) {
  const productId = cleanString(product?._id || product?.id || config?.productId);
  const title = cleanString(product?.name || product?.title || "Menu Item");
  const slug = slugify(product?.slug || title || productId);
  const price = cleanNumber(firstFilled(config?.price, product?.price, product?.numericPrice));

  const rawProductCategory = typeof product?.category === "string" ? product.category : "";
  let categoryName = cleanString(
    config?.categoryName ||
      product?.categoryName ||
      product?.categoryTitle ||
      product?.category?.name ||
      product?.category?.title ||
      categoryDoc?.name ||
      rawProductCategory
  );

  const categorySlug = slugify(
    config?.categorySlug ||
      product?.categorySlug ||
      product?.category?.slug ||
      categoryDoc?.slug ||
      categoryName ||
      config?.categoryId ||
      product?.categoryId
  );

  if (!categoryName && categorySlug) {
    categoryName = categorySlug.replace(/-/g, " ");
  }

  const categoryId = cleanString(
    config?.categoryId ||
      product?.categoryId ||
      categoryDoc?._id ||
      categoryDoc?.id ||
      categorySlug
  );

  const isPopular =
    cleanBoolean(config?.isPopular) ||
    cleanBoolean(config?.showInPopular) ||
    cleanBoolean(product?.isPopular) ||
    cleanBoolean(product?.showInPopular) ||
    cleanBoolean(product?.popular) ||
    cleanBoolean(product?.featured);

  return {
    id: productId,
    productId,
    slug,
    title,
    name: title,
    description: cleanString(product?.description),
    image: cleanString(config?.image || product?.image) || FALLBACK_IMAGE,
    price,
    numericPrice: price,
    categoryId,
    categoryName,
    categorySlug,
    category: categorySlug || categoryName || categoryId,
    storeSlug,
    isPopular,
    showInPopular: isPopular,
    sortOrder: Number(config?.sortOrder ?? product?.sortOrder ?? 0),
    status: cleanString(config?.status || product?.status || "Active"),
    updatedAt: cleanString(config?.updatedAt || product?.lastSavedAt || product?.updatedAt),
  };
}

function buildListProduct(
  storeSlug: string,
  product: any,
  config: any
): FrontendMenuProduct {
  const baseProduct = makeBaseProduct(storeSlug, product, config);

  return {
    ...baseProduct,
    hasDetails: false,
    sizes: [],
    modifierGroups: [],
    attachedModifierGroups: [],
    relatedUpsells: [],
    upsell: "",
  };
}

function getModifierGroupKeys(rawGroup: unknown) {
  if (!rawGroup) return [];

  if (typeof rawGroup === "string" || typeof rawGroup === "number") {
    return [cleanString(rawGroup)].filter(Boolean);
  }

  if (!isRecord(rawGroup)) return [];

  return [
    rawGroup._id,
    rawGroup.id,
    rawGroup.modifierGroupId,
    rawGroup.groupId,
    rawGroup.value,
    rawGroup.slug,
    rawGroup.name,
  ]
    .map((value) => cleanString(value))
    .filter(Boolean);
}

function modifierGroupHasOptions(rawGroup: unknown) {
  if (!isRecord(rawGroup)) return false;
  return readArray(rawGroup.options).length > 0 || readArray(rawGroup.modifierOptions).length > 0;
}

function addModifierGroupToMap(map: Map<string, any>, group: any) {
  getModifierGroupKeys(group).forEach((key) => {
    map.set(key, group);
    map.set(slugify(key), group);
  });
}

async function findModifierGroupDocs(keys: string[]) {
  const cleanKeys = Array.from(new Set(keys.map((key) => cleanString(key)).filter(Boolean)));

  if (!cleanKeys.length || !mongoose.connection.db) return [];

  const objectIds = getObjectIds(cleanKeys);
  const slugKeys = cleanKeys.map((key) => slugify(key));

  const orQuery: any[] = [
    { id: { $in: cleanKeys } },
    { modifierGroupId: { $in: cleanKeys } },
    { groupId: { $in: cleanKeys } },
    { slug: { $in: slugKeys } },
    { name: { $in: cleanKeys } },
  ];

  if (objectIds.length) {
    orQuery.push({ _id: { $in: objectIds } });
  }

  const statusQuery = {
    $or: [{ status: "Active" }, { status: { $exists: false } }, { status: "" }],
  };

  const foundDocs: any[] = [];
  const seen = new Set<string>();

  for (const collectionName of MODIFIER_GROUP_COLLECTIONS) {
    const docs = await mongoose.connection.db
      .collection(collectionName)
      .find({ $and: [{ $or: orQuery }, statusQuery] })
      .sort({ sortOrder: 1, name: 1 })
      .toArray();

    docs.forEach((doc) => {
      const key = cleanString(doc?._id || doc?.id || doc?.modifierGroupId || doc?.slug || doc?.name);
      if (!key || seen.has(key)) return;

      seen.add(key);
      foundDocs.push(toPlain(doc));
    });
  }

  return foundDocs;
}

async function buildModifierGroupDocMap(rawGroupsCollection: any[][]) {
  const lookupKeys = Array.from(
    new Set(
      rawGroupsCollection
        .flat()
        .filter((group) => !modifierGroupHasOptions(group))
        .flatMap((group) => getModifierGroupKeys(group))
        .filter(Boolean)
    )
  );

  const docs = await findModifierGroupDocs(lookupKeys);
  const docMap = new Map<string, any>();

  docs.forEach((doc) => addModifierGroupToMap(docMap, doc));

  return docMap;
}

function hydrateModifierGroupsWithMap(rawGroups: any[], docMap: Map<string, any>) {
  const groups = readArray(rawGroups);
  if (!groups.length) return [];

  return groups
    .map((rawGroup) => {
      if (modifierGroupHasOptions(rawGroup)) return toPlain(rawGroup);

      const rawGroupRecord = isRecord(rawGroup) ? rawGroup : { modifierGroupId: rawGroup };
      const rawKeys = getModifierGroupKeys(rawGroup);
      const matchedDoc = rawKeys
        .map((key) => docMap.get(key) || docMap.get(slugify(key)))
        .find(Boolean);

      if (!matchedDoc) return toPlain(rawGroupRecord);

      const rawOptions = readArray(rawGroupRecord.options).length
        ? readArray(rawGroupRecord.options)
        : readArray(rawGroupRecord.modifierOptions);

      const docOptions = readArray(matchedDoc.options).length
        ? readArray(matchedDoc.options)
        : readArray(matchedDoc.modifierOptions);

      return toPlain({
        ...matchedDoc,
        ...rawGroupRecord,
        options: rawOptions.length ? rawOptions : docOptions,
        modifierOptions: rawOptions.length ? rawOptions : docOptions,
        name: cleanString(rawGroupRecord.name || matchedDoc.name || matchedDoc.title),
        title: cleanString(rawGroupRecord.title || rawGroupRecord.name || matchedDoc.title || matchedDoc.name),
      });
    })
    .filter((group) => modifierGroupHasOptions(group));
}

async function hydrateModifierGroups(rawGroups: any[]) {
  const docMap = await buildModifierGroupDocMap([rawGroups]);
  return hydrateModifierGroupsWithMap(rawGroups, docMap);
}

function buildFullProduct(
  storeSlug: string,
  product: any,
  config: any,
  hydratedModifierGroups: any[],
  categoryDoc?: any
): FrontendMenuProduct {
  const baseProduct = makeBaseProduct(storeSlug, product, config, categoryDoc);
  const sizes = pickArray(config, product, "sizes");
  const relatedUpsells = pickArray(config, product, "relatedUpsells");

  return {
    ...baseProduct,
    sizes: toPlain(sizes || []),
    modifierGroups: hydratedModifierGroups,
    attachedModifierGroups: hydratedModifierGroups,
    relatedUpsells: toPlain(relatedUpsells || []),
    upsell: cleanString(config?.upsell || product?.upsell),
    hasDetails: true,
  };
}

async function getActiveStoreProductListConfigs(storeKeys: string[]) {
  return ProductStoreConfig.find({
    storeId: { $in: storeKeys },
    $and: [
      {
        $or: [
          { status: "Active" },
          { status: { $exists: false } },
          { status: "" },
        ],
      },
      {
        $or: [
          { isAvailable: true },
          { available: true },
          {
            isAvailable: { $exists: false },
            available: { $exists: false },
          },
        ],
      },
    ],
  })
    .select({
      _id: 1,
      productId: 1,
      storeId: 1,
      categoryId: 1,
      categoryName: 1,
      categorySlug: 1,
      price: 1,
      image: 1,
      isPopular: 1,
      showInPopular: 1,
      sortOrder: 1,
      status: 1,
      updatedAt: 1,
    })
    .sort({ sortOrder: 1, updatedAt: -1 })
    .lean<any[]>()
    .maxTimeMS(5000);
}

async function findListProductsByConfigIds(productIds: string[]) {
  const objectIds = getObjectIds(productIds);
  const productOrQuery: any[] = [
    { id: { $in: productIds } },
    { slug: { $in: productIds } },
  ];

  if (objectIds.length) {
    productOrQuery.push({ _id: { $in: objectIds } });
  }

  return Product.find({
    status: "Active",
    $or: productOrQuery,
  })
    .select({
      _id: 1,
      id: 1,
      name: 1,
      title: 1,
      slug: 1,
      description: 1,
      image: 1,
      status: 1,
      sortOrder: 1,
      price: 1,
      numericPrice: 1,
      category: 1,
      categoryId: 1,
      categoryName: 1,
      categoryTitle: 1,
      categorySlug: 1,
      isPopular: 1,
      showInPopular: 1,
      popular: 1,
      featured: 1,
      updatedAt: 1,
      lastSavedAt: 1,
    })
    .lean<any[]>()
    .maxTimeMS(5000);
}

// ✅ LIST endpoint/page helper: fast product cards only.
// Do NOT fetch sizes/modifierGroups/attachedModifierGroups here.
// Product details are loaded only when ProductModal opens.
async function getStoreMenuProductsFromDB(storeSlug: string): Promise<FrontendMenuProduct[]> {
  const cleanSlug = normalizeStoreId(storeSlug);
  if (!cleanSlug) return [];

  await connectDB();

  const store = await findActiveStore(cleanSlug);
  if (!store) return [];

  const storeKeys = buildStoreKeys(store, cleanSlug);
  const configs = await getActiveStoreProductListConfigs(storeKeys);

  if (!configs.length) return [];

  const productIds = Array.from(
    new Set(configs.map((config) => getConfigProductKey(config)).filter(Boolean))
  );

  if (!productIds.length) return [];

  const products = await findListProductsByConfigIds(productIds);
  const productMap = buildProductMap(products);

  const result = configs
    .map((config) => {
      const product = productMap.get(getConfigProductKey(config));
      if (!product) return null;

      return buildListProduct(cleanSlug, product, config);
    })
    .filter(Boolean) as FrontendMenuProduct[];

  return result.sort((a, b) => {
    const categorySort = a.categorySlug.localeCompare(b.categorySlug);
    if (categorySort !== 0) return categorySort;

    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}


const getCachedStoreMenuProducts = unstable_cache(
  getStoreMenuProductsFromDB,
  ["store-menu-products-v5"],
  {
    revalidate: 30,
    tags: ["store-menu-products", "store-menu"],
  }
);

export async function getStoreMenuProducts(storeSlug: string): Promise<FrontendMenuProduct[]> {
  const cleanSlug = normalizeStoreId(storeSlug);
  const cacheKey = `menu-products:${cleanSlug}`;
  const cached = memGet<FrontendMenuProduct[]>(cacheKey);
  if (cached) return cached;

  const data = await getCachedStoreMenuProducts(cleanSlug);
  memSet(cacheKey, data, MENU_CACHE_TTL_MS);
  return data;
}

export async function getStoreMenuProductDetails(
  storeSlug: string,
  productId: string
): Promise<FrontendMenuProductDetails | null> {
  const cleanSlug = normalizeStoreId(storeSlug);
  const cleanId = cleanString(productId);

  if (!cleanSlug || !cleanId) return null;

  const cacheKey = `menu-product-detail:${cleanSlug}:${cleanId}`;
  const cached = memGet<FrontendMenuProductDetails>(cacheKey);
  if (cached) return cached;

  await connectDB();

  const store = await findActiveStore(cleanSlug);
  if (!store) return null;

  const storeKeys = buildStoreKeys(store, cleanSlug);
  const productIdKeys = Array.from(
    new Set([cleanId, decodeURIComponent(cleanId)].filter(Boolean))
  );
  const productObjectIds = getObjectIds(productIdKeys);

  const productOrQuery: any[] = [
    { id: { $in: productIdKeys } },
    { slug: { $in: productIdKeys } },
  ];

  if (productObjectIds.length) {
    productOrQuery.push({ _id: { $in: productObjectIds } });
  }

  const product = await Product.findOne({
    status: "Active",
    $or: productOrQuery,
  })
    .select({
      _id: 1,
      id: 1,
      name: 1,
      title: 1,
      slug: 1,
      description: 1,
      image: 1,
      status: 1,
      sortOrder: 1,
      price: 1,
      numericPrice: 1,
      category: 1,
      categoryId: 1,
      categoryName: 1,
      categoryTitle: 1,
      categorySlug: 1,
      sizes: 1,
      modifierGroups: 1,
      attachedModifierGroups: 1,
      relatedUpsells: 1,
      upsell: 1,
      isPopular: 1,
      showInPopular: 1,
      popular: 1,
      featured: 1,
      updatedAt: 1,
      lastSavedAt: 1,
    })
    .lean<any>()
    .maxTimeMS(5000);

  if (!product) return null;

  const realProductKeys = Array.from(
    new Set(
      [
        product._id ? String(product._id) : "",
        product.id,
        product.slug,
        cleanId,
      ]
        .map((value) => cleanString(value))
        .filter(Boolean)
    )
  );

  const configProductIds: any[] = [...realProductKeys, ...getObjectIds(realProductKeys)];

  const config = await ProductStoreConfig.findOne({
    storeId: { $in: storeKeys },
    productId: { $in: configProductIds },
    $and: [
      {
        $or: [
          { status: "Active" },
          { status: { $exists: false } },
          { status: "" },
        ],
      },
      {
        $or: [
          { isAvailable: true },
          { available: true },
          {
            isAvailable: { $exists: false },
            available: { $exists: false },
          },
        ],
      },
    ],
  })
    .select({
      productId: 1,
      storeId: 1,
      categoryId: 1,
      categoryName: 1,
      categorySlug: 1,
      price: 1,
      image: 1,
      sizes: 1,
      modifierGroups: 1,
      attachedModifierGroups: 1,
      relatedUpsells: 1,
      upsell: 1,
      isPopular: 1,
      showInPopular: 1,
      sortOrder: 1,
      status: 1,
      updatedAt: 1,
    })
    .lean<any>()
    .maxTimeMS(5000);

  if (!config) return null;

  const rawModifierGroups = pickArray(config, product, "modifierGroups", "attachedModifierGroups");
  const [modifierGroups, categoryDocs] = await Promise.all([
    hydrateModifierGroups(rawModifierGroups),
    findCategoryDocs(getCategoryKeys(config, product)),
  ]);

  const categoryMap = new Map<string, any>();
  categoryDocs.forEach((doc) => addCategoryToMap(categoryMap, doc));
  const categoryDoc = getCategoryDocForProduct(categoryMap, config, product);

  const fullProduct = buildFullProduct(cleanSlug, product, config, modifierGroups, categoryDoc);
  memSet(cacheKey, fullProduct, DETAIL_CACHE_TTL_MS);

  return fullProduct;
}
