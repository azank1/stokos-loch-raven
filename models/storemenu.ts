import mongoose, { Schema } from "mongoose";

const StoreMenuSchema = new Schema(
  {
    storeSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["ready", "building", "failed"],
      default: "ready",
      index: true,
    },

    categories: {
      type: Array,
      default: [],
    },

    products: {
      type: Array,
      default: [],
    },

    menuProducts: {
      type: Array,
      default: [],
    },

    meta: {
      productCount: { type: Number, default: 0 },
      categoryCount: { type: Number, default: 0 },
      rebuiltReason: { type: String, default: "" },
      errorMessage: { type: String, default: "" },
      lastFailedAt: { type: Date, default: null },
    },

    version: {
      type: Number,
      default: 1,
    },

    builtAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "storemenus",
    minimize: false,
  }
);

StoreMenuSchema.index({ storeSlug: 1 }, { unique: true });
StoreMenuSchema.index({ storeSlug: 1, status: 1 });
StoreMenuSchema.index({ builtAt: -1 });

const StoreMenu =
  mongoose.models.StoreMenu || mongoose.model("StoreMenu", StoreMenuSchema);

export default StoreMenu;