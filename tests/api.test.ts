import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCartTotals,
  calculateProvisionalSwapEstimate,
  calculateSwapDifference,
  isValidOrderTransition,
  isValidSwapTransition,
  signPaymentWebhookPayload,
  verifyPaymentWebhookSignature,
} from "../src/server/domain.ts";
import { signAppToken, verifyAppToken } from "../src/server/auth.ts";

describe("Century Gadgets Domain Business Logic", () => {
  it("calculates server-side UGX cart totals with fixed and percentage discounts", () => {
    const fixed = calculateCartTotals(
      [
        { unitPriceUgx: 4250000, quantity: 1 },
        { unitPriceUgx: 125000, quantity: 2 },
      ],
      {
        code: "WELCOME50",
        discountType: "fixed_ugx",
        value: 50000,
        minOrderUgx: 1000000,
        isActive: true,
      },
      10000
    );

    assert.equal(fixed.subtotalUgx, 4500000);
    assert.equal(fixed.discountUgx, 50000);
    assert.equal(fixed.deliveryFeeUgx, 10000);
    assert.equal(fixed.totalUgx, 4460000);
    assert.equal(fixed.appliedDiscountCode, "WELCOME50");

    const pct = calculateCartTotals(
      [{ unitPriceUgx: 1000000, quantity: 1 }],
      {
        code: "LEARNER5",
        discountType: "percentage",
        value: 5,
        minOrderUgx: 200000,
        isActive: true,
      },
      0
    );
    assert.equal(pct.discountUgx, 50000);
    assert.equal(pct.totalUgx, 950000);
  });

  it("ignores discount codes when subtotal is below minimum threshold", () => {
    const res = calculateCartTotals(
      [{ unitPriceUgx: 125000, quantity: 1 }],
      {
        code: "WELCOME50",
        discountType: "fixed_ugx",
        value: 50000,
        minOrderUgx: 1000000,
        isActive: true,
      },
      10000
    );
    assert.equal(res.discountUgx, 0);
    assert.equal(res.appliedDiscountCode, null);
    assert.equal(res.totalUgx, 135000);
  });

  it("computes provisional swap estimates labelled non-final and calculates payable difference", () => {
    const est = calculateProvisionalSwapEstimate({
      targetPriceUgx: 4250000,
      currentBrand: "Apple",
      physicalCondition: "good",
      screenCondition: "flawless",
      powersOn: true,
      hasBeenRepaired: false,
      includesBoxOrAccessories: "Original Box",
    });

    assert.equal(est.isProvisional, true);
    assert.ok(est.provisionalEstimateUgx > 0);
    assert.equal(
      est.provisionalPayableDifferenceUgx,
      4250000 - est.provisionalEstimateUgx
    );

    assert.equal(calculateSwapDifference(4250000, 1800000), 2450000);
    assert.equal(calculateSwapDifference(1000000, 1200000), 0);
  });

  it("verifies HMAC-SHA256 payment webhook signatures securely", () => {
    const secret = "test-webhook-secret";
    const body = JSON.stringify({ providerRef: "PAY-SBX-12345", status: "successful" });
    const sig = signPaymentWebhookPayload(body, secret);

    assert.equal(verifyPaymentWebhookSignature(body, sig, secret), true);
    assert.equal(verifyPaymentWebhookSignature(body, "tampered-sig", secret), false);
    assert.equal(verifyPaymentWebhookSignature(body, undefined, secret), false);
  });

  it("enforces valid order and swap status state transitions", () => {
    assert.equal(isValidOrderTransition("pending_payment", "paid"), true);
    assert.equal(isValidOrderTransition("delivered", "pending_payment"), false);
    assert.equal(isValidOrderTransition("refunded", "paid"), false);

    assert.equal(isValidSwapTransition("submitted", "offer_issued"), true);
    assert.equal(isValidSwapTransition("offer_issued", "offer_accepted"), true);
    assert.equal(isValidSwapTransition("completed", "submitted"), false);
  });

  it("issues and validates short-lived signed access tokens", () => {
    const token = signAppToken("uid-123", "customer@centurygadgets.ug", "access");
    const decoded = verifyAppToken(token);
    assert.ok(decoded);
    assert.equal(decoded.uid, "uid-123");
    assert.equal(decoded.type, "access");
    assert.equal(verifyAppToken(`${token}x`), null);
  });
});
