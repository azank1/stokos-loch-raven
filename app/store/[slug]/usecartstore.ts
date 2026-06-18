import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PizzaSide = "left" | "right" | "whole";

export interface CartItem {
  cartId: string;
  id: number | string;
  category?: string;
  categoryId?: string;
  title: string;
  image: string;
  price: number; // unit price
  quantity: number;
  size?: { label: string; price: number };
  toppings?: Record<string, PizzaSide>;
  sauces?: string[];
  note?: string;
}

interface CartStore {
  cart: CartItem[];
  isCartOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (cartId: string) => void;
  toggleCart: () => void;
  closeCart: () => void;
  clearCart: () => void;
  setCart: (items: CartItem[]) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      cart: [],
      isCartOpen: false,

      toggleCart: () =>
        set((state) => ({
          isCartOpen: !state.isCartOpen,
        })),

      closeCart: () =>
        set({
          isCartOpen: false,
        }),

      addItem: (item) =>
        set((state) => {
          const existingIndex = state.cart.findIndex(
            (cartItem) => cartItem.cartId === item.cartId
          );

          if (existingIndex > -1) {
            const newCart = [...state.cart];

            newCart[existingIndex] = {
              ...newCart[existingIndex],
              quantity: newCart[existingIndex].quantity + item.quantity,
            };

            return {
              cart: newCart,
              isCartOpen: true,
            };
          }

          return {
            cart: [...state.cart, item],
            isCartOpen: true,
          };
        }),

      removeItem: (cartId) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.cartId !== cartId),
        })),

      clearCart: () =>
        set({
          cart: [],
        }),

      setCart: (items) =>
        set({
          cart: items,
          isCartOpen: true,
        }),
    }),
    {
      name: "stokos-cart",
      partialize: (state) => ({
        cart: state.cart,
      }),
    }
  )
);