import mongoose, { Schema } from "mongoose";

export const ALL_CATEGORIES_ID = "all";
export const ALL_CATEGORIES_NAME = "All Categories";

const ALL_CATEGORY_KEYS = new Set([
  "all",
  "all-categories",
  "all-category",
  "every-category",
  "any-category",
  "*",
]);

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
  return Number.isFinite(number) ? number : 0;
}

function isAllCategoryValue(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  const slug = slugify(raw);

  return ALL_CATEGORY_KEYS.has(raw) || ALL_CATEGORY_KEYS.has(slug);
}

function normalizeCategoryId(value: unknown, categoryName: unknown) {
  const rawCategoryId = String(value || "").trim();
  const rawCategoryName = String(categoryName || "").trim();

  if (isAllCategoryValue(rawCategoryId) || isAllCategoryValue(rawCategoryName)) {
    return ALL_CATEGORIES_ID;
  }

  return rawCategoryId || slugify(rawCategoryName) || "";
}

function normalizeCategoryName(value: unknown, categoryId: unknown) {
  const rawCategoryName = String(value || "").trim();
  const rawCategoryId = String(categoryId || "").trim();

  if (isAllCategoryValue(rawCategoryName) || isAllCategoryValue(rawCategoryId)) {
    return ALL_CATEGORIES_NAME;
  }

  return rawCategoryName;
}

const ModifierGroupAssignmentSchema = new Schema(
  {
    modifierGroupId: {
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

    // Use categoryId = "all" when this group should appear in every
    // category of the selected store.
    categoryId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      default: ALL_CATEGORIES_ID,
    },

    categoryName: {
      type: String,
      required: true,
      trim: true,
      default: ALL_CATEGORIES_NAME,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "modifiergroupassignments",
  }
);

ModifierGroupAssignmentSchema.pre("validate", function () {
  const doc = this as any;

  doc.modifierGroupId = String(doc.modifierGroupId || "").trim();
  doc.storeId = String(doc.storeId || "").trim();

  const nextCategoryId = normalizeCategoryId(doc.categoryId, doc.categoryName);
  const nextCategoryName = normalizeCategoryName(doc.categoryName, nextCategoryId);

  doc.categoryId = nextCategoryId;
  doc.categoryName = nextCategoryName || ALL_CATEGORIES_NAME;
  doc.sortOrder = cleanNumber(doc.sortOrder);
  doc.status = doc.status === "Inactive" ? "Inactive" : "Active";
});

// One modifier group can have only one assignment per store.
// Category can be "all" or one selected category, but the same store
// should not be repeated in another assignment row.
ModifierGroupAssignmentSchema.index(
  { modifierGroupId: 1, storeId: 1 },
  { unique: true }
);

ModifierGroupAssignmentSchema.index({ storeId: 1, categoryId: 1, status: 1 });
ModifierGroupAssignmentSchema.index({ storeId: 1, status: 1 });

const ModifierGroupAssignment =
  mongoose.models.ModifierGroupAssignment ||
  mongoose.model("ModifierGroupAssignment", ModifierGroupAssignmentSchema);

export default ModifierGroupAssignment;
