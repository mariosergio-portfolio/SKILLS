---
name: webstore-orders
description: Web store orders module rules: the order status machine (PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED), allowed transitions, customer vs admin cancellation, stock restoration, immutability after placement, and order history. Use when working on order lifecycle or fulfilment in the web store.
---

# Web Store — Orders Module

## Related skills

> Skills referenced by name below are sibling skills in this library. Load each one with the Skill tool (or `/<skill-name>`) before continuing; do not guess their content.

**Always load first:**
- `webstore-domain` — Order, OrderItem entity definitions and status machine rules

---

## Responsibilities
- Manage the order lifecycle after placement.
- Expose order history to customers.
- Allow admin to advance order status and manage fulfillment.
- Handle cancellations and trigger compensating actions (stock restore, refund initiation).

---

## Order Status Machine

```
PENDING ──► PAID ──► PROCESSING ──► SHIPPED ──► DELIVERED
   │          │
   └──────────┴──────────────────────────────────► CANCELLED
```

- `PENDING → PAID`: triggered by payment webhook.
- `PAID → PROCESSING`: admin confirms fulfillment start.
- `PROCESSING → SHIPPED`: admin marks as shipped (sets tracking info).
- `SHIPPED → DELIVERED`: admin or carrier webhook confirms delivery.
- `PENDING → CANCELLED`: customer or admin cancels before payment.
- `PAID → CANCELLED`: admin cancels after payment (triggers refund initiation).
- No other transitions are allowed.

---

## Use Cases

### Customer
| Use Case | Description |
|---|---|
| `ListCustomerOrders` | Paginated order history for the authenticated customer |
| `GetOrderDetail` | Full order detail including items, totals, status, and shipping info |
| `CancelOrder` | Cancel an order in `PENDING` status; emit `OrderCancelled`, trigger `RestoreStock` |

### Admin
| Use Case | Description |
|---|---|
| `ListAllOrders` | Paginated list of all orders with filters (status, date range, customerId) |
| `AdvanceOrderStatus` | Move order to the next valid status; validate transition rules |
| `SetShippingTracking` | Attach carrier and tracking number when advancing to `SHIPPED` |
| `AdminCancelOrder` | Cancel from `PENDING` or `PAID`; if `PAID`, initiate refund |

---

## API

Endpoints, access rules and DTOs are defined only in the `webstore-api-contract` skill; load it before writing or calling an endpoint. For this module see the Checkout and orders section (customer) and Admin — orders section.

---

## Cancellation Rules
1. Customer can only cancel orders in `PENDING` status.
2. Admin can cancel orders in `PENDING` or `PAID` status.
3. On cancellation:
   - Emit `OrderCancelled` event.
   - Emit `StockRestored` per item → inventory use case restores stock.
   - If status was `PAID` → initiate refund via Payment module.
4. Orders in `PROCESSING`, `SHIPPED`, or `DELIVERED` cannot be cancelled (require manual intervention).

---

## Immutability Rules
- `OrderItem` records are never modified after placement.
- `Order.total`, `subtotal`, `discountAmount`, `shippingCost` are frozen at placement.
- Only `status`, `trackingCarrier`, `trackingNumber`, and `updatedAt` may change post-placement.

---

## How to use this skill
1. Load `webstore-domain` for Order entity definitions and status machine rules.
2. Always validate status transitions against the state machine — never allow direct field assignment.
3. Enforce immutability: only status and tracking fields change after placement.
4. Apply cancellation rules strictly — stock restoration must accompany every cancellation.
