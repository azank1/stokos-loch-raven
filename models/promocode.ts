import mongoose, { Schema } from "mongoose";

const PromoCodeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "", trim: true },
    discountType: {
      type: String,
      enum: ["percent", "fixed"],
      default: "percent",
    },
    discountValue: { type: Number, required: true, min: 0 },
    minimumSubtotal: { type: Number, default: 0, min: 0 },
    maxUses: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "promocodes" }
);

const PromoCode =
  mongoose.models.PromoCode || mongoose.model("PromoCode", PromoCodeSchema);

export default PromoCode;
