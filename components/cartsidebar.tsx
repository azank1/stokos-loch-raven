"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useCartStore } from "@/app/store/[slug]/usecartstore";
import type { CartItem } from "@/app/store/[slug]/usecartstore";
import { STORES } from "@/lib/data/stores";
import {
  X,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Truck,
  Store,
  Clock,
  MapPin,
  PencilLine,
} from "lucide-react";
import Image from "next/image";

const upsellByCategory: Record<string, CartItem[]> = {
  pizzas: [
    {
      cartId: "upsell-coke-2l",
      id: "upsell-coke-2l",
      category: "upsell",
      title: "Coke 2L",
      price: 3.5,
      quantity: 1,
      image:
        "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=600&auto=format&fit=crop",
    },
    {
      cartId: "upsell-wings",
      id: "upsell-wings",
      category: "upsell",
      title: "Buffalo Wings",
      price: 8.99,
      quantity: 1,
      image:
        "https://images.unsplash.com/photo-1527477396000-e27163b481c2?q=80&w=600&auto=format&fit=crop",
    },
    {
      cartId: "upsell-fries-pizza",
      id: "upsell-fries-pizza",
      category: "upsell",
      title: "French Fries",
      price: 4.99,
      quantity: 1,
      image:
        "https://images.unsplash.com/photo-1576107232684-1279f390859f?q=80&w=600&auto=format&fit=crop",
    },
    {
      cartId: "upsell-garlic-knots",
      id: "upsell-garlic-knots",
      category: "upsell",
      title: "Garlic Knots",
      price: 5.99,
      quantity: 1,
      image:
        "https://www.savingdessert.com/wp-content/uploads/2022/02/Garlic-Knots-8.jpg",
    },
  ],

  breakfast: [
    {
      cartId: "upsell-coffee",
      id: "upsell-coffee",
      category: "upsell",
      title: "Hot Coffee",
      price: 2.49,
      quantity: 1,
      image:
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=600&auto=format&fit=crop",
    },
    {
      cartId: "upsell-hash-browns",
      id: "upsell-hash-browns",
      category: "upsell",
      title: "Hash Browns",
      price: 3.99,
      quantity: 1,
      image:
        "https://seasonandthyme.com/wp-content/uploads/2022/01/frozen-hash-browns-air-fryer-2.jpeg",
    },
  ],

  trending: [
    {
      cartId: "upsell-fries-trending",
      id: "upsell-fries-trending",
      category: "upsell",
      title: "French Fries",
      price: 4.99,
      quantity: 1,
      image:
        "https://images.unsplash.com/photo-1576107232684-1279f390859f?q=80&w=600&auto=format&fit=crop",
    },
    {
      cartId: "upsell-coke-can",
      id: "upsell-coke-can",
      category: "upsell",
      title: "Coke Can",
      price: 1.99,
      quantity: 1,
      image:
        "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?q=80&w=600&auto=format&fit=crop",
    },
  ],
};

type StoreConfig = {
  deliveryFee: number;
  taxRate: number;
  minimumOrder: number;
};

export default function CartSidebar() {
  const [mounted, setMounted] = useState(false);

  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam || "towson";

  const currentStore = STORES.find((store) => store.slug === slug) || STORES[0];

  const [loading, setLoading] = useState(false);
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);

  const [orderType, setOrderType] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<string | null>(null);
  const [orderDay, setOrderDay] = useState<string | null>(null);
  const [orderTime, setOrderTime] = useState<string | null>(null);
  const [orderStoreSlug, setOrderStoreSlug] = useState<string | null>(null);

  const { cart, isCartOpen, toggleCart, closeCart, removeItem, addItem } =
    useCartStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/store/${slug}/config`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setStoreConfig({ deliveryFee: d.deliveryFee, taxRate: d.taxRate, minimumOrder: d.minimumOrder });
        }
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (!mounted) return;

    const loadOrderInfo = () => {
      setOrderType(localStorage.getItem("stokos_order_type"));
      setDeliveryAddress(localStorage.getItem("stokos_delivery_address"));
      setOrderDay(localStorage.getItem("stokos_order_day"));
      setOrderTime(localStorage.getItem("stokos_order_time"));
      setOrderStoreSlug(localStorage.getItem("stokos_order_store") || slug);
    };

    loadOrderInfo();

    window.addEventListener("stokos-order-updated", loadOrderInfo);

    return () => {
      window.removeEventListener("stokos-order-updated", loadOrderInfo);
    };
  }, [slug, mounted]);

  useEffect(() => {
    if (!mounted) return;

    const resetLoading = () => {
      setLoading(false);
      closeCart();
    };

    window.addEventListener("pageshow", resetLoading);

    return () => {
      window.removeEventListener("pageshow", resetLoading);
    };
  }, [closeCart, mounted]);

  if (!mounted) return null;

  const orderStore =
    STORES.find((store) => store.slug === orderStoreSlug) || currentStore;

  const openOrderEditModal = () => {
    closeCart();

    setTimeout(() => {
      window.dispatchEvent(new Event("stokos-open-start-order"));
    }, 80);
  };

  const subtotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  const isDelivery = orderType === "delivery";
  const deliveryFee = isDelivery ? (storeConfig?.deliveryFee ?? 0) : 0;
  const taxAmount = storeConfig ? subtotal * (storeConfig.taxRate / 100) : 0;
  const estimatedTotal = subtotal + deliveryFee + taxAmount;

  const mainCartItems = cart.filter((item) => item.category !== "upsell");

  const upsellSections = mainCartItems
    .map((mainItem, index) => {
      const items = (upsellByCategory[mainItem.category || ""] || []).filter(
        (upsell) => !cart.some((cartItem) => cartItem.cartId === upsell.cartId)
      );

      return {
        key: `${mainItem.cartId}-${index}`,
        title: mainItem.title,
        items,
      };
    })
    .filter((section) => section.items.length > 0);

  const handleStripeCheckout = async () => {
    if (cart.length === 0 || loading) return;

    if (!orderType) {
      openOrderEditModal();
      return;
    }

    if (orderType === "delivery" && !deliveryAddress) {
      openOrderEditModal();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          items: cart,
          orderType,
          deliveryAddress,
          orderDay: orderDay || "Today",
          orderTime: orderTime || "ASAP",
          orderStore: orderStore.slug,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Checkout API Error:", data);
        alert(data?.error || "Stripe checkout failed");
        setLoading(false);
        return;
      }

      if (data.url) {
        sessionStorage.setItem("stripe_checkout_started", "1");
        window.location.assign(data.url);
        return;
      }

      alert("Stripe URL missing");
      setLoading(false);
    } catch (error) {
      console.error("Checkout Error:", error);
      alert("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <>
      {isCartOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          onClick={toggleCart}
        />
      )}

      <div
        className={`fixed right-0 top-0 z-[70] h-full w-full bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-[#121212] sm:max-w-md ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b p-4 dark:border-zinc-800 sm:p-5">
            <h2 className="text-lg font-black uppercase italic sm:text-xl">
              Your Order ({cart.length})
            </h2>

            <button
              type="button"
              onClick={toggleCart}
              className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X size={24} />
            </button>
          </div>

          <div className="no-scrollbar flex-grow space-y-4 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
            {orderType ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-800 text-white">
                      {orderType === "pickup" ? (
                        <Store size={18} />
                      ) : (
                        <Truck size={18} />
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase text-zinc-500">
                        Order Type
                      </p>

                      <p className="text-sm font-black capitalize text-black dark:text-white">
                        {orderType === "pickup"
                          ? "Pickup / Carryout"
                          : "Delivery"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openOrderEditModal}
                    className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 text-xs font-black text-zinc-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <PencilLine size={13} />
                    Edit
                  </button>
                </div>

                <div className="mt-4 rounded-xl bg-white p-3 dark:bg-black">
                  <p className="text-[11px] font-black uppercase text-zinc-500">
                    {orderType === "pickup"
                      ? "Pickup Store"
                      : "Ordering From"}
                  </p>

                  <p className="mt-1 text-sm font-black text-black dark:text-white">
                    {orderStore.name}
                  </p>

                  <div className="mt-2 flex gap-2 text-xs leading-5 text-zinc-500">
                    <MapPin size={14} className="mt-0.5 shrink-0" />
                    <span>
                      {orderStore.address}
                      <br />
                      {orderStore.cityStateZip}
                    </span>
                  </div>
                </div>

                {orderType === "delivery" && deliveryAddress && (
                  <div className="mt-3 rounded-xl bg-white p-3 dark:bg-black">
                    <p className="text-[11px] font-black uppercase text-zinc-500">
                      Delivery Address
                    </p>

                    <div className="mt-2 flex gap-2 text-xs leading-5 text-zinc-500">
                      <MapPin size={14} className="mt-0.5 shrink-0" />
                      <span>{deliveryAddress}</span>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex gap-2 text-xs text-zinc-500">
                  <Clock size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {orderDay || "Today"} · {orderTime || "ASAP"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-bold text-yellow-800">
                <p>Please select Delivery or Pickup before checkout.</p>

                <button
                  type="button"
                  onClick={openOrderEditModal}
                  className="mt-3 rounded-full bg-green-800 px-4 py-2 text-xs font-black uppercase text-white"
                >
                  Select Now
                </button>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-zinc-400">
                <ShoppingBag size={48} className="mb-4 opacity-20" />
                <p className="font-bold">Your cart is empty</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={`${item.cartId}-${index}`}
                  className="flex gap-3 rounded-2xl border p-3 dark:border-zinc-800 sm:gap-4"
                >
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-grow">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-bold leading-tight">
                        {item.quantity}x {item.title}
                      </h4>

                      <button
                        type="button"
                        onClick={() => removeItem(item.cartId)}
                        className="text-zinc-400 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {item.size?.label && (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Size: {item.size.label}
                      </p>
                    )}

                    {item.toppings &&
                      Object.keys(item.toppings).length > 0 && (
                        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                          Toppings:{" "}
                          {Object.entries(item.toppings)
                            .map(([name, side]) => `${name} (${side})`)
                            .join(", ")}
                        </p>
                      )}

                    {item.sauces && item.sauces.length > 0 && (
                      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                        Sauces: {item.sauces.join(", ")}
                      </p>
                    )}

                    {item.note && (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Note: {item.note}
                      </p>
                    )}

                    <p className="mt-2 font-black">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}

            {cart.length > 0 && upsellSections.length > 0 && (
              <div className="mt-8 space-y-6">
                {upsellSections.map((section) => (
                  <div key={section.key}>
                    <h3 className="mb-3 text-xs font-black uppercase text-zinc-400">
                      Complete your meal with {section.title}
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      {section.items.map((up) => (
                        <div
                          key={up.cartId}
                          className="rounded-xl border bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
                        >
                          <div className="relative mb-3 h-24 w-full overflow-hidden rounded-lg bg-zinc-100 sm:h-28">
                            <Image
                              src={up.image}
                              alt={up.title}
                              fill
                              sizes="180px"
                              className="object-cover"
                            />
                          </div>

                          <div className="mb-3 min-h-[34px] text-[12px] font-bold line-clamp-2">
                            {up.title}
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black">
                              ${up.price.toFixed(2)}
                            </span>

                            <button
                              type="button"
                              onClick={() => addItem(up)}
                              className="h-8 w-8 rounded-lg bg-[#DA3327] text-xs font-black text-white"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
            <div className="mb-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-bold">${subtotal.toFixed(2)}</span>
              </div>

              {isDelivery && storeConfig && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Delivery Fee</span>
                  <span className="font-bold">
                    {deliveryFee === 0 ? "Free" : `$${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
              )}

              {storeConfig && storeConfig.taxRate > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Est. Tax ({storeConfig.taxRate}%)</span>
                  <span className="font-bold">${taxAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-700">
                <span className="font-black uppercase">Est. Total</span>
                <span className="text-xl font-black">${estimatedTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStripeCheckout}
              disabled={loading || cart.length === 0}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#DA3327] font-black uppercase italic tracking-tighter text-white transition-transform hover:bg-red-700 active:scale-95 disabled:opacity-60"
            >
              {loading ? "Redirecting..." : "Go to Checkout"}
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}