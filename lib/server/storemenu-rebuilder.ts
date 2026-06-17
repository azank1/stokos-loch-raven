import "server-only";

import connectDB from "@/lib/mongodb";
import StoreMenu from "@/models/storemenu";
import {
  clearStoreMenuProductsCache,
  getStoreMenuProducts,
} from "@/lib/server/menuproducts";
import { clearStoreMenuSnapshotCache } from "@/lib/server/storemenu-snapshot";

export type MenuCategoryTab = {
  id: string;
  name: string;
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
  description?: string;
  image?: string;
  price?: number;
  numericPrice?: number;
  category?: any;
  categoryId?: string;
  categoryName?: string;
  categoryTitle?: string;
  categorySlug?: string;
  categorySortOrder?: number;
  storeSlug?: string;
  sortOrder?: number;
  status?: string;
  updatedAt?: string;
  isPopular?: boolean;
  showInPopular?: boolean;
  popular?: boolean;
  featured?: boolean;
  [key: string]: any;
};

type AdminCategory = {
  id?: string;
  _id?: string;
  name?: string;
  title?: string;
  slug?: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  thumbnail?: string;
  sortOrder?: number;
  categorySortOrder?: number;
  status?: string;
  isActive?: boolean;
  active?: boolean;
  hidden?: boolean;
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

const FALLBACK_IMAGE = "/images/placeholder-food.png";
const DEFAULT_CATEGORY_NAME = "Menu Items";
const DEFAULT_CATEGORY_SLUG = "menu-items";

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
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value || null));
}

function isPopularCategory(category: Partial<MenuCategoryTab>) {
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

function isMenuCouponsCategory(category: Partial<MenuCategoryTab>) {
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

function getProductCategoryName(product: DbProduct) {
  if (typeof product?.category === "string") return cleanString(product.category);

  return cleanString(
    product?.categoryName ||
      product?.categoryTitle ||
      product?.category?.name ||
      product?.category?.title ||
      DEFAULT_CATEGORY_NAME
  );
}

function getProductCategorySlug(product: DbProduct) {
  if (typeof product?.category === "string") return slugify(product.category);

  return (
    slugify(
      product?.categorySlug ||
        product?.category?.slug ||
        product?.category?.id ||
        product?.category?._id ||
        getProductCategoryName(product) ||
        product?.categoryId
    ) || DEFAULT_CATEGORY_SLUG
  );
}

function getProductTitle(product: DbProduct) {
  return cleanString(product?.title || product?.name || "Menu Item");
}

function getProductSlug(product: DbProduct) {
  return slugify(product?.slug || getProductTitle(product) || product?.id || product?._id);
}

function getProductId(product: DbProduct) {
  return cleanString(product?.productId || product?.id || product?._id || getProductSlug(product));
}

function isAdminCategoryVisible(category: AdminCategory) {
  if (category?.hidden === true) return false;

  const status = cleanString(category?.status).toLowerCase();

  if (status && ["inactive", "hidden", "disabled", "deleted"].includes(status)) {
    return false;
  }

  if (typeof category?.isActive === "boolean") return category.isActive;
  if (typeof category?.active === "boolean") return category.active;

  return true;
}

function buildSlimSnapshotProduct(product: DbProduct, storeSlug: string) {
  const title = getProductTitle(product);
  const id = getProductId(product);
  const slug = getProductSlug(product) || slugify(id || title);
  const categoryName = getProductCategoryName(product);
  const categorySlug = getProductCategorySlug(product);
  const categoryId = cleanString(product?.categoryId || categorySlug || categoryName);
  const price = cleanNumber(product?.price ?? product?.numericPrice);
  const popular = isProductPopular(product);

  return toPlain({
    id,
    productId: id,
    slug,
    title,
    name: title,
    description: cleanString(product?.description),
    image: cleanString(product?.image) || FALLBACK_IMAGE,
    price,
    numericPrice: price,
    categoryId,
    categoryName: categoryName || DEFAULT_CATEGORY_NAME,
    categorySlug: categorySlug || DEFAULT_CATEGORY_SLUG,
    category: categorySlug || categoryName || DEFAULT_CATEGORY_SLUG,
    storeSlug: cleanString(product?.storeSlug) || storeSlug,
    isPopular: popular,
    showInPopular: popular,
    sortOrder: cleanNumber(product?.sortOrder ?? 0),
    status: cleanString(product?.status || "Active"),
    updatedAt: cleanString(product?.updatedAt),

    // Product modal/detail API should load modifiers, sizes and upsells only after click.
    hasDetails: false,
    sizes: [],
    modifierGroups: [],
    attachedModifierGroups: [],
    relatedUpsells: [],
    upsell: "",
  });
}

function buildSlimSnapshotProducts(products: DbProduct[], storeSlug: string) {
  const seen = new Set<string>();

  return (Array.isArray(products) ? products : [])
    .map((product) => buildSlimSnapshotProduct(product, storeSlug))
    .filter((product) => {
      const key = cleanString(product?.id || product?.productId || product?.slug);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Kept for backward imports only. Rebuild no longer saves categories to StoreMenu.
export function buildSnapshotCategories(products: DbProduct[]) {
  const seen = new Set<string>();

  const realCategories = (Array.isArray(products) ? products : [])
    .map((product) => {
      const categoryName = getProductCategoryName(product);
      const categorySlug = getProductCategorySlug(product);

      return {
        id: categorySlug,
        slug: categorySlug,
        name: categoryName || categorySlug.replace(/-/g, " "),
        description: "",
        image: "",
        sortOrder: cleanNumber(product?.categorySortOrder ?? product?.sortOrder ?? 9999),
      };
    })
    .filter((category) => {
      if (!category.id || !category.name) return false;
      if (isPopularCategory(category)) return false;
      if (isMenuCouponsCategory(category)) return false;

      const key = slugify(category.slug || category.id || category.name);
      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

  const hasPopularProducts = (Array.isArray(products) ? products : []).some(isProductPopular);

  return hasPopularProducts ? [POPULAR_CATEGORY, ...realCategories] : realCategories;
}

// Kept for backward imports only. Rebuild no longer saves categories to StoreMenu.
export function buildSnapshotCategoriesFromAdmin(
  adminCategories: AdminCategory[],
  products: DbProduct[]
) {
  const seen = new Set<string>();

  const realCategories = (Array.isArray(adminCategories) ? adminCategories : [])
    .filter(isAdminCategoryVisible)
    .map((category) => {
      const name = cleanString(category?.name || category?.title);
      const slug = slugify(category?.slug || category?.id || category?._id || name);

      return {
        id: slug,
        slug,
        name: name || slug.replace(/-/g, " "),
        description: cleanString(category?.description),
        image: cleanString(category?.image || category?.imageUrl || category?.thumbnail),
        sortOrder: cleanNumber(category?.sortOrder ?? category?.categorySortOrder ?? 9999),
      };
    })
    .filter((category) => {
      if (!category.id || !category.name) return false;
      if (isPopularCategory(category)) return false;
      if (isMenuCouponsCategory(category)) return false;

      const key = slugify(category.slug || category.id || category.name);
      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

  const hasPopularProducts = (Array.isArray(products) ? products : []).some(isProductPopular);

  return hasPopularProducts ? [POPULAR_CATEGORY, ...realCategories] : realCategories;
}

export async function rebuildStoreMenu(storeSlug: string, reason = "admin-change") {
  const cleanStoreSlug = slugify(storeSlug);

  if (!cleanStoreSlug) {
    throw new Error("Store slug is required to rebuild store menu snapshot.");
  }

  await connectDB();

  try {
    // Important: snapshot rebuild is now product/menuProduct only.
    // Categories are saved/read only through CategoryStoreConfig + menucategories.ts.
    clearStoreMenuProductsCache(cleanStoreSlug);
    clearStoreMenuSnapshotCache(cleanStoreSlug);

    const products = await getStoreMenuProducts(cleanStoreSlug);
    const safeProducts = Array.isArray(products) ? products : [];
    const slimProducts = buildSlimSnapshotProducts(safeProducts, cleanStoreSlug);
    const now = new Date();

    const snapshot = await StoreMenu.findOneAndUpdate(
      { storeSlug: cleanStoreSlug },
      {
        $set: {
          storeSlug: cleanStoreSlug,
          status: "ready",
          products: slimProducts,

          // Keep old key empty for compatibility. Do not duplicate product list.
          menuProducts: [],

          meta: {
            productCount: slimProducts.length,
            categoryCount: 0,
            rebuiltReason: reason,
            errorMessage: "",
            lastFailedAt: null,
          },
          builtAt: now,
        },
        // Remove stale categories from old snapshots so they cannot overwrite UI/store badges.
        $unset: {
          categories: "",
        },
        $inc: { version: 1 },
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    ).lean<any>();

    clearStoreMenuSnapshotCache(cleanStoreSlug);

    return {
      storeSlug: cleanStoreSlug,
      categories: [],
      products: slimProducts,
      menuProducts: [],
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
        returnDocument: "after",
      }
    ).catch(() => null);

    throw error;
  }
}
