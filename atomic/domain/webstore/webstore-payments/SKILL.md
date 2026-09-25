---
name: webstore-payments
description: Web store payments module rules: starting payments with Stripe, PayPal or Mercado Pago, signature-verified idempotent webhooks, payment status flow, refunds, and card-data security. Use when integrating a payment gateway or handling payment callbacks in the web store.
---

# Web Store — Payments Module

## Related skills

> Skills referenced by name below are sibling skills in this library. Load each one with the Skill tool (or `/<skill-name>`) before continuing; do not guess their content.

**Always load first:**
- `webstore-domain` — Payment entity definitions and status rules

---

## Responsibilities
- Initiate payment sessions with the configured gateway.
- Receive and verify gateway webhook notifications.
- Update order status based on payment outcomes.
- Handle refunds triggered by order cancellations.

---

## Use Cases

| Use Case | Description |
|---|---|
| `InitiatePayment` | Create a gateway payment session for a `PENDING` order; return redirect URL or client secret |
| `HandlePaymentWebhook` | Receive gateway callback; verify signature; update Payment and Order status |
| `InitiateRefund` | Request refund from gateway for a `SUCCEEDED` payment; update status to `REFUNDED` |
| `GetPaymentStatus` | Return current payment status for an order |

---

## API

Endpoints, access rules and DTOs are defined only in the `webstore-api-contract` skill; load it before writing or calling an endpoint. For this module see the Payments section.

- Webhook endpoints are **public** (no auth) but **signature-verified**.
- All webhook handlers must be **idempotent**: processing the same event twice produces the same result.

---

## Idempotency Rules
1. Every payment attempt generates a unique `idempotencyKey` (UUID v4).
2. The `idempotencyKey` is sent as a header to the gateway on every API call.
3. On duplicate webhook delivery (same `gatewayReference`), return `200 OK` without reprocessing.
4. Store `gatewayReference` on first successful webhook; use it to detect duplicates.

---

## Gateway Integration

### Stripe
- API: `PaymentIntent` (server-side) + `confirmPayment` (client-side).
- Webhook event: `payment_intent.succeeded` → set order to `PAID`.
- Failure event: `payment_intent.payment_failed` → set payment to `FAILED`.
- Refund: `stripe.refunds.create({ payment_intent: ... })`.
- Signature verification: `Webhook.constructEvent(payload, sig, secret)`.

### PayPal
- API: Orders API v2 — `POST /v2/checkout/orders` → redirect to approval URL.
- Webhook event: `CHECKOUT.ORDER.APPROVED` → capture → `PAYMENT.CAPTURE.COMPLETED` → set order to `PAID`.
- Refund: `POST /v2/payments/captures/{id}/refund`.
- Signature verification: verify `PAYPAL-TRANSMISSION-SIG` header.

### Mercado Pago
- API: Preferences API — `POST /checkout/preferences` → redirect to checkout URL.
- Webhook (IPN): `payment` topic with `payment.status = approved` → set order to `PAID`.
- Refund: `POST /v1/payments/{id}/refunds`.
- Signature verification: validate `x-signature` header using HMAC-SHA256.

---

## Payment Status Flow

```
PENDING ──► SUCCEEDED ──► REFUNDED
   │
   └──────► FAILED
```

- `PENDING → SUCCEEDED`: gateway confirms payment.
- `SUCCEEDED → REFUNDED`: refund processed by gateway.
- `PENDING → FAILED`: gateway reports failure; order remains `PENDING` (customer may retry).
- A failed payment does **not** cancel the order — the customer may attempt payment again.

---

## Security Rules
1. Never log full card numbers, CVVs, or raw gateway secrets.
2. Always verify webhook signatures before processing any payload.
3. Store only `gatewayReference` and `idempotencyKey` — never raw card data.
4. Webhook endpoints must reject requests with invalid signatures with `400 Bad Request`.

---

## How to use this skill
1. Load `webstore-domain` for the Payment entity and status definitions.
2. Always implement webhook handlers as idempotent operations.
3. Use the gateway-specific integration notes for the correct API calls and webhook event names.
4. Enforce all security rules — never store sensitive card data.
