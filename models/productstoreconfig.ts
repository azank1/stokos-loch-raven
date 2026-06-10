import mongoose, { Schema } from "mongoose";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function normalizeStoreId(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanRelatedUpsells(value: unknown) {
  const rawItems = Array.isArray(value) ? value : [];
  const unique = new Map<string, { upsellId: string; name: string; price: number }>();

  rawItems.forEach((item: any, index) => {
    if (typeof item === "string" || typeof item === "number") {
      const upsellId = cleanString(item);
      if (!upsellId) return;

      unique.set(upsellId, {
        upsellId,
        name: upsellId,
        price: 0,
      });
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

const ProductSizeSchema = new Schema(
  {
    id: { type: String, trim: true, default: "" },
    name: { type: String, required: true, trim: true },
    price: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const ProductModifierOptionSchema = new Schema(
  {
    optionId: { type: String, trim: true, default: "" },
    id: { type: String, trim: true, default: "" },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    pricesBySize: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { _id: false }
);

const ProductModifierGroupSchema = new Schema(
  {
    modifierGroupId: { type: String, trim: true, default: "", index: true },
    name: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    minSelect: { type: Number, default: 0 },
    maxSelect: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    options: { type: [ProductModifierOptionSchema], default: [] },
  },
  { _id: false }
);

const ProductRelatedUpsellSchema = new Schema(
  {
    upsellId: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ProductStoreConfigSchema = new Schema(
  {
    productId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    storeId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    categoryId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    categoryName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    categorySlug: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    sizes: {
      type: [ProductSizeSchema],
      default: [],
    },
    modifierGroups: {
      type: [ProductModifierGroupSchema],
      default: [],
    },
    modifierGroupIds: {
      type: [String],
      default: [],
    },

    // Store-wise upsells with editable admin price.
    relatedUpsells: {
      type: [ProductRelatedUpsellSchema],
      default: [],
    },
    upsell: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Draft", "Hidden", "Inactive"],
      default: "Active",
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "productstoreconfigs",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ProductStoreConfigSchema.pre("validate", function () {
  const doc = this as any;

  doc.productId = String(doc.productId || "").trim();
  doc.storeId = normalizeStoreId(doc.storeId);
  doc.categoryId = String(doc.categoryId || "").trim();
  doc.relatedUpsells = cleanRelatedUpsells(doc.relatedUpsells);

  if (!Array.isArray(doc.sizes) || doc.sizes.length === 0) {
    doc.sizes = [
      {
        id: "regular",
        name: "Regular",
        price: cleanNumber(doc.price),
        sortOrder: 0,
      },
    ];
  }

  doc.sizes = doc.sizes
    .map((size: any, index: number) => {
      const name = String(size?.name || "").trim();
      if (!name) return null;

      return {
        id: String(size?.id || slugify(name) || `size-${index + 1}`),
        name,
        price: cleanNumber(size?.price),
        sortOrder: Number(size?.sortOrder ?? index),
      };
    })
    .filter(Boolean);

  if (doc.sizes.length > 0) {
    doc.price = cleanNumber(doc.sizes[0].price);
  }

  if (!doc.categorySlug && doc.categoryName) {
    doc.categorySlug = slugify(doc.categoryName);
  }

  if (Array.isArray(doc.modifierGroups)) {
    doc.modifierGroupIds = doc.modifierGroups
      .map((group: any) => String(group?.modifierGroupId || "").trim())
      .filter(Boolean);
  }
});

ProductStoreConfigSchema.index(
  { productId: 1, storeId: 1 },
  { unique: true, name: "unique_product_store_config" }
);
ProductStoreConfigSchema.index({ storeId: 1, categoryId: 1, status: 1 });
ProductStoreConfigSchema.index({ storeId: 1, sortOrder: 1 });
ProductStoreConfigSchema.index({ storeId: 1, "relatedUpsells.upsellId": 1 });

if (
  process.env.NODE_ENV === "development" &&
  mongoose.models.ProductStoreConfig
) {
  delete mongoose.models.ProductStoreConfig;
}

const ProductStoreConfig =
  mongoose.models.ProductStoreConfig ||
  mongoose.model("ProductStoreConfig", ProductStoreConfigSchema);

export default ProductStoreConfig;
