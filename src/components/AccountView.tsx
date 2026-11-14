import React, { useCallback, useEffect, useState } from "react";
import { Bell, LogOut, MapPin, MessageCircle, Package, Phone, ShieldCheck, Trash2 } from "lucide-react";
import { apiRequest, formatUgx } from "../lib/api.ts";
import { useApp } from "../context/AppContext.tsx";
import type { OrderRecord, Product } from "../types.ts";

interface AccountViewProps {
  onOpenAdmin: () => void;
  onSelectProduct: (product: Product) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({ onOpenAdmin, onSelectProduct }) => {
  const {
    user,
    bootstrap,
    wishlistIds,
    bookmarkIds,
    signInWithGoogle,
    signInWithCredentials,
    registerAccount,
    signOut,
    refreshUserSync,
    showToast,
  } = useApp();

  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("+256");
  const [regPassword, setRegPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [notifs, setNotifs] = useState<Array<{ id: number; title: string; body: string; isRead: boolean; createdAt: string }>>([]);
  const [addresses, setAddresses] = useState<Array<{ id: number; label: string; district: string; area: string; streetDetails: string }>>([]);
  const [faqs, setFaqs] = useState<Array<{ q: string; a: string }>>([]);

  // Profile edit
  const [editPhone, setEditPhone] = useState("");
  const [addrLabel, setAddrLabel] = useState("Home");
  const [addrDistrict, setAddrDistrict] = useState("Kampala");
  const [addrArea, setAddrArea] = useState("");
  const [addrStreet, setAddrStreet] = useState("");

  // Support ticket
  const [supName, setSupName] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("+256");
  const [supSubject, setSupSubject] = useState("");
  const [supMessage, setSupMessage] = useState("");

  const loadAccountData = useCallback(async () => {
    apiRequest<{ faqs: Array<{ q: string; a: string }> }>("/support/config")
      .then((res) => setFaqs(res.faqs))
      .catch(() => {});

    if (!user) return;
    setEditPhone(user.phone || "");
    setSupName(user.fullName);
    setSupEmail(user.email);
    setSupPhone(user.phone || "+256");

    const [ordRes, notifRes, meRes] = await Promise.all([
      apiRequest<{ orders: OrderRecord[] }>("/orders").catch(() => ({ orders: [] })),
      apiRequest<{ notifications: any[] }>("/notifications").catch(() => ({ notifications: [] })),
      apiRequest<{ addresses: any[] }>("/auth/me").catch(() => ({ addresses: [] })),
    ]);
    setOrders(ordRes.orders);
    setNotifs(notifRes.notifications);
    setAddresses(meRes.addresses);
  }, [user]);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      await signInWithCredentials(identifier, password);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      await registerAccount(regName, regEmail, regPhone, regPassword);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ phone: editPhone }),
      });
      await refreshUserSync();
      showToast("Profile updated");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/auth/addresses", {
        method: "POST",
        body: JSON.stringify({
          label: addrLabel,
          recipientName: user?.fullName || "Customer",
          phone: user?.phone || "+256700000000",
          district: addrDistrict,
          area: addrArea,
          streetDetails: addrStreet,
        }),
      });
      setAddrArea("");
      setAddrStreet("");
      await loadAccountData();
      showToast("Delivery address saved");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          name: supName,
          email: supEmail,
          phone: supPhone,
          subject: supSubject,
          message: supMessage,
        }),
      });
      setSupSubject("");
      setSupMessage("");
      showToast("Support inquiry sent to Century Gadgets Kampala");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleRequestDeletion = async () => {
    try {
      const res = await apiRequest<{ message: string }>("/auth/deletion-request", { method: "POST" });
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const isStaff = user && user.role !== "customer";
  const wishlistProducts = (bootstrap?.allProducts ?? []).filter((p) => wishlistIds.includes(p.id));
  const bookmarkedArticles = (bootstrap?.learnArticles ?? []).filter((a) => bookmarkIds.includes(a.id));

  return (
    <div className="space-y-8 pb-8">
      {!user ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 bg-white border border-[#E3E8EF] rounded-3xl p-6 md:p-8 space-y-5">
            <div>
              <h1 className="font-display font-bold text-2xl text-[#102747]">Century Gadgets Account</h1>
              <p className="text-xs text-[#667085] mt-1">
                Sign in to track orders, manage phone swap offers, and save your wishlist.
              </p>
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full h-11 rounded-xl bg-[#102747] text-white text-sm font-semibold hover:bg-[#0B1D36] transition-colors"
            >
              Continue with Google Sign-In
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-[#E3E8EF]" />
              <span className="px-3 text-xs text-[#667085]">or use email & phone</span>
              <div className="flex-grow border-t border-[#E3E8EF]" />
            </div>

            <div className="inline-flex p-1 bg-[#F5F7FA] rounded-xl border border-[#E3E8EF]">
              <button
                type="button"
                onClick={() => setAuthTab("login")}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium ${
                  authTab === "login" ? "bg-white text-[#102747] shadow-xs" : "text-[#667085]"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthTab("register")}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium ${
                  authTab === "register" ? "bg-white text-[#102747] shadow-xs" : "text-[#667085]"
                }`}
              >
                Create Account
              </button>
            </div>

            {authTab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-3">
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email or Uganda phone (+256...)"
                  className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm"
                />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full h-11 rounded-xl border border-[#102747] text-[#102747] text-sm font-semibold hover:bg-[#F5F7FA]"
                >
                  {authBusy ? "Signing in..." : "Sign In"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <input
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm"
                />
                <input
                  required
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm"
                />
                <input
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="Phone (+256 7XX XXX XXX)"
                  className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm"
                />
                <input
                  required
                  type="password"
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Password (min 8 characters)"
                  className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full h-11 rounded-xl border border-[#102747] text-[#102747] text-sm font-semibold hover:bg-[#F5F7FA]"
                >
                  {authBusy ? "Creating..." : "Create Customer Account"}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-6 bg-white border border-[#E3E8EF] rounded-3xl p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-[#102747]">Customer Support & Kampala Store</h2>
            {bootstrap?.storeInfo && (
              <div className="space-y-2 text-xs text-[#667085]">
                <p className="flex items-center gap-2 text-[#102747] font-medium">
                  <MapPin className="w-4 h-4" />
                  <span>{bootstrap.storeInfo.address}</span>
                </p>
                <p>{bootstrap.storeInfo.hours}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <a
                    href={`tel:${bootstrap.storeInfo.phone.replace(/\s+/g, "")}`}
                    className="px-3.5 py-2 rounded-xl border border-[#E3E8EF] text-[#102747] font-medium inline-flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Support</span>
                  </a>
                  <a
                    href={`https://wa.me/${bootstrap.storeInfo.whatsappNumber.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#102747] text-white font-medium inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Shop</span>
                  </a>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#E3E8EF] space-y-2">
              <h3 className="text-xs font-semibold text-[#102747]">Frequently Asked Questions</h3>
              {faqs.map((f, i) => (
                <div key={i} className="p-3 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF] text-xs">
                  <p className="font-semibold text-[#102747]">{f.q}</p>
                  <p className="text-[#667085] mt-1">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile Header */}
          <div className="bg-white border border-[#E3E8EF] rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[#667085]">
                {user.email} · Role: <strong className="text-[#102747]">{user.role.replace(/_/g, " ")}</strong>
              </p>
              <h1 className="font-display font-bold text-2xl text-[#102747]">{user.fullName}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isStaff && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="px-4 py-2.5 rounded-xl bg-[#102747] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Open Staff Admin Console</span>
                </button>
              )}
              <button
                type="button"
                onClick={signOut}
                className="px-4 py-2.5 rounded-xl border border-[#E3E8EF] text-[#102747] text-xs font-medium inline-flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Orders & Notifications */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-[#E3E8EF] rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#102747]" />
                  <h2 className="font-display font-bold text-base text-[#102747]">Order History ({orders.length})</h2>
                </div>
                {orders.length === 0 ? (
                  <p className="text-xs text-[#667085]">You have not placed any orders yet.</p>
                ) : (
                  <div className="space-y-3">
                    {orders.map((ord) => (
                      <div key={ord.id} className="p-4 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF] space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-[#102747]">{ord.orderRef}</span>
                          <span className="font-semibold text-[#102747]">
                            {ord.status.replace(/_/g, " ")} · Payment: {ord.paymentStatus}
                          </span>
                        </div>
                        <div className="text-[#667085]">
                          {ord.items.map((i) => `${i.quantity}x ${i.productNameSnapshot} (${i.variantSnapshot})`).join(", ")}
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="font-mono font-semibold text-[#102747] tabular-nums">
                            {formatUgx(ord.totalUgx)}
                          </span>
                          <span className="text-[#667085]">{new Date(ord.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-[#E3E8EF] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#102747]" />
                    <h2 className="font-display font-bold text-base text-[#102747]">Notifications</h2>
                  </div>
                  {notifs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => apiRequest("/notifications/read-all", { method: "POST" }).then(loadAccountData)}
                      className="text-xs text-[#102747] hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifs.length === 0 ? (
                  <p className="text-xs text-[#667085]">No notifications yet.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifs.map((n) => (
                      <div key={n.id} className={`p-3 rounded-xl border text-xs ${n.isRead ? "bg-white border-[#E3E8EF]" : "bg-[#F5F7FA] border-[#102747]/30"}`}>
                        <p className="font-semibold text-[#102747]">{n.title}</p>
                        <p className="text-[#667085] mt-0.5">{n.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Support Form */}
              <div className="bg-white border border-[#E3E8EF] rounded-2xl p-5 space-y-3">
                <h2 className="font-display font-bold text-base text-[#102747]">Contact Century Gadgets Support</h2>
                <form onSubmit={handleSupportSubmit} className="space-y-3">
                  <input
                    required
                    value={supSubject}
                    onChange={(e) => setSupSubject(e.target.value)}
                    placeholder="Subject (e.g. Warranty inquiry or Order update)"
                    className="w-full h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs"
                  />
                  <textarea
                    required
                    rows={3}
                    value={supMessage}
                    onChange={(e) => setSupMessage(e.target.value)}
                    placeholder="How can our Kampala team help?"
                    className="w-full rounded-xl border border-[#E3E8EF] p-3 text-xs"
                  />
                  <button type="submit" className="px-4 py-2 rounded-xl bg-[#102747] text-white text-xs font-medium">
                    Send Support Ticket
                  </button>
                </form>
              </div>
            </div>

            {/* Profile, Addresses, Wishlist, Bookmarks & Privacy */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-[#E3E8EF] rounded-2xl p-5 space-y-3">
                <h2 className="font-display font-bold text-base text-[#102747]">Phone & Preferences</h2>
                <form onSubmit={handleUpdateProfile} className="flex gap-2">
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+256 7XX XXX XXX"
                    className="flex-1 h-10 rounded-xl border border-[#E3E8EF] px-3 text-xs"
                  />
                  <button type="submit" className="px-4 h-10 rounded-xl bg-[#102747] text-white text-xs font-medium">
                    Save
                  </button>
                </form>
              </div>

              <div className="bg-white border border-[#E3E8EF] rounded-2xl p-5 space-y-3">
                <h2 className="font-display font-bold text-base text-[#102747]">Saved Delivery Addresses</h2>
                {addresses.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF] flex justify-between text-xs">
                    <div>
                      <p className="font-semibold text-[#102747]">{a.label} · {a.district}</p>
                      <p className="text-[#667085]">{a.area}, {a.streetDetails}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => apiRequest(`/auth/addresses/${a.id}`, { method: "DELETE" }).then(loadAccountData)}
                      className="text-[#667085] hover:text-[#DC2626]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <form onSubmit={handleAddAddress} className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} placeholder="Label (Home/Work)" className="h-9 rounded-xl border border-[#E3E8EF] px-3 text-xs" />
                    <input value={addrDistrict} onChange={(e) => setAddrDistrict(e.target.value)} placeholder="District (Kampala)" className="h-9 rounded-xl border border-[#E3E8EF] px-3 text-xs" />
                  </div>
                  <input required value={addrArea} onChange={(e) => setAddrArea(e.target.value)} placeholder="Area (e.g. Kololo / Ntinda)" className="w-full h-9 rounded-xl border border-[#E3E8EF] px-3 text-xs" />
                  <input required value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} placeholder="Street & Landmark" className="w-full h-9 rounded-xl border border-[#E3E8EF] px-3 text-xs" />
                  <button type="submit" className="w-full py-2 rounded-xl border border-[#102747] text-[#102747] text-xs font-medium">
                    Add Delivery Address
                  </button>
                </form>
              </div>

              <div className="bg-white border border-[#E3E8EF] rounded-2xl p-5 space-y-3">
                <h2 className="font-display font-bold text-base text-[#102747]">
                  Saved Wishlist ({wishlistProducts.length}) & Articles ({bookmarkedArticles.length})
                </h2>
                {wishlistProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectProduct(p)}
                    className="w-full p-2.5 rounded-xl bg-[#F5F7FA] text-left flex justify-between text-xs"
                  >
                    <span className="font-medium text-[#102747]">{p.name}</span>
                    <span className="font-mono text-[#667085]">{formatUgx(p.basePriceUgx)}</span>
                  </button>
                ))}
                {bookmarkedArticles.map((a) => (
                  <div key={a.id} className="p-2.5 rounded-xl bg-[#F5F7FA] text-xs text-[#102747]">
                    {a.title}
                  </div>
                ))}
              </div>

              <div className="bg-white border border-[#E3E8EF] rounded-2xl p-5 space-y-2 text-xs text-[#667085]">
                <p className="font-semibold text-[#102747]">Privacy & Trade-In Policy</p>
                <p>
                  We only collect contact and device inspection data required to fulfill orders and phone swaps. Device photographs are restricted to authorized swap assessors.
                </p>
                <button
                  type="button"
                  onClick={handleRequestDeletion}
                  className="text-[#DC2626] font-medium hover:underline pt-1"
                >
                  Request Account Deletion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
