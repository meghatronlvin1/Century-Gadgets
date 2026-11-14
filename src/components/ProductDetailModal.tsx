import React, { useEffect, useState } from "react";
import { ArrowLeftRight, Check, Heart, Share2, ShieldCheck, Truck, X } from "lucide-react";
import { apiRequest, formatUgx } from "../lib/api.ts";
import { resolveMediaUrl } from "../lib/media.ts";
import { useApp } from "../context/AppContext.tsx";
import type { DeliveryZone, Product } from "../types.ts";

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onStartSwap: (product: Product, variantId: number) => void;
  onOpenCart: () => void;
}

interface ReviewRow {
  id: number;
  authorName: string;
  rating: number;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onStartSwap,
  onOpenCart,
}) => {
  const { user, wishlistIds, toggleWishlist, addToCart, showToast } = useApp();
  const [selectedVariantId, setSelectedVariantId] = useState<number>(0);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number>(0);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [relatedAccessories, setRelatedAccessories] = useState<Product[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!product) return;
    setSelectedVariantId(product.variants[0]?.id ?? 0);
    apiRequest<{
      product: Product;
      reviews: ReviewRow[];
      relatedAccessories: Product[];
      deliveryZones: DeliveryZone[];
    }>(`/catalog/products/${product.slug}`)
      .then((res) => {
        setReviews(res.reviews);
        setRelatedAccessories(res.relatedAccessories);
        setDeliveryZones(res.deliveryZones);
        if (res.deliveryZones[0]) setSelectedZoneId(res.deliveryZones[0].id);
      })
      .catch(() => {});
  }, [product]);

  if (!product) return null;

  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];
  const isWishlisted = wishlistIds.includes(product.id);
  const selectedZone = deliveryZones.find((z) => z.id === selectedZoneId);

  const handleShare = async () => {
    const shareText = `${product.name} — ${formatUgx(activeVariant?.priceUgx ?? product.basePriceUgx)} at Century Gadgets Kampala`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText).catch(() => {});
    }
    showToast("Product link & summary copied to clipboard");
  };

  const handleBuyNow = async () => {
    if (!activeVariant) return;
    await addToCart(activeVariant.id, 1);
    onClose();
    onOpenCart();
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast("Please sign in to submit a product review", "error");
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await apiRequest<{ message: string }>(`/catalog/products/${product.id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      setReviewComment("");
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="bg-white w-full max-w-4xl rounded-t-3xl md:rounded-2xl border border-[#E3E8EF] max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-[#E3E8EF] px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-[#667085] truncate">
              {product.brand?.name} · {product.model} · {product.conditionGrade}
            </p>
            <h2 className="font-display font-bold text-[#102747] text-lg truncate">{product.name}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share product"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#E3E8EF] text-[#102747] hover:bg-[#F5F7FA]"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-label="Toggle wishlist"
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#E3E8EF] ${
                isWishlisted ? "text-[#DC2626] bg-red-50" : "text-[#102747] hover:bg-[#F5F7FA]"
              }`}
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close product details"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#F5F7FA] text-[#102747] hover:bg-[#E3E8EF]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left: Product Visual & Specs */}
          <div className="space-y-4">
            <div className="aspect-[4/3] rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF] overflow-hidden">
              <img
                src={resolveMediaUrl(product.primaryImageUrl)}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="bg-[#F5F7FA] rounded-2xl p-4 border border-[#E3E8EF] space-y-2">
              <h3 className="font-display font-semibold text-sm text-[#102747]">Verified Specifications</h3>
              <dl className="grid grid-cols-1 gap-1.5 text-xs">
                <div className="flex justify-between gap-4 py-1 border-b border-[#E3E8EF]">
                  <dt className="text-[#667085]">Display</dt>
                  <dd className="text-[#102747] font-medium text-right">{product.specs.display}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-[#E3E8EF]">
                  <dt className="text-[#667085]">Processor & RAM</dt>
                  <dd className="text-[#102747] font-medium text-right">
                    {product.specs.processor} · {product.specs.ram}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-[#E3E8EF]">
                  <dt className="text-[#667085]">Camera</dt>
                  <dd className="text-[#102747] font-medium text-right">{product.specs.camera}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-[#E3E8EF]">
                  <dt className="text-[#667085]">Battery</dt>
                  <dd className="text-[#102747] font-medium text-right">{product.specs.battery}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-[#E3E8EF]">
                  <dt className="text-[#667085]">SIM & Network</dt>
                  <dd className="text-[#102747] font-medium text-right">{product.networkCompatibility}</dd>
                </div>
                {product.batteryHealth !== null && (
                  <div className="flex justify-between gap-4 py-1">
                    <dt className="text-[#667085]">Verified Battery Health</dt>
                    <dd className="text-[#16A34A] font-semibold tabular-nums">{product.batteryHealth}%</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono font-bold text-2xl text-[#102747] tabular-nums">
                  {formatUgx(activeVariant?.priceUgx ?? product.basePriceUgx)}
                </span>
                {product.compareAtPriceUgx && (
                  <span className="font-mono text-sm text-[#667085] line-through tabular-nums">
                    {formatUgx(product.compareAtPriceUgx)}
                  </span>
                )}
              </div>
              <p className="text-xs mt-1 text-[#667085]">
                {activeVariant && activeVariant.availableQty > 0
                  ? `${activeVariant.availableQty} unit(s) ready in Kampala · SKU ${activeVariant.sku}`
                  : "Currently out of stock"}
              </p>
              <p className="text-sm text-[#667085] mt-3 leading-relaxed">{product.description}</p>
            </div>

            {/* Variants */}
            <div>
              <p className="text-xs font-semibold text-[#102747] mb-2">Select Storage & Finish</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition-colors ${
                      activeVariant?.id === v.id
                        ? "border-[#102747] bg-[#F5F7FA]"
                        : "border-[#E3E8EF] bg-white hover:border-[#667085]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-[#E3E8EF] shrink-0"
                        style={{ backgroundColor: v.colorHex }}
                      />
                      <span className="text-xs font-medium text-[#102747] truncate">
                        {v.storage} · {v.color}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#102747] tabular-nums shrink-0">
                      {formatUgx(v.priceUgx)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery Estimator */}
            <div className="p-3.5 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#102747]">
                <Truck className="w-4 h-4" />
                <span>Delivery & Collection Estimator</span>
              </div>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(Number(e.target.value))}
                className="w-full rounded-lg border border-[#E3E8EF] bg-white px-3 py-2 text-xs text-[#102747]"
              >
                {deliveryZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} ({z.feeUgx === 0 ? "Free" : formatUgx(z.feeUgx)})
                  </option>
                ))}
              </select>
              {selectedZone && (
                <p className="text-xs text-[#667085]">
                  {selectedZone.estimatedTime} · {selectedZone.instructions}
                </p>
              )}
            </div>

            {/* Warranty */}
            <div className="flex items-start gap-2.5 text-xs text-[#667085]">
              <ShieldCheck className="w-4 h-4 text-[#102747] shrink-0 mt-0.5" />
              <span>{product.warrantyTerms}</span>
            </div>

            {/* CTAs */}
            <div className="space-y-2.5 pt-2">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={!activeVariant || activeVariant.availableQty <= 0}
                  onClick={() => activeVariant && addToCart(activeVariant.id, 1)}
                  className="h-11 rounded-xl border border-[#102747] text-[#102747] font-medium text-sm hover:bg-[#F5F7FA] disabled:opacity-40 transition-colors"
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  disabled={!activeVariant || activeVariant.availableQty <= 0}
                  onClick={handleBuyNow}
                  className="h-11 rounded-xl bg-[#102747] text-white font-medium text-sm hover:bg-[#0B1D36] disabled:opacity-40 transition-colors"
                >
                  Buy Now
                </button>
              </div>

              {product.isSwapEligible && activeVariant && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartSwap(product, activeVariant.id);
                  }}
                  className="w-full h-11 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF] text-[#102747] font-medium text-sm hover:bg-[#E3E8EF]/60 flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Swap Your Current Phone For This Device</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Related Accessories & Verified Reviews */}
        <div className="px-5 md:px-6 pb-6 space-y-6 border-t border-[#E3E8EF] pt-5">
          {relatedAccessories.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-sm text-[#102747] mb-3">Compatible Accessories</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedAccessories.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#E3E8EF] bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={resolveMediaUrl(acc.primaryImageUrl)}
                        alt={acc.name}
                        className="w-12 h-12 rounded-lg object-cover bg-[#F5F7FA] shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#102747] truncate">{acc.name}</p>
                        <p className="font-mono text-xs text-[#667085] tabular-nums">{formatUgx(acc.basePriceUgx)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => acc.variants[0] && addToCart(acc.variants[0].id, 1)}
                      className="px-3 py-1.5 rounded-lg bg-[#102747] text-white text-xs font-medium shrink-0"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-display font-semibold text-sm text-[#102747] mb-3">
              Customer Reviews ({reviews.length})
            </h3>
            {reviews.length === 0 ? (
              <p className="text-xs text-[#667085] mb-3">
                No moderated customer reviews published yet for this model.
              </p>
            ) : (
              <div className="space-y-2.5 mb-4">
                {reviews.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-[#102747]">
                        {r.authorName}
                        {r.isVerifiedPurchase && (
                          <span className="ml-2 text-[#16A34A] inline-flex items-center gap-1">
                            <Check className="w-3 h-3" /> Verified Purchase
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[#102747]">{r.rating}/5</span>
                    </div>
                    <p className="text-xs text-[#667085]">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="flex flex-col sm:flex-row gap-2">
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="rounded-xl border border-[#E3E8EF] px-3 py-2 text-xs bg-white text-[#102747]"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} / 5
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Write an honest review (moderated by staff)..."
                className="flex-1 rounded-xl border border-[#E3E8EF] px-3 py-2 text-xs text-[#102747]"
                required
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="px-4 py-2 rounded-xl bg-[#102747] text-white text-xs font-medium disabled:opacity-50"
              >
                {submittingReview ? "Submitting..." : "Post Review"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
