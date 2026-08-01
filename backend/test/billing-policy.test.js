import test from "node:test";
import assert from "node:assert/strict";

import { isFullRefund, stripeSubscriptionState } from "../billing-policy.js";

const subscription = {
  id: "sub_123",
  customer: "cus_123",
  status: "active",
  current_period_end: 2000,
  metadata: { userId: "7", plan: "family" },
};

test("activates only a confirmed unexpired Stripe subscription", () => {
  assert.deepEqual(stripeSubscriptionState(subscription, 1000), {
    id: "sub_123", customerId: "cus_123", userId: "7", plan: "family",
    status: "active", active: true, periodEnd: 2000,
  });
  assert.equal(stripeSubscriptionState({ ...subscription, current_period_end: 900 }, 1000).active, false);
  assert.equal(stripeSubscriptionState({ ...subscription, status: "incomplete" }, 1000).active, false);
  assert.equal(stripeSubscriptionState({ ...subscription, status: "past_due" }, 1000).active, false);
  assert.equal(stripeSubscriptionState({ ...subscription, status: "canceled" }, 1000).active, true);
});

test("does not grant active access without current_period_end", () => {
  const state = stripeSubscriptionState({ ...subscription, current_period_end: null }, 1000);
  assert.equal(state.active, false);
  assert.equal(state.status, "incomplete");
});

test("falls back from unknown client plan metadata", () => {
  const state = stripeSubscriptionState({ ...subscription, metadata: { userId: "7", plan: "admin" } }, 1000);
  assert.equal(state.plan, "monthly");
});

test("resolves plan from stripe price when metadata is absent", () => {
  const state = stripeSubscriptionState(
    {
      ...subscription,
      metadata: {},
      items: {
        data: [
          { price: { id: "price_yearly_123" } },
        ],
      },
    },
    1000,
    { price_yearly_123: "yearly" }
  );
  assert.equal(state.plan, "yearly");
});

test("recognizes only a complete charge refund", () => {
  assert.equal(isFullRefund({ amount: 1000, amount_refunded: 1000, refunded: true }), true);
  assert.equal(isFullRefund({ amount: 1000, amount_refunded: 500, refunded: true }), false);
});
