---
name: webstore-backoffice
description: Use when the user invokes /webstore-backoffice or asks about the web store backoffice module — admin product management, order management, inventory adjustments, customer management, coupon management, and reporting.
---

# Web Store — Backoffice Module

## When to use this skill
Activate when the user types `/webstore-backoffice` or asks about admin-facing operations: managing products, categories, orders, inventory, customers, coupons, or generating reports.

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

## REST Endpoints

### Products & Categories
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/products` | Create product |
| `PUT` | `/api/admin/products/{id}` | Full update |
| `PATCH` | `/api/admin/products/{id}` | Partial update |
| `DELETE` | `/api/admin/products/{id}` | Archive |
| `PATCH` | `/api/admin/products/{id}/restore` | Restore from archived |
| `POST` | `/api/admin/categories` | Create category |
| `PUT` | `/api/admin/categories/{id}` | Update category |
| `DELETE` | `/api/admin/categories/{id}` | Delete category |

### Orders
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/orders` | List all orders (`?status=`, `?customerId=`, `?from=`, `?to=`, `?q=`) |
| `GET` | `/api/admin/orders/{id}` | Full order detail |
| `PATCH` | `/api/admin/orders/{id}/status` | Advance status (body: `status`, `trackingCarrier`, `trackingNumber`) |
| `DELETE` | `/api/admin/orders/{id}` | Cancel order |

### Inventory
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/inventory` | All stock levels (`?lowStock=true`) |
| `GET` | `/api/admin/inventory/{productId}` | Stock level for one product |
| `PATCH` | `/api/admin/inventory/{productId}` | Manual adjustment (`delta`, `reason`, `actor`) |
| `GET` | `/api/admin/inventory/{productId}/audit` | Audit log for one product |

### Customers
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/customers` | List customers (`?q=`, `?page=`, `?size=`) |
| `GET` | `/api/admin/customers/{id}` | Customer detail |
| `PATCH` | `/api/admin/customers/{id}/deactivate` | Deactivate customer |
| `PATCH` | `/api/admin/customers/{id}/reactivate` | Reactivate customer |

### Coupons
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/coupons` | List coupons (`?active=`, `?expired=`) |
| `POST` | `/api/admin/coupons` | Create coupon |
| `PUT` | `/api/admin/coupons/{id}` | Update coupon |
| `PATCH` | `/api/admin/coupons/{id}/activate` | Activate |
| `PATCH` | `/api/admin/coupons/{id}/deactivate` | Deactivate |
| `GET` | `/api/admin/coupons/{id}/usage` | Usage details |

### Reports
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/reports/sales` | Sales summary (`?from=`, `?to=`) |
| `GET` | `/api/admin/reports/top-products` | Top products (`?from=`, `?to=`, `?limit=10`, `?by=units\|revenue`) |
| `GET` | `/api/admin/reports/low-stock` | Low-stock report |
| `GET` | `/api/admin/reports/order-status` | Order status breakdown (`?from=`, `?to=`) |
| `GET` | `/api/admin/reports/revenue-by-category` | Revenue by category (`?from=`, `?to=`) |

---

## Access Control
- All `/api/admin/**` endpoints require `ROLE_ADMIN`.
- Report endpoints may additionally require `ROLE_MANAGER` for sensitive revenue data.
- Customer and product endpoints accessible to `ROLE_ADMIN` and `ROLE_STAFF` (read-only for staff).

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
3. Always enforce `ROLE_ADMIN` on all `/api/admin/**` routes.
4. Use the use cases list to name application services and input ports.
5. For reports, prefer dedicated read-model queries over full-aggregate loading.
6. Respond and assist in English unless the user requests another language.
7. Await further instructions from the user and execute them accordingly within the backoffice module context.
