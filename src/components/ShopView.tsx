import React, { useEffect, useState } from "react";
import { Scale, Search, X } from "lucide-react";
import { apiRequest, formatUgx } from "../lib/api.ts";
import { useApp } from "../context/AppContext.tsx";
import type { Product } from "../types.ts";
import { ProductCard } from "./ProductCard.tsx";

interface ShopViewProps {
  initialCategory?: string;
  onSelectProduct: (product: Product) => void;
}

export const ShopView: React.FC<ShopViewProps> = ({ initialCategory = "", onSelectProduct }) => {
  const { bootstrap } = useApp();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [condition, setCondition] = useState("");
  const [storage, setStorage] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState("popularity");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [compareList, setCompareList] = useState<Product[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  useEffect(() => {
    setCategory(initialCategory);
    setPage(1);
  }, [initialCategory]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (brand) params.set("brand", brand);
    if (category) params.set("category", category);
    if (condition) params.set("condition", condition);
    if (storage) params.set("storage", storage);
    if (inStockOnly) params.set("inStock", "true");
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", "12");

    apiRequest<{ items: Product[]; pagination: { total: number; totalPages: number } }>(
      `/catalog/products?${params.toString()}`
    )
      .then((res) => {
        setItems(res.items);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, brand, category, condition, storage, inStockOnly, sort, page]);

  const toggleCompare = (product: Product) => {
    setCompareList((prev) => {
      if (prev.some((p) => p.id === product.id)) {
        return prev.filter((p) => p.id !== product.id);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), product];
      }
      return [...prev, product];
    });
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#102747]">Smartphone & Accessory Catalogue</h1>
          <p className="text-xs text-[#667085]">
            Showing {items.length} of {total} verified products · Prices in Ugandan Shillings (UGX)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {compareList.length >= 2 && (
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#102747] text-white text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Scale className="w-4 h-4" />
              <span>Compare ({compareList.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E3E8EF] rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-[#667085] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search model, chip, camera..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#E3E8EF] text-xs text-[#102747]"
            />
          </div>

          <select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by brand"
            className="h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs text-[#102747] bg-white"
          >
            <option value="">All Brands</option>
            {bootstrap?.brands.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={condition}
            onChange={(e) => {
              setCondition(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by condition"
            className="h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs text-[#102747] bg-white"
          >
            <option value="">All Conditions</option>
            <option value="new">Brand New</option>
            <option value="refurbished">Certified Refurbished</option>
            <option value="used">Verified Used</option>
          </select>

          <select
            value={storage}
            onChange={(e) => {
              setStorage(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by storage"
            className="h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs text-[#102747] bg-white"
          >
            <option value="">Any Storage</option>
            <option value="128GB">128GB</option>
            <option value="256GB">256GB</option>
            <option value="512GB">512GB</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort products"
            className="h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs text-[#102747] bg-white"
          >
            <option value="popularity">Sort: Popularity</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="newest">Sort: Newest</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setCategory("");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                category === "" ? "bg-[#102747] text-white" : "bg-[#F5F7FA] text-[#667085]"
              }`}
            >
              All Categories
            </button>
            {bootstrap?.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategory(c.slug);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  category === c.slug ? "bg-[#102747] text-white" : "bg-[#F5F7FA] text-[#667085]"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-[#102747] cursor-pointer">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => {
                setInStockOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-[#E3E8EF]"
            />
            <span>In stock only</span>
          </label>
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-80 rounded-2xl bg-white border border-[#E3E8EF] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-[#E3E8EF] rounded-2xl p-10 text-center space-y-3">
          <p className="font-display font-semibold text-[#102747]">No matching devices found</p>
          <p className="text-xs text-[#667085]">Try clearing your brand, storage, or condition filters.</p>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setBrand("");
              setCategory("");
              setCondition("");
              setStorage("");
              setInStockOnly(false);
            }}
            className="px-4 py-2 rounded-xl bg-[#102747] text-white text-xs font-medium"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={onSelectProduct}
              onToggleCompare={toggleCompare}
              isCompared={compareList.some((p) => p.id === product.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3.5 py-2 rounded-xl border border-[#E3E8EF] bg-white text-xs text-[#102747] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-[#667085] font-mono tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3.5 py-2 rounded-xl border border-[#E3E8EF] bg-white text-xs text-[#102747] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E3E8EF] w-full max-w-4xl max-h-[88vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-[#102747]">Side-by-Side Device Comparison</h2>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="p-2 rounded-xl bg-[#F5F7FA] text-[#102747]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E8EF]">
                    <th className="py-2 pr-4 text-[#667085] font-medium">Specification</th>
                    {compareList.map((p) => (
                      <th key={p.id} className="py-2 px-3 text-[#102747] font-semibold">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8EF]">
                  <tr>
                    <td className="py-2.5 pr-4 text-[#667085]">Price</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="py-2.5 px-3 font-mono font-semibold text-[#102747] tabular-nums">
                        {formatUgx(p.basePriceUgx)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-[#667085]">Condition</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="py-2.5 px-3 text-[#102747]">{p.conditionGrade}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-[#667085]">Display</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="py-2.5 px-3 text-[#102747]">{p.specs.display}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-[#667085]">Processor & RAM</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="py-2.5 px-3 text-[#102747]">
                        {p.specs.processor} · {p.specs.ram}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-[#667085]">Camera</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="py-2.5 px-3 text-[#102747]">{p.specs.camera}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-[#667085]">Battery</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="py-2.5 px-3 text-[#102747]">{p.specs.battery}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-[#667085]">Warranty</td>
                    {compareList.map((p) => (
                      <td key={p.id} className="py-2.5 px-3 text-[#102747]">{p.warrantyMonths} months</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
