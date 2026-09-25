---
name: webstore-arch-react
description: Blueprint for building the web store front end in React: module layout, domain types, API client organisation against webstore-api-contract, auth and cart session, checkout flow, admin screens, routes, and a step-by-step workflow with done criteria. Use when implementing or extending the web store UI in React.
---

# Web Store — React Front-End Implementation

## Loading strategy

> Skills named below are sibling skills in this library. Load them with the Skill tool (or `/<skill-name>`) when the table says so; never guess their content.

Load **only what the current task touches**. Loading every module skill up front floods the context and buries the rules that matter.

| Task | Load in addition to this skill |
|---|---|
| Any task that calls the back-end | `webstore-api-contract` (read only the sections you need) |
| Scaffolding, tooling, config | `tech-stack-react` |
| A feature in a module | `webstore-domain` + that module's skill (e.g. `webstore-checkout`) |
| Admin screens | `webstore-backoffice` + the module being administered |
| Code review or refactoring | `tech-good-practices` |

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

Types in `src/domain/types/` mirror the entities in `webstore-domain` and the response shapes in `webstore-api-contract`. Names, field names and value sets must match exactly:

| TypeScript type | Domain entity / value object | Notes |
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
- Field names use `camelCase`, as the contract defines.

---

## API Integration

Every call must match `webstore-api-contract` exactly: path, method, access level and DTO shape. Load the contract section for the module you are working on. Don't copy endpoint tables into this project's docs.

- **Pagination:** send `?page=&size=&sort=` from the `usePagination` hook, and parse the contract's `PageResponse<T>` (`items`, `page`, `size`, `totalElements`, `totalPages`).
- **Errors:** `api/errors.ts` parses RFC 9457 `ProblemDetail`, including the optional `errors[]` list, into a typed `ApiError`. Map `status` and `errors[].code` to user-facing messages. Never show the raw `detail`.
- **DTOs:** request and response types live in `src/api/types/`, one file per contract section, named exactly as in the contract (`PlaceOrderRequest`, `AdvanceOrderStatusRequest`, …). They can be generated from the back-end's OpenAPI spec (`/v3/api-docs`) with `openapi-typescript`, or written by hand. Either way, Zod schemas validate responses at the boundary.

### API file organisation

Files in `src/api/endpoints/` follow the contract sections:

| File | Contract section | Access |
|---|---|---|
| `authApi.ts`, `customerApi.ts` | Auth and account | Public / Customer |
| `productApi.ts`, `categoryApi.ts`, `shippingApi.ts` | Catalog | Public |
| `cartApi.ts` | Cart (including `POST /api/cart/merge`) | Session |
| `checkoutApi.ts`, `orderApi.ts` | Checkout and orders | Customer |
| `paymentApi.ts` | Payments (never the webhooks) | Customer |
| `adminProductApi.ts` | Admin — catalog (`/api/admin/products`, `/api/admin/categories`) | Staff / Admin |
| `adminOrderApi.ts` | Admin — orders | Staff / Admin |
| `adminInventoryApi.ts` | Admin — inventory (`/api/admin/inventory`) | Staff / Admin |
| `adminCustomerApi.ts`, `adminCouponApi.ts` | Admin — customers and coupons | Staff / Admin |
| `adminReportApi.ts` | Admin — reports | Staff / Manager |

The admin UI hides write actions from `STAFF` users. The server still enforces the roles.

---

## Project Structure

Details: [references/project-structure.md](references/project-structure.md). Read it when scaffolding the project or deciding where a file goes.

## Naming Conventions

| Artefact | Convention | Example |
|---|---|---|
| Domain types | `PascalCase` readonly interface — match `webstore-domain` names | `Product`, `Order`, `CartItem` |
| Status union types | `PascalCase` + `Status` suffix | `OrderStatus`, `ProductStatus`, `PaymentStatus` |
| Discount type union | `DiscountType` | `'PERCENTAGE' \| 'FIXED_AMOUNT'` |
| API functions | camelCase verb + noun | `getProducts`, `addCartItem`, `placeOrder` |
| Request interfaces | `PascalCase` + `Request` suffix — match contract DTO names | `PlaceOrderRequest`, `AdvanceOrderStatusRequest` |
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
- Refresh token is stored in an **httpOnly cookie** set by the back-end — the client never reads it directly.
- `api/client.ts` attaches the in-memory JWT as `Authorization: Bearer <token>` on every request.
- On `401` response, the client calls `POST /api/auth/refresh`, updates the in-memory token, and retries the original request once. If refresh also fails, redirect to `/login`.
- On login success, call `POST /api/cart/merge`. The browser sends the anonymous `sessionId` cookie automatically, and the server merges that cart into the customer cart. Then invalidate the `['cart']` query.
- `ProtectedRoute` checks `authStore.isAuthenticated`. `AdminRoute` also checks that `authStore.role` is one of `'STAFF' | 'MANAGER' | 'ADMIN'`, and admin write actions are shown only to `'ADMIN'`.

---

## Cart Behaviour

- Anonymous cart: `sessionId` stored in a **session cookie** (TTL 30 min, renewed on activity). Sent automatically by the browser on every `cartApi.ts` request.
- Authenticated cart: resolved server-side from the JWT `customerId`; `sessionId` cookie also sent during the merge window.
- `POST /api/cart/refresh` is called automatically on `CheckoutPage` mount — never assume prices are current before checkout entry.
- Unavailable items (`status = ARCHIVED` or `stockQuantity = 0`) are flagged in the `CartItem` response; block the "Proceed to Checkout" button and render inline warnings per item.
- Cart item count in the navbar is derived from TanStack Query `useCart` cache — never duplicated in Zustand.

---

## Checkout Flow

The checkout maps directly to `POST /api/orders` in `webstore-api-contract`:

```
1. CartPage
   → user reviews items
   → RefreshCart (POST /api/cart/refresh) called on page mount
   → "Proceed" disabled if any item is unavailable

2. CheckoutPage — step 1: Address
   → AddressForm (React Hook Form + Zod, schema matches Address value object)
   → pre-fills from GET /api/customers/me/addresses if authenticated

3. CheckoutPage — step 2: Shipping
   → ShippingMethodSelector: GET /api/shipping-methods
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
- All forms use React Hook Form + Zod resolvers; schemas mirror the contract DTO validation rules.
- `AddressForm`, `LoginForm`, `RegisterForm`, `ProductForm`, `CouponForm`, `TrackingForm` have no `useState` for individual fields.
- Validation runs on `blur`; final validation on submit.
- Submission disables all fields and the submit button — prevents double-click.

### Access Control
- Public: `/`, `/products/*`, `/categories/*`, `/cart`, `/login`, `/register`.
- Protected (JWT required): `/checkout`, `/orders/*`, `/payment/*`.
- Back-office (`STAFF`, `MANAGER` or `ADMIN` role): `/backoffice/**`. Write actions only for `ADMIN`.
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
| `/categories/:id` | `CategoryPage` | Public | `GET /api/categories/{id}` |
| `/cart` | `CartPage` | Public | `GET /api/cart` |
| `/checkout` | `CheckoutPage` | Customer | `POST /api/orders` |
| `/orders` | `OrderListPage` | Protected | `GET /api/orders` |
| `/orders/:id` | `OrderDetailPage` | Protected | `GET /api/orders/{id}` |
| `/payment` | `PaymentPage` | Protected | `POST /api/payments` |
| `/payment/result` | `PaymentResultPage` | Protected | `GET /api/payments/{orderId}` |
| `/login` | `LoginPage` | Public | `POST /api/auth/login` |
| `/register` | `RegisterPage` | Public | `POST /api/auth/register` |
| `/backoffice/products` | `AdminProductListPage` | Staff | `GET /api/admin/products` |
| `/backoffice/products/new` | `AdminProductFormPage` | Admin | `POST /api/admin/products` |
| `/backoffice/products/:id` | `AdminProductFormPage` | Admin | `PUT /api/admin/products/{id}` |
| `/backoffice/orders` | `AdminOrderListPage` | Staff | `GET /api/admin/orders` |
| `/backoffice/orders/:id` | `AdminOrderDetailPage` | Staff | `GET /api/admin/orders/{id}` |
| `/backoffice/inventory` | `AdminInventoryPage` | Staff | `GET /api/admin/inventory` |
| `/backoffice/customers` | `AdminCustomerListPage` | Staff | `GET /api/admin/customers` |
| `/backoffice/customers/:id` | `AdminCustomerDetailPage` | Staff | `GET /api/admin/customers/{id}` |
| `/backoffice/coupons` | `AdminCouponListPage` | Admin | `GET /api/admin/coupons` |
| `/backoffice/reports` | `AdminReportsPage` | Staff (revenue: Manager) | `GET /api/admin/reports/*` |

---

## Workflow — building a feature

1. **Scope.** Identify the module, its pages and the contract endpoints it uses. Ask if the requested behaviour isn't in the module skill.
2. **Types.** Add or extend the request/response types and Zod schemas in `src/api/types/`, matching the contract shapes exactly.
3. **API functions.** Add typed functions to the matching `src/api/endpoints/*Api.ts` file. Validate responses with Zod at the boundary.
4. **Hooks.** Write TanStack Query hooks with stable query keys. Mutations invalidate exactly the keys they affect (e.g. placing an order invalidates `['cart']` and `['orders']`).
5. **UI.** Build components and pages. Forms use React Hook Form + Zod. Every async view has loading, error and empty states.
6. **Routing and access.** Register the route and wrap it in `ProtectedRoute` or `AdminRoute` according to the contract's access level. Hide admin write actions from `STAFF`.
7. **Tests.** Write Vitest tests for hooks and utilities, and React Testing Library tests for components, with API calls mocked at the network layer using contract-shaped responses. Add or extend a Playwright test for critical flows (browse → cart → checkout → payment result).
8. **Verify.** Run `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build`.

## Done criteria

- [ ] Every call uses the contract's path, method and DTO shape, and nothing calls webhook endpoints.
- [ ] No `any`, and response data passes Zod validation before reaching components.
- [ ] Errors are parsed as RFC 9457. Users see mapped messages, never the raw `detail`. `409` and `422` behave as the checkout flow above describes.
- [ ] Loading, error and empty states exist for every query, and buttons are disabled while their mutation runs.
- [ ] The JWT lives only in memory, and nothing auth-related is in `localStorage` or `sessionStorage`.
- [ ] Lint, type-check, tests and build are all green.
