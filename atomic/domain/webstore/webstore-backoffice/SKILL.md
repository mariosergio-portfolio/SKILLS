---
name: webstore-backoffice
description: Web store back-office (admin) module rules: product and category management, order handling, inventory adjustments, customer deactivation, coupon management, sales reports, and the STAFF/MANAGER/ADMIN role model. Use when building admin features for the web store.
---

# Web Store — Backoffice Module

## Related skills

> Skills referenced by name below are sibling skills in this library. Load each one with the Skill tool (or `/<skill-name>`) before continuing; do not guess their content.

**Always load first:**
- `webstore-domain` — entity definitions and business rules

**Load relevant module skills for the area being worked on:**
- `webstore-catalog` — product and category admin rules
- `webstore-orders` — order status transitions and cancellation rules
- `webstore-inventory` — stock adjustment and audit log rules
- `webstore-payments` — refund initiation rules

---

## Responsibilities
- Provide admin-only endpoints for full CRUD on products and categories.
- Allow admins to manage the order lifecycle (advance status, cancel, attach tracking).
- Enable manual inventory adjustments with audit trail.
- Manage customer accounts (view, deactivate).
- Manage coupons (create, activate, deactivate, view usage).
- Expose operational reports (sales summary, low-stock list, top products).

---

## Use Cases

### Product & Category Management
| Use Case | Description |
|---|---|
| `CreateProduct` | Create a new product (validates SKU uniqueness, price > 0, category exists) |
| `UpdateProduct` | Full or partial update of any product field except SKU |
| `ArchiveProduct` | Soft-delete: set status to `ARCHIVED`; product remains in past orders |
| `RestoreProduct` | Set status back to `ACTIVE` or `DRAFT` from `ARCHIVED` |
| `CreateCategory` | Create category (validates slug uniqueness, no parent cycle) |
| `UpdateCategory` | Update name, slug, parent, or sort order |
| `DeleteCategory` | Delete only if no products are assigned |

### Order Management
| Use Case | Description |
|---|---|
| `ListAllOrders` | Paginated list with filters: `status`, `customerId`, `from`, `to`, `q` (search by id or customer email) |
| `GetOrderDetailAdmin` | Full order detail including payment info and audit trail |
| `AdvanceOrderStatus` | Move order to next valid status; validate transition rules |
| `SetShippingTracking` | Attach `trackingCarrier` and `trackingNumber` when advancing to `SHIPPED` |
| `AdminCancelOrder` | Cancel from `PENDING` or `PAID`; if `PAID` initiate refund |

### Inventory Management
| Use Case | Description |
|---|---|
| `ListInventory` | All products with current stock levels; `?lowStock=true` filter |
| `AdjustStock` | Manual stock increase or decrease with reason and actor recorded |
| `GetInventoryAuditLog` | Paginated audit log per product |

### Customer Management
| Use Case | Description |
|---|---|
| `ListCustomers` | Paginated customer list with search by name or email |
| `GetCustomerDetail` | Full customer profile with order history summary |
| `DeactivateCustomer` | Prevent login; does not delete data or past orders |
| `ReactivateCustomer` | Re-enable a deactivated customer account |

### Coupon Management
| Use Case | Description |
|---|---|
| `CreateCoupon` | Create a new coupon (validates code uniqueness, value, expiry) |
| `UpdateCoupon` | Update discount value, expiry, max uses, or min order amount |
| `ActivateCoupon` | Set `active = true` |
| `DeactivateCoupon` | Set `active = false`; existing uses are unaffected |
| `ListCoupons` | Paginated list with filters: `active`, `expired`, `code` |
| `GetCouponUsage` | Usage count and list of orders that used the coupon |

### Reporting
| Use Case | Description |
|---|---|
| `GetSalesSummary` | Total revenue, order count, average order value for a date range |
| `GetTopProducts` | Top N products by units sold or revenue for a date range |
| `GetLowStockReport` | All products with `stockQuantity < reorderPoint` |
| `GetOrderStatusBreakdown` | Count of orders per status for a date range |
| `GetRevenueByCategory` | Revenue grouped by product category for a date range |

---

## API

Endpoints, access rules and DTOs are defined only in the `webstore-api-contract` skill; load it before writing or calling an endpoint. For this module see the Admin sections of the contract (`/api/admin/**`). Access control below is summarised there per endpoint.

---

## Access Control
- Three back-office roles: `STAFF` (read-only), `MANAGER` (read + revenue reports), and `ADMIN` (everything).
- Every `/api/admin/**` read is open to staff. Every write (create, update, archive, adjust, status change, cancel) is admin-only.
- Revenue reports (`sales`, `top-products`, `revenue-by-category`) require `MANAGER` or `ADMIN`.
- The exact role for each endpoint is in `webstore-api-contract`.

---

## Business Rules
1. Archiving a product does not affect existing orders or order history.
2. Deleting a category is only allowed when no products reference it.
3. Deactivating a customer does not cancel active orders — handle those separately.
4. Coupon deactivation is immediate; in-flight carts with the coupon applied should re-validate at checkout.
5. Stock adjustments with negative `delta` that would result in `stockQuantity < 0` are rejected.
6. Report queries over large date ranges should be served from a read model or materialized view, not live aggregation.

---

## How to use this skill
1. Load `webstore-domain` for entity and rule definitions.
2. Load the relevant module skills when implementing a specific backoffice area (catalog, orders, inventory, payments).
3. Enforce the per-endpoint roles from `webstore-api-contract` on every `/api/admin/**` route (staff read, admin write, manager for revenue reports).
4. Use the use cases list to name application services and input ports.
5. For reports, prefer dedicated read-model queries over full-aggregate loading.
