import mongoose, { Schema } from "mongoose";

function slugify(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function normalizeStoreId(value: unknown) {
  return slugify(value);
}

function cleanNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizePayload(payload: any) {
  if (!payload || typeof payload !== "object") return payload;

  if ("categoryId" in payload)
    payload.categoryId = cleanString(payload.categoryId);
  if ("storeId" in payload) payload.storeId = normalizeStoreId(payload.storeId);
  if ("storeSlug" in payload && !payload.storeId)
    payload.storeId = normalizeStoreId(payload.storeSlug);
  if ("store" in payload && !payload.storeId)
    payload.storeId = normalizeStoreId(payload.store);
  if ("categoryName" in payload)
    payload.categoryName = cleanString(payload.categoryName);

  payload.categorySlug = slugify(
    payload.categorySlug || payload.slug || payload.categoryName,
  );

  const available =
    payload.available !== false && payload.isAvailable !== false;
  payload.available = available;
  payload.isAvailable = available;

  payload.sortOrder = cleanNumber(payload.sortOrder);

  if (!["Active", "Hidden", "Inactive"].includes(cleanString(payload.status))) {
    payload.status = "Active";
  }

  return payload;
}

const CategoryStoreConfigSchema = new Schema(
  {
    categoryId: {
      type: String,
      required: true,
      trim: true,
    },
    storeId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    categoryName: {
      type: String,
      default: "",
      trim: true,
    },
    categorySlug: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    available: {
      type: Boolean,
      default: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["Active", "Hidden", "Inactive"],
      default: "Active",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "categorystoreconfigs",
  },
);

CategoryStoreConfigSchema.pre("validate", function () {
  normalizePayload(this as any, true);
});

CategoryStoreConfigSchema.pre("findOneAndUpdate", function () {
  const update: any = this.getUpdate() || {};
  const setPayload = update.$set || update;

  normalizePayload(setPayload);

  if (update.$set) {
    update.$set = setPayload;
    this.setUpdate(update);
  } else {
    this.setUpdate(setPayload);
  }
});

CategoryStoreConfigSchema.pre("updateOne", function () {
  const update: any = this.getUpdate() || {};
  if (update.$set) normalizePayload(update.$set);
  this.setUpdate(update);
});

CategoryStoreConfigSchema.pre("updateMany", function () {
  const update: any = this.getUpdate() || {};
  if (update.$set) normalizePayload(update.$set);
  this.setUpdate(update);
});

// Correct unique rule: one config per category per store.
// Important: old wrong unique indexes must be dropped by scripts/mongodb-indexes.js.
CategoryStoreConfigSchema.index(
  { categoryId: 1, storeId: 1 },
  { unique: true, name: "unique_category_store_config" },
);
CategoryStoreConfigSchema.index({ storeId: 1, status: 1, sortOrder: 1 });
CategoryStoreConfigSchema.index({
  storeId: 1,
  status: 1,
  available: 1,
  sortOrder: 1,
});
CategoryStoreConfigSchema.index({
  storeId: 1,
  status: 1,
  isAvailable: 1,
  sortOrder: 1,
});
CategoryStoreConfigSchema.index({
  storeId: 1,
  status: 1,
  categorySlug: 1,
  sortOrder: 1,
});
CategoryStoreConfigSchema.index({ categoryId: 1 });
CategoryStoreConfigSchema.index({ categorySlug: 1, storeId: 1 });

if (
  process.env.NODE_ENV === "development" &&
  mongoose.models.CategoryStoreConfig
) {
  delete mongoose.models.CategoryStoreConfig;
}

const CategoryStoreConfig =
  mongoose.models.CategoryStoreConfig ||
  mongoose.model("CategoryStoreConfig", CategoryStoreConfigSchema);

export default CategoryStoreConfig;
