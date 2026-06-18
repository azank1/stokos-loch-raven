"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  Search,
  Store,
  Truck,
  User,
  Utensils,
  X,
} from "lucide-react";
import {
  getNextStatuses,
  STATUS_COLORS,
  type OrderStatus,
  type OrderType,
} from "@/lib/orderstatus";

type AdminOrderItem = {
  name?: string;
  title?: string;
  quantity?: number;
  amount?: number;
  currency?: string;
  size?: {
    label?: string;
    price?: number;
  };
  toppings?: Record<string, string>;
  sauces?: string[];
  note?: string;
};

type AdminOrder = {
  _id: string;
  orderNumber: string;
  createdAt: string;
  storeName: string;
  storeSlug?: string;
  orderType: "pickup" | "delivery" | string;
  deliveryAddress?: string;
  orderDay?: string;
  orderTime?: string;
  customerName?: string;
  customerEmail?: string;
  paymentStatus?: string;
  amountTotal: number;
  subtotal?: number;
  deliveryFee?: number;
  tax?: number;
  currency?: string;
  paymentMethod?: string;
  status: string;
  statusHistory?: { status: string; at: string }[];
  items: AdminOrderItem[];
};

const ALL_STATUSES = [
  "all",
  "Placed",
  "Confirmed",
  "Preparing",
  "Ready for Pickup",
  "Out for Delivery",
  "Delivered",
  "Completed",
  "Cancelled",
] as const;

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeOrder, setActiveOrder] = useState<AdminOrder | null>(null);
  const [notification, setNotification] = useState("");
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders);
        setActiveOrder((current) => {
          if (current) {
            return (
              data.orders.find((o: AdminOrder) => o._id === current._id) ||
              data.orders[0] ||
              null
            );
          }
          return data.orders[0] || null;
        });
      }
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(""), 4500);
    return () => clearTimeout(timer);
  }, [notification]);

  const filteredOrders = useMemo(() => {
    const value = search.toLowerCase().trim();
    if (!value) return orders;
    return orders.filter(
      (order) =>
        safeText(order.orderNumber).includes(value) ||
        safeText(order.customerName).includes(value) ||
        safeText(order.customerEmail).includes(value) ||
        safeText(order.storeName).includes(value) ||
        safeText(order.orderType).includes(value)
    );
  }, [orders, search]);

  const totalRevenue = orders.reduce(
    (acc, order) => acc + Number(order.amountTotal || 0),
    0
  );

  const pickupOrders = orders.filter(
    (o) => o.orderType?.toLowerCase() === "pickup"
  ).length;

  const deliveryOrders = orders.filter(
    (o) => o.orderType?.toLowerCase() === "delivery"
  ).length;

  const handleAdvanceStatus = async (newStatus: OrderStatus) => {
    if (!activeOrder || advancing) return;

    setAdvancing(true);

    try {
      const res = await fetch(`/api/admin/orders/${activeOrder._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (data.success) {
        setNotification(`Order ${activeOrder.orderNumber} → ${newStatus}`);
        await loadOrders();
      } else {
        alert(data.message || "Failed to update status.");
      }
    } catch {
      alert("Something went wrong.");
    } finally {
      setAdvancing(false);
    }
  };

  const nextStatuses = activeOrder
    ? getNextStatuses(
        activeOrder.status as OrderStatus,
        activeOrder.orderType as OrderType
      )
    : [];

  return (
    <div className="w-full">
      <section className="mb-5 overflow-hidden rounded-[30px] bg-[#146C38] p-6 text-white md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-4 flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2">
              <LayoutDashboard size={16} />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-white/75">
                Admin Control Center
              </span>
            </div>

            <h2 className="text-3xl font-black tracking-tight md:text-5xl">
              Manage Stoko&apos;s Orders
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
              Manage orders, delivery, payments, and customer details from one
              clean dashboard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <MiniHeroCard
              label="Total Orders"
              value={orders.length.toString()}
            />
            <MiniHeroCard
              label="Revenue"
              value={formatMoney("USD", totalRevenue)}
            />
          </div>
        </div>
      </section>

      {notification && (
        <div className="mb-5 flex items-center justify-between rounded-3xl border border-green-200 bg-green-50 px-5 py-4 text-green-900 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} />
            <p className="text-sm font-black">{notification}</p>
          </div>

          <button type="button" onClick={() => setNotification("")}>
            <X size={18} />
          </button>
        </div>
      )}

      <section className="mb-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          title="Total Orders"
          value={orders.length.toString()}
          icon={<PackageCheck />}
        />

        <StatCard
          title="Revenue"
          value={formatMoney("USD", totalRevenue)}
          icon={<CreditCard />}
        />

        <StatCard
          title="Pickup Orders"
          value={pickupOrders.toString()}
          icon={<Store />}
        />

        <StatCard
          title="Delivery Orders"
          value={deliveryOrders.toString()}
          icon={<Truck />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Order list */}
        <div className="overflow-hidden rounded-[30px] border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black uppercase">Orders</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {loading ? "Loading..." : `${filteredOrders.length} order${filteredOrders.length !== 1 ? "s" : ""}`}
                </p>
              </div>

              <button
                type="button"
                onClick={loadOrders}
                className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-black uppercase text-zinc-600 hover:bg-zinc-200"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <Search size={18} className="text-zinc-400" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search orders..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
              />
            </div>

            {/* Status filter */}
            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase transition ${
                    statusFilter === s
                      ? "bg-[#0F3F24] text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[760px] space-y-3 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-48 items-center justify-center text-zinc-400">
                <p className="font-bold">Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center text-center text-zinc-400">
                <PackageCheck size={46} className="mb-4 opacity-30" />
                <p className="font-bold">No orders yet</p>
                <p className="mt-1 text-sm">New orders will appear here.</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isActive = activeOrder?._id === order._id;

                return (
                  <button
                    key={order._id}
                    type="button"
                    onClick={() => setActiveOrder(order)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      isActive
                        ? "border-green-700 bg-green-50 shadow-sm"
                        : "border-zinc-200 bg-white hover:border-green-400 hover:bg-green-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">{order.orderNumber}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <OrderTypeBadge type={order.orderType} />
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                            STATUS_COLORS[order.status as OrderStatus] ||
                            "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {order.customerName || "Customer"}
                        </p>

                        <p className="truncate text-xs text-zinc-500">
                          {order.storeName || "Store"}
                        </p>
                      </div>

                      <p className="shrink-0 text-lg font-black">
                        {formatMoney(order.currency, order.amountTotal)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Order detail */}
        <div className="overflow-hidden rounded-[30px] border border-zinc-200 bg-white shadow-sm">
          {!activeOrder ? (
            <div className="flex min-h-[640px] flex-col items-center justify-center text-center text-zinc-400">
              <PackageCheck size={52} className="mb-4 opacity-30" />
              <p className="font-bold">Select an order to view details</p>
            </div>
          ) : (
            <>
              <div className="border-b border-zinc-200 p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-green-700">
                      Order Detail
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      {activeOrder.orderNumber}
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500">
                      {formatDate(activeOrder.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="rounded-2xl bg-green-50 px-5 py-3 text-green-800">
                      <p className="text-xs font-black uppercase">Payment</p>
                      <p className="text-sm font-black">
                        {activeOrder.paymentStatus === "paid"
                          ? "Paid Successfully"
                          : activeOrder.paymentStatus || "Pending"}
                      </p>
                    </div>

                    <div
                      className={`rounded-2xl px-5 py-3 ${STATUS_COLORS[activeOrder.status as OrderStatus] || "bg-zinc-100 text-zinc-800"}`}
                    >
                      <p className="text-xs font-black uppercase">Status</p>
                      <p className="text-sm font-black">{activeOrder.status}</p>
                    </div>

                    <div className="rounded-2xl bg-zinc-100 px-5 py-3 text-zinc-800">
                      <p className="text-xs font-black uppercase">Total</p>
                      <p className="text-sm font-black">
                        {formatMoney(activeOrder.currency, activeOrder.amountTotal)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status advance controls */}
                {nextStatuses.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <p className="w-full text-xs font-black uppercase text-zinc-400">
                      Advance status:
                    </p>

                    {nextStatuses.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={advancing}
                        onClick={() => handleAdvanceStatus(s)}
                        className={`rounded-full px-4 py-2 text-xs font-black uppercase transition disabled:opacity-60 ${
                          s === "Cancelled"
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-[#0F3F24] text-white hover:bg-[#146C38]"
                        }`}
                      >
                        {advancing ? "..." : `→ ${s}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 p-6 md:grid-cols-2">
                <DetailCard
                  icon={<User size={20} />}
                  title="Customer"
                  main={activeOrder.customerName || "Not provided"}
                  sub={activeOrder.customerEmail || "Not provided"}
                />

                <DetailCard
                  icon={<CreditCard size={20} />}
                  title="Payment"
                  main={formatMoney(activeOrder.currency, activeOrder.amountTotal)}
                  sub={activeOrder.paymentMethod || "Card via Stripe"}
                />

                <DetailCard
                  icon={
                    activeOrder.orderType?.toLowerCase() === "delivery" ? (
                      <Truck size={20} />
                    ) : (
                      <Store size={20} />
                    )
                  }
                  title="Order Type"
                  main={
                    activeOrder.orderType?.toLowerCase() === "delivery"
                      ? "Delivery"
                      : "Pickup / Carryout"
                  }
                  sub={`${activeOrder.orderDay || "Today"} · ${activeOrder.orderTime || "ASAP"}`}
                />

                <DetailCard
                  icon={<MapPin size={20} />}
                  title={
                    activeOrder.orderType?.toLowerCase() === "delivery"
                      ? "Delivery Address"
                      : "Pickup Store"
                  }
                  main={
                    activeOrder.orderType?.toLowerCase() === "delivery"
                      ? activeOrder.deliveryAddress || "Not provided"
                      : activeOrder.storeName || "Store"
                  }
                  sub="Store / order location"
                />
              </div>

              {/* Money breakdown */}
              {(activeOrder.subtotal !== undefined ||
                activeOrder.deliveryFee ||
                activeOrder.tax) && (
                <div className="px-6 pb-4">
                  <div className="rounded-3xl border border-zinc-200 p-4">
                    <p className="mb-3 text-xs font-black uppercase text-zinc-500">
                      Order Totals
                    </p>

                    <div className="space-y-2 text-sm">
                      {activeOrder.subtotal !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Subtotal</span>
                          <span className="font-bold">
                            {formatMoney(activeOrder.currency, activeOrder.subtotal)}
                          </span>
                        </div>
                      )}

                      {(activeOrder.deliveryFee ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Delivery Fee</span>
                          <span className="font-bold">
                            {formatMoney(activeOrder.currency, activeOrder.deliveryFee)}
                          </span>
                        </div>
                      )}

                      {(activeOrder.tax ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Tax</span>
                          <span className="font-bold">
                            {formatMoney(activeOrder.currency, activeOrder.tax)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between border-t border-zinc-200 pt-2">
                        <span className="font-black">Total</span>
                        <span className="font-black text-green-800">
                          {formatMoney(activeOrder.currency, activeOrder.amountTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="px-6 pb-6">
                <div className="rounded-3xl border border-zinc-200">
                  <div className="flex items-center gap-3 border-b border-zinc-200 p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-green-800">
                      <Utensils size={20} />
                    </div>

                    <div>
                      <h3 className="text-lg font-black uppercase">
                        Full Order Details
                      </h3>

                      <p className="text-sm text-zinc-500">
                        Items, size, toppings, sauces, and special instructions.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    {activeOrder.items?.length ? (
                      activeOrder.items.map((item, index) => {
                        const itemName = item.name || item.title || "Menu Item";
                        const hasToppings =
                          item.toppings &&
                          Object.keys(item.toppings).length > 0;
                        const hasSauces = item.sauces && item.sauces.length > 0;
                        const hasNote = item.note && item.note.trim().length > 0;
                        const hasDetails =
                          item.size?.label || hasToppings || hasSauces || hasNote;

                        return (
                          <div
                            key={`${itemName}-${index}`}
                            className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-base font-black">
                                  {item.quantity || 1}x {itemName}
                                </p>

                                {item.size?.label && (
                                  <p className="mt-1 text-xs font-semibold text-zinc-500">
                                    Size: {item.size.label}
                                  </p>
                                )}
                              </div>

                              <p className="text-sm font-black">
                                {formatMoney(
                                  item.currency || activeOrder.currency,
                                  item.amount || 0
                                )}
                              </p>
                            </div>

                            {hasDetails && (
                              <div className="mt-4 space-y-3 rounded-2xl bg-white p-4">
                                {hasToppings && (
                                  <div>
                                    <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                                      Toppings
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                                      {Object.entries(item.toppings || {})
                                        .map(
                                          ([name, side]) =>
                                            `${name} (${formatSide(side)})`
                                        )
                                        .join(", ")}
                                    </p>
                                  </div>
                                )}

                                {hasSauces && (
                                  <div>
                                    <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                                      Sauces
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                                      {(item.sauces || []).join(", ")}
                                    </p>
                                  </div>
                                )}

                                {hasNote && (
                                  <div>
                                    <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                                      Special Instructions
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                                      {item.note}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center text-center text-zinc-400">
                        <FileText size={34} className="mb-3 opacity-40" />
                        <p className="font-bold">No item details available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function MiniHeroCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/10 p-4">
      <p className="text-xs font-black uppercase text-white/55">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-800">
        {icon}
      </div>

      <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function DetailCard({
  icon,
  title,
  main,
  sub,
}: {
  icon: ReactNode;
  title: string;
  main: string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-green-800 shadow-sm">
        {icon}
      </div>

      <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
        {title}
      </p>

      <p className="mt-2 break-words text-base font-black">{main}</p>
      <p className="mt-1 break-words text-sm text-zinc-500">{sub}</p>
    </div>
  );
}

function OrderTypeBadge({ type }: { type: string }) {
  const isDelivery = type?.toLowerCase() === "delivery";

  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
        isDelivery ? "bg-orange-100 text-orange-700" : "bg-green-800 text-white"
      }`}
    >
      {isDelivery ? "Delivery" : "Pickup"}
    </span>
  );
}

function safeText(value: unknown) {
  return String(value || "").toLowerCase();
}

function formatMoney(
  currency: string | undefined,
  amount: number | undefined
) {
  const code = currency?.toUpperCase() || "USD";
  const value = Number(amount || 0).toFixed(2);
  if (code === "USD") return `$${value}`;
  return `${code} ${value}`;
}

function formatDate(value: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function formatSide(value: string) {
  if (!value) return "Whole";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
