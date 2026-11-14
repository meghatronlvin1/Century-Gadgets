import React, { useCallback, useEffect, useState } from "react";
import { Calendar, CheckCircle2, MessageSquare, ShieldCheck, Upload } from "lucide-react";
import { apiRequest, formatUgx } from "../lib/api.ts";
import { resolveMediaUrl } from "../lib/media.ts";
import { useApp } from "../context/AppContext.tsx";
import type { Product, SwapRequestRecord } from "../types.ts";

interface SwapViewProps {
  preselectedTarget?: { product: Product; variantId: number } | null;
  onRequireSignIn: () => void;
}

export const SwapView: React.FC<SwapViewProps> = ({ preselectedTarget, onRequireSignIn }) => {
  const { user, bootstrap, showToast } = useApp();
  const [mode, setMode] = useState<"wizard" | "dashboard">(preselectedTarget ? "wizard" : "wizard");
  const [swaps, setSwaps] = useState<SwapRequestRecord[]>([]);
  const [loadingSwaps, setLoadingSwaps] = useState(false);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const eligibleTargets = (bootstrap?.allProducts ?? []).filter((p) => p.isSwapEligible);
  const [targetProductId, setTargetProductId] = useState<number>(preselectedTarget?.product.id ?? 0);
  const [targetVariantId, setTargetVariantId] = useState<number>(preselectedTarget?.variantId ?? 0);

  const [currentBrand, setCurrentBrand] = useState("Apple");
  const [currentModel, setCurrentModel] = useState("");
  const [currentStorage, setCurrentStorage] = useState("128GB");
  const [currentColor, setCurrentColor] = useState("");
  const [physicalCondition, setPhysicalCondition] = useState<"mint" | "good" | "fair" | "damaged">("good");
  const [batteryCondition, setBatteryCondition] = useState("89% Battery Health");
  const [screenCondition, setScreenCondition] = useState<"flawless" | "minor_scratches" | "cracked">("flawless");
  const [cameraCondition, setCameraCondition] = useState("Clear lenses, autofocus working");
  const [powersOn, setPowersOn] = useState(true);
  const [hasBeenRepaired, setHasBeenRepaired] = useState(false);
  const [includesBoxOrAccessories, setIncludesBoxOrAccessories] = useState("Phone + Original Box");
  const [ownershipDeclared, setOwnershipDeclared] = useState(false);
  const [photos, setPhotos] = useState<Array<{ angleLabel: string; url: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  // Dashboard interaction states
  const [apptDate, setApptDate] = useState("2026-11-20");
  const [apptSlot, setApptSlot] = useState("11:00 AM - 12:00 PM");
  const [apptType, setApptType] = useState<"store_dropoff" | "scheduled_inspection">("scheduled_inspection");
  const [msgDrafts, setMsgDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    if (preselectedTarget) {
      setTargetProductId(preselectedTarget.product.id);
      setTargetVariantId(preselectedTarget.variantId);
      setMode("wizard");
      setStep(2);
    } else if (eligibleTargets.length > 0 && targetProductId === 0) {
      setTargetProductId(eligibleTargets[0].id);
      setTargetVariantId(eligibleTargets[0].variants[0]?.id ?? 0);
    }
  }, [preselectedTarget, eligibleTargets.length]);

  const loadSwaps = useCallback(async () => {
    if (!user) return;
    setLoadingSwaps(true);
    try {
      const res = await apiRequest<{ swaps: SwapRequestRecord[] }>("/swaps");
      setSwaps(res.swaps);
    } catch {
      // ignore
    } finally {
      setLoadingSwaps(false);
    }
  }, [user]);

  useEffect(() => {
    loadSwaps();
  }, [loadSwaps]);

  const selectedTargetProduct = eligibleTargets.find((p) => p.id === targetProductId);
  const selectedTargetVariant = selectedTargetProduct?.variants.find((v) => v.id === targetVariantId) ?? selectedTargetProduct?.variants[0];

  const handlePhotoUpload = async (angleLabel: string, file: File) => {
    if (!user) {
      onRequireSignIn();
      showToast("Please sign in before uploading device photographs", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiRequest<{ url: string }>("/uploads/image", {
          method: "POST",
          body: JSON.stringify({ dataUrl: String(reader.result) }),
        });
        setPhotos((prev) => [...prev.filter((p) => p.angleLabel !== angleLabel), { angleLabel, url: res.url }]);
        showToast(`${angleLabel} photo uploaded`);
      } catch (err: any) {
        showToast(err.message, "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireSignIn();
      showToast("Please sign in to submit your phone swap request", "error");
      return;
    }
    if (!ownershipDeclared) {
      showToast("Please confirm the device ownership and eligibility declaration", "error");
      return;
    }
    if (photos.length === 0) {
      showToast("Please upload at least 1 clear photograph of your device", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ swap: SwapRequestRecord }>("/swaps", {
        method: "POST",
        body: JSON.stringify({
          targetProductId,
          targetVariantId,
          currentBrand,
          currentModel,
          currentStorage,
          currentColor,
          physicalCondition,
          batteryCondition,
          screenCondition,
          cameraCondition,
          powersOn,
          hasBeenRepaired,
          includesBoxOrAccessories,
          ownershipDeclared: true,
          photos,
        }),
      });
      setSwaps((prev) => [res.swap, ...prev]);
      setMode("dashboard");
      setStep(1);
      setPhotos([]);
      setOwnershipDeclared(false);
      showToast(`Swap ${res.swap.swapRef} submitted for staff assessment`);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfferDecision = async (swapId: number, decision: "accepted" | "declined") => {
    try {
      await apiRequest(`/swaps/${swapId}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      await loadSwaps();
      showToast(`Offer ${decision}`);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleBookAppointment = async (swapId: number) => {
    try {
      await apiRequest(`/swaps/${swapId}/appointment`, {
        method: "POST",
        body: JSON.stringify({
          scheduledDate: apptDate,
          timeSlot: apptSlot,
          locationType: apptType,
        }),
      });
      await loadSwaps();
      showToast("Inspection appointment scheduled");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handlePayDifference = async (swapId: number) => {
    try {
      const init = await apiRequest<{ payment: { providerRef: string } }>(`/swaps/${swapId}/pay-difference`, {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "mtn_momo",
          payerPhone: user?.phone || "+256700000000",
          idempotencyKey: `swp-pay-${swapId}-${Date.now()}`,
        }),
      });
      await apiRequest("/payments/sandbox-confirm", {
        method: "POST",
        body: JSON.stringify({
          providerRef: init.payment.providerRef,
          outcome: "successful",
        }),
      });
      await loadSwaps();
      showToast("[SANDBOX] Swap balance payment verified via server webhook");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleSendMessage = async (swapId: number) => {
    const text = (msgDrafts[swapId] || "").trim();
    if (!text) return;
    try {
      await apiRequest(`/swaps/${swapId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMsgDrafts((prev) => ({ ...prev, [swapId]: "" }));
      await loadSwaps();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#102747]">Phone Swap & Trade-In</h1>
          <p className="text-xs text-[#667085]">
            Provisional online estimate followed by physical verification in Kampala — never a binding automated quote
          </p>
        </div>

        <div className="inline-flex p-1 bg-[#E3E8EF]/60 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setMode("wizard")}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              mode === "wizard" ? "bg-white text-[#102747] shadow-xs" : "text-[#667085]"
            }`}
          >
            New Swap Request
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("dashboard");
              loadSwaps();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              mode === "dashboard" ? "bg-white text-[#102747] shadow-xs" : "text-[#667085]"
            }`}
          >
            My Swap Requests ({swaps.length})
          </button>
        </div>
      </div>

      {mode === "wizard" && (
        <div className="bg-white border border-[#E3E8EF] rounded-3xl p-5 md:p-8 space-y-6">
          {/* Stepper Indicator */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { n: 1, label: "Target Device" },
              { n: 2, label: "Current Phone" },
              { n: 3, label: "Device Photos" },
              { n: 4, label: "Declaration" },
            ].map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n as 1 | 2 | 3 | 4)}
                className={`p-2.5 rounded-xl border text-left transition-colors ${
                  step === s.n ? "border-[#102747] bg-[#102747] text-white" : "border-[#E3E8EF] bg-[#F5F7FA] text-[#667085]"
                }`}
              >
                <div className="text-[11px] font-mono">0{s.n}</div>
                <div className="text-xs font-medium truncate">{s.label}</div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmitSwap} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-display font-semibold text-lg text-[#102747]">
                  Step 1: Select the Century Gadgets Phone You Want
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {eligibleTargets.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        setTargetProductId(prod.id);
                        setTargetVariantId(prod.variants[0]?.id ?? 0);
                      }}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-colors ${
                        targetProductId === prod.id
                          ? "border-[#102747] bg-[#F5F7FA]"
                          : "border-[#E3E8EF] bg-white hover:border-[#667085]"
                      }`}
                    >
                      <img
                        src={resolveMediaUrl(prod.primaryImageUrl)}
                        alt={prod.name}
                        className="w-14 h-14 rounded-xl object-cover bg-[#F5F7FA] shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#102747] truncate">{prod.name}</p>
                        <p className="text-xs text-[#667085]">{prod.conditionGrade}</p>
                        <p className="font-mono text-xs font-semibold text-[#102747] tabular-nums mt-0.5">
                          {formatUgx(prod.basePriceUgx)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedTargetProduct && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#102747]">Select Target Variant</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTargetProduct.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setTargetVariantId(v.id)}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-medium ${
                            targetVariantId === v.id
                              ? "border-[#102747] bg-[#102747] text-white"
                              : "border-[#E3E8EF] text-[#102747]"
                          }`}
                        >
                          {v.storage} · {v.color} ({formatUgx(v.priceUgx)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-5 py-2.5 rounded-xl bg-[#102747] text-white text-sm font-medium"
                  >
                    Continue to Current Phone Details
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-display font-semibold text-lg text-[#102747]">
                  Step 2: Describe Your Current Smartphone
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#102747]">Brand</label>
                    <select
                      value={currentBrand}
                      onChange={(e) => setCurrentBrand(e.target.value)}
                      className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm text-[#102747] bg-white"
                    >
                      {["Apple", "Samsung", "Google Pixel", "Tecno", "Infinix", "Redmi / Xiaomi", "Other"].map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#102747]">Model Name</label>
                    <input
                      required
                      value={currentModel}
                      onChange={(e) => setCurrentModel(e.target.value)}
                      placeholder="e.g. iPhone 13 Pro / Galaxy S22"
                      className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm text-[#102747]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#102747]">Storage Capacity</label>
                    <select
                      value={currentStorage}
                      onChange={(e) => setCurrentStorage(e.target.value)}
                      className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm text-[#102747] bg-white"
                    >
                      {["64GB", "128GB", "256GB", "512GB", "1TB"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#102747]">Color</label>
                    <input
                      required
                      value={currentColor}
                      onChange={(e) => setCurrentColor(e.target.value)}
                      placeholder="e.g. Graphite / Phantom Black"
                      className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm text-[#102747]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#102747]">General Physical Condition</label>
                    <select
                      value={physicalCondition}
                      onChange={(e) => setPhysicalCondition(e.target.value as any)}
                      className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm text-[#102747] bg-white"
                    >
                      <option value="mint">Mint — Looks nearly untouched</option>
                      <option value="good">Good — Light everyday wear only</option>
                      <option value="fair">Fair — Visible scuffs or dents</option>
                      <option value="damaged">Damaged — Cracked back or frame bend</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#102747]">Screen Condition</label>
                    <select
                      value={screenCondition}
                      onChange={(e) => setScreenCondition(e.target.value as any)}
                      className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm text-[#102747] bg-white"
                    >
                      <option value="flawless">Flawless — No scratches or dead pixels</option>
                      <option value="minor_scratches">Minor micro-scratches</option>
                      <option value="cracked">Cracked glass / display lines</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#102747]">Battery Condition</label>
                    <input
                      required
                      value={batteryCondition}
                      onChange={(e) => setBatteryCondition(e.target.value)}
                      placeholder="e.g. 89% Battery Health / Lasts full day"
                      className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm text-[#102747]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#102747]">Camera Condition</label>
                    <input
                      required
                      value={cameraCondition}
                      onChange={(e) => setCameraCondition(e.target.value)}
                      className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm text-[#102747]"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-[#102747]">Box & Accessories Included</label>
                    <input
                      required
                      value={includesBoxOrAccessories}
                      onChange={(e) => setIncludesBoxOrAccessories(e.target.value)}
                      className="w-full h-11 rounded-xl border border-[#E3E8EF] px-3 text-sm text-[#102747]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#102747]">
                    <input type="checkbox" checked={powersOn} onChange={(e) => setPowersOn(e.target.checked)} />
                    <span>Phone powers on and charges normally</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#102747]">
                    <input type="checkbox" checked={hasBeenRepaired} onChange={(e) => setHasBeenRepaired(e.target.checked)} />
                    <span>Phone has been opened or repaired previously</span>
                  </label>
                </div>

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl border border-[#E3E8EF] text-sm">
                    Back
                  </button>
                  <button type="button" onClick={() => setStep(3)} className="px-5 py-2.5 rounded-xl bg-[#102747] text-white text-sm font-medium">
                    Continue to Device Photos
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="font-display font-semibold text-lg text-[#102747]">
                  Step 3: Upload Photographs of Your Phone
                </h2>
                <p className="text-xs text-[#667085]">
                  Upload clear photos of the front screen, back glass, and side frame. Supported: PNG, JPEG, WebP up to 3MB.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { key: "front", label: "Front Screen (Powered On)" },
                    { key: "back", label: "Back & Camera Lenses" },
                    { key: "sides", label: "Frame & Charging Port" },
                  ].map((slot) => {
                    const uploaded = photos.find((p) => p.angleLabel === slot.key);
                    return (
                      <div key={slot.key} className="p-4 rounded-2xl border border-[#E3E8EF] bg-[#F5F7FA] space-y-3">
                        <p className="text-xs font-semibold text-[#102747]">{slot.label}</p>
                        {uploaded ? (
                          <div className="space-y-2">
                            <img src={uploaded.url} alt={slot.label} className="w-full h-32 object-cover rounded-xl bg-white" />
                            <p className="text-xs text-[#16A34A] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                            </p>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-32 rounded-xl border border-dashed border-[#667085]/50 bg-white cursor-pointer hover:border-[#102747] text-xs text-[#667085] gap-2">
                            <Upload className="w-5 h-5 text-[#102747]" />
                            <span>Choose Image</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handlePhotoUpload(slot.key, f);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={() => setStep(2)} className="px-4 py-2.5 rounded-xl border border-[#E3E8EF] text-sm">
                    Back
                  </button>
                  <button type="button" onClick={() => setStep(4)} className="px-5 py-2.5 rounded-xl bg-[#102747] text-white text-sm font-medium">
                    Review & Declaration
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <h2 className="font-display font-semibold text-lg text-[#102747]">
                  Step 4: Ownership Declaration & Provisional Summary
                </h2>

                <div className="p-4 rounded-2xl bg-[#F5F7FA] border border-[#E3E8EF] space-y-2 text-xs">
                  <p className="font-semibold text-[#102747]">Swap Summary</p>
                  <p className="text-[#667085]">
                    Target Upgrade: <strong className="text-[#102747]">{selectedTargetProduct?.name}</strong> (
                    {selectedTargetVariant?.storage} · {formatUgx(selectedTargetVariant?.priceUgx ?? 0)})
                  </p>
                  <p className="text-[#667085]">
                    Trading In: <strong className="text-[#102747]">{currentBrand} {currentModel || "(Model)"} ({currentStorage})</strong> ·{" "}
                    {physicalCondition} condition · {photos.length} photo(s) attached
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-[#E3E8EF] bg-white space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-[#667085]">
                    <ShieldCheck className="w-5 h-5 text-[#102747] shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-[#102747]">Device Trade-In & Security Notice</p>
                      <p>
                        Century Gadgets NEVER asks for your Apple ID password, Google password, or screen unlock PIN online. Upon submitting, you receive a provisional estimate only. Final trade-in value is confirmed after physical inspection in Kampala.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-start gap-2.5 text-xs text-[#102747] font-medium cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={ownershipDeclared}
                      onChange={(e) => setOwnershipDeclared(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I declare that I am the lawful owner of this device, it is not carrier-blacklisted or reported lost/stolen, and I will remove Find My / Activation Lock in person only after accepting the final confirmed valuation.
                    </span>
                  </label>
                </div>

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={() => setStep(3)} className="px-4 py-2.5 rounded-xl border border-[#E3E8EF] text-sm">
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 rounded-xl bg-[#102747] text-white text-sm font-semibold hover:bg-[#0B1D36] disabled:opacity-50"
                  >
                    {submitting ? "Submitting Request..." : "Submit Swap Request"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {mode === "dashboard" && (
        <div className="space-y-4">
          {!user ? (
            <div className="bg-white border border-[#E3E8EF] rounded-2xl p-8 text-center space-y-3">
              <p className="font-display font-semibold text-[#102747]">Sign in to track your phone swaps</p>
              <button
                type="button"
                onClick={onRequireSignIn}
                className="px-5 py-2.5 rounded-xl bg-[#102747] text-white text-xs font-medium"
              >
                Go to Account Sign-In
              </button>
            </div>
          ) : loadingSwaps ? (
            <div className="h-48 rounded-2xl bg-white border border-[#E3E8EF] animate-pulse" />
          ) : swaps.length === 0 ? (
            <div className="bg-white border border-[#E3E8EF] rounded-2xl p-8 text-center space-y-3">
              <p className="font-display font-semibold text-[#102747]">No swap requests yet</p>
              <p className="text-xs text-[#667085]">Submit your current device to receive an assessment from our Kampala desk.</p>
              <button
                type="button"
                onClick={() => setMode("wizard")}
                className="px-5 py-2.5 rounded-xl bg-[#102747] text-white text-xs font-medium"
              >
                Start Swap Request
              </button>
            </div>
          ) : (
            swaps.map((sw) => (
              <div key={sw.id} className="bg-white border border-[#E3E8EF] rounded-2xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-[#E3E8EF]">
                  <div>
                    <p className="font-mono text-xs text-[#667085]">
                      {sw.swapRef} · Status: <strong className="text-[#102747]">{sw.status.replace(/_/g, " ")}</strong>
                    </p>
                    <h3 className="font-display font-bold text-base text-[#102747]">
                      {sw.currentBrand} {sw.currentModel} ({sw.currentStorage}) → {sw.targetProduct?.name}
                    </h3>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-xs text-[#667085]">
                      {sw.finalConfirmedValuationUgx
                        ? "Confirmed Trade-In Value"
                        : sw.offeredValuationUgx
                          ? "Staff Offer Valuation"
                          : "Provisional Estimate (Not Final)"}
                    </p>
                    <p className="font-mono font-bold text-sm text-[#102747] tabular-nums">
                      {formatUgx(sw.finalConfirmedValuationUgx ?? sw.offeredValuationUgx ?? sw.provisionalEstimateUgx)}
                      <span className="text-xs font-normal text-[#667085]">
                        {" "}
                        · Balance {formatUgx(sw.payableDifferenceUgx)}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Offer Accept / Decline */}
                {sw.status === "offer_issued" && (
                  <div className="p-4 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs">
                      <p className="font-semibold text-[#102747]">Staff Valuation Offer Issued</p>
                      <p className="text-[#667085]">{sw.staffNotes || "Review our trade-in valuation and decide below."}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOfferDecision(sw.id, "declined")}
                        className="px-4 py-2 rounded-xl border border-[#DC2626] text-[#DC2626] text-xs font-medium"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOfferDecision(sw.id, "accepted")}
                        className="px-4 py-2 rounded-xl bg-[#102747] text-white text-xs font-medium"
                      >
                        Accept Offer
                      </button>
                    </div>
                  </div>
                )}

                {/* Book Inspection Appointment */}
                {sw.status === "offer_accepted" && (
                  <div className="p-4 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF] space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#102747]">
                      <Calendar className="w-4 h-4" />
                      <span>Book Kampala Physical Inspection / Store Drop-Off</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="date"
                        value={apptDate}
                        onChange={(e) => setApptDate(e.target.value)}
                        className="rounded-xl border border-[#E3E8EF] px-3 py-2 text-xs bg-white"
                      />
                      <select
                        value={apptSlot}
                        onChange={(e) => setApptSlot(e.target.value)}
                        className="rounded-xl border border-[#E3E8EF] px-3 py-2 text-xs bg-white"
                      >
                        <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
                        <option value="11:00 AM - 12:00 PM">11:00 AM - 12:00 PM</option>
                        <option value="2:00 PM - 3:00 PM">2:00 PM - 3:00 PM</option>
                        <option value="4:30 PM - 5:30 PM">4:30 PM - 5:30 PM</option>
                      </select>
                      <select
                        value={apptType}
                        onChange={(e) => setApptType(e.target.value as any)}
                        className="rounded-xl border border-[#E3E8EF] px-3 py-2 text-xs bg-white"
                      >
                        <option value="scheduled_inspection">Scheduled Inspection</option>
                        <option value="store_dropoff">Store Drop-Off</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBookAppointment(sw.id)}
                      className="px-4 py-2 rounded-xl bg-[#102747] text-white text-xs font-medium"
                    >
                      Confirm Appointment
                    </button>
                  </div>
                )}

                {/* Pay Confirmed Balance */}
                {sw.status === "awaiting_payment" && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-amber-900">
                      <p className="font-semibold">Inspection Verified — Pay Remaining Balance</p>
                      <p>Confirmed payable difference: {formatUgx(sw.payableDifferenceUgx)} (Sandbox Mobile Money)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePayDifference(sw.id)}
                      className="px-4 py-2 rounded-xl bg-[#102747] text-white text-xs font-medium shrink-0"
                    >
                      Pay Balance (Sandbox)
                    </button>
                  </div>
                )}

                {/* Valuation Audit Trail & Timeline */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-[#102747]">Valuation History</p>
                    {sw.valuations.map((v) => (
                      <div key={v.id} className="p-2.5 rounded-xl bg-[#F5F7FA] border border-[#E3E8EF]">
                        <div className="flex justify-between font-medium text-[#102747]">
                          <span>{v.stage.replace(/_/g, " ")}</span>
                          <span className="font-mono tabular-nums">{formatUgx(v.amountUgx)}</span>
                        </div>
                        <p className="text-[#667085] mt-0.5">{v.notes}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <p className="font-semibold text-[#102747]">Status & Messages</p>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {sw.statusHistory.map((h) => (
                        <div key={h.id} className="text-[#667085]">
                          <strong className="text-[#102747]">{h.toStatus.replace(/_/g, " ")}</strong> — {h.note}
                        </div>
                      ))}
                      {sw.messages.map((m) => (
                        <div key={m.id} className="p-2 rounded-lg bg-[#F5F7FA] text-[#102747]">
                          <span className="font-semibold">{m.senderRole === "staff" ? "Century Staff" : "You"}:</span> {m.message}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={msgDrafts[sw.id] || ""}
                        onChange={(e) => setMsgDrafts((prev) => ({ ...prev, [sw.id]: e.target.value }))}
                        placeholder="Ask staff a question..."
                        className="flex-1 rounded-xl border border-[#E3E8EF] px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendMessage(sw.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#102747] text-white text-xs inline-flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
