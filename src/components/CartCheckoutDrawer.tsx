import React, { useEffect, useState } from "react";
import { CheckCircle2, Minus, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { apiRequest, formatUgx } from "../lib/api.ts";
import { resolveMediaUrl } from "../lib/media.ts";
import { useApp } from "../context/AppContext.tsx";
import type { OrderRecord } from "../types.ts";

interface CartCheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  onRequireSignIn: () => void;
}

export const CartCheckoutDrawer: React.FC<CartCheckoutDrawerProps> = ({
  open,
  onClose,
  onRequireSignIn,
}) => {
  const { user, cart, bootstrap, refreshCart, showToast } = useApp();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Cart, 2: Delivery & Payment Form, 3: Order Confirmation
  const [discountInput, setDiscountInput] = useState("");
  const [zoneId, setZoneId] = useState<number>(0);
  const [collectionOption, setCollectionOption] = useState<"delivery" | "store_pickup">("store_pickup");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"mtn_momo" | "airtel_money" | "card" | "cash_on_collection">("mtn_momo");
  const [payerPhone, setPayerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    order: OrderRecord;
    payment: { providerRef: string; status: string; isSimulated: boolean } | null;
  } | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `ck-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (bootstrap?.deliveryZones[0] && zoneId === 0) {
      setZoneId(bootstrap.deliveryZones[0].id);
      setCollectionOption(bootstrap.deliveryZones[0].isStoreCollection ? "store_pickup" : "delivery");
    }
  }, [bootstrap, zoneId]);

  useEffect(() => {
    if (user) {
      setCustomerName((prev) => prev || user.fullName);
      setCustomerEmail((prev) => prev || user.email);
      setCustomerPhone((prev) => prev || user.phone || "+256");
    }
  }, [user]);

  useEffect(() => {
    if (open && zoneId > 0) {
      refreshCart(zoneId);
    }
  }, [open, zoneId, refreshCart]);

  if (!open) return null;

  const selectedZone = bootstrap?.deliveryZones.find((z) => z.id === zoneId);

  const updateQty = async (variantId: number, qty: number) => {
    try {
      await apiRequest(`/cart/items/${variantId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: qty }),
      });
      await refreshCart(zoneId);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const applyDiscount = async () => {
    try {
      await apiRequest("/cart/discount", {
        method: "POST",
        body: JSON.stringify({ code: discountInput }),
      });
      await refreshCart(zoneId);
      showToast(discountInput ? `Discount ${discountInput.toUpperCase()} applied` : "Discount removed");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onClose();
      onRequireSignIn();
      showToast("Please sign in to complete your order", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{
        order: OrderRecord;
        payment: { providerRef: string; status: string; isSimulated: boolean } | null;
      }>("/checkout", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey,
          deliveryZoneId: zoneId,
          collectionOption,
          customerName,
          customerPhone,
          customerEmail,
          deliveryAddress:
            collectionOption === "store_pickup"
              ? "Store Pickup — Mabirizi Complex Level 2, Kampala Rd"
              : deliveryAddress,
          deliveryNotes,
          paymentMethod,
          payerPhone: paymentMethod === "mtn_momo" || paymentMethod === "airtel_money" ? payerPhone || customerPhone : undefined,
        }),
      });
      setConfirmedOrder(res);
      setStep(3);
      setIdempotencyKey(`ck-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await refreshCart();
      showToast(`Order ${res.order.orderRef} created`);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSandboxConfirm = async (outcome: "successful" | "failed") => {
    if (!confirmedOrder?.payment?.providerRef) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ payment: { status: string; providerRef: string; isSimulated: boolean } }>(
        "/payments/sandbox-confirm",
        {
          method: "POST",
          body: JSON.stringify({
            providerRef: confirmedOrder.payment.providerRef,
            outcome,
          }),
        }
      );
      setConfirmedOrder((prev) =>
        prev
          ? {
              ...prev,
              order: {
                ...prev.order,
                status: outcome === "successful" ? "paid" : prev.order.status,
                paymentStatus: outcome,
              },
              payment: res.payment,
            }
          : null
      );
      showToast(
        outcome === "successful"
          ? "[SANDBOX] Payment verified via server webhook"
          : "[SANDBOX] Payment marked failed",
        outcome === "successful" ? "success" : "error"
      );
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping Cart">
      <div className="w-full max-w-lg bg-white h-full flex flex-col border-l border-[#E3E8EF] shadow-2xl">
        <div className="px-5 py-4 border-b border-[#E3E8EF] flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-[#102747] text-lg">
              {step === 1 ? "Shopping Cart" : step === 2 ? "Checkout Details" : "Order Confirmation"}
            </h2>
            <p className="text-xs text-[#667085]">
              {step === 1
                ? `${cart?.itemCount ?? 0} item(s) · Server-verified UGX pricing`
                : step === 2
                  ? "Step 2 of 2 · Delivery & Uganda payment authorization"
                  : "Verified reference & payment status"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (step === 3) setStep(1);
              onClose();
            }}
            aria-label="Close cart"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#F5F7FA] text-[#102747]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {step === 1 && (
            <>
              {!cart || cart.items.length === 0 ? (
                <div className="text-center py-14 space-y-3">
                  <p className="font-display font-semibold text-[#102747]">Your cart is empty</p>
                  <p className="text-sm text-[#667085]">
                    Browse verified smartphones and accessories in the Shop tab to get started.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.items.map((item) => (
                      <div key={item.variantId} className="flex gap-3 p-3 rounded-xl border border-[#E3E8EF] bg-white">
                        <img
                          src={resolveMediaUrl(item.imageUrl)}
                          alt={item.productName}
                          className="w-16 h-16 rounded-lg object-cover bg-[#F5F7FA] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#102747] truncate">{item.productName}</p>
                          <p className="text-xs text-[#667085]">
                            {item.storage} · {item.color}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="inline-flex items-center border border-[#E3E8EF] rounded-lg">
                              <button
                                type="button"
                                onClick={() => updateQty(item.variantId, item.quantity - 1)}
                                aria-label="Decrease quantity"
                                className="p-1.5 text-[#102747] hover:bg-[#F5F7FA]"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2.5 text-xs font-mono tabular-nums">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQty(item.variantId, item.quantity + 1)}
                                aria-label="Increase quantity"
                                className="p-1.5 text-[#102747] hover:bg-[#F5F7FA]"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-[#102747] tabular-nums">
                                {formatUgx(item.lineTotalUgx)}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQty(item.variantId, 0)}
                                aria-label="Remove item"
                                className="text-[#667085] hover:text-[#DC2626]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Discount Code */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder="Promo code (e.g. WELCOME50 or LEARNER5)"
                      className="flex-1 rounded-xl border border-[#E3E8EF] px-3 py-2 text-xs text-[#102747]"
                    />
                    <button
                      type="button"
                      onClick={applyDiscount}
                      className="px-4 py-2 rounded-xl border border-[#102747] text-[#102747] text-xs font-medium hover:bg-[#F5F7FA]"
                    >
                      Apply
                    </button>
                  </div>

                  {/* Delivery Zone Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#102747]">Delivery Zone / Collection</label>
                    <select
                      value={zoneId}
                      onChange={(e) => {
                        const nextId = Number(e.target.value);
                        setZoneId(nextId);
                        const z = bootstrap?.deliveryZones.find((d) => d.id === nextId);
                        if (z) setCollectionOption(z.isStoreCollection ? "store_pickup" : "delivery");
                      }}
                      className="w-full rounded-xl border border-[#E3E8EF] px-3 py-2.5 text-xs text-[#102747] bg-white"
                    >
                      {bootstrap?.deliveryZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} — {z.feeUgx === 0 ? "Free" : formatUgx(z.feeUgx)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Summary */}
                  <div className="p-4 rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF] space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#667085]">Subtotal</span>
                      <span className="font-mono tabular-nums text-[#102747]">{formatUgx(cart.subtotalUgx)}</span>
                    </div>
                    {cart.discountUgx > 0 && (
                      <div className="flex justify-between text-[#16A34A]">
                        <span>Discount ({cart.appliedDiscountCode})</span>
                        <span className="font-mono tabular-nums">-{formatUgx(cart.discountUgx)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#667085]">Delivery Fee</span>
                      <span className="font-mono tabular-nums text-[#102747]">{formatUgx(cart.deliveryFeeUgx)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[#E3E8EF] text-sm font-bold text-[#102747]">
                      <span>Total Payable</span>
                      <span className="font-mono tabular-nums">{formatUgx(cart.totalUgx)}</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {step === 2 && cart && (
            <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#102747]">Customer Full Name</label>
                <input
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-[#E3E8EF] px-3 py-2.5 text-sm text-[#102747]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#102747]">Phone Number (Uganda)</label>
                  <input
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+256 7XX XXX XXX"
                    className="w-full rounded-xl border border-[#E3E8EF] px-3 py-2.5 text-sm text-[#102747]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#102747]">Email Address</label>
                  <input
                    required
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#E3E8EF] px-3 py-2.5 text-sm text-[#102747]"
                  />
                </div>
              </div>

              {!selectedZone?.isStoreCollection && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#102747]">Delivery Address & Landmark</label>
                  <input
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="e.g. Plot 14 Acacia Ave, Kololo, near..."
                    className="w-full rounded-xl border border-[#E3E8EF] px-3 py-2.5 text-sm text-[#102747]"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#102747]">Delivery Instructions (Optional)</label>
                <input
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Call before arrival, preferred delivery window..."
                  className="w-full rounded-xl border border-[#E3E8EF] px-3 py-2.5 text-sm text-[#102747]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#102747]">Payment Method (Uganda)</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: "mtn_momo", title: "MTN Mobile Money (Sandbox)", desc: "Authorized server-verified MoMo push prompt" },
                    { id: "airtel_money", title: "Airtel Money (Sandbox)", desc: "Authorized Airtel Money collection prompt" },
                    { id: "card", title: "Visa / Mastercard (Sandbox)", desc: "Encrypted payment gateway redirect" },
                    { id: "cash_on_collection", title: "Pay on Store Collection", desc: "Inspect device first at Mabirizi Complex" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        paymentMethod === m.id ? "border-[#102747] bg-[#F5F7FA]" : "border-[#E3E8EF] bg-white"
                      }`}
                    >
                      <div className="text-xs font-semibold text-[#102747]">{m.title}</div>
                      <div className="text-xs text-[#667085]">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {(paymentMethod === "mtn_momo" || paymentMethod === "airtel_money") && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#102747]">Mobile Money Number (Never enter PIN here)</label>
                  <input
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                    placeholder="+256 77X XXX XXX"
                    className="w-full rounded-xl border border-[#E3E8EF] px-3 py-2.5 text-sm text-[#102747]"
                  />
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF] text-xs flex justify-between font-bold text-[#102747]">
                <span>Order Total</span>
                <span className="font-mono tabular-nums">{formatUgx(cart.totalUgx)}</span>
              </div>
            </form>
          )}

          {step === 3 && confirmedOrder && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF] space-y-2">
                <div className="flex items-center gap-2 text-[#16A34A] font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Order Reference: {confirmedOrder.order.orderRef}</span>
                </div>
                <p className="text-xs text-[#667085]">
                  Status: <strong className="text-[#102747]">{confirmedOrder.order.status.replace(/_/g, " ")}</strong> ·
                  Payment: <strong className="text-[#102747]">{confirmedOrder.order.paymentStatus}</strong>
                </p>
                <p className="font-mono text-sm font-bold text-[#102747] tabular-nums">
                  Total: {formatUgx(confirmedOrder.order.totalUgx)}
                </p>
              </div>

              {confirmedOrder.payment?.isSimulated && confirmedOrder.order.paymentStatus === "pending" && (
                <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 space-y-3">
                  <div className="flex items-start gap-2 text-xs text-amber-900">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Sandbox Payment Verification</p>
                      <p className="mt-0.5">
                        Ref {confirmedOrder.payment.providerRef} is in sandbox mode (no real money charged). Trigger a signed server-side webhook verification to test payment state transitions:
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSandboxConfirm("successful")}
                      className="py-2 rounded-xl bg-[#102747] text-white text-xs font-medium hover:bg-[#0B1D36]"
                    >
                      Verify Sandbox Success
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSandboxConfirm("failed")}
                      className="py-2 rounded-xl border border-[#DC2626] text-[#DC2626] text-xs font-medium hover:bg-red-50"
                    >
                      Simulate Payment Failed
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[#E3E8EF] bg-white">
          {step === 1 && cart && cart.items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  onClose();
                  onRequireSignIn();
                  showToast("Please sign in on the Account tab to checkout");
                  return;
                }
                setStep(2);
              }}
              className="w-full h-12 rounded-xl bg-[#102747] text-white font-medium text-sm hover:bg-[#0B1D36] transition-colors"
            >
              Proceed to Checkout · {formatUgx(cart.totalUgx)}
            </button>
          )}
          {step === 2 && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-12 rounded-xl border border-[#E3E8EF] text-[#102747] text-sm font-medium"
              >
                Back
              </button>
              <button
                type="submit"
                form="checkout-form"
                disabled={submitting}
                className="col-span-2 h-12 rounded-xl bg-[#102747] text-white text-sm font-medium hover:bg-[#0B1D36] disabled:opacity-50"
              >
                {submitting ? "Processing..." : "Confirm & Place Order"}
              </button>
            </div>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setConfirmedOrder(null);
                onClose();
              }}
              className="w-full h-12 rounded-xl bg-[#102747] text-white font-medium text-sm"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
