"use client";

import { useEffect, useState } from "react";
import type { StoreItem } from "../page";

type StoreFormState = {
  name: string;
  location: string;
  phone: string;
  openingHours: string;
  deliveryFee: string;
  taxRate: string;
  minimumOrder: string;
};

const emptyForm: StoreFormState = {
  name: "",
  location: "",
  phone: "",
  openingHours: "",
  deliveryFee: "",
  taxRate: "",
  minimumOrder: "",
};

const createSlug = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function StoreForm({
  editingStore,
  onSaved,
  onCancelEdit,
}: {
  editingStore: StoreItem | null;
  onSaved: () => void;
  onCancelEdit: () => void;
}) {
  const [form, setForm] = useState<StoreFormState>(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingStore) {
      setForm({
        name: editingStore.name,
        location: editingStore.location,
        phone: editingStore.phone,
        openingHours: editingStore.openingHours,
        deliveryFee: String(editingStore.deliveryFee ?? ""),
        taxRate: String(editingStore.taxRate ?? ""),
        minimumOrder: String(editingStore.minimumOrder ?? ""),
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingStore]);

  const updateField = <K extends keyof StoreFormState>(
    key: K,
    value: StoreFormState[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.name.trim() ||
      !form.location.trim() ||
      !form.phone.trim() ||
      !form.openingHours.trim()
    ) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      setLoading(true);

      const url = editingStore
        ? `/api/admin/stores/${editingStore._id}`
        : "/api/admin/stores";

      const method = editingStore ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          slug: createSlug(form.name),
          location: form.location,
          phone: form.phone,
          openingHours: form.openingHours,
          deliveryFee: form.deliveryFee !== "" ? parseFloat(form.deliveryFee) : 0,
          taxRate: form.taxRate !== "" ? parseFloat(form.taxRate) : 0,
          minimumOrder: form.minimumOrder !== "" ? parseFloat(form.minimumOrder) : 0,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "Failed to save store.");
        return;
      }

      setForm(emptyForm);
      onSaved();
    } catch (error) {
      console.error("SAVE STORE ERROR:", error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-zinc-950">
            {editingStore ? "Edit Store" : "Add Store"}
          </h2>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Add store name, location, phone, and hours.
          </p>
        </div>

        {editingStore && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-black text-zinc-600 hover:bg-zinc-50"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-bold text-zinc-700">
            Store Name
          </label>
          <input
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Towson"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-zinc-700">
            Location
          </label>
          <input
            value={form.location}
            onChange={(e) => updateField("location", e.target.value)}
            placeholder="6821 Loch Raven Blvd, Towson, MD 21286"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-zinc-700">
            Phone Number
          </label>
          <input
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="410-296-6066"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-zinc-700">
            Opening Hours
          </label>
          <textarea
            value={form.openingHours}
            onChange={(e) => updateField("openingHours", e.target.value)}
            placeholder="Daily: 11am - 11:30pm"
            rows={4}
            className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-zinc-700">
              Delivery Fee ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.deliveryFee}
              onChange={(e) => updateField("deliveryFee", e.target.value)}
              placeholder="3.99"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-zinc-700">
              Tax Rate (%)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.taxRate}
              onChange={(e) => updateField("taxRate", e.target.value)}
              placeholder="6.00"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-zinc-700">
              Min. Order ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.minimumOrder}
              onChange={(e) => updateField("minimumOrder", e.target.value)}
              placeholder="10.00"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-2xl bg-[#DA3327] px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(218,51,39,0.22)] transition hover:bg-[#c92d23] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? editingStore
              ? "Updating Store..."
              : "Adding Store..."
            : editingStore
              ? "Update Store"
              : "Add Store"}
        </button>
      </div>
    </form>
  );
}