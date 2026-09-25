---
name: webstore-cart
description: Web store cart module rules: add/update/remove items, stock checks, coupon validation, price refresh, anonymous (session cookie) vs customer carts, and merging carts on login. Use when building or reviewing cart behaviour in the web store.
---

# Web Store — Cart Module

## Related skills

> Skills referenced by name below are sibling skills in this library. Load each one with the Skill tool (or `/<skill-name>`) before continuing; do not guess their content.

**Always load first:**
- `webstore-domain` — Cart, CartItem, Coupon entity definitions and business rules

---

## Responsibilities
- Manage the full cart lifecycle (create, read, update, clear).
- Enforce stock availability and price freshness on every cart operation.
- Apply and validate coupon codes.
- Merge anonymous carts into authenticated customer carts on login.

---

## Use Cases

| Use Case | Description |
|---|---|
| `GetCart` | Return current cart for the session or customer; create empty cart if none exists |
| `AddItemToCart` | Add a product to the cart; increment quantity if already present; validate stock |
| `UpdateCartItemQuantity` | Change quantity of an existing cart item; validate stock; remove if quantity = 0 |
| `RemoveCartItemFromCart` | Remove a specific item from the cart |
| `ApplyCoupon` | Validate and attach a coupon code to the cart |
| `RemoveCoupon` | Detach the current coupon from the cart |
| `RefreshCartPrices` | Re-snapshot `unitPrice` from current product prices; flag out-of-stock items |
| `MergeAnonymousCart` | On customer login, merge anonymous cart items into customer's persistent cart |
| `ClearCart` | Remove all items (called internally after order placement) |

---

## API

Endpoints, access rules and DTOs are defined only in the `webstore-api-contract` skill; load it before writing or calling an endpoint. For this module see the Cart section of the contract. All cart endpoints work for anonymous sessions and for logged-in customers; `POST /api/cart/merge` runs `MergeAnonymousCart`.

---

## Cart Identity Resolution
- **Anonymous:** identified by `sessionId` cookie (TTL 30 min, renewable on activity).
- **Authenticated:** identified by `customerId` (JWT claim); cart persists 7 days.
- On login, call `MergeAnonymousCart`: anonymous items are merged into the customer's cart; conflicts (same product) sum quantities up to available stock.

---

## Coupon Validation Rules
1. Coupon must exist and be `active = true`.
2. `expiresAt` must be in the future.
3. `usedCount < maxUses` (if `maxUses` is set).
4. Cart subtotal must meet `minOrderAmount`.
5. Only one coupon per cart at a time; applying a new one replaces the existing one.

---

## Price Refresh Rules
- Called automatically before checkout (`GetCart` during checkout flow).
- Updates `CartItem.unitPrice` from current `Product.price`.
- Flags items where `Product.status = ARCHIVED` or `stockQuantity = 0` as unavailable.
- Client must resolve unavailable items before proceeding to checkout.

---

## Business Rules
1. Cannot add `ARCHIVED` or out-of-stock products to the cart.
2. Adding quantity beyond available stock is rejected with a validation error.
3. Removing the last item in a cart leaves an empty cart (does not delete the cart record).
4. `CartItem.unitPrice` is a snapshot — it does not auto-update; `RefreshCartPrices` must be called explicitly or on checkout entry.

---

## How to use this skill
1. Load `webstore-domain` for full entity and coupon rule definitions.
2. Use the use cases list to name application services and input ports.
3. Take endpoint paths, access and DTOs from `webstore-api-contract`; cart endpoints must work for anonymous sessions.
4. Enforce price refresh and coupon validation rules at every checkout entry point.
