---
name: webstore-checkout
description: Web store checkout rules: the step-by-step PlaceOrder flow, a single atomic transaction for stock deduction and order creation, price freeze on order lines, total calculation, cart clearing, and error scenarios (409/422). Use when implementing or reviewing order placement in the web store.
---

# Web Store — Checkout Module

## Related skills

> Skills referenced by name below are sibling skills in this library. Load each one with the Skill tool (or `/<skill-name>`) before continuing; do not guess their content.

**Always load first:**
- `webstore-domain` — Order, OrderItem, Cart, CartItem entity definitions and rules
- `webstore-cart` — cart validation and price refresh rules

---

## Responsibilities
- Orchestrate the transition from Cart → Order.
- Validate cart contents (stock, prices, shipping address) before placement.
- Atomically deduct stock, freeze prices, create the order, and clear the cart.
- Emit `OrderPlaced` domain event for downstream processing.

---

## Checkout Flow (step-by-step)

```
1. GET /api/cart          → validate: all items in stock, prices refreshed
2. Customer provides      → shippingAddress, shippingMethod (+ billingAddress optional)
3. POST /api/orders       → atomic transaction:
      a. Re-check stock for each item (optimistic lock on Product.stockQuantity)
      b. Freeze prices → create OrderItem with unitPrice = CartItem.unitPrice
      c. Compute subtotal, apply coupon → discountAmount, add shippingCost → total
      d. Create Order with status = PENDING
      e. Emit StockReduced per item
      f. Clear Cart
      g. Emit OrderPlaced
4. POST /api/payments     → initiate payment with gateway
5. Webhook callback       → gateway confirms payment → Order status = PAID → emit OrderPaid
6. Async fulfillment      → send confirmation email, trigger warehouse processing
```

---

## Use Cases

| Use Case | Description |
|---|---|
| `ValidateCart` | Verify all cart items are in stock and prices are current before checkout |
| `PlaceOrder` | Atomic: deduct stock, freeze prices, create order, clear cart, emit events |
| `CalculateOrderTotals` | Compute subtotal, apply discount, add shipping cost, return total |

---

## API

Endpoints, access rules and DTOs are defined only in the `webstore-api-contract` skill; load it before writing or calling an endpoint. For this module see the `POST /api/orders` with `PlaceOrderRequest`. It returns the created `Order` with status `PENDING`, and its `id` is used to start payment.

---

## Atomicity Requirements
- Stock deduction and order creation **must happen in a single database transaction**.
- Use optimistic locking (`@Version` / `rowVersion`) on `Product.stockQuantity`.
- On `OptimisticLockException`, retry once; if it fails again, return `409 Conflict` with item-level stock details.
- Cart is cleared **only after** the order is successfully persisted.

---

## Price Freeze Rules
- `OrderItem.unitPrice` = `CartItem.unitPrice` at the moment of `PlaceOrder`.
- If price has changed since last cart refresh, placement is allowed — the last refreshed price is used (never the current live price fetched inside the transaction).
- `lineTotal = unitPrice × quantity` is computed and stored; never recalculated from product.

---

## Total Calculation
```
subtotal        = Σ (OrderItem.unitPrice × quantity)
discountAmount  = coupon applied to subtotal (PERCENTAGE or FIXED_AMOUNT)
shippingCost    = from ShippingMethod selected
total           = subtotal - discountAmount + shippingCost
```
- `total` must be > 0 after all discounts.
- `discountAmount` cannot exceed `subtotal`.

---

## Error Scenarios

| Scenario | HTTP Status | Detail |
|---|---|---|
| One or more items out of stock | `409 Conflict` | List of unavailable items with available quantities |
| Cart is empty | `422 Unprocessable Entity` | Cart must have at least one item |
| Invalid shipping address | `422 Unprocessable Entity` | Field-level validation errors |
| Invalid coupon at placement | `422 Unprocessable Entity` | Coupon expired, used up, or minimum not met |
| Concurrent stock conflict | `409 Conflict` | Retry suggested |

---

## How to use this skill
1. Load `webstore-domain` and `webstore-cart` before implementing checkout logic.
2. Treat `PlaceOrder` as a single atomic use case — never split stock deduction and order creation across separate transactions.
3. Follow the price freeze rules strictly — `OrderItem.unitPrice` must never be recalculated after placement.
4. Use the error scenarios table to implement consistent error responses.
