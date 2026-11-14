import crypto from "crypto";

export interface CartLineInput {
  unitPriceUgx: number;
  quantity: number;
}

export interface DiscountInput {
  code: string;
  discountType: string; // 'percentage' | 'fixed_ugx'
  value: number;
  minOrderUgx: number;
  isActive: boolean;
}

export function calculateCartTotals(
  items: CartLineInput[],
  discount: DiscountInput | null,
  deliveryFeeUgx: number
) {
  const subtotalUgx = items.reduce(
    (sum, item) => sum + Math.max(0, item.unitPriceUgx) * Math.max(0, item.quantity),
    0
  );

  let discountUgx = 0;
  let appliedDiscountCode: string | null = null;

  if (discount && discount.isActive && subtotalUgx >= discount.minOrderUgx && subtotalUgx > 0) {
    if (discount.discountType === "percentage") {
      discountUgx = Math.round((subtotalUgx * Math.min(100, Math.max(0, discount.value))) / 100);
    } else {
      discountUgx = Math.min(subtotalUgx, Math.max(0, discount.value));
    }
    appliedDiscountCode = discount.code;
  }

  const normalizedDeliveryFee = subtotalUgx > 0 ? Math.max(0, deliveryFeeUgx) : 0;
  const totalUgx = Math.max(0, subtotalUgx - discountUgx + normalizedDeliveryFee);

  return {
    subtotalUgx,
    discountUgx,
    deliveryFeeUgx: normalizedDeliveryFee,
    totalUgx,
    appliedDiscountCode,
  };
}

export interface ProvisionalSwapInput {
  targetPriceUgx: number;
  currentBrand: string;
  physicalCondition: "mint" | "good" | "fair" | "damaged";
  screenCondition: "flawless" | "minor_scratches" | "cracked";
  powersOn: boolean;
  hasBeenRepaired: boolean;
  includesBoxOrAccessories: string;
}

export function calculateProvisionalSwapEstimate(input: ProvisionalSwapInput) {
  if (!input.powersOn) {
    const fallbackEstimate = 120000;
    return {
      provisionalEstimateUgx: fallbackEstimate,
      provisionalPayableDifferenceUgx: Math.max(0, input.targetPriceUgx - fallbackEstimate),
      isProvisional: true,
    };
  }

  const brandBaseMap: Record<string, number> = {
    Apple: 1450000,
    Samsung: 1050000,
    "Google Pixel": 900000,
    Tecno: 420000,
    Infinix: 380000,
    "Redmi / Xiaomi": 480000,
  };

  let base = brandBaseMap[input.currentBrand] ?? 450000;

  const conditionFactor: Record<string, number> = {
    mint: 1.0,
    good: 0.84,
    fair: 0.65,
    damaged: 0.38,
  };
  base = Math.round(base * (conditionFactor[input.physicalCondition] ?? 0.7));

  if (input.screenCondition === "minor_scratches") {
    base = Math.round(base * 0.9);
  } else if (input.screenCondition === "cracked") {
    base = Math.round(base * 0.55);
  }

  if (input.hasBeenRepaired) {
    base = Math.round(base * 0.85);
  }

  if (input.includesBoxOrAccessories.toLowerCase().includes("box")) {
    base += 60000;
  }

  // Cap provisional estimate at 75% of target device price so store terms stay realistic
  const capped = Math.min(base, Math.round(input.targetPriceUgx * 0.75));
  const provisionalEstimateUgx = Math.max(100000, Math.round(capped / 10000) * 10000);

  return {
    provisionalEstimateUgx,
    provisionalPayableDifferenceUgx: Math.max(0, input.targetPriceUgx - provisionalEstimateUgx),
    isProvisional: true,
  };
}

export function calculateSwapDifference(targetPriceUgx: number, valuationUgx: number) {
  return Math.max(0, targetPriceUgx - Math.max(0, valuationUgx));
}

export function signPaymentWebhookPayload(payloadString: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
}

export function verifyPaymentWebhookSignature(
  payloadString: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const expected = signPaymentWebhookPayload(payloadString, secret);
  const providedBuf = Buffer.from(signatureHeader, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ["paid", "confirmed", "cancelled"],
  paid: ["confirmed", "processing", "refund_pending", "cancelled"],
  confirmed: ["processing", "ready_for_collection", "dispatched", "cancelled", "refund_pending"],
  processing: ["ready_for_collection", "dispatched", "cancelled", "refund_pending"],
  ready_for_collection: ["delivered", "cancelled", "refund_pending"],
  dispatched: ["delivered", "refund_pending"],
  delivered: ["refund_pending"],
  cancelled: [],
  refund_pending: ["refunded", "cancelled"],
  refunded: [],
};

export function isValidOrderTransition(fromStatus: string, toStatus: string): boolean {
  if (fromStatus === toStatus) return true;
  return (ORDER_TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

export const SWAP_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "more_info_required",
  "inspection_scheduled",
  "inspection_completed",
  "offer_issued",
  "offer_accepted",
  "offer_declined",
  "awaiting_payment",
  "awaiting_exchange",
  "completed",
  "cancelled",
] as const;

const SWAP_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "more_info_required", "offer_issued", "cancelled"],
  under_review: ["more_info_required", "offer_issued", "inspection_scheduled", "cancelled"],
  more_info_required: ["under_review", "submitted", "offer_issued", "cancelled"],
  offer_issued: ["offer_accepted", "offer_declined", "more_info_required", "cancelled"],
  offer_accepted: ["inspection_scheduled", "awaiting_payment", "awaiting_exchange", "cancelled"],
  offer_declined: ["under_review", "cancelled"],
  inspection_scheduled: ["inspection_completed", "cancelled"],
  inspection_completed: ["offer_issued", "awaiting_payment", "awaiting_exchange", "completed", "cancelled"],
  awaiting_payment: ["awaiting_exchange", "completed", "cancelled"],
  awaiting_exchange: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isValidSwapTransition(fromStatus: string, toStatus: string): boolean {
  if (fromStatus === toStatus) return true;
  return (SWAP_TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

export function formatUgx(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString("en-UG")}`;
}
