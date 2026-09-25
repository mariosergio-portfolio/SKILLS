---
name: webstore-database-postgres
description: Use when the user invokes %webstore-database-postgres or asks about the web store database implemented in PostgreSQL — concrete column types, DDL scripts, indexes, constraints, triggers, and Flyway migration structure for the e-commerce system.
---

# Web Store — PostgreSQL Schema Implementation

## When to use this skill
Activate when the user types `%webstore-database-postgres` or asks about the web store database in PostgreSQL: concrete DDL, column type choices, indexes, triggers, or Flyway migration layout.

**Foundation skills this composite wires together:**
- `%webstore-data-structure` — canonical logical schema: tables, columns, business rules, usage rules
- `%tech-database-postgres` — PostgreSQL DDL conventions: naming, types, constraints, indexes, triggers, partitioning

---

## Logical → PostgreSQL Type Mapping

| Logical / domain type | PostgreSQL type | Notes |
|---|---|---|
| Unique identifier | `UUID` | `DEFAULT gen_random_uuid()` on PK columns |
| Short bounded string | `VARCHAR(n)` | Use domain-meaningful lengths (255, 100, 50, 20, …) |
| Long text | `TEXT` | `description`, unbounded free text |
| Monetary amount | `NUMERIC(19,4)` | Never `FLOAT` — rounding errors in financial data |
| Currency code | `CHAR(3)` | ISO 4217; `DEFAULT 'USD'` |
| Integer counter / quantity | `INT` | Quantities, sort orders, day counts |
| Optimistic lock counter | `BIGINT` | `product.version` — wide type avoids overflow at scale |
| Boolean flag | `BOOLEAN` | `active`, `is_default`; explicit `DEFAULT true/false` |
| Enumerated string | `VARCHAR(20)` + `CHECK` | Statuses, types — bounded list enforced by CHECK |
| Session identifier | `VARCHAR(128)` | Anonymous cart `session_id` |
| URL / path | `VARCHAR(500)` | Product image URLs |
| Timestamp (audit) | `TIMESTAMPTZ` | All `created_at`, `updated_at`, `placed_at` — UTC |
| Timestamp (optional) | `TIMESTAMPTZ` | `expires_at`, nullable |

---

## Shared Trigger Function

Define once; reused by all tables with `updated_at`:

```sql
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
```

---

## DDL Scripts

### `customer`

```sql
CREATE TABLE customer (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    active        BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_customer_email UNIQUE (email)
);

CREATE TRIGGER trg_customer_set_updated_at
    BEFORE UPDATE ON customer
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

---

### `customer_address`

```sql
CREATE TABLE customer_address (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID         NOT NULL,
    street      VARCHAR(255) NOT NULL,
    city        VARCHAR(100) NOT NULL,
    state       VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20)  NOT NULL,
    country     VARCHAR(100) NOT NULL,
    is_default  BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT fk_customer_address_customer FOREIGN KEY (customer_id) REFERENCES customer(id)
);

CREATE INDEX idx_customer_address_customer_id ON customer_address(customer_id);

CREATE TRIGGER trg_customer_address_set_updated_at
    BEFORE UPDATE ON customer_address
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

---

### `category`

```sql
CREATE TABLE category (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    slug       VARCHAR(255) NOT NULL,
    parent_id  UUID,
    sort_order INT          NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_category_slug   UNIQUE (slug),
    CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES category(id)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_category_parent_id ON category(parent_id);

CREATE TRIGGER trg_category_set_updated_at
    BEFORE UPDATE ON category
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

> `DEFERRABLE INITIALLY DEFERRED` on the self-referencing FK allows bulk-inserting a category tree where parent rows may arrive after child rows in the same transaction.

---

### `product`

```sql
CREATE TABLE product (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    sku            VARCHAR(100)  NOT NULL,
    name           VARCHAR(255)  NOT NULL,
    description    TEXT,
    price          NUMERIC(19,4) NOT NULL,
    currency       CHAR(3)       NOT NULL DEFAULT 'USD',
    stock_quantity INT           NOT NULL DEFAULT 0,
    version        BIGINT        NOT NULL DEFAULT 0,
    category_id    UUID,
    status         VARCHAR(20)   NOT NULL,
    reorder_point  INT           NOT NULL DEFAULT 5,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_product_sku            UNIQUE (sku),
    CONSTRAINT fk_product_category       FOREIGN KEY (category_id) REFERENCES category(id),
    CONSTRAINT ck_product_price_positive CHECK (price > 0),
    CONSTRAINT ck_product_stock_non_neg  CHECK (stock_quantity >= 0),
    CONSTRAINT ck_product_status         CHECK (status IN ('ACTIVE', 'DRAFT', 'ARCHIVED'))
);

CREATE INDEX idx_product_category_id ON product(category_id);
CREATE INDEX idx_product_status      ON product(status);

CREATE TRIGGER trg_product_set_updated_at
    BEFORE UPDATE ON product
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

---

### `product_image`

```sql
CREATE TABLE product_image (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID         NOT NULL,
    url        VARCHAR(500) NOT NULL,
    sort_order INT          NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT fk_product_image_product FOREIGN KEY (product_id) REFERENCES product(id)
);

CREATE INDEX idx_product_image_product_id ON product_image(product_id);
```

---

### `shipping_method`

```sql
CREATE TABLE shipping_method (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(100)  NOT NULL,
    cost           NUMERIC(19,4) NOT NULL,
    currency       CHAR(3)       NOT NULL DEFAULT 'USD',
    estimated_days INT           NOT NULL,
    active         BOOLEAN       NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT ck_shipping_method_cost_non_neg CHECK (cost >= 0)
);

CREATE TRIGGER trg_shipping_method_set_updated_at
    BEFORE UPDATE ON shipping_method
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

---

### `coupon`

```sql
CREATE TABLE coupon (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code             VARCHAR(50)   NOT NULL,
    discount_type    VARCHAR(20)   NOT NULL,
    value            NUMERIC(19,4) NOT NULL,
    min_order_amount NUMERIC(19,4),
    max_uses         INT,
    used_count       INT           NOT NULL DEFAULT 0,
    expires_at       TIMESTAMPTZ,
    active           BOOLEAN       NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_coupon_code           UNIQUE (code),
    CONSTRAINT ck_coupon_discount_type  CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    CONSTRAINT ck_coupon_value_positive CHECK (value > 0)
);

CREATE TRIGGER trg_coupon_set_updated_at
    BEFORE UPDATE ON coupon
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

---

### `cart`

```sql
CREATE TABLE cart (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID,
    session_id  VARCHAR(128),
    coupon_id   UUID,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_cart_customer_id UNIQUE (customer_id),
    CONSTRAINT uq_cart_session_id  UNIQUE (session_id),
    CONSTRAINT fk_cart_customer    FOREIGN KEY (customer_id) REFERENCES customer(id),
    CONSTRAINT fk_cart_coupon      FOREIGN KEY (coupon_id)   REFERENCES coupon(id),
    CONSTRAINT ck_cart_identity    CHECK (
        (customer_id IS NOT NULL AND session_id IS NULL) OR
        (customer_id IS NULL     AND session_id IS NOT NULL)
    )
);

CREATE INDEX idx_cart_coupon_id ON cart(coupon_id);

CREATE TRIGGER trg_cart_set_updated_at
    BEFORE UPDATE ON cart
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

---

### `cart_item`

```sql
CREATE TABLE cart_item (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id    UUID          NOT NULL,
    product_id UUID          NOT NULL,
    quantity   INT           NOT NULL,
    unit_price NUMERIC(19,4) NOT NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_cart_item_cart_product  UNIQUE (cart_id, product_id),
    CONSTRAINT fk_cart_item_cart          FOREIGN KEY (cart_id)    REFERENCES cart(id),
    CONSTRAINT fk_cart_item_product       FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT ck_cart_item_quantity      CHECK (quantity >= 1)
);

CREATE INDEX idx_cart_item_product_id ON cart_item(product_id);

CREATE TRIGGER trg_cart_item_set_updated_at
    BEFORE UPDATE ON cart_item
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

---

### `order`

> `order` is a reserved word in PostgreSQL — always quote it as `"order"` in DDL and DML.

```sql
CREATE TABLE "order" (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id          UUID          NOT NULL,
    status               VARCHAR(20)   NOT NULL,
    subtotal             NUMERIC(19,4) NOT NULL,
    discount_amount      NUMERIC(19,4) NOT NULL DEFAULT 0,
    shipping_cost        NUMERIC(19,4) NOT NULL DEFAULT 0,
    total                NUMERIC(19,4) NOT NULL,
    currency             CHAR(3)       NOT NULL DEFAULT 'USD',
    shipping_street      VARCHAR(255)  NOT NULL,
    shipping_city        VARCHAR(100)  NOT NULL,
    shipping_state       VARCHAR(100)  NOT NULL,
    shipping_postal_code VARCHAR(20)   NOT NULL,
    shipping_country     VARCHAR(100)  NOT NULL,
    billing_street       VARCHAR(255),
    billing_city         VARCHAR(100),
    billing_state        VARCHAR(100),
    billing_postal_code  VARCHAR(20),
    billing_country      VARCHAR(100),
    shipping_method_id   UUID,
    tracking_carrier     VARCHAR(100),
    tracking_number      VARCHAR(100),
    placed_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT fk_order_customer        FOREIGN KEY (customer_id)       REFERENCES customer(id),
    CONSTRAINT fk_order_shipping_method FOREIGN KEY (shipping_method_id) REFERENCES shipping_method(id),
    CONSTRAINT ck_order_status          CHECK (status IN ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'))
);

CREATE INDEX idx_order_customer_id ON "order"(customer_id);
CREATE INDEX idx_order_status      ON "order"(status);
CREATE INDEX idx_order_placed_at   ON "order"(placed_at DESC);

CREATE TRIGGER trg_order_set_updated_at
    BEFORE UPDATE ON "order"
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

---

### `order_item`

```sql
CREATE TABLE order_item (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID          NOT NULL,
    product_id UUID          NOT NULL,
    sku        VARCHAR(100)  NOT NULL,
    name       VARCHAR(255)  NOT NULL,
    quantity   INT           NOT NULL,
    unit_price NUMERIC(19,4) NOT NULL,
    line_total NUMERIC(19,4) NOT NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT fk_order_item_order   FOREIGN KEY (order_id)   REFERENCES "order"(id),
    CONSTRAINT fk_order_item_product FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT ck_order_item_qty     CHECK (quantity >= 1)
);

CREATE INDEX idx_order_item_order_id   ON order_item(order_id);
CREATE INDEX idx_order_item_product_id ON order_item(product_id);
```

---

### `payment`

```sql
CREATE TABLE payment (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID          NOT NULL,
    gateway           VARCHAR(50)   NOT NULL,
    gateway_reference VARCHAR(255),
    idempotency_key   UUID          NOT NULL,
    amount            NUMERIC(19,4) NOT NULL,
    currency          CHAR(3)       NOT NULL,
    status            VARCHAR(20)   NOT NULL,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_payment_order_id          UNIQUE (order_id),
    CONSTRAINT uq_payment_gateway_reference UNIQUE (gateway_reference),
    CONSTRAINT uq_payment_idempotency_key   UNIQUE (idempotency_key),
    CONSTRAINT fk_payment_order             FOREIGN KEY (order_id) REFERENCES "order"(id),
    CONSTRAINT ck_payment_status            CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'))
);

CREATE TRIGGER trg_payment_set_updated_at
    BEFORE UPDATE ON payment
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

---

### `inventory_audit_log`

```sql
CREATE TABLE inventory_audit_log (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID         NOT NULL,
    change_type VARCHAR(20)  NOT NULL,
    delta       INT          NOT NULL,
    reason      VARCHAR(255),
    actor       VARCHAR(255),
    order_id    UUID,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT fk_inv_audit_product FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT fk_inv_audit_order   FOREIGN KEY (order_id)   REFERENCES "order"(id),
    CONSTRAINT ck_inv_audit_type    CHECK (change_type IN ('DEDUCTION', 'RESTORATION', 'ADJUSTMENT'))
);

CREATE INDEX idx_inv_audit_product_id ON inventory_audit_log(product_id);
CREATE INDEX idx_inv_audit_order_id   ON inventory_audit_log(order_id);
CREATE INDEX idx_inv_audit_created_at ON inventory_audit_log(created_at DESC);
```

> `inventory_audit_log` is **append-only** — no `updated_at` column, no UPDATE trigger.

---

## Flyway Migration Structure

```
src/main/resources/db/migration/
├── V1__create_fn_set_updated_at.sql
├── V2__create_customer.sql
├── V3__create_customer_address.sql
├── V4__create_category.sql
├── V5__create_product.sql
├── V6__create_product_image.sql
├── V7__create_shipping_method.sql
├── V8__create_coupon.sql
├── V9__create_cart.sql
├── V10__create_cart_item.sql
├── V11__create_order.sql
├── V12__create_order_item.sql
├── V13__create_payment.sql
└── V14__create_inventory_audit_log.sql
```

- `V1` creates the shared `fn_set_updated_at()` function before any table that uses it.
- Each subsequent file contains exactly one table DDL, its indexes, and its trigger.
- Version numbers are strictly increasing and immutable once applied to any environment.
- Follow the `V{n}__{snake_case_description}.sql` naming convention.

---

## Key PostgreSQL-Specific Notes

- **`"order"` is a reserved word** — always quote it in DDL and all DML (`SELECT … FROM "order"`, `REFERENCES "order"(id)`).
- **`product.version`** — used for optimistic locking on stock deduction. Always include it in UPDATE WHERE clauses: `UPDATE product SET stock_quantity = stock_quantity - $1, version = version + 1 WHERE id = $2 AND version = $3`.
- **`cart` identity** — the `ck_cart_identity` CHECK ensures exactly one of `customer_id` / `session_id` is set; the separate UNIQUE constraints on each column enforce one cart per customer and one cart per session.
- **`order_item` snapshots** — `sku`, `name`, and `unit_price` are frozen at checkout; never update them post-placement.
- **`inventory_audit_log`** — append-only; no UPDATE trigger and no `updated_at` column by design.
- **`payment` idempotency** — both `gateway_reference` and `idempotency_key` carry UNIQUE constraints; use `gateway_reference` to detect duplicate webhook deliveries.

---

## How to use this skill
1. Use `%webstore-data-structure` for the technology-agnostic schema, column definitions, and business rules.
2. Use `%tech-database-postgres` for broader PostgreSQL DDL conventions (partitioning, ENUM types, RLS, full-text search) beyond what is covered here.
3. Apply the DDL scripts above as Flyway migrations — one file per table, in dependency order.
4. Respond and assist in English unless the user requests another language.
5. Await further instructions from the user and execute them accordingly.
