---
name: tech-database-postgres
description: PostgreSQL schema design reference: naming conventions, data types, named constraints, indexes, partitioning, identity/sequences, ENUM types, triggers, audit columns, optimistic locking, and DDL anti-patterns. Use when writing or reviewing PostgreSQL DDL or migrations.
---

# PostgreSQL — DDL Good Practices & Design Reference

## General DDL Principles

- **Schema migrations over manual DDL** — always manage DDL through a versioned migration tool (Flyway, Liquibase). Never apply raw DDL directly to a production database outside a migration pipeline.
- **One concern per migration file** — each migration adds, alters, or drops exactly one logical unit (one table, one index batch, one constraint). Never bundle unrelated changes.
- **Immutable migrations** — once a migration is applied to any environment, never edit it. Add a new migration to correct mistakes.
- **Never use `DROP … CASCADE` in production migrations** — be explicit about what is dropped.
- **All DDL inside a transaction** — Flyway and Liquibase wrap DDL in transactions by default; keep it that way so a failed migration is fully rolled back.

---

## Naming Conventions

| Object | Convention | Example |
|--------|-----------|---------|
| Table | `snake_case`, plural | `order_items`, `customer_addresses` |
| Column | `snake_case` | `created_at`, `unit_price` |
| Primary key constraint | `pk_<table>` | `pk_order_items` |
| Foreign key constraint | `fk_<table>_<referenced_table>` | `fk_order_items_orders` |
| Unique constraint | `uq_<table>_<columns>` | `uq_customers_email` |
| Check constraint | `ck_<table>_<rule>` | `ck_products_price_positive` |
| Index | `idx_<table>_<columns>` | `idx_orders_customer_id` |
| Partial index | `idx_<table>_<columns>_<condition>` | `idx_orders_status_pending` |
| Sequence | `seq_<table>_<column>` | `seq_invoices_number` |
| ENUM type | `<domain>_status` or `<domain>_type` | `order_status`, `discount_type` |
| Schema | `snake_case`, singular domain | `catalog`, `payments`, `identity` |
| Trigger | `trg_<table>_<event>` | `trg_products_set_updated_at` |
| Trigger function | `fn_<table>_<event>` | `fn_products_set_updated_at` |

> Use **explicit constraint names** on every constraint — never rely on PostgreSQL auto-generated names. Explicit names make error messages readable and allow targeted `ALTER TABLE … DROP CONSTRAINT`.

---

## Primary Keys

### UUID (preferred for distributed / API-exposed IDs)
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```
- `gen_random_uuid()` (built-in since PG 13) — no extension required.
- Never expose sequential integers as public API identifiers.
- Use `UUID` for all tables that communicate IDs to clients or external systems.

### BIGSERIAL (preferred for high-volume internal/audit tables)
```sql
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```
- Prefer `GENERATED ALWAYS AS IDENTITY` over the legacy `SERIAL` pseudo-type.
- Suitable for append-only logs, audit trails, and internal join tables.

---

## Data Types — Choosing the Right One

| Use case | Recommended type | Avoid |
|----------|-----------------|-------|
| Monetary / financial amounts | `NUMERIC(19,4)` | `FLOAT`, `REAL`, `DOUBLE PRECISION` — they have rounding errors |
| Percentage / rate | `NUMERIC(5,4)` (e.g. 0.1750 = 17.50 %) | `FLOAT` |
| Short enumerated value (mutable list) | `VARCHAR(30)` + CHECK | `TEXT` without constraint |
| Short enumerated value (stable list) | PostgreSQL `ENUM` type | `INT` code columns |
| Timestamps (UTC stored, timezone-aware) | `TIMESTAMPTZ` | `TIMESTAMP` (no tz info) |
| Timestamps (pure UTC, no tz conversion needed) | `TIMESTAMP` with application-enforced UTC | mixed usage |
| Date only | `DATE` | `TIMESTAMP` with time stripped in code |
| Boolean flags | `BOOLEAN` | `SMALLINT`, `CHAR(1)` |
| Free text, long content | `TEXT` | `VARCHAR` without a length limit (same storage, less clear intent) |
| Short bounded string | `VARCHAR(n)` | `TEXT` when length has domain meaning |
| Binary data | `BYTEA` | storing Base64 as `TEXT` |
| JSON documents (queried) | `JSONB` | `JSON` (not indexable efficiently) |
| JSON documents (stored only) | `JSON` | — |
| IP addresses | `INET` or `CIDR` | `VARCHAR` |
| Currency code | `CHAR(3)` (ISO 4217) | free `TEXT` |
| Country / language code | `CHAR(2)` or `VARCHAR(5)` | free `TEXT` |
| Coordinates | `POINT` / PostGIS `GEOMETRY` | two separate `FLOAT` columns |

---

## Constraints

### NOT NULL
Apply `NOT NULL` to every column that must always have a value — make nullability a deliberate, documented choice.

### UNIQUE
```sql
-- single-column unique
CONSTRAINT uq_customers_email UNIQUE (email)

-- multi-column unique
CONSTRAINT uq_cart_items_cart_product UNIQUE (cart_id, product_id)
```
Always name UNIQUE constraints explicitly.

### CHECK
```sql
CONSTRAINT ck_products_price_positive  CHECK (price > 0),
CONSTRAINT ck_products_stock_non_neg   CHECK (stock_quantity >= 0),
CONSTRAINT ck_orders_status            CHECK (status IN ('PENDING','PAID','SHIPPED','DELIVERED','CANCELLED')),
CONSTRAINT ck_carts_identity           CHECK (
    (customer_id IS NOT NULL AND session_id IS NULL) OR
    (customer_id IS NULL     AND session_id IS NOT NULL)
)
```
- Use CHECK for domain invariants that PostgreSQL can enforce without a trigger.
- Prefer CHECK over application-only validation for critical business rules.

### FOREIGN KEY
```sql
CONSTRAINT fk_order_items_orders   FOREIGN KEY (order_id)   REFERENCES orders(id),
CONSTRAINT fk_order_items_products FOREIGN KEY (product_id) REFERENCES products(id)
```
- Always name FKs explicitly.
- Default action on delete is `NO ACTION` — prefer it unless you have a clear cascade/set-null requirement.
- Use `ON DELETE CASCADE` only for owned child entities (e.g. `order_item` → `order`).
- Use `ON DELETE SET NULL` for optional references (e.g. `product.category_id`).
- **Never** use `ON DELETE CASCADE` on financial or audit records.

### DEFERRABLE constraints
```sql
CONSTRAINT fk_node_parent FOREIGN KEY (parent_id) REFERENCES nodes(id)
    DEFERRABLE INITIALLY DEFERRED
```
Use `DEFERRABLE INITIALLY DEFERRED` for self-referencing tables or when bulk-inserting a tree structure where parent/child rows arrive in arbitrary order.

---

## PostgreSQL ENUM Types

```sql
-- Define before the table that uses it
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE discount_type AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

CREATE TABLE orders (
    id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    status order_status NOT NULL DEFAULT 'PENDING'
);
```

**When to use ENUM vs VARCHAR + CHECK:**

| Scenario | Prefer |
|----------|--------|
| Small, stable list (rarely changes) | `ENUM` — enforced at type level, self-documenting |
| List that may grow via migrations | `VARCHAR(n)` + CHECK — adding a value to an ENUM requires `ALTER TYPE … ADD VALUE` (non-transactional in PG < 12) |
| Shared across multiple tables | `ENUM` — single definition, reused |
| Mapped to a Java/Kotlin enum | `ENUM` or `VARCHAR` + CHECK — both work well with JPA/Hibernate |

**Adding a value to a live ENUM (PG 12+):**
```sql
ALTER TYPE order_status ADD VALUE 'REFUNDED' AFTER 'DELIVERED';
```

---

## Timestamps & Timezone Handling

```sql
-- Preferred: store as TIMESTAMPTZ, PostgreSQL converts on read/write
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

- Always store timestamps in **UTC**.
- Use `TIMESTAMPTZ` (`TIMESTAMP WITH TIME ZONE`) so PostgreSQL normalises input to UTC and converts to the session timezone on output.
- Use `now()` or `CURRENT_TIMESTAMP` for defaults — both are transaction-time-stable within a transaction.
- Use `clock_timestamp()` only when you need the real wall-clock time inside a long transaction (e.g. step-by-step audit logging).

---

## Auto-updating `updated_at` via Trigger

```sql
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply to every table that has updated_at
CREATE TRIGGER trg_products_set_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

- Define the function once and reuse it across tables.
- Always use `BEFORE UPDATE` — the value must be set before the row is written.

---

## Indexing Strategy

### Always index
- All foreign key columns (PostgreSQL does not auto-index FKs).
- Columns used in frequent `WHERE` filters (status, date ranges, category).
- Columns used in `ORDER BY` on large tables.

### Partial indexes (powerful PostgreSQL feature)
```sql
-- Only index rows that need attention
CREATE INDEX idx_orders_status_pending
    ON orders(created_at)
    WHERE status = 'PENDING';

-- Only index active products
CREATE INDEX idx_products_sku_active
    ON products(sku)
    WHERE status = 'ACTIVE';
```
Partial indexes are smaller, faster, and reduce write overhead. Use them whenever a query always filters on a column with few distinct values.

### Composite indexes — column order matters
```sql
-- Supports: WHERE customer_id = ? ORDER BY placed_at DESC
CREATE INDEX idx_orders_customer_placed
    ON orders(customer_id, placed_at DESC);
```
Put equality-filter columns first, range/sort columns last.

### Covering indexes (INCLUDE)
```sql
-- Query reads only from the index, avoids heap fetch
CREATE INDEX idx_order_items_order_covering
    ON order_items(order_id)
    INCLUDE (product_id, quantity, unit_price);
```
Use `INCLUDE` to add non-filter columns that are frequently selected alongside the indexed column.

### Index types
| Type | Use case |
|------|---------|
| `BTREE` (default) | Equality, range, ORDER BY — the general-purpose default |
| `GIN` | JSONB containment (`@>`), full-text search (`tsvector`), array containment |
| `GiST` | Geometric types, PostGIS, range overlap |
| `HASH` | Equality-only lookups on very large tables (rarely needed) |
| `BRIN` | Append-only, physically ordered tables (audit logs, time-series) — extremely small |

### What NOT to index
- Columns with very low cardinality that are not used in partial indexes (e.g. a boolean flag on a table that is 99 % `true`).
- Columns that are never filtered, joined, or sorted.
- Every column "just in case" — index bloat slows writes and wastes storage.

---

## Sequences & Custom ID Generation

```sql
-- Custom sequential invoice number (not the PK)
CREATE SEQUENCE seq_invoices_number
    START WITH 1000
    INCREMENT BY 1
    NO CYCLE;

ALTER TABLE invoices
    ADD COLUMN invoice_number BIGINT NOT NULL DEFAULT nextval('seq_invoices_number');
```

- Use sequences for business-visible sequential numbers (invoice numbers, order numbers) — keep UUIDs as the technical PK.
- `GENERATED ALWAYS AS IDENTITY` is syntax sugar over sequences and is preferred for surrogate PKs.

---

## Schemas (Namespacing)

```sql
CREATE SCHEMA catalog;
CREATE SCHEMA payments;
CREATE SCHEMA identity;

SET search_path = catalog, public;
```

- Use PostgreSQL schemas to namespace large databases by domain (microservice boundary simulation in a monolith).
- Cross-schema FKs are allowed but introduce coupling — use them sparingly.
- Keep `public` for shared lookup tables or migration history only.

---

## Partitioning

Use table partitioning for tables expected to grow beyond tens of millions of rows.

```sql
-- Range partition by month (audit logs, events, time-series)
CREATE TABLE audit_logs (
    id         BIGINT GENERATED ALWAYS AS IDENTITY,
    event_type VARCHAR(50)  NOT NULL,
    payload    JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2025_01
    PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- List partition by tenant or status
CREATE TABLE orders (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status order_status NOT NULL,
    ...
) PARTITION BY LIST (status);
```

- Attach indexes to the **parent** table — they are inherited by all partitions automatically (PG 11+).
- Use `pg_partman` extension to automate partition creation and retention.
- Do **not** partition tables with fewer than ~5M rows — the overhead outweighs the benefit.

---

## JSONB — When and How

```sql
CREATE TABLE product_attributes (
    id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID  NOT NULL REFERENCES products(id),
    attributes JSONB NOT NULL DEFAULT '{}'
);

-- GIN index for containment queries
CREATE INDEX idx_product_attributes_gin
    ON product_attributes USING GIN (attributes);

-- Query example
SELECT * FROM product_attributes
WHERE attributes @> '{"color": "red", "size": "M"}';
```

**Use JSONB when:**
- Attributes are sparse and vary by product type (EAV pattern replacement).
- The schema is intentionally flexible and evolves per product category.
- You need containment or key-existence queries.

**Do not use JSONB when:**
- The same fields appear on every row — model them as proper columns.
- You need FK integrity or CHECK constraints on the values inside.
- You query individual fields with equality filters frequently without a path expression.

---

## Row-Level Security (RLS)

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_tenant_isolation
    ON orders
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

- Enable RLS for multi-tenant schemas where data isolation must be enforced at the database layer.
- Set `app.current_tenant` (or equivalent) in the connection/session before executing queries.
- Grant only `SELECT`, `INSERT`, `UPDATE`, `DELETE` to the application role — never `SUPERUSER`.

---

## Optimistic Locking

```sql
version BIGINT NOT NULL DEFAULT 0
```

```sql
UPDATE products
SET    stock_quantity = stock_quantity - :delta,
       version        = version + 1
WHERE  id      = :id
AND    version = :expected_version;
-- If 0 rows updated → concurrent modification detected
```

- Add a `version BIGINT NOT NULL DEFAULT 0` column to any entity subject to concurrent updates.
- Increment in the `WHERE` clause to detect lost updates without explicit locks.
- Pairs naturally with JPA `@Version` / EF Core concurrency tokens.

---

## Full-Text Search

```sql
-- Stored tsvector column (updated by trigger)
ALTER TABLE products ADD COLUMN search_vector TSVECTOR;

CREATE OR REPLACE FUNCTION fn_products_update_search_vector()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_search_vector
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION fn_products_update_search_vector();

CREATE INDEX idx_products_search_gin
    ON products USING GIN (search_vector);

-- Query
SELECT * FROM products
WHERE search_vector @@ plainto_tsquery('english', 'wireless headphones')
ORDER BY ts_rank(search_vector, plainto_tsquery('english', 'wireless headphones')) DESC;
```

- Prefer a stored, trigger-maintained `tsvector` column over `to_tsvector(…)` inline in queries for performance.
- Use `GIN` index on the `tsvector` column.
- Use `plainto_tsquery` for user-supplied free text; use `to_tsquery` for structured queries.

---

## Common Anti-Patterns to Avoid

| Anti-pattern | Problem | Correct approach |
|-------------|---------|-----------------|
| Using `FLOAT` / `REAL` for money | Rounding errors in financial calculations | `NUMERIC(19,4)` |
| Storing timezone-unaware `TIMESTAMP` without UTC discipline | Ambiguous, daylight-saving bugs | `TIMESTAMPTZ` or explicit UTC enforcement |
| No constraint names | Cryptic error messages (`constraint_name_12345`) | Always name every constraint |
| Auto-indexing every FK "just in case" without reviewing | Index bloat, slower writes | Only index FKs that are actually traversed in queries |
| Using `TEXT` for everything | No length enforcement, unclear domain intent | `VARCHAR(n)` where length has meaning |
| Storing JSON as `TEXT` | No querying, no indexing | `JSONB` |
| `SELECT *` in views and stored procedures | Schema changes break callers silently | Always list columns explicitly |
| `SERIAL` / `BIGSERIAL` pseudo-types | Legacy syntax, less explicit | `GENERATED ALWAYS AS IDENTITY` |
| Putting business logic only in application code | DB can become inconsistent if accessed directly | Use CHECK, FK, and triggers for invariants the DB should own |
| Unbounded table growth without partitioning or archival | Query degradation after millions of rows | Partition by time or range; archive cold data |

---

## DDL Template — Canonical Table Structure

```sql
CREATE TABLE <table_name> (
    -- 1. Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 2. Business columns (NOT NULL first, nullable after)
    <col_name> <TYPE> NOT NULL,
    <col_name> <TYPE>,

    -- 3. Foreign keys (inline REFERENCES or via CONSTRAINT block below)
    <fk_col> UUID NOT NULL,

    -- 4. Audit timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 5. Named constraints (PK already declared inline above)
    CONSTRAINT fk_<table>_<ref>     FOREIGN KEY (<fk_col>) REFERENCES <ref_table>(id),
    CONSTRAINT uq_<table>_<cols>    UNIQUE (<col1>, <col2>),
    CONSTRAINT ck_<table>_<rule>    CHECK (<expression>)
);

-- 6. Indexes (after table creation)
CREATE INDEX idx_<table>_<col>  ON <table_name>(<col>);

-- 7. updated_at trigger
CREATE TRIGGER trg_<table>_set_updated_at
    BEFORE UPDATE ON <table_name>
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

---

## How to use this skill
1. Apply these PostgreSQL DDL conventions and good practices to any schema design, migration script, or schema review task.
2. When writing DDL, always include explicit constraint names, choose the correct data type from the reference above, and add the canonical audit columns (`created_at`, `updated_at`).
3. When reviewing DDL, check against the anti-patterns table and the constraint naming rules.
