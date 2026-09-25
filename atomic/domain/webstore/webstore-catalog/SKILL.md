---
name: webstore-catalog
description: Use when the user invokes %webstore-catalog or asks about the web store catalog module — product listing, search, filtering, product detail, categories, and backoffice product management.
---

# Web Store — Catalog Module

## When to use this skill
Activate when the user types `%webstore-catalog` or asks about product listing, search, filtering, product detail pages (PDP), category management, or admin product CRUD.

**Always load first:**
- `%webstore-domain` — entity definitions and business rules for Product and Category

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

## REST Endpoints

| Method | Path | Visibility | Description |
|---|---|---|---|
| `GET` | `/api/products` | Public | List / search products (`?q=`, `?categoryId=`, `?minPrice=`, `?maxPrice=`, `?page=`, `?size=`, `?sort=`) |
| `GET` | `/api/products/{id}` | Public | Product detail |
| `POST` | `/api/products` | Admin | Create product |
| `PUT` | `/api/products/{id}` | Admin | Full update |
| `PATCH` | `/api/products/{id}` | Admin | Partial update |
| `DELETE` | `/api/products/{id}` | Admin | Archive (soft-delete) |
| `GET` | `/api/categories` | Public | List categories |
| `GET` | `/api/categories/{id}` | Public | Category detail with products |
| `POST` | `/api/categories` | Admin | Create category |
| `PUT` | `/api/categories/{id}` | Admin | Update category |
| `DELETE` | `/api/categories/{id}` | Admin | Delete category |

---

## Filtering & Pagination
- Default page size: 20; max: 100.
- Sort fields: `name`, `price`, `createdAt`.
- Filters applied server-side via OData-style query params.
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
1. Load `%webstore-domain` for entity and rule definitions.
2. Use the use cases list to name application services and input ports.
3. Follow the REST endpoints table when implementing or reviewing controllers.
4. Apply filtering, pagination, and visibility rules to every query.
5. Respond and assist in English unless the user requests another language.
6. Await further instructions from the user and execute them accordingly within the catalog module context.
