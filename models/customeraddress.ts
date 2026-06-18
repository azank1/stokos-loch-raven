import mongoose, { Schema } from "mongoose";

const CustomerAddressSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, index: true },
    label: { type: String, default: "Home", trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    zip: { type: String, default: "", trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "customeraddresses" }
);

CustomerAddressSchema.index({ clerkUserId: 1, isDefault: 1 });

const CustomerAddress =
  mongoose.models.CustomerAddress ||
  mongoose.model("CustomerAddress", CustomerAddressSchema);

export default CustomerAddress;
