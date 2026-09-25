---
name: webstore-inventory
description: Use when the user invokes %webstore-inventory or asks about the web store inventory module — stock levels, stock deduction, reservation, restocking, low-stock alerts, and admin inventory adjustments.
---

# Web Store — Inventory Module

## When to use this skill
Activate when the user types `%webstore-inventory` or asks about stock management: checking levels, deducting stock at checkout, reserving stock, restoring stock on cancellation, low-stock alerts, or admin inventory adjustments.

**Always load first:**
- `%webstore-domain` — Product entity, `StockReduced`, `StockRestored`, `StockBelowThreshold` domain events

---

## Responsibilities
- Track stock levels per product.
- Deduct stock atomically at order placement (optimistic locking).
- Restore stock on order cancellation.
- Emit low-stock alerts when quantity falls below threshold.
- Provide admin tools for manual inventory adjustments and auditing.

---

## Use Cases

| Use Case | Description |
|---|---|
| `GetStockLevel` | Return current `stockQuantity` (and `reservedQuantity` if used) for a product |
| `DeductStock` | Atomically reduce `stockQuantity` by order quantities; called inside `PlaceOrder` transaction |
| `RestoreStock` | Increment `stockQuantity` on order cancellation; emit `StockRestored` |
| `ReserveStock` | (Optional) Temporarily hold stock during checkout window; releases on timeout or completion |
| `AdjustStock` | Admin manual adjustment (increase or decrease); records reason and actor |
| `CheckLowStock` | Evaluate if `stockQuantity < reorderPoint`; emit `StockBelowThreshold` if true |

---

## REST Endpoints

| Method | Path | Visibility | Description |
|---|---|---|---|
| `GET` | `/api/inventory/{productId}` | Admin | Get stock level for a product |
| `PATCH` | `/api/inventory/{productId}` | Admin | Manual stock adjustment |
| `GET` | `/api/inventory` | Admin | List all products with stock (`?lowStock=true` filter) |

**PATCH adjustment request body:**
```json
{
  "delta": 50,
  "reason": "Supplier delivery",
  "actor": "admin@store.com"
}
```
- Positive `delta`: stock in. Negative `delta`: stock out (manual write-off).
- `delta` resulting in `stockQuantity < 0` is rejected.

---

## Optimistic Locking
- `Product.stockQuantity` has a `@Version` (JPA) / `rowVersion` (EF Core) field.
- `DeductStock` issues a conditional update: `UPDATE product SET stock_quantity = stock_quantity - ? WHERE id = ? AND version = ?`.
- On version mismatch (`OptimisticLockException`), retry once; on second failure return `409 Conflict`.
- This prevents overselling under concurrent checkout requests.

---

## Stock Reservation (Optional Pattern)
- Add `reservedQuantity` field to Product.
- On checkout start: `reservedQuantity += orderQuantity`, `stockQuantity` unchanged.
- On `PlaceOrder`: convert reservation → deduction (`reservedQuantity -= qty`, `stockQuantity -= qty`).
- On checkout timeout or abandonment: release reservation (`reservedQuantity -= qty`).
- Available stock for display = `stockQuantity - reservedQuantity`.

---

## Low-Stock Alert Rules
- `reorderPoint` is a configurable threshold per product (default: 5).
- After every `DeductStock`, check: if `stockQuantity < reorderPoint` → emit `StockBelowThreshold`.
- `StockBelowThreshold` is consumed by a notification adapter (email/Slack to admin).
- Do not emit the event if it was already emitted within the last 24 hours for the same product (debounce).

---

## Audit Log
- Every stock change (deduction, restoration, adjustment) must be recorded in an `InventoryAuditLog` table.
- Fields: `id`, `productId`, `changeType` (`DEDUCTION` | `RESTORATION` | `ADJUSTMENT`), `delta`, `reason`, `actor`, `orderId` (nullable), `createdAt`.

---

## How to use this skill
1. Load `%webstore-domain` for Product entity and stock-related domain events.
2. Always use optimistic locking for `DeductStock` — never issue a plain update without version check.
3. Record every stock change in the audit log.
4. Use the reservation pattern only when checkout abandonment rate is high enough to justify the complexity.
5. Respond and assist in English unless the user requests another language.
6. Await further instructions from the user and execute them accordingly within the inventory module context.
