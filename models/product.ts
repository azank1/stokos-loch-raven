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

const ProductRelatedUpsellSchema = new Schema(
  {
    upsellId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ProductSchema = new Schema(
  {
    // Product Master = common/global data only.
    // Store/category/price/size/modifier/status/sortOrder live in ProductStoreConfig.
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    slug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },

    description: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    tags: {
      type: [String],
      default: [],
    },

    badge: {
      type: String,
      default: "",
    },

    updatedAt: {
      type: String,
      default: "Today",
    },

    // Legacy fields are intentionally optional so old rows do not break during migration.
    // New writes should not depend on these fields.
    storeId: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },
    categoryId: { type: String, default: "", trim: true },
    categoryName: { type: String, default: "", trim: true },
    price: { type: Number, default: 0 },
    sizes: { type: Array, default: [] },
    modifierGroups: { type: Array, default: [] },
    modifierGroupIds: { type: [String], default: [] },

    // New structure: [{ upsellId, name, price }].
    // Kept on product master only for legacy compatibility; store-wise value lives in ProductStoreConfig.
    relatedUpsells: { type: [ProductRelatedUpsellSchema], default: [] },
    upsell: { type: String, default: "" },

    status: {
      type: String,
      enum: ["Active", "Draft", "Hidden", "Inactive"],
      default: "Active",
    },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "lastSavedAt",
    },
    collection: "products",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ProductSchema.virtual("storeConfigs", {
  ref: "ProductStoreConfig",
  localField: "_id",
  foreignField: "productId",
  justOne: false,
});

ProductSchema.pre("validate", function () {
  const doc = this as any;

  if (doc.name) {
    doc.name = String(doc.name || "").trim();
  }

  if (!doc.slug && doc.name) {
    doc.slug = slugify(doc.name);
  }

  if (doc.slug) {
    doc.slug = slugify(doc.slug);
  }

  if (!doc.updatedAt) {
    doc.updatedAt = "Today";
  }

  doc.relatedUpsells = cleanRelatedUpsells(doc.relatedUpsells);
});

ProductSchema.index({ slug: 1 });
ProductSchema.index({ name: 1 });

if (process.env.NODE_ENV === "development" && mongoose.models.Product) {
  delete mongoose.models.Product;
}

const Product =
  mongoose.models.Product || mongoose.model("Product", ProductSchema);

export default Product;
