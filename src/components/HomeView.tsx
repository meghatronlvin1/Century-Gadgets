import React, { useEffect, useState } from "react";
import { ArrowLeftRight, ArrowRight, BookOpen, ExternalLink, MapPin, Phone, Search } from "lucide-react";
import { apiRequest, formatUgx } from "../lib/api.ts";
import { heroImg, resolveMediaUrl } from "../lib/media.ts";
import { useApp } from "../context/AppContext.tsx";
import type { Product } from "../types.ts";
import { ProductCard } from "./ProductCard.tsx";

interface HomeViewProps {
  onNavigateTab: (tab: "home" | "shop" | "swap" | "learn" | "account") => void;
  onSelectCategory: (categorySlug: string) => void;
  onSelectProduct: (product: Product) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigateTab,
  onSelectCategory,
  onSelectProduct,
}) => {
  const { user, bootstrap, bootstrapLoading } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ id: number; name: string; slug: string; basePriceUgx: number }>>([]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      apiRequest<{ suggestions: Array<{ id: number; name: string; slug: string; basePriceUgx: number }> }>(
        `/catalog/autocomplete?q=${encodeURIComponent(trimmed)}`
      )
        .then((res) => setSuggestions(res.suggestions))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSuggestion = (id: number) => {
    const found = bootstrap?.allProducts.find((p) => p.id === id);
    if (found) {
      setSearchQuery("");
      setSuggestions([]);
      onSelectProduct(found);
    }
  };

  return (
    <div className="space-y-10 pb-8">
      {/* Search + Greeting Bar */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#667085]">
              {user ? `Welcome back, ${user.fullName}` : "Century Gadgets · Kampala, Uganda"}
            </p>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-[#102747] tracking-tight text-balance">
              Verified smartphones, transparent phone swaps, and honest tech guidance.
            </h1>
          </div>

          <div className="relative w-full md:w-96 shrink-0">
            <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search iPhone, Samsung, Pixel, Tecno..."
              aria-label="Search smartphones and accessories"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border border-[#E3E8EF] text-sm text-[#102747] focus:outline-none focus:border-[#102747]"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-12 z-20 bg-white border border-[#E3E8EF] rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(s.id)}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#F5F7FA] flex items-center justify-between gap-2 border-b last:border-b-0 border-[#E3E8EF]"
                  >
                    <span className="text-xs font-medium text-[#102747] truncate">{s.name}</span>
                    <span className="font-mono text-xs text-[#667085] tabular-nums shrink-0">
                      {formatUgx(s.basePriceUgx)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hero Split */}
        <div className="bg-white border border-[#E3E8EF] rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-6 p-6 md:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs font-medium text-[#667085]">
                Kampala Flagship · Sample Catalogue Preview
              </p>
              <h2 className="font-display font-bold text-3xl md:text-4xl text-[#102747] leading-tight text-balance">
                Upgrade with confidence. Trade in your current phone cleanly.
              </h2>
              <p className="text-sm md:text-base text-[#667085] leading-relaxed max-w-xl">
                Every new and pre-owned smartphone undergoes hardware diagnostics, battery health checks, and Ugandan 4G/5G network verification.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateTab("shop")}
                className="px-5 py-3 rounded-xl bg-[#102747] text-white text-sm font-medium hover:bg-[#0B1D36] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <span>Browse Catalogue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab("swap")}
                className="px-5 py-3 rounded-xl border border-[#E3E8EF] bg-[#F5F7FA] text-[#102747] text-sm font-medium hover:bg-[#E3E8EF]/60 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Request Phone Swap</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 min-h-[240px] lg:min-h-[340px] bg-[#F5F7FA]">
            <img
              src={heroImg}
              alt="Century Gadgets flagship smartphones"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Category Buttons */}
        {bootstrap && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {bootstrap.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.slug)}
                className="px-4 py-2.5 rounded-xl bg-white border border-[#E3E8EF] text-xs font-medium text-[#102747] hover:border-[#102747] hover:bg-[#F5F7FA] transition-colors whitespace-nowrap shrink-0"
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Featured & Best-Selling Smartphones */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-xl text-[#102747]">Best-Selling & Featured Devices</h2>
            <p className="text-xs text-[#667085]">Live stock and UGX pricing from our PostgreSQL inventory</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("shop")}
            className="text-xs font-semibold text-[#102747] hover:underline whitespace-nowrap shrink-0"
          >
            View all devices
          </button>
        </div>

        {bootstrapLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-80 rounded-2xl bg-white border border-[#E3E8EF] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(bootstrap?.bestSellers.length ? bootstrap.bestSellers : bootstrap?.allProducts ?? [])
              .slice(0, 6)
              .map((product) => (
                <ProductCard key={product.id} product={product} onSelect={onSelectProduct} />
              ))}
          </div>
        )}
      </section>

      {/* Phone Swap + Learn Before You Buy + TikTok */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 bg-[#102747] text-white rounded-3xl p-6 md:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs text-white/70">Century Gadgets Phone Swap</p>
            <h2 className="font-display font-bold text-2xl leading-snug text-balance">
              Trade in your current smartphone toward an upgrade.
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              Submit your device condition and photos for a provisional estimate, review our staff valuation, book an inspection in Kampala, and pay only the confirmed difference.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("swap")}
            className="w-fit px-5 py-3 rounded-xl bg-white text-[#102747] text-sm font-semibold hover:bg-[#F5F7FA] transition-colors inline-flex items-center gap-2"
          >
            <span>Start Swap Assessment</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#E3E8EF] rounded-3xl p-6 md:p-8 flex flex-col justify-between gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl text-[#102747]">Learn Before You Buy</h2>
              <p className="text-xs text-[#667085]">Practical buying guides & Century Gadgets TikTok tutorials</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("learn")}
              className="text-xs font-semibold text-[#102747] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Open Learn Hub</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bootstrap?.learnArticles.slice(0, 2).map((art) => (
              <button
                key={art.id}
                type="button"
                onClick={() => onNavigateTab("learn")}
                className="text-left p-4 rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF] hover:border-[#102747] transition-colors space-y-2"
              >
                <p className="text-xs text-[#667085]">
                  {art.category} · {art.readingTimeMin} min read
                </p>
                <h3 className="font-display font-semibold text-sm text-[#102747] line-clamp-2">{art.title}</h3>
              </button>
            ))}
          </div>

          {bootstrap && bootstrap.tiktokVideos.length > 0 && (
            <div className="pt-3 border-t border-[#E3E8EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={resolveMediaUrl(bootstrap.tiktokVideos[0].thumbnailUrl)}
                  alt={bootstrap.tiktokVideos[0].title}
                  className="w-12 h-12 rounded-xl object-cover bg-[#F5F7FA] shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs text-[#667085]">Featured on @centurygadgets TikTok</p>
                  <p className="text-sm font-semibold text-[#102747] truncate">{bootstrap.tiktokVideos[0].title}</p>
                </div>
              </div>
              <a
                href={bootstrap.storeInfo?.tiktokUrl || "https://www.tiktok.com/@centurygadgets"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl border border-[#E3E8EF] text-xs font-semibold text-[#102747] hover:bg-[#F5F7FA] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>Follow on TikTok</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Store Location & Support Footer Card */}
      {bootstrap?.storeInfo && (
        <section className="bg-white border border-[#E3E8EF] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 text-xs text-[#667085]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#102747]">
              <MapPin className="w-4 h-4" />
              <span>{bootstrap.storeInfo.address}</span>
            </div>
            <p>{bootstrap.storeInfo.hours}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`tel:${bootstrap.storeInfo.phone.replace(/\s+/g, "")}`}
              className="px-4 py-2.5 rounded-xl border border-[#E3E8EF] text-xs font-medium text-[#102747] hover:bg-[#F5F7FA] inline-flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Shop</span>
            </a>
            <button
              type="button"
              onClick={() => onNavigateTab("account")}
              className="px-4 py-2.5 rounded-xl bg-[#102747] text-white text-xs font-medium hover:bg-[#0B1D36]"
            >
              Customer Support & FAQs
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
