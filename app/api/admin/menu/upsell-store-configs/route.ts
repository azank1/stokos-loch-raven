import mongoose, { Schema } from "mongoose";

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanStatus(value: unknown) {
  const status = cleanString(value);

  if (["Active", "Paused", "Inactive"].includes(status)) {
    return status;
  }

  return "Active";
}

function cleanBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (["true", "yes", "1", "active"].includes(lower)) return true;
    if (["false", "no", "0", "inactive", "off"].includes(lower)) return false;
  }

  return fallback;
}

const UpsellStoreConfigSchema = new Schema(
  {
    upsellId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    storeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    categoryId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    categoryName: {
      type: String,
      required: true,
      trim: true,
    },

    available: {
      type: Boolean,
      default: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["Active", "Paused", "Inactive"],
      default: "Active",
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "upsellstoreconfigs",
  }
);

UpsellStoreConfigSchema.pre("validate", function () {
  const doc = this as any;

  doc.upsellId = cleanString(doc.upsellId);
  doc.storeId = cleanString(doc.storeId);
  doc.categoryId = cleanString(doc.categoryId);
  doc.categoryName = cleanString(doc.categoryName);
  doc.available = cleanBoolean(doc.available, true);
  doc.status = doc.available ? cleanStatus(doc.status) : "Inactive";
  doc.sortOrder = Number(doc.sortOrder || 0);
});

UpsellStoreConfigSchema.index(
  { upsellId: 1, storeId: 1 },
  { unique: true }
);

UpsellStoreConfigSchema.index({ storeId: 1, categoryId: 1, status: 1 });
UpsellStoreConfigSchema.index({ storeId: 1, available: 1, status: 1 });

const UpsellStoreConfig =
  mongoose.models.UpsellStoreConfig ||
  mongoose.model("UpsellStoreConfig", UpsellStoreConfigSchema);

export default UpsellStoreConfig;
