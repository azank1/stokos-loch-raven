import mongoose, { Schema } from "mongoose";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(value.map((item) => cleanString(item)).filter(Boolean))
  );
}

function cleanStatus(value: unknown) {
  const status = cleanString(value);

  if (["Active", "Paused", "Inactive"].includes(status)) {
    return status;
  }

  return "Active";
}

const UpsellRuleSchema = new Schema(
  {
    // Master upsell item. Store/category availability is stored in UpsellStoreConfig.
    // These store fields are denormalized only for old UI/filter compatibility.
    storeId: {
      type: String,
      required: true,
      default: "towson",
      trim: true,
    },

    storeIds: {
      type: [String],
      default: [],
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    image: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Active", "Paused", "Inactive"],
      default: "Active",
    },

    // Legacy fields kept optional so old product-based upsell records do not break.
    // New flow does not use product selection or one global trigger category.
    categoryType: {
      type: String,
      default: "",
      trim: true,
    },

    categoryId: {
      type: String,
      default: "",
      trim: true,
    },

    categoryName: {
      type: String,
      default: "",
      trim: true,
    },

    triggerCategoryId: {
      type: String,
      default: "",
      trim: true,
    },

    triggerCategoryName: {
      type: String,
      default: "",
      trim: true,
    },

    offerProductIds: {
      type: [String],
      default: [],
    },

    trigger: {
      type: String,
      default: "",
      trim: true,
    },

    offer: {
      type: String,
      default: "",
      trim: true,
    },

    appliesToCategories: {
      type: [String],
      default: [],
    },

    appliesToProducts: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "upsellrules",
  }
);

UpsellRuleSchema.pre("validate", function () {
  const doc = this as any;

  doc.name = cleanString(doc.name);
  doc.image = cleanString(doc.image);
  doc.description = cleanString(doc.description);
  doc.status = cleanStatus(doc.status);
  doc.sortOrder = Number(doc.sortOrder || 0);

  doc.storeIds = cleanStringArray(doc.storeIds);
  doc.storeId = cleanString(doc.storeId || doc.storeIds[0] || "towson");

  doc.categoryId = cleanString(doc.categoryId);
  doc.categoryName = cleanString(doc.categoryName || doc.categoryType);
  doc.categoryType = cleanString(doc.categoryType || doc.categoryName);

  doc.slug = slugify(doc.slug || doc.name);

  // Keep legacy fields populated with harmless values for old code/old indexes.
  doc.triggerCategoryId = cleanString(
    doc.triggerCategoryId || doc.categoryId || doc.slug
  );

  doc.triggerCategoryName = cleanString(
    doc.triggerCategoryName || doc.categoryName || doc.categoryType
  );

  doc.offerProductIds = [];
  doc.trigger = doc.triggerCategoryName || doc.categoryType;
  doc.offer = doc.name;
  doc.appliesToCategories = doc.triggerCategoryName
    ? [doc.triggerCategoryName]
    : [];
  doc.appliesToProducts = [];
});

// Indexes only here. Do not use index: true inside fields above.
UpsellRuleSchema.index({ slug: 1 }, { unique: true });
UpsellRuleSchema.index({ storeId: 1 });
UpsellRuleSchema.index({ storeIds: 1, status: 1, sortOrder: 1 });
UpsellRuleSchema.index({ status: 1, sortOrder: 1 });

if (process.env.NODE_ENV === "development" && mongoose.models.UpsellRule) {
  delete mongoose.models.UpsellRule;
}

const UpsellRule =
  mongoose.models.UpsellRule ||
  mongoose.model("UpsellRule", UpsellRuleSchema);

export default UpsellRule;