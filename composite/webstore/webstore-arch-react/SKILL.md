---
name: webstore-arch-react
description: Use when the user invokes /webstore-arch-react or asks about implementing the web store front-end in React — module structure, domain type mapping, API organisation aligned with the Java API, cart/checkout flows, auth, and good practices for the e-commerce application.
---

# Web Store — React Front-End Implementation

## When to use this skill
Activate when the user types `/webstore-arch-react` or asks about implementing the web store front-end using React.

> Skills referenced by name below are sibling skills in this library. Load each one with the Skill tool (or `/<skill-name>`) before continuing; do not guess their content.

**Foundation skills this composite wires together:**
- `tech-stack-react` — React technology stack, project structure, conventions, configuration, and testing strategy
- `tech-good-practices` — SOLID principles, clean code, naming, error handling, and testing good practices

**Back-end contract (always load when implementing API integration):**
- `webstore-arch-java-api` — Java REST API: endpoint paths, request/response DTOs, error format, pagination convention

**Load the relevant web store domain skills for the module being implemented:**
- `webstore-domain` — all entities, business rules, value objects, and module responsibilities
- `webstore-catalog` — product listing, search, filtering, and category navigation
- `webstore-cart` — cart lifecycle, item operations, coupon application, price refresh
- `webstore-checkout` — order placement flow, stock check, price freeze
- `webstore-orders` — order history, status tracking, cancellation
- `webstore-payments` — payment initiation and gateway integration
- `webstore-inventory` — stock levels (admin)
- `webstore-backoffice` — admin product, order, customer, coupon, and report management

---

## Application Artifact Name: `webstore-frontend`

---

## Module Mapping

The `src/modules/` folder mirrors the web store business modules:

```
src/modules/
├── catalog/        ← product listing, search, filtering, product detail, categories
├── cart/           ← cart management, coupon, price refresh
├── checkout/       ← checkout flow, address, shipping method, order placement
├── orders/         ← customer order history, order detail, cancellation
├── payments/       ← payment initiation, status polling
├── auth/           ← login, registration, session management
└── backoffice/     ← admin: products, orders, inventory, customers, coupons, reports
    ├── products/
    ├── orders/
    ├── inventory/
    ├── customers/
    ├── coupons/
    └── reports/
```

Each module follows the standard `tech-stack-react` layout: `pages/`, `components/`, `hooks/`, `store.ts`.

---

## Domain Type Mapping

Types in `src/domain/types/` mirror the Java back-end domain model exactly — names, field names, and value sets must match:

| TypeScript type | Maps to Java domain | Notes |
|---|---|---|
| `Product` | `Product` | |
| `ProductStatus` | `ProductStatus` | `'ACTIVE' \| 'DRAFT' \| 'ARCHIVED'` |
| `Category` | `Category` | |
| `Customer` | `Customer` | |
| `Address` | `Address` (value object) | embedded in `Order` and `Customer` |
| `Cart` | `Cart` | |
| `CartItem` | `CartItem` | `unitPrice` is a live snapshot |
| `Coupon` | `Coupon` | |
| `DiscountType` | `DiscountType` | `'PERCENTAGE' \| 'FIXED_AMOUNT'` |
| `Order` | `Order` | |
| `OrderItem` | `OrderItem` | `unitPrice` frozen at checkout |
| `OrderStatus` | `OrderStatus` | `'PENDING' \| 'PAID' \| 'PROCESSING' \| 'SHIPPED' \| 'DELIVERED' \| 'CANCELLED'` |
| `Payment` | `Payment` | |
| `PaymentStatus` | `PaymentStatus` | `'PENDING' \| 'SUCCEEDED' \| 'FAILED' \| 'REFUNDED'` |
| `ShippingMethod` | `ShippingMethod` (value object) | |
| `Money` | `Money` (value object) | `{ amount: number; currency: string }` |
| `InventoryAuditLog` | `InventoryAuditLog` | |

Rules:
- All domain types are **`readonly` interfaces** — never use mutable classes.
- `Money.amount` is a `number` on the client; always display via `formatMoney(money: Money): string`.
- Status types are string literal unions — TypeScript exhaustive `switch` must cover all values.
- Field names use `camelCase` matching the Java JSON serialisation (Jackson default).

---

## API Endpoint Alignment

All front-end API calls must match the paths and HTTP methods defined in `webstore-arch-java-api` exactly.

### Pagination convention
All paginated endpoints accept `?page=0&size=20&sort=<field>,<asc|desc>` — pass these from `usePagination` hook.

### Error format — RFC 9457 Problem Details
The Java API returns **RFC 9457 Problem Details** on all error responses. `api/errors.ts` must parse this format:

```ts
interface ProblemDetail {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
```

Map `status` to user-facing messages in a shared error handler — never display raw `detail` to end users.

### Request / Response DTOs

The following TypeScript request shapes must match the Java `*Request` DTOs exactly:

**`PlaceOrderRequest`** (maps to Java `PlaceOrderRequest`) — `POST /api/orders`:
```ts
interface PlaceOrderRequest {
  shippingAddress: Address;
  billingAddress?: Address;
  shippingMethodId: string;   // UUID
  couponCode?: string;
}
```

**`AdvanceOrderStatusRequest`** (maps to Java PATCH body) — `PATCH /api/admin/orders/{id}/status`:
```ts
interface AdvanceOrderStatusRequest {
  status: OrderStatus;
  trackingCarrier?: string;
  trackingNumber?: string;
}
```

**`StockAdjustmentRequest`** (maps to Java PATCH body) — `PATCH /api/admin/inventory/{productId}`:
```ts
interface StockAdjustmentRequest {
  delta: number;        // positive = stock in, negative = stock out
  reason?: string;
  actor: string;        // admin email or system identifier
}
```

---

## API Endpoint Organisation

Files in `src/api/endpoints/` are grouped by back-end resource, mirroring the Java `infrastructure/rest/` module split:

| File | Java controller | Paths covered | Auth |
|---|---|---|---|
| `authApi.ts` | `AuthController` | `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/refresh`, `POST /api/auth/logout` | Public |
| `customerApi.ts` | `CustomerController` | `GET /api/customers/me`, `GET /api/customers/me/addresses`, `POST /api/customers/me/addresses` | JWT |
| `productApi.ts` | `ProductController` | `GET /api/products`, `GET /api/products/{id}` | Public |
| `categoryApi.ts` | `CategoryController` | `GET /api/categories`, `GET /api/categories/{id}` | Public |
| `cartApi.ts` | `CartController` | `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/{itemId}`, `DELETE /api/cart/items/{itemId}`, `POST /api/cart/coupon`, `DELETE /api/cart/coupon`, `POST /api/cart/refresh` | Session / JWT |
| `checkoutApi.ts` | `CheckoutController` | `POST /api/orders` | JWT |
| `orderApi.ts` | `OrderController` | `GET /api/orders`, `GET /api/orders/{id}`, `DELETE /api/orders/{id}` | JWT |
| `paymentApi.ts` | `PaymentController` | `POST /api/payments`, `GET /api/payments/{orderId}` | JWT |
| `adminProductApi.ts` | `ProductController` (admin) | `POST /api/products`, `PUT /api/products/{id}`, `PATCH /api/products/{id}`, `DELETE /api/products/{id}`, `PATCH /api/products/{id}/restore`, `POST /api/categories`, `PUT /api/categories/{id}`, `DELETE /api/categories/{id}` | Admin JWT |
| `adminOrderApi.ts` | `AdminOrderController` | `GET /api/admin/orders`, `GET /api/admin/orders/{id}`, `PATCH /api/admin/orders/{id}/status`, `DELETE /api/admin/orders/{id}` | Admin JWT |
| `adminInventoryApi.ts` | `InventoryController` | `GET /api/inventory`, `GET /api/inventory/{productId}`, `PATCH /api/inventory/{productId}` | Admin JWT |
| `adminCustomerApi.ts` | `CustomerController` (admin) | `GET /api/admin/customers`, `GET /api/admin/customers/{id}`, `PATCH /api/admin/customers/{id}/deactivate`, `PATCH /api/admin/customers/{id}/reactivate` | Admin JWT |
| `adminCouponApi.ts` | `CouponController` | `GET /api/admin/coupons`, `POST /api/admin/coupons`, `PUT /api/admin/coupons/{id}`, `PATCH /api/admin/coupons/{id}/activate`, `PATCH /api/admin/coupons/{id}/deactivate`, `GET /api/admin/coupons/{id}/usage` | Admin JWT |
| `adminReportApi.ts` | `ReportController` | `GET /api/admin/reports/sales`, `GET /api/admin/reports/top-products`, `GET /api/admin/reports/low-stock`, `GET /api/admin/reports/order-status`, `GET /api/admin/reports/revenue-by-category` | Admin JWT |

> Webhook endpoints (`/api/payments/webhook/*`) are **server-to-server only** — never called from the front-end.

All API functions are typed: inputs validated by Zod request schemas; responses parsed by Zod response schemas and mapped to domain types.

---

## Project Structure

Details: [references/project-structure.md](references/project-structure.md). Read it when scaffolding the project or deciding where a file goes.

## Naming Conventions

| Artefact | Convention | Example |
|---|---|---|
| Domain types | `PascalCase` readonly interface — match Java model names | `Product`, `Order`, `CartItem` |
| Status union types | `PascalCase` + `Status` suffix | `OrderStatus`, `ProductStatus`, `PaymentStatus` |
| Discount type union | `DiscountType` | `'PERCENTAGE' \| 'FIXED_AMOUNT'` |
| API functions | camelCase verb + noun | `getProducts`, `addCartItem`, `placeOrder` |
| Request interfaces | `PascalCase` + `Request` suffix — match Java DTO names | `PlaceOrderRequest`, `AdvanceOrderStatusRequest` |
| Zod schemas | camelCase + `Schema` suffix | `productSchema`, `placeOrderRequestSchema` |
| Page components | `PascalCase` + `Page` suffix | `ProductListPage`, `CheckoutPage` |
| Non-page components | `PascalCase` | `ProductCard`, `OrderStatusBadge` |
| Hooks | `use` prefix + camelCase | `useCart`, `usePlaceOrder`, `useAdminOrders` |
| Zustand stores | camelCase + `Store` suffix | `cartStore`, `authStore` |
| Utility functions | camelCase verb | `formatMoney`, `formatDate`, `slugify` |

---

## Authentication & Session

- Auth state (user, JWT, `isAuthenticated`, `role`) lives in `modules/auth/store.ts` (Zustand).
- JWT is stored in **memory only** — never in `localStorage` or `sessionStorage` (XSS risk).
- Refresh token is stored in an **httpOnly cookie** set by the Java API — the client never reads it directly.
- `api/client.ts` attaches the in-memory JWT as `Authorization: Bearer <token>` on every request.
- On `401` response, the client calls `POST /api/auth/refresh`, updates the in-memory token, and retries the original request once. If refresh also fails, redirect to `/login`.
- On login success, call `POST /api/cart/refresh` (or `MergeAnonymousCart` endpoint) passing the anonymous `sessionId` cookie to merge the anonymous cart into the authenticated cart.
- `ProtectedRoute` checks `authStore.isAuthenticated`; `AdminRoute` additionally checks `authStore.role === 'ADMIN'`.

---

## Cart Behaviour

- Anonymous cart: `sessionId` stored in a **session cookie** (TTL 30 min, renewed on activity). Sent automatically by the browser on every `cartApi.ts` request.
- Authenticated cart: resolved server-side from the JWT `customerId`; `sessionId` cookie also sent during the merge window.
- `POST /api/cart/refresh` is called automatically on `CheckoutPage` mount — never assume prices are current before checkout entry.
- Unavailable items (`status = ARCHIVED` or `stockQuantity = 0`) are flagged in the `CartItem` response; block the "Proceed to Checkout" button and render inline warnings per item.
- Cart item count in the navbar is derived from TanStack Query `useCart` cache — never duplicated in Zustand.

---

## Checkout Flow

The checkout maps directly to the `POST /api/orders` endpoint of `webstore-arch-java-api`:

```
1. CartPage
   → user reviews items
   → RefreshCart (POST /api/cart/refresh) called on page mount
   → "Proceed" disabled if any item is unavailable

2. CheckoutPage — step 1: Address
   → AddressForm (React Hook Form + Zod, schema matches Address value object)
   → pre-fills from GET /api/customers/me/addresses if authenticated

3. CheckoutPage — step 2: Shipping
   → ShippingMethodSelector: fetches shipping methods from back-end
   → user picks a ShippingMethod; stores shippingMethodId

4. CheckoutPage — step 3: Review
   → OrderSummary: subtotal, discountAmount, shippingCost, total
      (computed client-side from CartItem data + selected ShippingMethod.cost)
   → PlaceOrderButton → usePlaceOrder → POST /api/orders
      body: PlaceOrderRequest { shippingAddress, billingAddress?, shippingMethodId, couponCode? }

5. On 201 Created → navigate to PaymentPage with orderId

6. PaymentPage
   → useInitiatePayment → POST /api/payments { orderId }
   → redirect to gateway URL or render embedded payment widget

7. PaymentResultPage
   → usePaymentStatus → GET /api/payments/{orderId} (poll until status ≠ PENDING)
   → SUCCEEDED → navigate to /orders/{id}
   → FAILED    → show retry option; order remains PENDING

8. OrderDetailPage → display confirmed order
```

Good practice rules:
- Each step is a separate component — `CheckoutPage` is a multi-step controller, never a monolith.
- `usePlaceOrder` mutation disables `PlaceOrderButton` while in-flight — prevent double submissions.
- `409 Conflict` from `POST /api/orders` (stock conflict) → return user to CartPage with item-level errors highlighted.
- `422 Unprocessable Entity` from `POST /api/orders` (invalid coupon, empty cart, invalid address) → show field-level or toast errors without leaving the checkout page.
- On `201 Created`, invalidate TanStack Query cache keys: `['cart']` and `['orders']`.

---

## Admin Order Status Advancement

`PATCH /api/admin/orders/{id}/status` body matches `AdvanceOrderStatusRequest`:

```ts
// Status machine from webstore-orders:
// PENDING → PAID → PROCESSING → SHIPPED → DELIVERED
// PENDING | PAID → CANCELLED
```

- `OrderStatusAdvancer` component renders only the **valid next statuses** from the current one — never exposes invalid transitions.
- `TrackingForm` is shown only when advancing to `SHIPPED` (requires `trackingCarrier` + `trackingNumber`).
- `useAdminCancelOrder` calls `DELETE /api/admin/orders/{id}` — only enabled for `PENDING` or `PAID` status.

---

## Good Practices Applied

### Single Responsibility
- Each hook owns exactly one use case: `useAddToCart`, `usePlaceOrder`, `useAdvanceOrderStatus`, `useRestoreProduct` — never a fat combined hook.
- Page components own routing and layout; all data logic is in hooks; all rendering is in components.

### Error Handling
- `api/errors.ts` parses RFC 9457 Problem Details into typed `ApiError` with `status`, `title`, and optional `detail`.
- Every `useMutation` has an `onError` handler — toast for unexpected errors, inline for validation errors.
- Every async route boundary is wrapped in `<ErrorBoundary>` with a contextual fallback UI.
- `404` from product detail → redirect to `/` with a "Product not found" notice.
- `409` from `POST /api/orders` → return to CartPage with item-level stock errors.
- `422` from `POST /api/orders` → display validation errors inline on the relevant checkout step.

### Loading & Empty States
- Every `useQuery` renders: skeleton/spinner while `isLoading`, `<EmptyState>` when data is empty, content when ready.
- All mutation trigger buttons show a loading spinner and are disabled while `isPending`.

### Immutability & Derived State
- Domain types are `readonly` interfaces — never mutate API response objects.
- `OrderItem.unitPrice` and `Cart.items[].unitPrice` are never recalculated on the client — displayed as received.
- Totals displayed in `OrderSummary` are computed from `CartItem` data for preview; the authoritative total is returned in the `Order` response.

### Forms
- All forms use React Hook Form + Zod resolvers; schemas mirror Java DTO validation rules.
- `AddressForm`, `LoginForm`, `RegisterForm`, `ProductForm`, `CouponForm`, `TrackingForm` have no `useState` for individual fields.
- Validation runs on `blur`; final validation on submit.
- Submission disables all fields and the submit button — prevents double-click.

### Access Control
- Public: `/`, `/products/*`, `/categories/*`, `/cart`, `/login`, `/register`.
- Protected (JWT required): `/checkout`, `/orders/*`, `/payment/*`.
- Admin (ROLE_ADMIN required): `/backoffice/**`.
- All `adminProduct/Order/Inventory/Customer/Coupon/ReportApi` calls automatically include the JWT via `api/client.ts` interceptor.

### Testing
- **Unit (Vitest)**: `formatMoney`, `slugify`, Zod schemas, Problem Details parser, pure hook logic.
- **Component (RTL)**: `ProductCard`, `CartItemRow`, `OrderStatusBadge`, `AddressForm`, `OrderStatusAdvancer` — mocked TanStack Query + Zustand.
- **E2E (Playwright)**: add-to-cart → checkout → order placed; admin advance order to SHIPPED with tracking; coupon application; admin cancel order.
- Test naming: `should_<expected>_when_<condition>` — e.g. `should_disable_checkout_when_cart_is_empty`.

---

## Environment Variables

```dotenv
# .env.development
VITE_API_BASE_URL=http://localhost:8080
VITE_APP_ENV=development
VITE_ENABLE_MOCKS=false

# .env.production
VITE_API_BASE_URL=https://api.mywebstore.com
VITE_APP_ENV=production
VITE_ENABLE_MOCKS=false
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
  readonly VITE_ENABLE_MOCKS: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## Routes

| Path | Page | Auth | Back-end endpoint |
|---|---|---|---|
| `/` | `ProductListPage` | Public | `GET /api/products` |
| `/products/:id` | `ProductDetailPage` | Public | `GET /api/products/{id}` |
| `/categories/:slug` | `CategoryPage` | Public | `GET /api/categories/{id}` |
| `/cart` | `CartPage` | Public | `GET /api/cart` |
| `/checkout` | `CheckoutPage` | Protected | `POST /api/orders` |
| `/orders` | `OrderListPage` | Protected | `GET /api/orders` |
| `/orders/:id` | `OrderDetailPage` | Protected | `GET /api/orders/{id}` |
| `/payment` | `PaymentPage` | Protected | `POST /api/payments` |
| `/payment/result` | `PaymentResultPage` | Protected | `GET /api/payments/{orderId}` |
| `/login` | `LoginPage` | Public | `POST /api/auth/login` |
| `/register` | `RegisterPage` | Public | `POST /api/auth/register` |
| `/backoffice/products` | `AdminProductListPage` | Admin | `GET /api/products` |
| `/backoffice/products/new` | `AdminProductFormPage` | Admin | `POST /api/products` |
| `/backoffice/products/:id` | `AdminProductFormPage` | Admin | `PUT /api/products/{id}` |
| `/backoffice/orders` | `AdminOrderListPage` | Admin | `GET /api/admin/orders` |
| `/backoffice/orders/:id` | `AdminOrderDetailPage` | Admin | `GET /api/admin/orders/{id}` |
| `/backoffice/inventory` | `AdminInventoryPage` | Admin | `GET /api/inventory` |
| `/backoffice/customers` | `AdminCustomerListPage` | Admin | `GET /api/admin/customers` |
| `/backoffice/customers/:id` | `AdminCustomerDetailPage` | Admin | `GET /api/admin/customers/{id}` |
| `/backoffice/coupons` | `AdminCouponListPage` | Admin | `GET /api/admin/coupons` |
| `/backoffice/reports` | `AdminReportsPage` | Admin | `GET /api/admin/reports/*` |

---

## How to use this skill
1. Load `tech-stack-react` for the full technology stack, configurations, and general conventions.
2. Load `tech-good-practices` for SOLID principles, naming rules, error handling, and testing strategy.
3. Load `webstore-arch-java-api` for the authoritative REST endpoint paths, request/response DTO shapes, and error format.
4. Load the relevant web store domain skills for the module being implemented.
5. Apply the module mapping, type definitions, API organisation, and good practices defined here to all web store React implementation work.
6. Respond and assist in English unless the user requests another language.
7. Await further instructions from the user and execute them accordingly.
