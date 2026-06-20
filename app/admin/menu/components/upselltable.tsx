"use client";

import { useState } from "react";
import { Edit2, ImageIcon, Trash2 } from "lucide-react";

import type { Product, UpsellRule, UpsellStatus } from "../types";
import Pagination from "@/components/pagination";

const PAGE_SIZE = 12;

type StoreItem = {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
};

type UpsellTableProps = {
  upsellRules: UpsellRule[];
  stores?: StoreItem[];
  products?: Product[]; // kept optional for old parent props; no longer used.
  onEdit: (upsell: UpsellRule) => void;
  onDelete: (id: string) => void;
};

function normalizeStoreValue(value: unknown) {
  if (!value) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const obj = value as {
      _id?: string;
      id?: string;
      slug?: string;
      name?: string;
    };

    return String(obj.slug || obj._id || obj.id || obj.name || "").trim();
  }

  return "";
}

function getStoreValue(store: StoreItem) {
  return (
    normalizeStoreValue(store.slug) ||
    normalizeStoreValue(store._id) ||
    normalizeStoreValue(store.id) ||
    normalizeStoreValue(store.name)
  );
}

function getStoreName(stores: StoreItem[], storeId: string) {
  const foundStore = stores.find((store) => getStoreValue(store) === storeId);
  return foundStore?.name || storeId;
}

function getSafeId(item: unknown) {
  if (!item || typeof item !== "object") return "";

  const obj = item as { _id?: string; id?: string };
  return String(obj._id || obj.id || "").trim();
}

function getStatusClass(status?: UpsellStatus) {
  if (status === "Inactive") return "bg-zinc-100 text-zinc-600";
  if (status === "Paused") return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-800";
}

function getStoreConfigs(upsell: UpsellRule) {
  const configs = Array.isArray(upsell.storeConfigs) ? upsell.storeConfigs : [];

  if (configs.length > 0) {
    return configs
      .map((config, index) => ({
        storeId: normalizeStoreValue(config.storeId),
        categoryName: String(config.categoryName || "").trim(),
        available: config.available !== false,
        status: config.status || "Active",
        sortOrder: Number(config.sortOrder ?? index),
      }))
      .filter((config) => config.storeId)
      .sort((first, second) => first.sortOrder - second.sortOrder);
  }

  const storeIds = Array.isArray(upsell.storeIds) ? upsell.storeIds : [];
  const categoryName =
    upsell.categoryName ||
    upsell.categoryType ||
    upsell.triggerCategoryName ||
    upsell.appliesToCategories?.[0] ||
    "";

  if (storeIds.length > 0) {
    return storeIds.map((storeId, index) => ({
      storeId: normalizeStoreValue(storeId),
      categoryName,
      available: true,
      status: "Active" as UpsellStatus,
      sortOrder: index,
    }));
  }

  return [
    {
      storeId: normalizeStoreValue(upsell.storeId || "towson"),
      categoryName,
      available: true,
      status: upsell.status || "Active",
      sortOrder: 0,
    },
  ].filter((config) => config.storeId);
}

export default function UpsellTable({
  upsellRules,
  stores = [],
  onEdit,
  onDelete,
}: UpsellTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalUpsells = upsellRules.length;
  const totalPages = Math.max(1, Math.ceil(totalUpsells / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedUpsells = upsellRules.slice(startIndex, startIndex + PAGE_SIZE);

  if (!totalUpsells) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center">
        <h3 className="text-lg font-black text-zinc-950">No upsells found</h3>
        <p className="mt-2 text-sm font-semibold text-zinc-500">
          Add your first upsell item with store-wise category availability.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left">
          <thead className="bg-zinc-50 text-xs font-black uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-4">Upsell Item</th>
              <th className="px-5 py-4">Store-wise Category</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {paginatedUpsells.map((upsell) => {
              const id = getSafeId(upsell);
              const configs = getStoreConfigs(upsell);
              const activeConfigs = configs.filter(
                (config) => config.available && config.status !== "Inactive"
              );

              return (
                <tr key={id || upsell.slug || upsell.name} className="align-top">
                  <td className="px-5 py-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-green-50 text-green-800">
                        {upsell.image ? (
                          <img
                            src={upsell.image}
                            alt={upsell.name || "Upsell"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon size={20} />
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-zinc-950">
                          {upsell.name || "Untitled Upsell"}
                        </h4>

                        {upsell.description && (
                          <p className="mt-1 max-w-xs text-xs font-semibold leading-5 text-zinc-500">
                            {upsell.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-5">
                    <div className="space-y-2">
                      {configs.length ? (
                        configs.map((config) => (
                          <div
                            key={`${id}-${config.storeId}`}
                            className={`rounded-2xl border px-3 py-2 ${
                              config.available && config.status !== "Inactive"
                                ? "border-green-100 bg-green-50"
                                : "border-zinc-100 bg-zinc-50"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-black text-zinc-900">
                                {getStoreName(stores, config.storeId)}
                              </span>

                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-black ${
                                  config.available && config.status !== "Inactive"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-zinc-200 text-zinc-600"
                                }`}
                              >
                                {config.available && config.status !== "Inactive"
                                  ? config.status
                                  : "Off"}
                              </span>
                            </div>

                            <p className="mt-1 text-xs font-bold text-zinc-500">
                              Category: {config.categoryName || "Not selected"}
                            </p>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs font-bold text-zinc-400">
                          No store config
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-5">
                    <div className="space-y-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${getStatusClass(
                          upsell.status
                        )}`}
                      >
                        {upsell.status || "Active"}
                      </span>

                      <p className="text-xs font-semibold text-zinc-500">
                        {activeConfigs.length} active store
                        {activeConfigs.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-5">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(upsell)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-green-50 hover:text-green-800"
                        aria-label="Edit upsell"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => id && onDelete(id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                        aria-label="Delete upsell"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={totalUpsells}
        pageSize={PAGE_SIZE}
        itemLabel="upsells"
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
