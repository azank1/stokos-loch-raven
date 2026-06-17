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
  },
);

CategorySchema.virtual("storeConfigs", {
  ref: "CategoryStoreConfig",
  localField: "_idStr",
  foreignField: "categoryId",
  justOne: false,
});

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
