import React from "react";
import { Heart, Scale, Smartphone } from "lucide-react";
import { formatUgx } from "../lib/api.ts";
import { resolveMediaUrl } from "../lib/media.ts";
import { useApp } from "../context/AppContext.tsx";
import type { Product } from "../types.ts";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onToggleCompare?: (product: Product) => void;
  isCompared?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onToggleCompare,
  isCompared,
}) => {
  const { wishlistIds, toggleWishlist, addToCart } = useApp();
  const isWishlisted = wishlistIds.includes(product.id);
  const defaultVariant = product.variants[0];
  const inStock = product.totalAvailableStock > 0;

  return (
    <article className="group bg-white border border-[#E3E8EF] rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col">
      <button
        type="button"
        onClick={() => onSelect(product)}
        className="relative aspect-[4/3] w-full bg-[#F5F7FA] overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-[#102747]"
      >
        <img
          src={resolveMediaUrl(product.primaryImageUrl)}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="sr-only">{product.name}</div>
      </button>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-2 text-xs text-[#667085] mb-1">
            <span className="truncate">
              {product.brand?.name || "Century"} · {product.condition === "new" ? "New" : product.condition === "refurbished" ? "Certified Refurbished" : "Verified Used"}
              {product.batteryHealth && product.condition !== "new" ? ` · ${product.batteryHealth}% Battery` : ""}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {onToggleCompare && (
                <button
                  type="button"
                  onClick={() => onToggleCompare(product)}
                  aria-label={`Compare ${product.name}`}
                  title="Compare device"
                  className={`min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg transition-colors ${
                    isCompared ? "bg-[#102747] text-white" : "text-[#667085] hover:bg-[#F5F7FA] hover:text-[#102747]"
                  }`}
                >
                  <Scale className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label={`Save ${product.name} to wishlist`}
                className={`min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg transition-colors ${
                  isWishlisted ? "text-[#DC2626] bg-red-50" : "text-[#667085] hover:bg-[#F5F7FA] hover:text-[#102747]"
                }`}
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelect(product)}
            className="text-left w-full"
          >
            <h3 className="font-display font-semibold text-[#102747] text-base leading-snug line-clamp-2 hover:underline">
              {product.name}
            </h3>
          </button>

          <p className="text-xs text-[#667085] mt-1 line-clamp-1">
            {product.specs.display} · {product.warrantyMonths} mo warranty
          </p>
        </div>

        <div className="pt-2 border-t border-[#E3E8EF] flex items-center justify-between gap-2">
          <div>
            <div className="font-mono font-semibold text-sm text-[#102747] tabular-nums">
              {formatUgx(defaultVariant?.priceUgx ?? product.basePriceUgx)}
            </div>
            <div className={`text-xs ${inStock ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
              {inStock ? `In stock (${product.totalAvailableStock} available)` : "Out of stock"}
            </div>
          </div>

          <button
            type="button"
            disabled={!inStock || !defaultVariant}
            onClick={() => defaultVariant && addToCart(defaultVariant.id, 1)}
            className="px-3.5 py-2 min-h-[40px] rounded-xl bg-[#102747] text-white text-xs font-medium hover:bg-[#0B1D36] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
};

export const ProductPlaceholderIcon = () => (
  <div className="flex items-center justify-center w-full h-full bg-[#F5F7FA] text-[#667085]">
    <Smartphone className="w-10 h-10" />
  </div>
);
