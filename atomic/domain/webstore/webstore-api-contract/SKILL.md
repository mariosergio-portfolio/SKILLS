---
name: webstore-api-contract
description: The single source of truth for the web store HTTP API: every endpoint path and method, who may call it (public, anonymous session, customer, staff, admin), DTO shapes, pagination, RFC 9457 errors, status codes, JWT and cart-session rules. Use when implementing or consuming any web store endpoint in any back-end or front-end, or checking that a client and server agree.
---

# Web Store — HTTP API Contract

Every back-end composite implements this contract and every front-end composite consumes it. If a composite, module skill, or existing code disagrees with this file, **this file wins** — flag the disagreement to the user.

The business meaning of each operation lives in the module skills (`webstore-catalog`, `webstore-cart`, …). Load only the module you are working on.

---

## Global conventions

| Topic | Rule |
|---|---|
| Base path | `/api`. Admin operations live under `/api/admin/**`; nothing else does. |
| Format | JSON, `camelCase` field names, UTF-8. Errors use `application/problem+json`. |
| IDs | UUID strings. |
| Timestamps | ISO 8601 in UTC (`2026-09-25T14:03:00Z`). |
| Money | `{ "amount": 19.90, "currency": "BRL" }`. The amount is a JSON number with at most 2 decimals; servers compute with decimal types, never floating point. The currency is ISO 4217. |
| Enums | Upper-case strings exactly as in `webstore-domain` (`PENDING`, `FIXED_AMOUNT`, …). |
| Create | `201 Created` + `Location` header + the created resource in the body. |
| Update | `200 OK` + the updated resource. |
| Delete / archive / cancel | `204 No Content`. |

### Pagination

Request: `?page=0&size=20&sort=<field>,<asc|desc>`. `page` is zero-based, `size` defaults to 20 with a maximum of 100, and sort fields are listed per endpoint.

Response (the same shape on every paginated endpoint — never leak a framework's native page type):

```json
{ "items": [ ... ], "page": 0, "size": 20, "totalElements": 134, "totalPages": 7 }
```

### Errors — RFC 9457 Problem Details

```json
{
  "type": "https://webstore.example/problems/insufficient-stock",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "2 items in the cart are no longer available.",
  "instance": "/api/orders",
  "errors": [ { "field": "items[1].quantity", "code": "INSUFFICIENT_STOCK", "message": "Only 3 left" } ]
}
```

`errors` is optional and lists field- or item-level problems. Clients show `title` or a mapped message, never the raw `detail`.

| Status | When |
|---|---|
| `400 Bad Request` | Malformed JSON, wrong types, or an invalid webhook signature |
| `401 Unauthorized` | Missing or expired access token |
| `403 Forbidden` | Authenticated, but the role or ownership check failed |
| `404 Not Found` | The resource does not exist, **or it belongs to another customer** (never reveal that it exists) |
| `409 Conflict` | Stock conflict, optimistic-lock conflict, invalid status transition, duplicate SKU, slug or email |
| `422 Unprocessable Entity` | Bean or field validation or a business-rule violation: empty cart, invalid coupon, invalid address |

---

## Auth and session

| Caller | How it is identified |
|---|---|
| **Anonymous** | `sessionId` cookie (HttpOnly, SameSite=Lax, 30-minute TTL renewed on activity), created by the first cart call |
| **Customer** | `Authorization: Bearer <access JWT>` with claims `sub` (customerId) and `role=CUSTOMER` |
| **Staff / Manager / Admin** | The same JWT, with `role` set to `STAFF`, `MANAGER` or `ADMIN` |

- The access token is short-lived and is kept **in memory** by browser clients. The refresh token is an HttpOnly cookie, readable only by the server.
- A `401` response means the client calls `POST /api/auth/refresh` once, then retries the request. If the refresh fails, the client sends the user to login.
- **Cart merge:** straight after login, the client calls `POST /api/cart/merge` with both the JWT and the `sessionId` cookie. The server merges the anonymous cart into the customer cart (quantities are summed and capped at available stock) and clears the cookie.
- Ownership: customers only ever see their own cart, orders, payments and addresses.

Role access in the tables below: **Public** = no auth · **Session** = anonymous cookie *or* customer JWT · **Customer** = customer JWT · **Staff** = `STAFF`, `MANAGER` or `ADMIN` · **Admin** = `ADMIN` only · **Manager** = `MANAGER` or `ADMIN`.

---

## Endpoints

### Auth and account
| Method | Path | Access | Body → Response |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | `RegisterRequest` → `201` `Customer` |
| `POST` | `/api/auth/login` | Public | `LoginRequest` → `TokenResponse` (+ refresh cookie) |
| `POST` | `/api/auth/refresh` | Refresh cookie | → `TokenResponse` |
| `POST` | `/api/auth/logout` | Customer | → `204`, clears the refresh cookie |
| `GET` | `/api/customers/me` | Customer | → `Customer` |
| `GET` | `/api/customers/me/addresses` | Customer | → `Address[]` |
| `POST` | `/api/customers/me/addresses` | Customer | `Address` → `201` `Address` |

### Catalog (read side)
| Method | Path | Access | Notes |
|---|---|---|---|
| `GET` | `/api/products` | Public | Paginated. `?q=` (name + description, case-insensitive), `?categoryId=`, `?minPrice=`, `?maxPrice=`. Sort by `name`, `price` or `createdAt`. Only `ACTIVE` products. |
| `GET` | `/api/products/{id}` | Public | `404` unless the product is `ACTIVE` |
| `GET` | `/api/categories` | Public | Category tree |
| `GET` | `/api/categories/{id}` | Public | Category + first page of its products |
| `GET` | `/api/shipping-methods` | Public | → `ShippingMethod[]` |

### Cart
| Method | Path | Access | Body → Response |
|---|---|---|---|
| `GET` | `/api/cart` | Session | → `Cart` (an empty cart is created if none exists) |
| `POST` | `/api/cart/items` | Session | `{ productId, quantity }` → `Cart`. Adding an existing product increments its quantity. |
| `PATCH` | `/api/cart/items/{itemId}` | Session | `{ quantity }` → `Cart`. `0` removes the item. |
| `DELETE` | `/api/cart/items/{itemId}` | Session | → `Cart` |
| `POST` | `/api/cart/coupon` | Session | `{ code }` → `Cart`, or `422` if the coupon is invalid |
| `DELETE` | `/api/cart/coupon` | Session | → `Cart` |
| `POST` | `/api/cart/refresh` | Session | → `Cart` with current prices; unavailable items are flagged |
| `POST` | `/api/cart/merge` | Customer + `sessionId` cookie | → `Cart` |

Cart endpoints **must** work without a JWT. Requiring login for the cart breaks anonymous shopping.

### Checkout and orders
| Method | Path | Access | Body → Response |
|---|---|---|---|
| `POST` | `/api/orders` | Customer | `PlaceOrderRequest` → `201` `Order` (`PENDING`). Returns `409` on stock conflict and `422` for an empty cart, invalid coupon or invalid address. |
| `GET` | `/api/orders` | Customer | Paginated own orders; sort by `placedAt` |
| `GET` | `/api/orders/{id}` | Customer | Own order, otherwise `404` |
| `DELETE` | `/api/orders/{id}` | Customer | Cancels the order; only allowed from `PENDING`, otherwise `409` |

### Payments
| Method | Path | Access | Body → Response |
|---|---|---|---|
| `POST` | `/api/payments` | Customer | `InitiatePaymentRequest` → `201` `PaymentSession` |
| `GET` | `/api/payments/{orderId}` | Customer | → `Payment` (the client polls this while the status is `PENDING`) |
| `POST` | `/api/payments/webhook/stripe` | Public, signature-verified | → `200` (also for duplicates); `400` if the signature is invalid |
| `POST` | `/api/payments/webhook/paypal` | Public, signature-verified | same |
| `POST` | `/api/payments/webhook/mercadopago` | Public, signature-verified | same |

Webhooks are server-to-server; front-ends never call them.

### Admin — catalog
| Method | Path | Access | Notes |
|---|---|---|---|
| `GET` | `/api/admin/products` | Staff | Paginated, all statuses, `?status=`, `?q=` |
| `POST` | `/api/admin/products` | Admin | `ProductRequest` → `201` `Product` (`409` on duplicate SKU) |
| `PUT` | `/api/admin/products/{id}` | Admin | Full update |
| `PATCH` | `/api/admin/products/{id}` | Admin | Partial update |
| `DELETE` | `/api/admin/products/{id}` | Admin | Archives the product (soft delete) → `204` |
| `PATCH` | `/api/admin/products/{id}/restore` | Admin | `ARCHIVED` → `ACTIVE` |
| `POST` | `/api/admin/categories` | Admin | `CategoryRequest` → `201` |
| `PUT` | `/api/admin/categories/{id}` | Admin | `409` if the change would create a cycle |
| `DELETE` | `/api/admin/categories/{id}` | Admin | `409` while the category still has products |

### Admin — orders
| Method | Path | Access | Notes |
|---|---|---|---|
| `GET` | `/api/admin/orders` | Staff | Paginated, `?status=`, `?customerId=`, `?from=`, `?to=`, `?q=` |
| `GET` | `/api/admin/orders/{id}` | Staff | Full detail, including payments |
| `PATCH` | `/api/admin/orders/{id}/status` | Admin | `AdvanceOrderStatusRequest`; `409` for an invalid transition |
| `DELETE` | `/api/admin/orders/{id}` | Admin | Cancels from `PENDING` or `PAID`; a `PAID` order triggers a refund |

### Admin — inventory
| Method | Path | Access | Notes |
|---|---|---|---|
| `GET` | `/api/admin/inventory` | Staff | Paginated, `?lowStock=true` |
| `GET` | `/api/admin/inventory/{productId}` | Staff | Stock level |
| `PATCH` | `/api/admin/inventory/{productId}` | Admin | `StockAdjustmentRequest`; `422` if the stock would go below 0 |
| `GET` | `/api/admin/inventory/{productId}/audit` | Staff | Paginated audit log |

### Admin — customers and coupons
| Method | Path | Access |
|---|---|---|
| `GET` | `/api/admin/customers` (`?q=`, paginated) | Staff |
| `GET` | `/api/admin/customers/{id}` | Staff |
| `PATCH` | `/api/admin/customers/{id}/deactivate` · `/reactivate` | Admin |
| `GET` | `/api/admin/coupons` (`?active=`, `?expired=`) | Admin |
| `POST` | `/api/admin/coupons` | Admin |
| `PUT` | `/api/admin/coupons/{id}` | Admin |
| `PATCH` | `/api/admin/coupons/{id}/activate` · `/deactivate` | Admin |
| `GET` | `/api/admin/coupons/{id}/usage` | Admin |

### Admin — reports (all `?from=` / `?to=` dates)
| Method | Path | Access |
|---|---|---|
| `GET` | `/api/admin/reports/sales` | Manager |
| `GET` | `/api/admin/reports/top-products` (`?limit=10`, `?by=units\|revenue`) | Manager |
| `GET` | `/api/admin/reports/revenue-by-category` | Manager |
| `GET` | `/api/admin/reports/order-status` | Staff |
| `GET` | `/api/admin/reports/low-stock` | Staff |

---

## DTO shapes

Field lists use the entity definitions from `webstore-domain`. Response DTOs never expose `passwordHash`, `idempotencyKey` or gateway secrets.

```ts
// requests
RegisterRequest           { email; password; fullName }
LoginRequest              { email; password }
PlaceOrderRequest         { shippingAddress: Address; billingAddress?: Address; shippingMethodId; couponCode? }
AdvanceOrderStatusRequest { status: OrderStatus; trackingCarrier?; trackingNumber? }  // tracking fields required when status = SHIPPED
StockAdjustmentRequest    { delta: int; reason: string; actor: string }             // delta > 0 stock in, < 0 write-off
InitiatePaymentRequest    { orderId; gateway: 'STRIPE' | 'PAYPAL' | 'MERCADO_PAGO' }
ProductRequest            { sku; name; description; price: Money; stockQuantity; categoryId; imageUrls: string[]; status }
CategoryRequest           { name; slug; parentId?; sortOrder }

// responses
TokenResponse   { accessToken; expiresIn /* seconds */; customer: Customer }
Cart            { id; items: CartItem[]; couponCode?; subtotal: Money; discountAmount: Money; updatedAt }
CartItem        { id; productId; name; quantity; unitPrice: Money; lineTotal: Money; available: boolean }
Order           { id; status; items: OrderItem[]; subtotal; discountAmount; shippingCost; total /* Money */;
                  shippingAddress; billingAddress; placedAt; updatedAt; trackingCarrier?; trackingNumber? }
PaymentSession  { paymentId; status: 'PENDING'; redirectUrl?; clientSecret? }   // redirectUrl for PayPal/Mercado Pago, clientSecret for Stripe
Payment         { id; orderId; gateway; status: PaymentStatus; amount: Money; createdAt; updatedAt }
```

---

## Keeping clients and servers aligned

- Back-ends publish OpenAPI at `/v3/api-docs` (plus a Swagger UI in dev). The generated spec must match this file.
- Front-ends may generate their types from that OpenAPI spec, or hand-write them to match the shapes above.
- To add or change an endpoint, edit **this skill first**, then the implementations.
