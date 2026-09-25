---
name: webstore-orders
description: Use when the user invokes %webstore-orders or asks about the web store orders module — order lifecycle, status transitions, order history, cancellation, and admin order management.
---

# Web Store — Orders Module

## When to use this skill
Activate when the user types `%webstore-orders` or asks about order lifecycle, status transitions, customer order history, order cancellation, or admin order management.

**Always load first:**
- `%webstore-domain` — Order, OrderItem entity definitions and status machine rules

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

## REST Endpoints

| Method | Path | Visibility | Description |
|---|---|---|---|
| `GET` | `/api/orders` | Customer | Customer's own order list (`?page=`, `?size=`, `?sort=`) |
| `GET` | `/api/orders/{id}` | Customer | Order detail |
| `DELETE` | `/api/orders/{id}` | Customer | Cancel own order (only `PENDING`) |
| `GET` | `/api/admin/orders` | Admin | All orders (`?status=`, `?customerId=`, `?from=`, `?to=`) |
| `GET` | `/api/admin/orders/{id}` | Admin | Full admin order detail |
| `PATCH` | `/api/admin/orders/{id}/status` | Admin | Advance status |
| `DELETE` | `/api/admin/orders/{id}` | Admin | Admin cancel (any cancellable status) |

**PATCH status request body:**
```json
{
  "status": "SHIPPED",
  "trackingCarrier": "FedEx",
  "trackingNumber": "123456789"
}
```

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
1. Load `%webstore-domain` for Order entity definitions and status machine rules.
2. Always validate status transitions against the state machine — never allow direct field assignment.
3. Enforce immutability: only status and tracking fields change after placement.
4. Apply cancellation rules strictly — stock restoration must accompany every cancellation.
5. Respond and assist in English unless the user requests another language.
6. Await further instructions from the user and execute them accordingly within the orders module context.
