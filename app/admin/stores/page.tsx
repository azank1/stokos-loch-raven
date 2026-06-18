"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import StoreForm from "./forms/storeform";
import StoreTable from "./components/storetable";

export type StoreItem = {
  _id: string;
  name: string;
  slug: string;
  location: string;
  phone: string;
  openingHours: string;
  deliveryFee?: number;
  taxRate?: number;
  minimumOrder?: number;
};

export default function StoresPage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null);
  const [loading, setLoading] = useState(true);

  const formRef = useRef<HTMLDivElement | null>(null);

  const fetchStores = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/admin/stores", {
        cache: "no-store",
      });

      const data = await res.json();

      if (data.success) {
        setStores(data.stores || []);
      }
    } catch (error) {
      console.error("FETCH STORES ERROR:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleAddStoreClick = () => {
    setEditingStore(null);

    setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  const handleDelete = async (storeId: string) => {
    const confirmDelete = confirm("Are you sure you want to delete this store?");

    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/stores/${storeId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "Failed to delete store.");
        return;
      }

      if (editingStore?._id === storeId) {
        setEditingStore(null);
      }

      fetchStores();
    } catch (error) {
      console.error("DELETE STORE ERROR:", error);
      alert("Something went wrong.");
    }
  };

  return (
    <div className="min-h-screen p-5 md:p-2">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-7 rounded-[30px] bg-[#14743A] p-8 text-white shadow-[0_18px_45px_rgba(20,116,58,0.18)] md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-white/12 px-4 py-2">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-white/85">
                  Store Setup
                </p>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
                Store Management
              </h1>

              <p className="mt-4 max-w-4xl text-base font-medium text-white/85">
                Add, edit, update, and delete Stoko&apos;s store locations,
                phone numbers, opening hours, and ordering details.
              </p>
            </div>

            {/* <button
              type="button"
              onClick={handleAddStoreClick}
              className="flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-green-800 transition hover:bg-green-50"
            >
              <Plus size={18} />
              Add Store
            </button> */}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
          <div ref={formRef}>
            <StoreForm
              editingStore={editingStore}
              onCancelEdit={() => setEditingStore(null)}
              onSaved={() => {
                setEditingStore(null);
                fetchStores();
              }}
            />
          </div>

          <StoreTable
            stores={stores}
            loading={loading}
            onEdit={setEditingStore}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}