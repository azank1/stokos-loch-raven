import "server-only";

import mongoose from "mongoose";
import { unstable_cache } from "next/cache";
import connectDB from "@/lib/mongodb";
import Product from "@/models/product";
import ProductStoreConfig from "@/models/productstoreconfig";
import Category from "@/models/category";

type AnyObject = Record<string, any>;

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = cleanString(value).replace(/[^0-9.]/g, "");
  const number = Number(raw || 0);

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

function isActiveStatus(value: unknown, fallback = true) {
  const status = cleanString(value);
  if (!status) return fallback;

  return status.toLowerCase() === "active";
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
  return JSON.parse(JSON.stringify(value));
}

function normalizeSizes(sizes: any[], fallbackPrice: number) {
  const cleanSizes = Array.isArray(sizes) ? sizes : [];

  if (cleanSizes.length === 0) {
    return [
      {
        id: "regular",
        name: "Regular",
        label: "Regular",
        price: fallbackPrice,
        sortOrder: 0,
      },
    ];
  }

  return cleanSizes
    .map((size, index) => {
      const name = cleanString(size.name || size.label || "Regular");
      const id = cleanString(size.id || slugify(name) || `size-${index}`);

      return {
        id,
        name,
        label: name,
        price: cleanNumber(size.price),
        sortOrder: cleanNumber(size.sortOrder ?? index),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeModifierGroups(groups: any[]) {
  const cleanGroups = Array.isArray(groups) ? groups : [];

  return cleanGroups
    .filter((group) => isActiveStatus(group?.status, true))
    .map((group, groupIndex) => {
      const name = cleanString(group.name || "Options");

      return {
        modifierGroupId: cleanString(
          group.modifierGroupId || group.id || slugify(name)
        ),
        name,
        required: Boolean(group.required),
        minSelect: cleanNumber(group.minSelect || 0),
        maxSelect: cleanNumber(group.maxSelect || 0),
        sortOrder: cleanNumber(group.sortOrder ?? groupIndex),
        status: cleanString(group.status || "Active"),
        options: Array.isArray(group.options)
          ? group.options
              .filter((option: any) => isActiveStatus(option?.status, true))
              .map((option: any, optionIndex: number) => {
                const optionName = cleanString(option.name || "Option");

                return {
                  id: cleanString(
                    option.id || option.optionId || slugify(optionName)
                  ),
                  optionId: cleanString(
                    option.optionId || option.id || slugify(optionName)
                  ),
                  name: optionName,
                  status: cleanString(option.status || "Active"),
                  pricesBySize:
                    option.pricesBySize && typeof option.pricesBySize === "object"
                      ? option.pricesBySize
                      : {},
                  sortOrder: cleanNumber(option.sortOrder ?? optionIndex),
                };
              })
              .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
          : [],
      };
    })
    .filter((group) => group.options.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function buildProductMap(products: AnyObject[]) {
  const map = new Map<string, AnyObject>();

  products.forEach((product) => {
    if (product?._id) map.set(String(product._id), product);
    if (product?.id) map.set(String(product.id), product);
    if (product?.slug) map.set(String(product.slug), product);
  });

  return map;
}

function buildCategoryMap(categories: AnyObject[]) {
  const map = new Map<string, AnyObject>();

  categories.forEach((category) => {
    if (category?._id) map.set(String(category._id), category);
    if (category?.id) map.set(String(category.id), category);
    if (category?.slug) map.set(String(category.slug), category);
  });

  return map;
}

function getProductCategoryId(product: AnyObject) {
  if (product?.category && typeof product.category === "object") {
    return cleanString(product.category._id || product.category.id || product.category.slug);
  }

  return cleanString(
    product?.categoryId ||
      product?.categoryID ||
      product?.category_id ||
      product?.categorySlug ||
      product?.category
  );
}

async function getStoreMenuProductsFromDB(storeSlug: string) {
  await connectDB();

  const storeId = cleanString(storeSlug).toLowerCase();

  if (!storeId) return [];

  const configsRaw = await ProductStoreConfig.find({
    storeId,
    status: "Active",
    isAvailable: { $ne: false },
    available: { $ne: false },
  })
    .select({
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
      status: 1,
      isAvailable: 1,
      available: 1,
      sortOrder: 1,
      updatedAt: 1,
    })
    .sort({ sortOrder: 1, updatedAt: -1 })
    .lean<any[]>();

  const configs = toPlain(configsRaw);

  const productIdValues = Array.from(
    new Set(
      configs
        .map((config: any) => cleanString(config.productId))
        .filter(Boolean)
    )
  );

  if (!productIdValues.length) return [];

  const objectIds = productIdValues
    .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
    .map((id: string) => new mongoose.Types.ObjectId(id));

  const productOrQuery: any[] = [{ id: { $in: productIdValues } }];

  if (objectIds.length) {
    productOrQuery.push({ _id: { $in: objectIds } });
  }

  const productsRaw = await Product.find({
    status: "Active",
    $or: productOrQuery,
  })
    .select({
      id: 1,
      slug: 1,
      name: 1,
      title: 1,
      description: 1,
      image: 1,
      imageUrl: 1,
      thumbnail: 1,
      photo: 1,
      category: 1,
      categoryId: 1,
      categoryID: 1,
      category_id: 1,
      categoryName: 1,
      categorySlug: 1,
      categoryTitle: 1,
      price: 1,
      basePrice: 1,
      sizes: 1,
      modifierGroups: 1,
      attachedModifierGroups: 1,
      modifierGroupIds: 1,
      relatedUpsells: 1,
      upsell: 1,
      isPopular: 1,
      popular: 1,
      isFeatured: 1,
      featured: 1,
      showInPopular: 1,
      showInPopularMenu: 1,
      status: 1,
      sortOrder: 1,
      updatedAt: 1,
    })
    .lean<any[]>();

  const products = toPlain(productsRaw);
  const productMap = buildProductMap(products);

  const categoryIds = Array.from(
    new Set(
      configs
        .map((config: any) => cleanString(config.categoryId))
        .concat(products.map((product: any) => getProductCategoryId(product)))
        .filter(Boolean)
    )
  );

  const categoryObjectIds = categoryIds
    .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
    .map((id: string) => new mongoose.Types.ObjectId(id));

  const categoryOrQuery: any[] = [
    { id: { $in: categoryIds } },
    { slug: { $in: categoryIds } },
  ];

  if (categoryObjectIds.length) {
    categoryOrQuery.push({ _id: { $in: categoryObjectIds } });
  }

  const categoriesRaw = categoryIds.length
    ? await Category.find({
        $or: categoryOrQuery,
      })
        .select({
          id: 1,
          name: 1,
          slug: 1,
          description: 1,
          image: 1,
          sortOrder: 1,
          status: 1,
        })
        .lean<any[]>()
    : [];

  const categoryMap = buildCategoryMap(toPlain(categoriesRaw));

  return configs
    .map((config: any) => {
      const product = productMap.get(cleanString(config.productId));

      if (!product) return null;

      const productId = cleanString(product._id || product.id || config.productId);
      const title = cleanString(product.name || product.title);
      const description = cleanString(product.description);
      const image = cleanString(
        product.image ||
          product.imageUrl ||
          product.thumbnail ||
          product.photo ||
          "/images/placeholder-food.png"
      );

      const rawCategoryId = cleanString(
        config.categoryId || getProductCategoryId(product) || ""
      );
      const category = categoryMap.get(rawCategoryId);

      const categoryId = rawCategoryId;
      const categoryName = cleanString(
        config.categoryName ||
          product.categoryName ||
          product.categoryTitle ||
          category?.name ||
          (typeof product.category === "string" ? product.category : "")
      );

      const categorySlug = slugify(
        config.categorySlug ||
          product.categorySlug ||
          category?.slug ||
          categoryName ||
          categoryId
      );

      const basePrice = cleanNumber(config.price ?? product.price ?? product.basePrice);
      const sizes = normalizeSizes(
        Array.isArray(config.sizes) && config.sizes.length
          ? config.sizes
          : product.sizes,
        basePrice
      );

      const cardPrice = sizes?.[0]?.price ?? basePrice;

      const modifierGroups = normalizeModifierGroups(
        Array.isArray(config.modifierGroups) && config.modifierGroups.length
          ? config.modifierGroups
          : Array.isArray(product.modifierGroups) && product.modifierGroups.length
          ? product.modifierGroups
          : product.attachedModifierGroups
      );

      const relatedUpsells = Array.isArray(config.relatedUpsells)
        ? config.relatedUpsells
        : Array.isArray(product.relatedUpsells)
          ? product.relatedUpsells
          : [];

      const isPopular = cleanBoolean(
        config.isPopular,
        cleanBoolean(config.showInPopular, cleanBoolean(product.isPopular, false))
      );

      const isAvailable = config.isAvailable !== false && config.available !== false;

      const storeConfig = {
        ...config,
        categoryId,
        categoryName,
        categorySlug,
        price: basePrice,
        sizes,
        modifierGroups,
        relatedUpsells,
        isAvailable,
        available: isAvailable,
        isPopular,
        showInPopular: isPopular,
      };

      return {
        id: productId,
        _id: productId,
        productId,
        storeId,

        title,
        name: title,
        slug: cleanString(product.slug) || slugify(title || productId),

        category: categorySlug,
        categoryId,
        categoryName,
        categorySlug,

        price: cardPrice.toFixed(2),
        numericPrice: cardPrice,

        image,
        description,

        sizes,
        modifierGroups,
        modifierGroupIds: Array.isArray(config.modifierGroupIds)
          ? config.modifierGroupIds
          : Array.isArray(product.modifierGroupIds)
            ? product.modifierGroupIds
            : [],

        relatedUpsells,
        upsell: config.upsell || product.upsell || "",

        isPopular,
        showInPopular: isPopular,

        status: "Active",
        sortOrder: cleanNumber(config.sortOrder ?? product.sortOrder ?? 0),
        updatedAt: cleanString(config.updatedAt || product.updatedAt || ""),

        storeConfig,
        storeConfigs: [storeConfig],
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
}

export const getStoreMenuProducts = unstable_cache(
  getStoreMenuProductsFromDB,
  ["store-menu-products-v4"],
  {
    revalidate: 60,
    tags: ["store-menu-products"],
  }
);
