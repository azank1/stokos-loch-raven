import "server-only";

import connectDB from "@/lib/mongodb";
import StoreMenu from "@/models/storemenu";
import { getStoreMenuCategories } from "@/lib/server/menucategories";
import { getStoreMenuProducts } from "@/lib/server/menuproducts";
import { clearStoreMenuSnapshotCache } from "@/lib/server/storemenu-snapshot";

type MenuCategoryTab = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  sortOrder?: number;
};

type DbCategory = {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  sortOrder?: number;
};

type DbProduct = {
  id?: string;
  _id?: string;
  productId?: string;
  slug?: string;
  name?: string;
  title?: string;
  category?: any;
  categoryId?: string;
  categoryName?: string;
  categoryTitle?: string;
  categorySlug?: string;
  categorySortOrder?: number;
  isPopular?: boolean;
  showInPopular?: boolean;
  popular?: boolean;
  featured?: boolean;
};

const POPULAR_CATEGORY: MenuCategoryTab = {
  id: "trending",
  slug: "trending",
  name: "Popular Menu Items",
  description: "",
  image: "",
  sortOrder: -1,
};

const MENU_COUPON_CATEGORY_KEYS = new Set([
  "menu-coupons",
  "menu-coupon",
  "menu-coupon-category",
  "coupons",
  "coupon",
  "deals",
  "deal",
  "menu-deals",
  "menu-deal",
]);

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const number = Number(cleanString(value).replace(/[^0-9.-]/g, "") || 0);
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

function slugify(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toPlainJSON<T>(value: T, fallback: T): T {
  try {
    if (value === undefined || value === null) return fallback;
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return fallback;
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPopularCategory(category: Partial<DbCategory | MenuCategoryTab>) {
  const id = slugify(category.id);
  const slug = slugify(category.slug);
  const name = slugify(category.name);

  return (
    id === "trending" ||
    slug === "trending" ||
    name === "trending" ||
    name === "popular-menu-items" ||
    name === "popular-items" ||
    name === "popular-menu-item"
  );
}

function isMenuCouponsCategory(category: Partial<DbCategory | MenuCategoryTab>) {
  return [category.id, category.slug, category.name]
    .filter(Boolean)
    .map((value) => slugify(value))
    .some((key) => MENU_COUPON_CATEGORY_KEYS.has(key));
}

function isProductPopular(product: DbProduct) {
  return (
    cleanBoolean(product?.isPopular) ||
    cleanBoolean(product?.showInPopular) ||
    cleanBoolean(product?.popular) ||
    cleanBoolean(product?.featured)
  );
}

function normalizeCategory(category: DbCategory): MenuCategoryTab {
  const name = cleanString(category.name);
  const cleanSlug = slugify(category.slug || category.id || category._id || name);

  return {
    id: cleanSlug,
    slug: cleanSlug,
    name,
    description: cleanString(category.description),
    image: cleanString(category.image),
    sortOrder: cleanNumber(category.sortOrder),
  };
}

function getProductCategoryName(product: DbProduct) {
  if (typeof product?.category === "string") return cleanString(product.category);

  return cleanString(
    product?.categoryName ||
      product?.categoryTitle ||
      product?.category?.name ||
      product?.category?.title ||
      ""
  );
}

function getProductCategorySlug(product: DbProduct) {
  if (typeof product?.category === "string") return slugify(product.category);

  return slugify(
    product?.categorySlug ||
      product?.category?.slug ||
      product?.category?.id ||
      product?.category?._id ||
      getProductCategoryName(product) ||
      product?.categoryId
  );
}

function normalizeProductForSnapshot(product: DbProduct, index: number) {
  const plainProduct = toPlainJSON<any>(product, {} as any);

  const productId = cleanString(
    plainProduct.id || plainProduct._id || plainProduct.productId || plainProduct.slug
  );

  const categoryName = getProductCategoryName(plainProduct);
  const categorySlug = getProductCategorySlug(plainProduct);
  const title = cleanString(plainProduct.title || plainProduct.name);
  const name = cleanString(plainProduct.name || plainProduct.title);

  return {
    ...plainProduct,
    id: productId || `product-${index + 1}`,
    _id: cleanString(plainProduct._id || productId || `product-${index + 1}`),
    title,
    name,
    categoryName,
    categorySlug,
    categoryId: cleanString(
      plainProduct.categoryId ||
        plainProduct.category?._id ||
        plainProduct.category?.id ||
        categorySlug
    ),
  };
}

function normalizeProductsForSnapshot(products: DbProduct[]) {
  return (Array.isArray(products) ? products : [])
    .map((product, index) => normalizeProductForSnapshot(product, index))
    .filter((product) => cleanString(product.title || product.name));
}

function deriveCategoriesFromProducts(products: DbProduct[]) {
  const seen = new Set<string>();

  return (Array.isArray(products) ? products : [])
    .map((product) => {
      const categoryName = getProductCategoryName(product);
      const categorySlug = getProductCategorySlug(product);

      return {
        id: categorySlug,
        slug: categorySlug,
        name: categoryName || categorySlug,
        description: "",
        image: "",
        sortOrder: cleanNumber(product?.categorySortOrder || 9999),
      };
    })
    .filter((category) => {
      if (!category.id || !category.name) return false;
      if (isPopularCategory(category)) return false;
      if (isMenuCouponsCategory(category)) return false;
      if (seen.has(category.id)) return false;

      seen.add(category.id);
      return true;
    });
}

export function buildSnapshotCategories(
  dbCategories: DbCategory[],
  products: DbProduct[]
) {
  const seen = new Set<string>();

  const realCategories = [
    ...(Array.isArray(dbCategories) ? dbCategories : [])
      .map((category) => toPlainJSON(category, {} as DbCategory))
      .filter((category) => !isPopularCategory(category))
      .map((category) => normalizeCategory(category)),
    ...deriveCategoriesFromProducts(products),
  ]
    .filter((category) => {
      if (!category.name) return false;
      if (isMenuCouponsCategory(category)) return false;

      const key = slugify(category.slug || category.id || category.name);
      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

  const hasPopularProducts = (Array.isArray(products) ? products : []).some(
    isProductPopular
  );

  return hasPopularProducts ? [POPULAR_CATEGORY, ...realCategories] : realCategories;
}

export async function rebuildStoreMenu(storeSlug: string, reason = "admin-change") {
  const cleanStoreSlug = slugify(storeSlug);

  if (!cleanStoreSlug) {
    throw new Error("Store slug is required to rebuild store menu snapshot.");
  }

  await connectDB();

  await StoreMenu.findOneAndUpdate(
    { storeSlug: cleanStoreSlug },
    {
      $set: {
        storeSlug: cleanStoreSlug,
        status: "building",
        "meta.rebuiltReason": reason,
        "meta.errorMessage": "",
      },
      $setOnInsert: {
        categories: [],
        products: [],
        menuProducts: [],
        version: 0,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  try {
    // Keep these sequential to avoid Mongo Atlas timeouts on heavy store menus.
    const dbCategoriesRaw = await getStoreMenuCategories(cleanStoreSlug);
    const dbProductsRaw = await getStoreMenuProducts(cleanStoreSlug);

    const products = normalizeProductsForSnapshot(
      Array.isArray(dbProductsRaw) ? dbProductsRaw : []
    );

    const categories = buildSnapshotCategories(
      Array.isArray(dbCategoriesRaw) ? dbCategoriesRaw : [],
      products
    );

    const now = new Date();

    const snapshot = await StoreMenu.findOneAndUpdate(
      { storeSlug: cleanStoreSlug },
      {
        $set: {
          storeSlug: cleanStoreSlug,
          status: "ready",
          categories,
          products,
          menuProducts: products,
          meta: {
            productCount: products.length,
            categoryCount: categories.length,
            rebuiltReason: reason,
            errorMessage: "",
            lastFailedAt: null,
          },
          builtAt: now,
        },
        $inc: { version: 1 },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).lean<any>();

    clearStoreMenuSnapshotCache(cleanStoreSlug);

    return {
      storeSlug: cleanStoreSlug,
      categories,
      products,
      menuProducts: products,
      version: snapshot?.version || 1,
      builtAt: snapshot?.builtAt || now,
      status: "ready",
    };
  } catch (error: any) {
    await StoreMenu.findOneAndUpdate(
      { storeSlug: cleanStoreSlug },
      {
        $set: {
          status: "failed",
          "meta.rebuiltReason": reason,
          "meta.errorMessage": error?.message || "Snapshot rebuild failed",
          "meta.lastFailedAt": new Date(),
        },
      },
      {
        upsert: false,
        new: true,
      }
    );

    clearStoreMenuSnapshotCache(cleanStoreSlug);

    throw error;
  }
}
