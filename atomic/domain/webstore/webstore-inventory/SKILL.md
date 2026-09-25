---
name: webstore-inventory
description: Web store inventory module rules: stock levels, deducting stock at checkout with optimistic locking, optional reservations, restocking, low-stock alerts, manual admin adjustments, and the stock audit log. Use when working on stock management in the web store.
---

# Web Store — Inventory Module

## Related skills

> Skills referenced by name below are sibling skills in this library. Load each one with the Skill tool (or `/<skill-name>`) before continuing; do not guess their content.

**Always load first:**
- `webstore-domain` — Product entity, `StockReduced`, `StockRestored`, `StockBelowThreshold` domain events

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

## API

Endpoints, access rules and DTOs are defined only in the `webstore-api-contract` skill; load it before writing or calling an endpoint. For this module see the Admin — inventory section (`/api/admin/inventory/**`).

- A positive `delta` adds stock. A negative `delta` is a manual write-off.
- A `delta` that would make `stockQuantity < 0` is rejected.

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
1. Load `webstore-domain` for Product entity and stock-related domain events.
2. Always use optimistic locking for `DeductStock` — never issue a plain update without version check.
3. Record every stock change in the audit log.
4. Use the reservation pattern only when checkout abandonment rate is high enough to justify the complexity.
