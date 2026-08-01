const ACTIVE_STRIPE_STATUSES = new Set([
  "active",
  "trialing",
  "canceled"
]);
const KNOWN_PLANS = new Set([
  "monthly", "semiannual", "yearly", "family", "family_semiannual", "family_yearly"
]);
const KNOWN_PLAN_SOURCE = new Set(KNOWN_PLANS);

function resolvePlan(subscription, fallbackPlan = "monthly", pricePlanMap = null) {
  const requestedPlan = String(subscription?.metadata?.plan ?? "").trim().toLowerCase();
  if (KNOWN_PLAN_SOURCE.has(requestedPlan)) return requestedPlan;

  const candidatePlan = String(
    subscription?.plan?.metadata?.plan ??
    subscription?.price?.metadata?.plan ??
    ""
  ).trim().toLowerCase();
  if (KNOWN_PLAN_SOURCE.has(candidatePlan)) return candidatePlan;

  const priceId = String(
    subscription?.plan?.id ??
    subscription?.items?.data?.[0]?.price?.id ??
    subscription?.items?.data?.[0]?.plan?.id ??
    ""
  ).trim();
  if (priceId && pricePlanMap && pricePlanMap[priceId]) {
    return pricePlanMap[priceId];
  }

  return KNOWN_PLAN_SOURCE.has(fallbackPlan) ? fallbackPlan : "monthly";
}

export function stripeSubscriptionState(subscription, nowSeconds = Math.floor(Date.now() / 1000), pricePlanMap = null) {
  const status = String(subscription?.status ?? "incomplete");
  const periodEnd = Number(subscription?.current_period_end ?? 0);
  const active = ACTIVE_STRIPE_STATUSES.has(status) &&
    Number.isFinite(periodEnd) && periodEnd > nowSeconds;
  return {
    id: String(subscription?.id ?? ""),
    customerId: String(subscription?.customer ?? ""),
    userId: String(subscription?.metadata?.userId ?? ""),
    plan: resolvePlan(subscription, "monthly", pricePlanMap),
    status: active ? status : status === "active" ? "incomplete" : status,
    active,
    periodEnd: Number.isFinite(periodEnd) && periodEnd > 0 ? periodEnd : 0,
  };
}

export function isFullRefund(charge) {
  const amount = Number(charge?.amount ?? 0);
  const refunded = Number(charge?.amount_refunded ?? 0);
  return charge?.refunded === true && amount > 0 && refunded >= amount;
}
