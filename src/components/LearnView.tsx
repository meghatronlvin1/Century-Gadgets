import React, { useEffect, useState } from "react";
import { Bookmark, CheckCircle2, Compass, ExternalLink, Play, Share2, X } from "lucide-react";
import { apiRequest, formatUgx } from "../lib/api.ts";
import { resolveMediaUrl } from "../lib/media.ts";
import { useApp } from "../context/AppContext.tsx";
import type { ArticleRecord, Product, TikTokVideoRecord } from "../types.ts";

const LEARN_CATEGORIES = [
  "All",
  "Smartphone buying guides",
  "iPhone tips and tutorials",
  "Samsung tips and tutorials",
  "Android tips and tutorials",
  "Battery health and charging",
  "Phone maintenance and care",
  "Camera and photography tips",
  "Smartphone security and privacy",
  "Original versus counterfeit devices",
  "Refurbished versus new phones",
  "Understanding RAM, storage, processors, and refresh rates",
  "How to verify a phone before buying it",
  "Common smartphone problems and troubleshooting",
  "Accessories and compatibility",
  "Phone comparisons",
  "New technology announcements",
];

interface LearnViewProps {
  onSelectProduct: (product: Product) => void;
}

export const LearnView: React.FC<LearnViewProps> = ({ onSelectProduct }) => {
  const { bootstrap, bookmarkIds, toggleBookmark, showToast } = useApp();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [videos, setVideos] = useState<TikTokVideoRecord[]>([]);
  const [tiktokProfileUrl, setTiktokProfileUrl] = useState("https://www.tiktok.com/@centurygadgets");
  const [activeArticle, setActiveArticle] = useState<{
    article: ArticleRecord;
    relatedProducts: Product[];
  } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  // Guided phone finder state
  const [budgetUgx, setBudgetUgx] = useState(3000000);
  const [preferredBrand, setPreferredBrand] = useState("Any");
  const [primaryUse, setPrimaryUse] = useState<"photography" | "business" | "gaming" | "everyday">("everyday");
  const [storageNeed, setStorageNeed] = useState<"128GB" | "256GB" | "512GB">("256GB");
  const [batteryPriority, setBatteryPriority] = useState<"high" | "moderate">("high");
  const [recommendations, setRecommendations] = useState<Array<{ product: Product; reasons: string[] }>>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    const query = selectedCategory === "All" ? "" : `?category=${encodeURIComponent(selectedCategory)}`;
    apiRequest<{ articles: ArticleRecord[] }>(`/learn/articles${query}`)
      .then((res) => setArticles(res.articles))
      .catch(() => {});
  }, [selectedCategory]);

  useEffect(() => {
    apiRequest<{ profileUrl: string; videos: TikTokVideoRecord[] }>("/tiktok/videos")
      .then((res) => {
        setVideos(res.videos);
        setTiktokProfileUrl(res.profileUrl);
      })
      .catch(() => {});
  }, []);

  const openArticle = async (slug: string) => {
    try {
      const res = await apiRequest<{ article: ArticleRecord; relatedProducts: Product[] }>(`/learn/articles/${slug}`);
      setQuizAnswers({});
      setActiveArticle(res);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const runPhoneMatcher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingRecs(true);
    try {
      const res = await apiRequest<{ recommendations: Array<{ product: Product; reasons: string[] }> }>(
        "/learn/recommend",
        {
          method: "POST",
          body: JSON.stringify({
            budgetUgx,
            preferredBrand,
            primaryUse,
            storageNeed,
            batteryPriority,
          }),
        }
      );
      setRecommendations(res.recommendations);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoadingRecs(false);
    }
  };

  return (
    <div className="space-y-10 pb-8">
      <div>
        <h1 className="font-display font-bold text-2xl text-[#102747]">Century Gadgets Learn Hub</h1>
        <p className="text-xs text-[#667085]">
          Practical smartphone guides, device verification checklists, and curated @centurygadgets TikTok lessons
        </p>
      </div>

      {/* Which Phone Should I Buy? Guided Experience */}
      <section className="bg-white border border-[#E3E8EF] rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex items-start gap-3">
          <Compass className="w-6 h-6 text-[#102747] shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display font-bold text-xl text-[#102747]">Which Phone Should I Buy?</h2>
            <p className="text-xs text-[#667085]">
              Tell us your budget and priorities — we match against Century Gadgets&apos; live in-stock catalogue.
            </p>
          </div>
        </div>

        <form onSubmit={runPhoneMatcher} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#102747]">Max Budget (UGX)</label>
            <select
              value={budgetUgx}
              onChange={(e) => setBudgetUgx(Number(e.target.value))}
              className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white text-[#102747]"
            >
              <option value={1200000}>Up to UGX 1,200,000</option>
              <option value={2000000}>Up to UGX 2,000,000</option>
              <option value={3200000}>Up to UGX 3,200,000</option>
              <option value={5000000}>Up to UGX 5,000,000</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#102747]">Preferred Brand</label>
            <select
              value={preferredBrand}
              onChange={(e) => setPreferredBrand(e.target.value)}
              className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white text-[#102747]"
            >
              <option value="Any">Any Brand</option>
              <option value="Apple">Apple iPhone</option>
              <option value="Samsung">Samsung</option>
              <option value="Google Pixel">Google Pixel</option>
              <option value="Tecno">Tecno</option>
              <option value="Infinix">Infinix</option>
              <option value="Redmi / Xiaomi">Redmi / Xiaomi</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#102747]">Primary Use</label>
            <select
              value={primaryUse}
              onChange={(e) => setPrimaryUse(e.target.value as any)}
              className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white text-[#102747]"
            >
              <option value="everyday">Everyday & Social</option>
              <option value="photography">Camera & Content</option>
              <option value="business">Business & Calls</option>
              <option value="gaming">Gaming & 120Hz</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#102747]">Storage Need</label>
            <select
              value={storageNeed}
              onChange={(e) => setStorageNeed(e.target.value as any)}
              className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white text-[#102747]"
            >
              <option value="128GB">128GB</option>
              <option value="256GB">256GB</option>
              <option value="512GB">512GB</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#102747]">Battery Priority</label>
            <select
              value={batteryPriority}
              onChange={(e) => setBatteryPriority(e.target.value as any)}
              className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white text-[#102747]"
            >
              <option value="high">All-Day 5000mAh+</option>
              <option value="moderate">Standard</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loadingRecs}
            className="h-10 rounded-xl bg-[#102747] text-white text-xs font-semibold hover:bg-[#0B1D36] transition-colors"
          >
            {loadingRecs ? "Matching..." : "Find My Phone"}
          </button>
        </form>

        {recommendations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {recommendations.map((rec) => (
              <div key={rec.product.id} className="p-4 rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF] flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={resolveMediaUrl(rec.product.primaryImageUrl)}
                      alt={rec.product.name}
                      className="w-12 h-12 rounded-xl object-cover bg-white shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-sm text-[#102747] truncate">{rec.product.name}</h3>
                      <p className="font-mono text-xs text-[#102747] tabular-nums">{formatUgx(rec.product.basePriceUgx)}</p>
                    </div>
                  </div>
                  <ul className="space-y-1 text-xs text-[#667085]">
                    {rec.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectProduct(rec.product)}
                  className="w-full py-2 rounded-xl bg-[#102747] text-white text-xs font-medium"
                >
                  Inspect Device
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Educational Articles */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display font-bold text-xl text-[#102747]">Buying Guides & Device Care</h2>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter educational articles by category"
            className="h-10 rounded-xl border border-[#E3E8EF] bg-white px-3 text-xs text-[#102747]"
          >
            {LEARN_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((art) => {
            const isBookmarked = bookmarkIds.includes(art.id);
            return (
              <article
                key={art.id}
                className="bg-white border border-[#E3E8EF] rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <button type="button" onClick={() => openArticle(art.slug)} className="text-left">
                  <div className="aspect-[4/3] bg-[#F5F7FA] overflow-hidden">
                    <img
                      src={resolveMediaUrl(art.coverImageUrl)}
                      alt={art.title}
                      className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-xs text-[#667085]">
                      {art.category} · {art.readingTimeMin} min read
                    </p>
                    <h3 className="font-display font-semibold text-base text-[#102747] leading-snug">
                      {art.title}
                    </h3>
                    <p className="text-xs text-[#667085] line-clamp-2">{art.summary}</p>
                  </div>
                </button>
                <div className="px-4 pb-4 pt-2 border-t border-[#E3E8EF] flex items-center justify-between text-xs">
                  <span className="text-[#667085]">{art.authorName}</span>
                  <button
                    type="button"
                    onClick={() => toggleBookmark(art.id)}
                    aria-label="Bookmark article"
                    className={`p-1.5 rounded-lg ${isBookmarked ? "text-[#102747] bg-[#F5F7FA]" : "text-[#667085]"}`}
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-current" : ""}`} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Official Century Gadgets TikTok Educational Feed */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-xl text-[#102747]">Century Gadgets on TikTok</h2>
            <p className="text-xs text-[#667085]">
              Curated short-form tutorials linked directly to verified devices in our catalogue
            </p>
          </div>
          <a
            href={tiktokProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-[#102747] text-white text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 w-fit"
          >
            <span>Follow Century Gadgets on TikTok</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {videos.map((v) => {
            const linkedProducts = (bootstrap?.allProducts ?? []).filter((p) =>
              v.linkedProductIds.includes(p.id)
            );
            return (
              <div key={v.id} className="bg-white border border-[#E3E8EF] rounded-2xl overflow-hidden flex flex-col justify-between">
                <a
                  href={v.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-[4/3] bg-[#F5F7FA] overflow-hidden block"
                >
                  <img
                    src={resolveMediaUrl(v.thumbnailUrl)}
                    alt={v.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end justify-between p-4 text-white">
                    <span className="text-xs font-medium">{v.category}</span>
                    <span className="w-9 h-9 rounded-full bg-white text-[#102747] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </span>
                  </div>
                </a>
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-[#102747]">{v.title}</h3>
                    <p className="text-xs text-[#667085] mt-1">{v.description}</p>
                  </div>
                  {linkedProducts.length > 0 && (
                    <div className="pt-2 border-t border-[#E3E8EF] flex flex-wrap gap-1.5">
                      {linkedProducts.map((lp) => (
                        <button
                          key={lp.id}
                          type="button"
                          onClick={() => onSelectProduct(lp)}
                          className="text-xs text-[#102747] font-medium hover:underline"
                        >
                          Shop {lp.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Article Reader Modal */}
      {activeArticle && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E3E8EF] w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[#667085]">
                  {activeArticle.article.category} · {activeArticle.article.readingTimeMin} min read ·{" "}
                  {new Date(activeArticle.article.publishedAt).toLocaleDateString()}
                </p>
                <h2 className="font-display font-bold text-xl text-[#102747] mt-1">
                  {activeArticle.article.title}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(activeArticle.article.title).catch(() => {});
                    showToast("Article reference copied");
                  }}
                  className="p-2 rounded-xl border border-[#E3E8EF] text-[#102747]"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveArticle(null)}
                  className="p-2 rounded-xl bg-[#F5F7FA] text-[#102747]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <img
              src={resolveMediaUrl(activeArticle.article.coverImageUrl)}
              alt={activeArticle.article.title}
              className="w-full h-56 object-cover rounded-2xl bg-[#F5F7FA]"
            />

            <div className="space-y-3 text-sm text-[#102747] leading-relaxed whitespace-pre-line">
              {activeArticle.article.contentMarkdown}
            </div>

            {activeArticle.article.quizQuestions.length > 0 && (
              <div className="p-4 rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF] space-y-4">
                <h3 className="font-display font-semibold text-sm text-[#102747]">Quick Knowledge Check</h3>
                {activeArticle.article.quizQuestions.map((q, qIdx) => {
                  const picked = quizAnswers[qIdx];
                  return (
                    <div key={qIdx} className="space-y-2">
                      <p className="text-xs font-semibold text-[#102747]">{q.question}</p>
                      <div className="space-y-1.5">
                        {q.options.map((opt, optIdx) => (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                            className={`w-full text-left px-3 py-2 rounded-xl border text-xs ${
                              picked === optIdx
                                ? optIdx === q.correctIndex
                                  ? "border-[#16A34A] bg-green-50 text-[#16A34A]"
                                  : "border-[#DC2626] bg-red-50 text-[#DC2626]"
                                : "border-[#E3E8EF] bg-white text-[#102747]"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      {picked !== undefined && <p className="text-xs text-[#667085]">{q.explanation}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            {activeArticle.relatedProducts.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#E3E8EF]">
                <h3 className="font-display font-semibold text-sm text-[#102747]">Mentioned Devices</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeArticle.relatedProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setActiveArticle(null);
                        onSelectProduct(p);
                      }}
                      className="p-3 rounded-xl border border-[#E3E8EF] text-left flex items-center justify-between hover:bg-[#F5F7FA]"
                    >
                      <span className="text-xs font-semibold text-[#102747]">{p.name}</span>
                      <span className="font-mono text-xs text-[#667085] tabular-nums">{formatUgx(p.basePriceUgx)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
