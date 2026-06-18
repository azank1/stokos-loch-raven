"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

type Address = {
  _id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
};

const emptyForm = {
  label: "Home",
  street: "",
  city: "",
  state: "",
  zip: "",
  isDefault: false,
};

export default function AccountAddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/account/addresses")
      .then((r) => r.json())
      .then((d) => d.success && setAddresses(d.addresses || []));
  };

  useEffect(() => {
    load();
  }, []);

  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setForm(emptyForm);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const removeAddress = async (id: string) => {
    await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    load();
  };

  const setDefault = async (address: Address) => {
    await fetch(`/api/account/addresses/${address._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...address, isDefault: true }),
    });
    load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={saveAddress} className="space-y-3 rounded-3xl bg-white p-6 ring-1 ring-zinc-200">
        <h2 className="text-lg font-black">Add address</h2>
        {(["label", "street", "city", "state", "zip"] as const).map((field) => (
          <input
            key={field}
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required={field === "street"}
          />
        ))}
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          Set as default
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-green-800 px-5 py-2 text-sm font-black text-white"
        >
          {saving ? "Saving..." : "Save address"}
        </button>
      </form>

      <div className="space-y-3">
        {addresses.map((address) => (
          <article key={address._id} className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">{address.label}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  {address.street}
                  {address.city ? `, ${address.city}` : ""}
                  {address.state ? `, ${address.state}` : ""} {address.zip}
                </p>
                {address.isDefault && (
                  <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-black text-green-800">
                    Default
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeAddress(address._id)}
                className="text-zinc-400 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
            {!address.isDefault && (
              <button
                type="button"
                onClick={() => setDefault(address)}
                className="mt-3 text-xs font-black uppercase text-green-800"
              >
                Make default
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
