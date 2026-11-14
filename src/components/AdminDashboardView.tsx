import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, FileText, Layers, Package, RefreshCw, Shield, Users } from "lucide-react";
import { apiRequest, formatUgx } from "../lib/api.ts";
import { useApp } from "../context/AppContext.tsx";
import type { OrderRecord, Product, SwapRequestRecord, UserProfile } from "../types.ts";

interface AdminDashboardViewProps {
  onExitAdmin: () => void;
}

type AdminSection = "overview" | "orders" | "inventory" | "swaps" | "content" | "staff";

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onExitAdmin }) => {
  const { user, bootstrap, refreshBootstrap, showToast } = useApp();
  const [section, setSection] = useState<AdminSection>("overview");
  const [kpis, setKpis] = useState<any>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [swaps, setSwaps] = useState<SwapRequestRecord[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // New Product Form
  const [prodName, setProdName] = useState("");
  const [prodModel, setProdModel] = useState("");
  const [prodPrice, setProdPrice] = useState("1500000");
  const [prodStorage, setProdStorage] = useState("128GB");
  const [prodColor, setProdColor] = useState("Midnight Black");
  const [prodStock, setProdStock] = useState("5");

  // Swap assessment drafts
  const [valDrafts, setValDrafts] = useState<Record<number, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  // New Article / TikTok Forms
  const [artTitle, setArtTitle] = useState("");
  const [artCategory, setArtCategory] = useState("Smartphone buying guides");
  const [artSummary, setArtSummary] = useState("");
  const [artBody, setArtBody] = useState("");
  const [vidTitle, setVidTitle] = useState("");
  const [vidUrl, setVidUrl] = useState("https://www.tiktok.com/@centurygadgets");
  const [vidDesc, setVidDesc] = useState("");

  const loadAdminData = useCallback(async () => {
    try {
      const ov = await apiRequest<{ kpis: any }>("/admin/overview");
      setKpis(ov.kpis);
    } catch {
      // role-dependent
    }
    apiRequest<{ orders: OrderRecord[] }>("/admin/orders")
      .then((r) => setOrders(r.orders))
      .catch(() => {});
    apiRequest<{ swaps: SwapRequestRecord[] }>("/admin/swaps")
      .then((r) => setSwaps(r.swaps))
      .catch(() => {});
    apiRequest<{ users: UserProfile[] }>("/admin/staff")
      .then((r) => setStaffUsers(r.users))
      .catch(() => {});
    apiRequest<{ logs: any[] }>("/admin/audit-logs")
      .then((r) => setAuditLogs(r.logs))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleOrderStatus = async (orderId: number, status: string) => {
    try {
      await apiRequest(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadAdminData();
      showToast("Order status updated");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleRefundOrder = async (orderId: number) => {
    const reason = window.prompt("Enter verified refund approval reason (minimum 5 characters):");
    if (!reason || reason.trim().length < 5) return;
    try {
      await apiRequest(`/admin/orders/${orderId}/refund`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim(), confirmApproval: true }),
      });
      await loadAdminData();
      showToast("Refund approved and logged");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleAdjustStock = async (variantId: number, currentStock: number) => {
    const qtyRaw = window.prompt(`Current stock: ${currentStock}. Enter new stock quantity:`, String(currentStock));
    if (qtyRaw === null) return;
    const reason = window.prompt("Enter mandatory audit reason for stock adjustment:");
    if (!reason || reason.trim().length < 5) {
      showToast("Audit reason (min 5 chars) is required", "error");
      return;
    }
    try {
      await apiRequest(`/admin/variants/${variantId}/stock`, {
        method: "POST",
        body: JSON.stringify({ newStockQty: Number(qtyRaw), reason: reason.trim() }),
      });
      await refreshBootstrap();
      showToast("Stock adjusted and audited");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bootstrap?.brands[0] || !bootstrap?.categories[0]) return;
    try {
      await apiRequest("/admin/products", {
        method: "POST",
        body: JSON.stringify({
          name: prodName,
          brandId: bootstrap.brands[0].id,
          categoryId: bootstrap.categories[0].id,
          model: prodModel,
          condition: "new",
          conditionGrade: "Brand New Sealed",
          warrantyMonths: 12,
          description: `${prodName} (${prodModel}) verified by Century Gadgets Kampala.`,
          basePriceUgx: Number(prodPrice),
          storage: prodStorage,
          color: prodColor,
          stockQty: Number(prodStock),
          imageUrl: "media:iphone",
        }),
      });
      setProdName("");
      setProdModel("");
      await refreshBootstrap();
      showToast("Product created in catalogue");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleAssessSwap = async (swapId: number, status: string) => {
    const valRaw = valDrafts[swapId];
    const note = noteDrafts[swapId] || `Updated to ${status} by staff assessor.`;
    try {
      await apiRequest(`/admin/swaps/${swapId}/assess`, {
        method: "POST",
        body: JSON.stringify({
          status,
          valuationUgx: valRaw ? Number(valRaw) : undefined,
          note,
        }),
      });
      await loadAdminData();
      showToast("Swap assessment updated");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleCompleteInspection = async (swap: SwapRequestRecord) => {
    const valRaw = valDrafts[swap.id] || String(swap.offeredValuationUgx ?? swap.provisionalEstimateUgx);
    const note = noteDrafts[swap.id] || "Physical inspection passed in Kampala store.";
    try {
      await apiRequest(`/admin/swaps/${swap.id}/inspect`, {
        method: "POST",
        body: JSON.stringify({
          finalValuationUgx: Number(valRaw),
          inspectionNotes: note,
        }),
      });
      await loadAdminData();
      showToast("Inspection recorded");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handlePublishArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/admin/articles", {
        method: "POST",
        body: JSON.stringify({
          title: artTitle,
          category: artCategory,
          summary: artSummary,
          contentMarkdown: artBody,
          readingTimeMin: 4,
          tags: ["Guide"],
        }),
      });
      setArtTitle("");
      setArtSummary("");
      setArtBody("");
      await refreshBootstrap();
      showToast("Article published");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleAddTiktok = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/admin/tiktok", {
        method: "POST",
        body: JSON.stringify({
          title: vidTitle,
          videoUrl: vidUrl,
          description: vidDesc,
          category: "Tutorial",
        }),
      });
      setVidTitle("");
      setVidDesc("");
      await refreshBootstrap();
      showToast("TikTok video added");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await apiRequest<string>("/admin/reports/orders.csv");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "century-gadgets-orders.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="min-h-[82vh] bg-white border border-[#E3E8EF] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
      {/* Sidebar */}
      <aside className="lg:col-span-3 bg-[#102747] text-white p-5 space-y-6">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onExitAdmin}
            className="text-xs text-white/80 hover:text-white inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customer Store</span>
          </button>
          <h1 className="font-display font-bold text-lg">Century Operations</h1>
          <p className="text-xs text-white/70">Role: {user?.role.replace(/_/g, " ")}</p>
        </div>

        <nav className="space-y-1">
          {[
            { id: "overview", label: "Overview & KPIs", icon: Layers },
            { id: "orders", label: "Orders & Refunds", icon: Package },
            { id: "inventory", label: "Catalogue & Stock", icon: Shield },
            { id: "swaps", label: "Swap Assessment", icon: RefreshCw },
            { id: "content", label: "Learn & TikTok CMS", icon: FileText },
            { id: "staff", label: "Staff RBAC & Audit", icon: Users },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id as AdminSection)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left text-xs font-medium flex items-center gap-2.5 transition-colors ${
                  section === item.id ? "bg-white text-[#102747]" : "text-white/85 hover:bg-white/10"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="lg:col-span-9 p-6 space-y-6 overflow-x-auto">
        {section === "overview" && kpis && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl text-[#102747]">Operations Overview</h2>
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-4 py-2 rounded-xl border border-[#E3E8EF] text-xs font-medium text-[#102747] inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Orders CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Verified Revenue", value: formatUgx(kpis.totalRevenueUgx) },
                { label: "Total Orders", value: `${kpis.totalOrders} (${kpis.paidOrdersCount} paid)` },
                { label: "Pending Swaps", value: String(kpis.pendingSwapsCount) },
                { label: "Available Units", value: `${kpis.totalAvailableUnits} (${kpis.lowStockCount} low)` },
              ].map((stat, i) => (
                <div key={i} className="p-4 rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF]">
                  <p className="text-xs text-[#667085]">{stat.label}</p>
                  <p className="font-mono font-bold text-base text-[#102747] tabular-nums mt-1">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === "orders" && (
          <div className="space-y-4">
            <h2 className="font-display font-bold text-xl text-[#102747]">Orders & Refunds</h2>
            <div className="space-y-3">
              {orders.map((ord) => (
                <div key={ord.id} className="p-4 rounded-xl border border-[#E3E8EF] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-mono font-bold text-[#102747]">
                      {ord.orderRef} · {formatUgx(ord.totalUgx)}
                    </p>
                    <p className="text-[#667085]">
                      {ord.customerName} ({ord.customerPhone}) · Payment: {ord.paymentStatus}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={ord.status}
                      onChange={(e) => handleOrderStatus(ord.id, e.target.value)}
                      className="h-9 rounded-lg border border-[#E3E8EF] px-2.5 text-xs bg-white text-[#102747]"
                    >
                      {[
                        "pending_payment",
                        "paid",
                        "confirmed",
                        "processing",
                        "ready_for_collection",
                        "dispatched",
                        "delivered",
                        "cancelled",
                        "refund_pending",
                        "refunded",
                      ].map((st) => (
                        <option key={st} value={st}>
                          {st.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    {ord.paymentStatus === "successful" && (
                      <button
                        type="button"
                        onClick={() => handleRefundOrder(ord.id)}
                        className="px-3 py-1.5 rounded-lg border border-[#DC2626] text-[#DC2626] text-xs font-medium"
                      >
                        Approve Refund
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === "inventory" && (
          <div className="space-y-6">
            <h2 className="font-display font-bold text-xl text-[#102747]">Catalogue & Inventory Control</h2>
            <form onSubmit={handleCreateProduct} className="p-4 rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF] grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input required value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Product Name" className="h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
              <input required value={prodModel} onChange={(e) => setProdModel(e.target.value)} placeholder="Model Code" className="h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
              <input required type="number" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} placeholder="Price UGX" className="h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
              <input required value={prodStorage} onChange={(e) => setProdStorage(e.target.value)} placeholder="Storage (e.g. 256GB)" className="h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
              <input required value={prodColor} onChange={(e) => setProdColor(e.target.value)} placeholder="Color" className="h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
              <div className="flex gap-2">
                <input required type="number" value={prodStock} onChange={(e) => setProdStock(e.target.value)} placeholder="Stock" className="w-20 h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
                <button type="submit" className="flex-1 h-10 rounded-xl bg-[#102747] text-white text-xs font-medium">
                  Add Product
                </button>
              </div>
            </form>

            <div className="space-y-2.5">
              {(bootstrap?.allProducts ?? []).map((p: Product) => (
                <div key={p.id} className="p-4 rounded-xl border border-[#E3E8EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-[#102747]">{p.name}</p>
                    <p className="text-[#667085]">
                      {p.model} · {p.conditionGrade} · {formatUgx(p.basePriceUgx)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleAdjustStock(v.id, v.stockQty)}
                        className="px-3 py-1.5 rounded-lg bg-[#F5F7FA] border border-[#E3E8EF] text-[#102747] font-mono"
                      >
                        {v.storage}: {v.availableQty} avail (Edit)
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === "swaps" && (
          <div className="space-y-4">
            <h2 className="font-display font-bold text-xl text-[#102747]">Swap Assessment & Inspection Desk</h2>
            {swaps.length === 0 ? (
              <p className="text-xs text-[#667085]">No customer swap requests submitted yet.</p>
            ) : (
              swaps.map((sw) => (
                <div key={sw.id} className="p-4 rounded-2xl border border-[#E3E8EF] space-y-3 text-xs">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-mono font-bold text-[#102747]">
                        {sw.swapRef} · {sw.status.replace(/_/g, " ")}
                      </p>
                      <p className="text-[#667085]">
                        Trade-in: {sw.currentBrand} {sw.currentModel} ({sw.currentStorage}) → Target: {sw.targetProduct?.name}
                      </p>
                    </div>
                    <div className="font-mono text-right tabular-nums">
                      <p className="text-[#667085]">Provisional: {formatUgx(sw.provisionalEstimateUgx)}</p>
                      <p className="font-bold text-[#102747]">Target: {formatUgx(sw.targetPriceUgx)}</p>
                    </div>
                  </div>

                  {sw.photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {sw.photos.map((ph) => (
                        <img key={ph.id} src={ph.url} alt={ph.angleLabel} className="w-16 h-16 rounded-lg object-cover border border-[#E3E8EF]" />
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="Assessed Valuation (UGX)"
                      value={valDrafts[sw.id] || ""}
                      onChange={(e) => setValDrafts((prev) => ({ ...prev, [sw.id]: e.target.value }))}
                      className="h-9 rounded-xl border border-[#E3E8EF] px-3 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Assessor note / question..."
                      value={noteDrafts[sw.id] || ""}
                      onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [sw.id]: e.target.value }))}
                      className="sm:col-span-2 h-9 rounded-xl border border-[#E3E8EF] px-3 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAssessSwap(sw.id, "offer_issued")}
                      className="px-3.5 py-2 rounded-xl bg-[#102747] text-white font-medium"
                    >
                      Issue Valuation Offer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssessSwap(sw.id, "more_info_required")}
                      className="px-3.5 py-2 rounded-xl border border-[#E3E8EF] text-[#102747] font-medium"
                    >
                      Request More Info
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCompleteInspection(sw)}
                      className="px-3.5 py-2 rounded-xl border border-[#102747] text-[#102747] font-medium"
                    >
                      Complete Physical Inspection
                    </button>
                    {sw.status === "awaiting_exchange" && (
                      <button
                        type="button"
                        onClick={() => handleAssessSwap(sw.id, "completed")}
                        className="px-3.5 py-2 rounded-xl bg-[#16A34A] text-white font-medium"
                      >
                        Mark Exchange Completed
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {section === "content" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form onSubmit={handlePublishArticle} className="p-4 rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF] space-y-3">
              <h3 className="font-display font-bold text-sm text-[#102747]">Publish Educational Article</h3>
              <input required value={artTitle} onChange={(e) => setArtTitle(e.target.value)} placeholder="Article Title" className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
              <input required value={artCategory} onChange={(e) => setArtCategory(e.target.value)} placeholder="Category" className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
              <input required value={artSummary} onChange={(e) => setArtSummary(e.target.value)} placeholder="Short summary" className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
              <textarea required rows={4} value={artBody} onChange={(e) => setArtBody(e.target.value)} placeholder="Full educational article..." className="w-full rounded-xl border border-[#E3E8EF] p-3 text-xs bg-white" />
              <button type="submit" className="w-full py-2.5 rounded-xl bg-[#102747] text-white text-xs font-medium">
                Publish Article
              </button>
            </form>

            <form onSubmit={handleAddTiktok} className="p-4 rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF] space-y-3">
              <h3 className="font-display font-bold text-sm text-[#102747]">Curate Official TikTok Video</h3>
              <input required value={vidTitle} onChange={(e) => setVidTitle(e.target.value)} placeholder="Video Title" className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
              <input required type="url" value={vidUrl} onChange={(e) => setVidUrl(e.target.value)} placeholder="https://www.tiktok.com/@centurygadgets/..." className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs bg-white" />
              <textarea required rows={3} value={vidDesc} onChange={(e) => setVidDesc(e.target.value)} placeholder="Educational description" className="w-full rounded-xl border border-[#E3E8EF] p-3 text-xs bg-white" />
              <button type="submit" className="w-full py-2.5 rounded-xl bg-[#102747] text-white text-xs font-medium">
                Add TikTok Video
              </button>
            </form>
          </div>
        )}

        {section === "staff" && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="font-display font-bold text-xl text-[#102747]">Staff Roles & Access Control</h2>
              {staffUsers.map((u) => (
                <div key={u.id} className="p-3.5 rounded-xl border border-[#E3E8EF] flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-[#102747]">{u.fullName}</p>
                    <p className="text-[#667085]">{u.email}</p>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) =>
                      apiRequest(`/admin/staff/${u.id}/role`, {
                        method: "PATCH",
                        body: JSON.stringify({ role: e.target.value }),
                      }).then(() => {
                        loadAdminData();
                        showToast("Role updated");
                      })
                    }
                    className="h-9 rounded-lg border border-[#E3E8EF] px-2.5 text-xs bg-white"
                  >
                    {["customer", "administrator", "inventory_manager", "order_manager", "swap_assessor", "content_editor"].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-display font-bold text-base text-[#102747]">Recent Audit Logs</h3>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF] text-xs flex justify-between gap-4">
                    <span className="text-[#102747]">
                      <strong>{log.action}</strong> ({log.entityType} #{log.entityId}) by {log.actorEmail}
                    </span>
                    <span className="font-mono text-[#667085] shrink-0">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
