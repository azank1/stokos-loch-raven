"use client";

import { memo, useCallback, useState } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import dynamic from "next/dynamic";

// Lazy-load the modal JavaScript. Heavy options/modifiers load only when a product is opened.
const ProductModal = dynamic(() => import("./ProductModal"), {
  ssr: false,
  loading: () => null,
});

const FALLBACK_IMAGE = "/images/placeholder-food.png";

function cleanString(value: unknown, fallback = "") {
  return String(value || "").trim() || fallback;
}

function cleanPrice(value: unknown) {
  const number = Number(String(value || 0).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function ProductCard({ product }: any) {
  const [showModal, setShowModal] = useState(false);

  const title = cleanString(product?.title || product?.name, "Menu Item");
  const image = cleanString(product?.image, FALLBACK_IMAGE);
  const description = cleanString(product?.description);
  const price = cleanPrice(product?.price ?? product?.numericPrice);

  const handleOpen = useCallback(() => setShowModal(true), []);
  const handleClose = useCallback(() => setShowModal(false), []);

  return (
    <>
      <div
        onClick={handleOpen}
        className="
          group relative w-full h-full min-w-0
          bg-white text-black
          dark:bg-[#121212] dark:text-white
          rounded-2xl
          p-2.5 sm:p-3 md:p-3
          shadow-md md:shadow-2xl
          transition-all duration-300
          hover:bg-zinc-100 dark:hover:bg-[#181818]
          border border-zinc-200 dark:border-zinc-900/50
          flex flex-col cursor-pointer
          overflow-hidden
        "
      >
        <div
          className="
            relative w-full
            aspect-square md:aspect-[7/6]
            overflow-hidden
            rounded-xl md:rounded-2xl
            mb-3 md:mb-6
            shrink-0
          "
        >
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
        </div>

        <div className="flex flex-col flex-1 px-1 pb-1 min-w-0">
          <h3
            className="
              text-black dark:text-white
              text-[14px] sm:text-[14px] md:text-[16px]
              font-black uppercase tracking-wide
              leading-[1.25]
              group-hover:text-[#DA3327]
              transition-colors
              line-clamp-2
              min-h-[34px]
              overflow-hidden
              break-words
            "
          >
            {title}
          </h3>

          <p
            className="
              hidden md:block
              text-zinc-600 dark:text-zinc-400
              text-[14px]
              mt-2
              leading-relaxed
              line-clamp-3
              h-[50px]
              overflow-hidden
            "
          >
            {description}
          </p>

          <div className="flex items-end justify-between mt-auto pt-3 md:pt-4">
            <div className="flex items-end gap-1 min-w-0">
              <span className="text-lg md:text-xl font-black leading-none">$</span>
              <span className="text-lg sm:text-base md:text-2xl font-black leading-none tracking-tighter text-black dark:text-white">
                {price}
              </span>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleOpen();
              }}
              className="
                shrink-0
                w-9 h-9 sm:w-10 sm:h-10 md:w-9 md:h-9
                rounded-full
                bg-[#DA3327] text-white
                border border-zinc-300 dark:border-zinc-800
                flex items-center justify-center
                hover:scale-110
                transition-all duration-300
                shadow-lg active:scale-90
              "
              aria-label={`Add ${title}`}
            >
              <Plus size={18} className="md:w-6 md:h-6" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <ProductModal product={product} isOpen={showModal} onClose={handleClose} />
      )}
    </>
  );
}

export default memo(ProductCard);
