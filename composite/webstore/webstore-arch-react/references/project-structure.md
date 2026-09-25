# webstore-arch-react — Project structure

Reference file for the `webstore-arch-react` skill. Read it when scaffolding the project or deciding where a file goes.

## Project Structure

```
webstore-frontend/
├── src/
│   ├── domain/
│   │   └── types/                  ← Product, Category, Cart, Order, Payment, … (readonly interfaces)
│   │
│   ├── api/
│   │   ├── client.ts               ← Axios base client; attaches JWT; handles 401 → refresh → retry
│   │   ├── errors.ts               ← ProblemDetail parser; ApiError class; status → user message map
│   │   └── endpoints/              ← one file per back-end resource (see table above)
│   │
│   ├── modules/
│   │   ├── catalog/
│   │   │   ├── pages/              ← ProductListPage, ProductDetailPage, CategoryPage
│   │   │   ├── components/         ← ProductCard, ProductGrid, FilterPanel, CategoryTree,
│   │   │   │                          SearchBar, PriceRangeSlider, ProductImageGallery
│   │   │   ├── hooks/              ← useProducts, useProduct, useCategories, useCategory
│   │   │   └── store.ts            ← filters, sort, pagination UI state
│   │   │
│   │   ├── cart/
│   │   │   ├── pages/              ← CartPage
│   │   │   ├── components/         ← CartItemRow, CartSummary, CouponInput, EmptyCart
│   │   │   ├── hooks/              ← useCart, useAddToCart, useUpdateCartItem,
│   │   │   │                          useRemoveCartItem, useApplyCoupon, useRemoveCoupon,
│   │   │   │                          useRefreshCart
│   │   │   └── store.ts            ← cart drawer open/close state
│   │   │
│   │   ├── checkout/
│   │   │   ├── pages/              ← CheckoutPage
│   │   │   ├── components/         ← AddressForm, ShippingMethodSelector,
│   │   │   │                          OrderSummary, PlaceOrderButton
│   │   │   ├── hooks/              ← useShippingMethods, usePlaceOrder
│   │   │   └── store.ts            ← checkout step state (address → shipping → review)
│   │   │
│   │   ├── orders/
│   │   │   ├── pages/              ← OrderListPage, OrderDetailPage
│   │   │   ├── components/         ← OrderCard, OrderItemRow, OrderStatusBadge,
│   │   │   │                          OrderTimeline, CancelOrderButton
│   │   │   └── hooks/              ← useOrders, useOrder, useCancelOrder
│   │   │
│   │   ├── payments/
│   │   │   ├── pages/              ← PaymentPage, PaymentResultPage
│   │   │   ├── components/         ← PaymentGatewayRedirect, PaymentStatusCard
│   │   │   └── hooks/              ← useInitiatePayment, usePaymentStatus
│   │   │
│   │   ├── auth/
│   │   │   ├── pages/              ← LoginPage, RegisterPage
│   │   │   ├── components/         ← LoginForm, RegisterForm
│   │   │   ├── hooks/              ← useLogin, useRegister, useLogout, useCurrentUser
│   │   │   └── store.ts            ← auth state: user, token, isAuthenticated, role
│   │   │
│   │   └── backoffice/
│   │       ├── products/
│   │       │   ├── pages/          ← AdminProductListPage, AdminProductFormPage
│   │       │   ├── components/     ← AdminProductTable, ProductForm, ArchiveButton, RestoreButton
│   │       │   └── hooks/          ← useAdminProducts, useCreateProduct, useUpdateProduct,
│   │       │                          useArchiveProduct, useRestoreProduct,
│   │       │                          useCreateCategory, useUpdateCategory, useDeleteCategory
│   │       ├── orders/
│   │       │   ├── pages/          ← AdminOrderListPage, AdminOrderDetailPage
│   │       │   ├── components/     ← AdminOrderTable, OrderStatusAdvancer, TrackingForm
│   │       │   └── hooks/          ← useAdminOrders, useAdminOrder, useAdvanceOrderStatus,
│   │       │                          useAdminCancelOrder
│   │       ├── inventory/
│   │       │   ├── pages/          ← AdminInventoryPage
│   │       │   ├── components/     ← StockLevelTable, StockAdjustmentForm, AuditLogTable
│   │       │   └── hooks/          ← useInventory, useStockLevel, useAdjustStock, useAuditLog
│   │       ├── customers/
│   │       │   ├── pages/          ← AdminCustomerListPage, AdminCustomerDetailPage
│   │       │   ├── components/     ← CustomerTable, CustomerStatusBadge
│   │       │   └── hooks/          ← useAdminCustomers, useAdminCustomer,
│   │       │                          useDeactivateCustomer, useReactivateCustomer
│   │       ├── coupons/
│   │       │   ├── pages/          ← AdminCouponListPage, AdminCouponFormPage
│   │       │   ├── components/     ← CouponTable, CouponForm, CouponUsageTable
│   │       │   └── hooks/          ← useAdminCoupons, useCreateCoupon, useUpdateCoupon,
│   │       │                          useActivateCoupon, useDeactivateCoupon, useCouponUsage
│   │       └── reports/
│   │           ├── pages/          ← AdminReportsPage
│   │           ├── components/     ← SalesSummaryCard, TopProductsChart,
│   │           │                      LowStockTable, OrderStatusBreakdown, RevenueByCategoryChart
│   │           └── hooks/          ← useSalesSummary, useTopProducts,
│   │                                  useLowStock, useOrderStatusBreakdown, useRevenueByCategory
│   │
│   ├── shared/
│   │   ├── components/             ← Button, Modal, Table, Spinner, Badge, Pagination,
│   │   │                              ErrorBoundary, EmptyState, ConfirmDialog,
│   │   │                              MoneyDisplay, StatusBadge
│   │   ├── hooks/                  ← useDebounce, usePagination, useLocalStorage
│   │   └── utils/                  ← formatMoney, formatDate, slugify, truncate
│   │
│   ├── router/
│   │   ├── index.tsx               ← root router: public + protected + admin routes
│   │   ├── ProtectedRoute.tsx      ← redirects unauthenticated users to /login
│   │   └── AdminRoute.tsx          ← redirects non-admin users to /
│   │
│   ├── test/
│   │   └── setup.ts
│   │
│   ├── vite-env.d.ts
│   ├── main.tsx
│   └── index.css                   ← Tailwind v4 @import + @theme tokens
│
├── e2e/                            ← Playwright E2E tests
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── eslint.config.js
└── prettier.config.js
```

---
