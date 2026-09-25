---
name: webstore-domain
description: Web store domain model: the entities (Product, Category, Customer, Cart, CartItem, Coupon, Order, OrderItem, Payment), their fields and invariants, value objects (Money, Address, ShippingMethod), domain events, and which module owns what. Use when designing, implementing or reviewing any part of the web store, before loading a specific webstore module skill.
---

# Web Store — Domain Specification

## Domain Overview
The web store manages the full lifecycle of an e-commerce operation: catalog browsing, cart management, checkout, order fulfillment, payments, and inventory. All domain knowledge is technology-agnostic.

---

## Core Entities & Rules

### Product
- Has: `id`, `sku`, `name`, `description`, `price`, `currency`, `stockQuantity`, `categoryId`, `imageUrls[]`, `status`, `createdAt`, `updatedAt`
- Status values: `ACTIVE`, `DRAFT`, `ARCHIVED`
- Business rules:
  - SKU must be unique across the catalog.
  - Price must be > 0.
  - `ARCHIVED` products cannot be added to a cart.
  - Stock quantity must be ≥ 0; negative stock is not allowed.

### Category
- Has: `id`, `name`, `slug`, `parentId` (nullable), `sortOrder`
- Business rules:
  - Slug must be unique and URL-safe.
  - A category can have a parent (hierarchical tree); cycles are forbidden.
  - Deleting a category requires reassigning or removing its products first.

### Customer
- Has: `id`, `email`, `fullName`, `passwordHash`, `addresses: Address[]`, `createdAt`
- Business rules:
  - Email must be unique.
  - A customer must have at least one address to place an order.

### Cart
- Has: `id`, `customerId` (nullable for anonymous), `sessionId`, `items: CartItem[]`, `couponCode`, `updatedAt`
- Business rules:
  - A customer may have only one active cart at a time.
  - Anonymous carts are identified by `sessionId` (TTL 30 min).
  - Authenticated carts persist for 7 days.
  - On login, anonymous cart items are merged into the customer's existing cart.
  - A cart with no items cannot proceed to checkout.

### CartItem
- Has: `id`, `cartId`, `productId`, `quantity`, `unitPrice` (live snapshot)
- Business rules:
  - Quantity must be ≥ 1.
  - Adding the same product again increments quantity (no duplicate line items).
  - `unitPrice` is a live snapshot updated on cart refresh — it is **not** the frozen checkout price.

### Coupon / Discount
- Has: `id`, `code`, `discountType` (`PERCENTAGE` | `FIXED_AMOUNT`), `value`, `minOrderAmount`, `maxUses`, `usedCount`, `expiresAt`, `active`
- Business rules:
  - A coupon can only be applied once per order.
  - `PERCENTAGE` discounts are capped at 100%.
  - Expired or fully-used coupons are rejected at checkout.
  - `minOrderAmount` must be met before the coupon is applied.

### Order
- Has: `id`, `customerId`, `status`, `items: OrderItem[]`, `subtotal`, `discountAmount`, `shippingCost`, `total`, `currency`, `shippingAddress`, `billingAddress`, `paymentId`, `placedAt`, `updatedAt`
- Status machine: `PENDING` → `PAID` → `PROCESSING` → `SHIPPED` → `DELIVERED` or → `CANCELLED`
- Business rules:
  - An order can only be cancelled from `PENDING` or `PAID` status.
  - Status advances in order; no skipping or reversing (except `CANCELLED`).
  - `total = subtotal − discountAmount + shippingCost`.
  - An order is **immutable** after placement — corrections require compensating events.

### OrderItem
- Has: `id`, `orderId`, `productId`, `sku`, `name`, `quantity`, `unitPrice` (frozen), `lineTotal`
- Business rules:
  - `unitPrice` is the price **at the moment of checkout** — never recalculated later.
  - `lineTotal = unitPrice × quantity`.

### Payment
- Has: `id`, `orderId`, `gateway`, `gatewayReference`, `idempotencyKey`, `amount`, `currency`, `status`, `createdAt`, `updatedAt`
- Status values: `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`
- Business rules:
  - Each payment attempt has a unique `idempotencyKey`.
  - A `SUCCEEDED` payment moves the associated order to `PAID`.
  - A `REFUNDED` payment may trigger order cancellation or manual review.

---

## Value Objects

| Value Object | Fields |
|---|---|
| `Address` | `street`, `city`, `state`, `postalCode`, `country` |
| `Money` | `amount` (BigDecimal), `currency` (ISO 4217) |
| `ShippingMethod` | `id`, `name`, `cost`, `estimatedDays` |

---

## Domain Events

| Event | Trigger |
|---|---|
| `OrderPlaced` | Order successfully created from cart |
| `OrderPaid` | Payment confirmed by gateway |
| `OrderCancelled` | Order moved to `CANCELLED` |
| `OrderShipped` | Order status advanced to `SHIPPED` |
| `StockReduced` | Stock deducted at order placement |
| `StockRestored` | Stock returned after order cancellation |
| `StockBelowThreshold` | `stockQuantity < reorderPoint` |
| `CartMerged` | Anonymous cart merged on customer login |
| `PaymentFailed` | Gateway reported payment failure |

---

## Module Responsibilities

| Module | Skill | Responsibility |
|---|---|---|
| Catalog | `webstore-catalog` | Manage products and categories; expose search and detail endpoints |
| Cart | `webstore-cart` | Manage cart lifecycle, item operations, coupon application, price refresh |
| Checkout | `webstore-checkout` | Orchestrate order placement: stock deduction, price freeze, cart clearance |
| Orders | `webstore-orders` | Manage order lifecycle and status transitions |
| Payments | `webstore-payments` | Initiate payment, handle gateway webhooks, update order status |
| Inventory | `webstore-inventory` | Track and adjust stock levels; emit low-stock events |
| Backoffice | `webstore-backoffice` | Admin operations: product CRUD, order management, inventory adjustments, reports |

---

## How to use this skill
1. Use this skill as the canonical reference for all entity naming, field definitions, and business rules.
2. Reference domain events when designing asynchronous flows or outbox patterns.
3. Use value objects for money and address fields — never use raw primitives for price or currency.
4. Consult module responsibilities to assign use cases to the correct bounded context.
