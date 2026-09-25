---
name: webstore-cart
description: Use when the user invokes %webstore-cart or asks about the web store cart module — adding/removing items, quantity updates, coupon application, price refresh, anonymous vs authenticated carts, and cart merging on login.
---

# Web Store — Cart Module

## When to use this skill
Activate when the user types `%webstore-cart` or asks about cart operations: adding items, updating quantities, removing items, applying coupons, refreshing prices, or merging anonymous carts on login.

**Always load first:**
- `%webstore-domain` — Cart, CartItem, Coupon entity definitions and business rules

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

## REST Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cart` | Get current cart (session or customer) |
| `POST` | `/api/cart/items` | Add item (`productId`, `quantity`) |
| `PATCH` | `/api/cart/items/{itemId}` | Update quantity |
| `DELETE` | `/api/cart/items/{itemId}` | Remove item |
| `POST` | `/api/cart/coupon` | Apply coupon code |
| `DELETE` | `/api/cart/coupon` | Remove coupon |
| `POST` | `/api/cart/refresh` | Refresh prices and stock status |

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
1. Load `%webstore-domain` for full entity and coupon rule definitions.
2. Use the use cases list to name application services and input ports.
3. Follow REST endpoints when implementing or reviewing cart controllers.
4. Enforce price refresh and coupon validation rules at every checkout entry point.
5. Respond and assist in English unless the user requests another language.
6. Await further instructions from the user and execute them accordingly within the cart module context.
