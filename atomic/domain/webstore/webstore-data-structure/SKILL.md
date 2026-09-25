---
name: webstore-data-structure
description: Use when the user invokes /webstore-data-structure or asks about the web store relational data structure — tables, columns, types, primary keys, foreign keys, constraints, and usage rules. Technology-agnostic logical schema.
---

# Web Store — Relational Database Schema

## When to use this skill
Activate when the user types `/webstore-data-structure` or asks about the web store database structure, table definitions, column names, logical types, or relational constraints. This skill is **technology-agnostic** — it describes the logical schema only, not any specific database engine.

---

## Logical Type Glossary

| Logical type | Meaning |
|---|---|
| `UUID` | Globally unique identifier — map to the database-native UUID or equivalent |
| `STRING(n)` | Bounded variable-length text — map to `VARCHAR(n)` / `VARCHAR2(n)` / `NVARCHAR(n)` as appropriate |
| `TEXT` | Unbounded text — map to `TEXT` / `CLOB` / `NVARCHAR(MAX)` as appropriate |
| `DECIMAL(p,s)` | Exact fixed-point number — map to `NUMERIC(p,s)` / `NUMBER(p,s)` / `DECIMAL(p,s)` as appropriate |
| `CHAR(n)` | Fixed-length string — for codes with a defined exact length (e.g. currency ISO 4217 = 3 chars) |
| `INT` | Integer number |
| `BIGINT` | Large integer — for counters that may grow beyond INT range (e.g. optimistic lock version) |
| `BOOLEAN` | True / false flag — map to `BOOLEAN`, `BIT`, `NUMBER(1)`, etc. as appropriate |
| `DATE` | Calendar date with no time component |
| `TIMESTAMP` | Date and time, stored in UTC |

---

## Schema Overview

15 tables covering the full domain:

```
category (self-referencing)
  └── product
        └── product_image
        └── cart_item ──────────────────────► cart ──► customer
        └── order_item ──► order ──► payment       └──► customer_address
                               └──► customer
                               └──► shipping_method

coupon ──► cart

inventory_audit_log ──► product
                   └──► order
```

---

## Tables

### `customer`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `email` | `STRING(255)` | NOT NULL, UNIQUE |
| `full_name` | `STRING(255)` | NOT NULL |
| `password_hash` | `STRING(255)` | NOT NULL |
| `active` | `BOOLEAN` | NOT NULL, default `true` |
| `created_at` | `TIMESTAMP` | NOT NULL |
| `updated_at` | `TIMESTAMP` | NOT NULL |

---

### `customer_address`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `customer_id` | `UUID` | NOT NULL, FK → `customer.id` |
| `street` | `STRING(255)` | NOT NULL |
| `city` | `STRING(100)` | NOT NULL |
| `state` | `STRING(100)` | NOT NULL |
| `postal_code` | `STRING(20)` | NOT NULL |
| `country` | `STRING(100)` | NOT NULL |
| `is_default` | `BOOLEAN` | NOT NULL, default `false` |
| `created_at` | `TIMESTAMP` | NOT NULL |
| `updated_at` | `TIMESTAMP` | NOT NULL |

---

### `category`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `name` | `STRING(255)` | NOT NULL |
| `slug` | `STRING(255)` | NOT NULL, UNIQUE |
| `parent_id` | `UUID` | nullable, FK → `category.id` (self-referencing) |
| `sort_order` | `INT` | NOT NULL, default `0` |
| `created_at` | `TIMESTAMP` | NOT NULL |
| `updated_at` | `TIMESTAMP` | NOT NULL |

---

### `product`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `sku` | `STRING(100)` | NOT NULL, UNIQUE |
| `name` | `STRING(255)` | NOT NULL |
| `description` | `TEXT` | nullable |
| `price` | `DECIMAL(19,4)` | NOT NULL, CHECK (`price > 0`) |
| `currency` | `CHAR(3)` | NOT NULL, default `'USD'` |
| `stock_quantity` | `INT` | NOT NULL, default `0`, CHECK (`stock_quantity >= 0`) |
| `version` | `BIGINT` | NOT NULL, default `0` — optimistic lock |
| `category_id` | `UUID` | nullable, FK → `category.id` |
| `status` | `STRING(20)` | NOT NULL, allowed values: `ACTIVE`, `DRAFT`, `ARCHIVED` |
| `reorder_point` | `INT` | NOT NULL, default `5` |
| `created_at` | `TIMESTAMP` | NOT NULL |
| `updated_at` | `TIMESTAMP` | NOT NULL |

---

### `product_image`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `product_id` | `UUID` | NOT NULL, FK → `product.id` |
| `url` | `STRING(500)` | NOT NULL |
| `sort_order` | `INT` | NOT NULL, default `0` |
| `created_at` | `TIMESTAMP` | NOT NULL |

---

### `shipping_method`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `name` | `STRING(100)` | NOT NULL |
| `cost` | `DECIMAL(19,4)` | NOT NULL, CHECK (`cost >= 0`) |
| `currency` | `CHAR(3)` | NOT NULL, default `'USD'` |
| `estimated_days` | `INT` | NOT NULL |
| `active` | `BOOLEAN` | NOT NULL, default `true` |
| `created_at` | `TIMESTAMP` | NOT NULL |
| `updated_at` | `TIMESTAMP` | NOT NULL |

---

### `coupon`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `code` | `STRING(50)` | NOT NULL, UNIQUE |
| `discount_type` | `STRING(20)` | NOT NULL, allowed values: `PERCENTAGE`, `FIXED_AMOUNT` |
| `value` | `DECIMAL(19,4)` | NOT NULL, CHECK (`value > 0`) |
| `min_order_amount` | `DECIMAL(19,4)` | nullable |
| `max_uses` | `INT` | nullable |
| `used_count` | `INT` | NOT NULL, default `0` |
| `expires_at` | `TIMESTAMP` | nullable |
| `active` | `BOOLEAN` | NOT NULL, default `true` |
| `created_at` | `TIMESTAMP` | NOT NULL |
| `updated_at` | `TIMESTAMP` | NOT NULL |

---

### `cart`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `customer_id` | `UUID` | nullable, FK → `customer.id`, UNIQUE |
| `session_id` | `STRING(128)` | nullable, UNIQUE |
| `coupon_id` | `UUID` | nullable, FK → `coupon.id` |
| `updated_at` | `TIMESTAMP` | NOT NULL |

> Either `customer_id` or `session_id` must be set — never both null, never both set simultaneously.

---

### `cart_item`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `cart_id` | `UUID` | NOT NULL, FK → `cart.id` |
| `product_id` | `UUID` | NOT NULL, FK → `product.id` |
| `quantity` | `INT` | NOT NULL, CHECK (`quantity >= 1`) |
| `unit_price` | `DECIMAL(19,4)` | NOT NULL — live price snapshot |
| `created_at` | `TIMESTAMP` | NOT NULL |
| `updated_at` | `TIMESTAMP` | NOT NULL |

> UNIQUE (`cart_id`, `product_id`) — the same product cannot appear twice in a cart.

---

### `order`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `customer_id` | `UUID` | NOT NULL, FK → `customer.id` |
| `status` | `STRING(20)` | NOT NULL, allowed values: `PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED` |
| `subtotal` | `DECIMAL(19,4)` | NOT NULL |
| `discount_amount` | `DECIMAL(19,4)` | NOT NULL, default `0` |
| `shipping_cost` | `DECIMAL(19,4)` | NOT NULL, default `0` |
| `total` | `DECIMAL(19,4)` | NOT NULL |
| `currency` | `CHAR(3)` | NOT NULL, default `'USD'` |
| `shipping_street` | `STRING(255)` | NOT NULL |
| `shipping_city` | `STRING(100)` | NOT NULL |
| `shipping_state` | `STRING(100)` | NOT NULL |
| `shipping_postal_code` | `STRING(20)` | NOT NULL |
| `shipping_country` | `STRING(100)` | NOT NULL |
| `billing_street` | `STRING(255)` | nullable |
| `billing_city` | `STRING(100)` | nullable |
| `billing_state` | `STRING(100)` | nullable |
| `billing_postal_code` | `STRING(20)` | nullable |
| `billing_country` | `STRING(100)` | nullable |
| `shipping_method_id` | `UUID` | nullable, FK → `shipping_method.id` |
| `tracking_carrier` | `STRING(100)` | nullable |
| `tracking_number` | `STRING(100)` | nullable |
| `placed_at` | `TIMESTAMP` | NOT NULL |
| `updated_at` | `TIMESTAMP` | NOT NULL |

> Shipping address is embedded (denormalized) to freeze it at order time — it must never reference `customer_address`.

---

### `order_item`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `order_id` | `UUID` | NOT NULL, FK → `order.id` |
| `product_id` | `UUID` | NOT NULL, FK → `product.id` |
| `sku` | `STRING(100)` | NOT NULL — frozen snapshot |
| `name` | `STRING(255)` | NOT NULL — frozen snapshot |
| `quantity` | `INT` | NOT NULL, CHECK (`quantity >= 1`) |
| `unit_price` | `DECIMAL(19,4)` | NOT NULL — frozen at checkout |
| `line_total` | `DECIMAL(19,4)` | NOT NULL — `unit_price × quantity` |
| `created_at` | `TIMESTAMP` | NOT NULL |

---

### `payment`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `order_id` | `UUID` | NOT NULL, FK → `order.id`, UNIQUE |
| `gateway` | `STRING(50)` | NOT NULL — e.g. `STRIPE`, `PAYPAL`, `MERCADOPAGO` |
| `gateway_reference` | `STRING(255)` | nullable, UNIQUE — gateway transaction ID |
| `idempotency_key` | `UUID` | NOT NULL, UNIQUE |
| `amount` | `DECIMAL(19,4)` | NOT NULL |
| `currency` | `CHAR(3)` | NOT NULL |
| `status` | `STRING(20)` | NOT NULL, allowed values: `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED` |
| `created_at` | `TIMESTAMP` | NOT NULL |
| `updated_at` | `TIMESTAMP` | NOT NULL |

---

### `inventory_audit_log`
| Column | Logical Type | Constraints |
|---|---|---|
| `id` | `UUID` | PK |
| `product_id` | `UUID` | NOT NULL, FK → `product.id` |
| `change_type` | `STRING(20)` | NOT NULL, allowed values: `DEDUCTION`, `RESTORATION`, `ADJUSTMENT` |
| `delta` | `INT` | NOT NULL — positive = stock in, negative = stock out |
| `reason` | `STRING(255)` | nullable |
| `actor` | `STRING(255)` | nullable — admin email or system identifier |
| `order_id` | `UUID` | nullable, FK → `order.id` |
| `created_at` | `TIMESTAMP` | NOT NULL |

> `inventory_audit_log` is **append-only** — rows are never updated or deleted.

---

## Usage Rules

- `cart.customer_id` and `cart.session_id` are mutually exclusive — exactly one must be set.
- `cart_item` has a UNIQUE constraint on `(cart_id, product_id)` — the same product cannot appear twice in a cart.
- `order_item.sku`, `order_item.name`, and `order_item.unit_price` are frozen snapshots — never updated after order placement.
- `order_item.line_total = unit_price × quantity` — computed at placement and stored; never recalculated.
- `order` embeds the shipping address as flat columns — must not reference `customer_address` to preserve the address at order time.
- `product.version` is used for optimistic locking on stock deduction — always include it in the UPDATE WHERE clause.
- `payment.gateway_reference` and `payment.idempotency_key` are both UNIQUE — use `gateway_reference` to detect duplicate webhook deliveries.
- `inventory_audit_log` is append-only — never issue UPDATE or DELETE on this table.

---

## How to use this skill
1. Use this schema as the canonical logical reference for database design, migrations, and ORM entity mapping.
2. Map logical types to concrete database types using the technology-specific DDL skill (`webstore-database-postgres`, `tech-database-oracle`, etc.).
3. Refer to `webstore-domain` for the business meaning of each entity, domain events, and value objects.
4. Respond and assist in English unless the user requests another language.
5. Await further instructions from the user and execute them accordingly.
