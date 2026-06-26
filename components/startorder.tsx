"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { X, Send, ChevronRight, Clock } from "lucide-react";
import { STORES } from "@/lib/data/stores";

type OrderType = "pickup" | "delivery";

export default function StartOrder() {
  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam || "towson";

  const store = STORES.find((item) => item.slug === slug) || STORES[0];

  const [modalOpen, setModalOpen] = useState(false);
  const [orderTypeForced, setOrderTypeForced] = useState(false);
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [address, setAddress] = useState("");
  const [day, setDay] = useState("Today");
  const [time, setTime] = useState("ASAP");

  const isOrderLaterOnly =
    orderType === "delivery" && store.deliveryOrderLaterOnly;

  useEffect(() => {
    const savedStore = localStorage.getItem("stokos_order_store");

    if (savedStore && savedStore !== store.slug) {
      localStorage.removeItem("stokos_order_type");
      localStorage.removeItem("stokos_delivery_address");
      localStorage.removeItem("stokos_order_day");
      localStorage.removeItem("stokos_order_time");
      localStorage.removeItem("stokos_order_store");
      setOrderTypeForced(true);
      setModalOpen(true);
      return;
    }

    const savedType = localStorage.getItem("stokos_order_type") as OrderType | null;
    const savedAddress = localStorage.getItem("stokos_delivery_address");
    const savedDay = localStorage.getItem("stokos_order_day");
    const savedTime = localStorage.getItem("stokos_order_time");

    if (savedType) {
      setOrderType(savedType);
      if (savedAddress) setAddress(savedAddress);
      if (savedDay) setDay(savedDay);
      if (savedTime) setTime(savedTime);
    } else {
      setOrderTypeForced(true);
      setModalOpen(true);
    }
  }, [store.slug]);

  useEffect(() => {
    const openStartOrder = () => {
      setModalOpen(true);
    };

    window.addEventListener("stokos-open-start-order", openStartOrder);

    return () => {
      window.removeEventListener("stokos-open-start-order", openStartOrder);
    };
  }, []);

  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type);

    if (type === "delivery" && store.deliveryOrderLaterOnly) {
      setDay("");
      setTime("");
    } else {
      setDay("Today");
      setTime("ASAP");
    }
  };

  const updateOrder = () => {
    if (!orderType) return;

    if (orderType === "delivery" && !address.trim()) return;

    if (isOrderLaterOnly && (!day || !time)) return;

    localStorage.setItem("stokos_order_store", store.slug);
    localStorage.setItem("stokos_order_type", orderType);
    localStorage.setItem("stokos_order_day", day || "Today");
    localStorage.setItem("stokos_order_time", time || "ASAP");

    if (orderType === "delivery") {
      localStorage.setItem("stokos_delivery_address", address.trim());
    } else {
      localStorage.removeItem("stokos_delivery_address");
    }

    window.dispatchEvent(new Event("stokos-order-updated"));
    setOrderTypeForced(false);
    setModalOpen(false);
  };

  const canContinue =
    orderType === "pickup" ||
    (orderType === "delivery" &&
      address.trim().length > 0 &&
      (!isOrderLaterOnly || (day && time)));

  const modalButtonClass = (type: OrderType) =>
    `flex min-h-[42px] items-center justify-between rounded border px-3 py-2 text-left font-black transition ${
      orderType === type
        ? "border-green-700 bg-green-50 ring-2 ring-green-700"
        : "border-zinc-300 bg-white hover:border-green-500"
    }`;

  return (
    <>
      {modalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[450px] overflow-hidden rounded-md bg-white shadow-2xl">
            <div className="relative px-6 pt-6 text-center">
              {!orderTypeForced && (
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="absolute right-4 top-4 text-zinc-700 hover:text-black"
                >
                  <X size={24} />
                </button>
              )}

              <h3 className="text-xl font-black uppercase text-[#9E1111]">
                Stoko&apos;s
              </h3>

              <div className="mt-5">
                <h4 className="text-xl font-black text-black">Stoko&apos;s</h4>
                <p className="mt-1 text-base text-zinc-700">{store.displayName}</p>
                {orderTypeForced && (
                  <p className="mt-2 text-sm text-zinc-500">
                    Choose how you&apos;d like to receive your order to get started.
                  </p>
                )}
              </div>

              <div className="mt-4 border-t border-zinc-200" />
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleOrderTypeChange("pickup")}
                  className={modalButtonClass("pickup")}
                >
                  <span className="text-green-700">Pickup</span>

                  <span
                    className={`rounded-full border px-2 py-1 text-xs ${
                      orderType === "pickup"
                        ? "border-green-700 bg-green-700 text-white "
                        : "border-green-700 text-green-700"
                    }`}
                  >
                    {store.pickupTime}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOrderTypeChange("delivery")}
                  className={modalButtonClass("delivery")}
                >
                  <span className="text-green-700">Delivery</span>

                  {store.deliveryOrderLaterOnly ? (
                    <span
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                        orderType === "delivery"
                          ? "border-green-700 bg-green-700 text-white"
                          : "border-green-700 text-green-700"
                      }`}
                    >
                      <Clock size={12} />
                    </span>
                  ) : (
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${
                        orderType === "delivery"
                          ? "border-green-700 bg-green-700 text-white"
                          : "border-green-700 text-green-700"
                      }`}
                    >
                      {store.deliveryTime}
                    </span>
                  )}
                </button>
              </div>

              {orderType === "delivery" && store.deliveryOrderLaterOnly && (
                <p className="mt-1 text-center text-xs text-zinc-500">
                  Order Later Only <Clock size={12} className="inline-block" />
                </p>
              )}

              {orderType === "delivery" && (
                <div className="mt-6 flex overflow-hidden rounded border border-zinc-300">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter street address..."
                    className="h-11 flex-1 px-3 text-sm outline-none"
                  />

                  <button
                    type="button"
                    className="m-1 flex h-9 w-9 items-center justify-center rounded bg-green-700 text-white"
                  >
                    <Send size={18} />
                  </button>
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-2">
                <select
                  value={day}
                  onChange={(e) => {
                    setDay(e.target.value);
                    if (store.deliveryOrderLaterOnly && orderType === "delivery") {
                      setTime("");
                    }
                  }}
                  className="h-10 rounded border border-zinc-300 px-3 text-sm font-semibold outline-none dark:text-black text-black"
                >
                  {isOrderLaterOnly ? (
                    <>
                      <option value="">Select a Date</option>
                      <option value="Today">Today</option>
                      <option value="Tomorrow">Tomorrow</option>
                    </>
                  ) : (
                    <>
                      <option value="Today">Today</option>
                      <option value="Tomorrow">Tomorrow</option>
                    </>
                  )}
                </select>

                <select
                  value={time}
                  disabled={isOrderLaterOnly && !day}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-10 rounded border dark:text-black text-black border-zinc-300 px-3 text-sm font-semibold outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  {isOrderLaterOnly ? (
                    <>
                      <option value="">Select a Time</option>
                      <option value="12:00 PM">12:00 PM</option>
                      <option value="12:30 PM">12:30 PM</option>
                      <option value="1:00 PM">1:00 PM</option>
                      <option value="1:30 PM">1:30 PM</option>
                      <option value="2:00 PM">2:00 PM</option>
                    </>
                  ) : (
                    <>
                      <option value="ASAP">ASAP</option>
                      <option value="12:00 PM">12:00 PM</option>
                      <option value="12:30 PM">12:30 PM</option>
                      <option value="1:00 PM">1:00 PM</option>
                      <option value="1:30 PM">1:30 PM</option>
                    </>
                  )}
                </select>
              </div>

              {isOrderLaterOnly && !day && (
                <p className="mt-2 text-center text-xs text-zinc-500">
                  Select a date first
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!canContinue}
              onClick={updateOrder}
              className={`flex w-full items-center justify-between px-6 py-4 text-left text-base font-black text-white ${
                canContinue
                  ? "bg-green-700 hover:bg-green-800"
                  : "cursor-not-allowed bg-zinc-400"
              }`}
            >
              <span>
                {!orderType
                  ? "Select Pickup or Delivery"
                  : orderType === "pickup"
                  ? orderTypeForced
                    ? "Start Your Pickup Order"
                    : "Update Your Pickup Order"
                  : !address.trim()
                  ? "Enter Your Delivery Address to Continue"
                  : isOrderLaterOnly && (!day || !time)
                  ? "Select Delivery Date & Time to Continue"
                  : orderTypeForced
                  ? "Start Your Delivery Order"
                  : "Update Your Delivery Order"}
              </span>

              <ChevronRight size={26} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}