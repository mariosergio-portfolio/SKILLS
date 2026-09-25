---
name: webstore-catalog
description: Web store catalog module rules: product listing and full-text search, filters, sorting, pagination limits, product detail, the category tree, and visibility of ACTIVE/DRAFT/ARCHIVED products. Use when building or reviewing product or category features in the web store.
---

# Web Store — Catalog Module

## Related skills

> Skills referenced by name below are sibling skills in this library. Load each one with the Skill tool (or `/<skill-name>`) before continuing; do not guess their content.

**Always load first:**
- `webstore-domain` — entity definitions and business rules for Product and Category

---

## Responsibilities
- Expose the public product catalog (listing, search, filtering, detail).
- Manage the category hierarchy.
- Provide admin operations for product creation, update, and archiving.

---

## Use Cases

### Storefront (public)
| Use Case | Description |
|---|---|
| `ListProducts` | Return paginated, filterable product list (by category, price range, status=ACTIVE) |
| `SearchProducts` | Full-text search on name and description (`?q=`) |
| `GetProductDetail` | Return full product data for a given `id` or `sku` |
| `ListCategories` | Return category tree or flat list |
| `GetCategory` | Return single category with its products |

### Backoffice (admin)
| Use Case | Description |
|---|---|
| `CreateProduct` | Create a new product (validates SKU uniqueness, price > 0) |
| `UpdateProduct` | Full or partial update of product fields |
| `ArchiveProduct` | Soft-delete: set status to `ARCHIVED` |
| `CreateCategory` | Create a new category (validates slug uniqueness, no cycles) |
| `UpdateCategory` | Update name, slug, parent, or sort order |
| `DeleteCategory` | Delete only if no products are assigned |

---

## API

Endpoints, access rules and DTOs are defined only in the `webstore-api-contract` skill; load it before writing or calling an endpoint. For this module see the Catalog section (public reads) and Admin — catalog section (writes under `/api/admin/products` and `/api/admin/categories`).

---

## Filtering & Pagination
- Default page size: 20; max: 100.
- Sort fields: `name`, `price`, `createdAt`.
- Filters are plain query parameters, applied server-side.
- Full-text search (`?q=`) matches name and description (case-insensitive).
- Only `ACTIVE` products are returned to public endpoints; admin endpoints see all statuses.

---

## Business Rules (Catalog-specific)
1. SKU is immutable after creation.
2. Archiving a product does not remove it from existing orders.
3. Category slug changes must be propagated to any cached URLs.
4. A product may belong to exactly one category (single-level assignment); the category tree is for navigation only.

---

## How to use this skill
1. Load `webstore-domain` for entity and rule definitions.
2. Use the use cases list to name application services and input ports.
3. Take endpoint paths, access and DTOs from `webstore-api-contract` (public reads under `/api`, admin writes under `/api/admin`).
4. Apply filtering, pagination, and visibility rules to every query.
