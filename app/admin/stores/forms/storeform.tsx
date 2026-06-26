"use client";

import { useEffect, useState } from "react";
import type { DayHours, StoreItem } from "../page";
import BranchMapPicker from "../components/branchmappicker";
import { formatHoursLines, formatHoursText } from "@/lib/store-hours";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const defaultHours = (): DayHours[] =>
  Array.from({ length: 7 }, () => ({
    open: "11:00",
    close: "23:00",
    closed: false,
  }));

// Normalize whatever the store doc has into exactly 7 day-rows for the editor.
const hoursFromStore = (hours?: DayHours[]): DayHours[] => {
  const base = defaultHours();
  if (!Array.isArray(hours)) return base;
  return base.map((fallback, i) => ({
    open: hours[i]?.open ?? fallback.open,
    close: hours[i]?.close ?? fallback.close,
    closed: hours[i]?.closed ?? fallback.closed,
  }));
};

type StoreFormState = {
  name: string;
  location: string;
  phone: string;
  deliveryFee: string;
  taxRate: string;
  minimumOrder: string;
  latitude: string;
  longitude: string;
  deliveryRadiusKm: string;
  timezone: string;
  hours: DayHours[];
};

const emptyForm: StoreFormState = {
  name: "",
  location: "",
  phone: "",
  deliveryFee: "",
  taxRate: "",
  minimumOrder: "",
  latitude: "",
  longitude: "",
  deliveryRadiusKm: "8",
  timezone: "America/New_York",
  hours: defaultHours(),
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
        deliveryFee: String(editingStore.deliveryFee ?? ""),
        taxRate: String(editingStore.taxRate ?? ""),
        minimumOrder: String(editingStore.minimumOrder ?? ""),
        latitude:
          editingStore.latitude != null ? String(editingStore.latitude) : "",
        longitude:
          editingStore.longitude != null ? String(editingStore.longitude) : "",
        deliveryRadiusKm: String(editingStore.deliveryRadiusKm ?? "8"),
        timezone: editingStore.timezone || "America/New_York",
        hours: hoursFromStore(editingStore.hours),
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

  const updateDayHours = (index: number, patch: Partial<DayHours>) => {
    setForm((prev) => ({
      ...prev,
      hours: prev.hours.map((day, i) =>
        i === index ? { ...day, ...patch } : day
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.location.trim() || !form.phone.trim()) {
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
          openingHours: formatHoursText(form.hours),
          deliveryFee: form.deliveryFee !== "" ? parseFloat(form.deliveryFee) : 0,
          taxRate: form.taxRate !== "" ? parseFloat(form.taxRate) : 0,
          minimumOrder: form.minimumOrder !== "" ? parseFloat(form.minimumOrder) : 0,
          latitude: form.latitude !== "" ? parseFloat(form.latitude) : null,
          longitude: form.longitude !== "" ? parseFloat(form.longitude) : null,
          deliveryRadiusKm:
            form.deliveryRadiusKm !== "" ? parseFloat(form.deliveryRadiusKm) : 8,
          timezone: form.timezone,
          hours: form.hours,
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

        {/* Delivery service area */}
        <div className="rounded-2xl border border-zinc-200 p-4">
          <h3 className="text-sm font-black text-zinc-900">Delivery Area</h3>
          <p className="mb-3 mt-1 text-xs font-medium text-zinc-500">
            Set the branch pinpoint and how far it delivers.
          </p>

          <BranchMapPicker
            lat={form.latitude !== "" ? parseFloat(form.latitude) : null}
            lng={form.longitude !== "" ? parseFloat(form.longitude) : null}
            radiusKm={
              form.deliveryRadiusKm !== ""
                ? parseFloat(form.deliveryRadiusKm)
                : 8
            }
            onChange={(lat, lng) =>
              setForm((prev) => ({
                ...prev,
                latitude: String(lat),
                longitude: String(lng),
              }))
            }
          />

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-700">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => updateField("latitude", e.target.value)}
                placeholder="39.4015"
                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-700">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => updateField("longitude", e.target.value)}
                placeholder="-76.5719"
                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-700">
                Radius (km)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.deliveryRadiusKm}
                onChange={(e) =>
                  updateField("deliveryRadiusKm", e.target.value)
                }
                placeholder="8"
                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-bold text-zinc-700">
              Timezone
            </label>
            <input
              value={form.timezone}
              onChange={(e) => updateField("timezone", e.target.value)}
              placeholder="America/New_York"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327]"
            />
          </div>
        </div>

        {/* Per-day hours (drive the scheduled-time picker) */}
        <div className="rounded-2xl border border-zinc-200 p-4">
          <h3 className="text-sm font-black text-zinc-900">Hours by Day</h3>
          <p className="mb-3 mt-1 text-xs font-medium text-zinc-500">
            Used to limit the customer&apos;s scheduled pickup/delivery times.
          </p>

          <div className="space-y-2">
            {form.hours.map((day, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="w-10 shrink-0 text-xs font-black uppercase text-zinc-600">
                  {DAY_LABELS[i]}
                </span>

                <div className="flex min-w-[200px] flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={day.open}
                    disabled={day.closed}
                    onChange={(e) => updateDayHours(i, { open: e.target.value })}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327] disabled:bg-zinc-100 disabled:text-zinc-400"
                  />

                  <span className="shrink-0 text-xs font-bold text-zinc-400">to</span>

                  <input
                    type="time"
                    value={day.close}
                    disabled={day.closed}
                    onChange={(e) => updateDayHours(i, { close: e.target.value })}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-2 py-2 text-sm font-semibold text-zinc-900 outline-none transition focus:border-[#DA3327] disabled:bg-zinc-100 disabled:text-zinc-400"
                  />
                </div>

                <label className="flex shrink-0 items-center gap-1 text-xs font-bold text-zinc-600">
                  <input
                    type="checkbox"
                    checked={day.closed}
                    onChange={(e) =>
                      updateDayHours(i, { closed: e.target.checked })
                    }
                  />
                  Closed
                </label>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl bg-zinc-50 p-3">
            <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-zinc-400">
              Displayed to customers as
            </p>
            {formatHoursLines(form.hours).map((line) => (
              <p key={line} className="text-xs font-semibold text-zinc-700">
                {line}
              </p>
            ))}
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