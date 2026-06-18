export type OrderStatus =
  | "Placed"
  | "Confirmed"
  | "Preparing"
  | "Ready for Pickup"
  | "Out for Delivery"
  | "Delivered"
  | "Completed"
  | "Cancelled";

export type OrderType = "pickup" | "delivery";

const PICKUP_FLOW: OrderStatus[] = [
  "Placed",
  "Confirmed",
  "Preparing",
  "Ready for Pickup",
  "Completed",
];

const DELIVERY_FLOW: OrderStatus[] = [
  "Placed",
  "Confirmed",
  "Preparing",
  "Out for Delivery",
  "Delivered",
  "Completed",
];

export function getNextStatuses(
  current: OrderStatus,
  orderType: OrderType
): OrderStatus[] {
  const flow = orderType === "delivery" ? DELIVERY_FLOW : PICKUP_FLOW;
  const idx = flow.indexOf(current);

  if (idx === -1 || current === "Completed" || current === "Cancelled") {
    return [];
  }

  const next: OrderStatus[] = [];

  if (idx < flow.length - 1) {
    next.push(flow[idx + 1]);
  }

  next.push("Cancelled");

  return next;
}

export function isValidTransition(
  from: OrderStatus,
  to: OrderStatus,
  orderType: OrderType
): boolean {
  return getNextStatuses(from, orderType).includes(to);
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  Placed: "bg-zinc-100 text-zinc-700",
  Confirmed: "bg-blue-100 text-blue-700",
  Preparing: "bg-yellow-100 text-yellow-700",
  "Ready for Pickup": "bg-green-100 text-green-700",
  "Out for Delivery": "bg-orange-100 text-orange-700",
  Delivered: "bg-green-100 text-green-700",
  Completed: "bg-green-800 text-white",
  Cancelled: "bg-red-100 text-red-700",
};
