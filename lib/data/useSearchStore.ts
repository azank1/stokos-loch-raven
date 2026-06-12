"use client";

import { create } from "zustand";

type SearchStore = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
};

export const useSearchStore = create<SearchStore>((set) => ({
  searchQuery: "",
  setSearchQuery: (value) => set({ searchQuery: value }),
}));