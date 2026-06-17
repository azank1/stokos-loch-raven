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

function cleanNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

const CategorySchema = new Schema(
  {
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

    description: {
      type: String,
      default: "",
      trim: true,
    },

    image: {
      type: String,
      default: "",
      trim: true,
    },

    // Legacy only. New store-wise assignment lives in CategoryStoreConfig.
    storeId: {
      type: String,
      default: "",
      trim: true,
      select: false,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Active", "Hidden", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
    collection: "categories",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// FIX: Virtual localField must match the type stored in CategoryStoreConfig.categoryId.
// CategoryStoreConfig stores categoryId as a plain String (the hex string of the ObjectId).
// Using localField: "_id" (an ObjectId) caused the populate to never match because
// Mongoose compares ObjectId vs String and they do not coerce automatically.
// Using a virtual getter that converts _id to string ensures correct matching.
CategorySchema.virtual("storeConfigs", {
  ref: "CategoryStoreConfig",
  localField: "_idStr", // uses the virtual below
  foreignField: "categoryId",
  justOne: false,
});

// Virtual that exposes _id as a plain string for cross-type populate matching.
CategorySchema.virtual("_idStr").get(function () {
  return this._id ? String(this._id) : "";
});

CategorySchema.pre("validate", function () {
  const doc = this as any;

  doc.name = cleanString(doc.name);
  doc.description = cleanString(doc.description);
  doc.image = cleanString(doc.image);
  doc.storeId = "";
  doc.sortOrder = cleanNumber(doc.sortOrder);

  if (!doc.slug && doc.name) {
    doc.slug = slugify(doc.name);
  }

  if (doc.slug) {
    doc.slug = slugify(doc.slug);
  }
});

// FIX: slug index must be UNIQUE to prevent duplicate master Category documents
// with the same slug. Without uniqueness, findOrCreateMasterCategory could create
// two master Category rows with slug "popular-menu-items", leading to split
// CategoryStoreConfig rows under different categoryIds. getCategoryRows would
// group them together by slug for display, but any subsequent PATCH targeting
// one master would orphan the other master's configs.
CategorySchema.index({ slug: 1 }, { unique: true, name: "slug_unique" });
CategorySchema.index({ name: 1 }, { name: "name_lookup" });
CategorySchema.index({ status: 1, sortOrder: 1 }, { name: "status_sort" });
CategorySchema.index({ status: 1, slug: 1 }, { name: "status_slug" });

if (process.env.NODE_ENV === "development" && mongoose.models.Category) {
  delete mongoose.models.Category;
}

const Category =
  mongoose.models.Category || mongoose.model("Category", CategorySchema);

export default Category;
