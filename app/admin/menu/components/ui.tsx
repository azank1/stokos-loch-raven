"use client";

import { CheckCircle2, Edit3, Trash2 } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <th className="px-5 py-4 text-xs font-black uppercase tracking-wide text-zinc-500">
      {children}
    </th>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const isActive = status === "Active";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
        isActive
          ? "bg-green-800 text-white"
          : status === "Draft" || status === "Paused"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {isActive && <CheckCircle2 size={13} />}
      {status}
    </span>
  );
}

export function ActionButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:border-green-300 hover:bg-green-50 hover:text-green-800"
      >
        <Edit3 size={17} />
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}

export function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  pattern,
  onKeyDown,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  pattern?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-zinc-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        inputMode={inputMode}
        pattern={pattern}
        className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-semibold outline-none transition placeholder:text-zinc-400 focus:border-green-700"
      />
    </div>
  );
}

export function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-zinc-700">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-700 outline-none transition focus:border-green-700"
      >
        {options.length === 0 && <option value="">No options</option>}

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ImageBox({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-xs font-black text-green-800">
        IMG
      </div>
    );
  }

  return (
    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-green-50">
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

export function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-[26px] border border-dashed border-zinc-300 p-10 text-center">
      <p className="font-black text-zinc-600">{message}</p>
      <p className="mt-1 text-sm text-zinc-400">
        Add a new item to start managing your menu.
      </p>
    </div>
  );
}
