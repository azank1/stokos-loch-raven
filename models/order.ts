import mongoose, { Schema } from "mongoose";

const OrderItemSchema = new Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true },
    size: {
      label: String,
      price: Number,
    },
    toppings: { type: Map, of: String },
    sauces: [String],
    note: String,
  },
  { _id: false }
);

const StatusHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    stripeSessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    storeSlug: { type: String, required: true, index: true },
    storeName: { type: String, required: true },

    orderType: {
      type: String,
      enum: ["pickup", "delivery"],
      required: true,
    },

    deliveryAddress: { type: String },
    orderDay: { type: String, default: "Today" },
    orderTime: { type: String, default: "ASAP" },

    customerName: { type: String, default: "Not provided" },
    customerEmail: { type: String, default: "Not provided" },
    customerPhone: { type: String },

    items: { type: [OrderItemSchema], default: [] },

    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    amountTotal: { type: Number, required: true },
    currency: { type: String, default: "USD" },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      index: true,
    },

    status: {
      type: String,
      enum: [
        "Placed",
        "Confirmed",
        "Preparing",
        "Ready for Pickup",
        "Out for Delivery",
        "Delivered",
        "Completed",
        "Cancelled",
      ],
      default: "Placed",
      index: true,
    },

    statusHistory: { type: [StatusHistorySchema], default: [] },
  },
  {
    timestamps: true,
    collection: "orders",
  }
);

const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

export default Order;
