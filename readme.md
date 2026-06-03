# SAP CAP — CDS Annotations (@readonly, @mandatory, @assert, @title)

CDS annotations control field-level behaviour at the service layer — validation, write protection, UI metadata — all declared in `.cds` files without writing JS handlers.

---

## Annotation Overview

| Annotation | Effect | JS needed? |
|---|---|---|
| `@readonly` | Silently ignores the field if sent by the client on CREATE/UPDATE | ❌ |
| `@mandatory` | Returns 400 if the field is null/empty on CREATE | ❌ |
| `@Core.Computed` | Marks a field as server-calculated; hints to the client not to send a value | ⚠️ value must be filled in `after READ` |
| `@assert.range` | Validates a numeric range or allowed enum values | ❌ |
| `@assert.format` | Validates a field value against a regex pattern | ❌ |
| `@title` | Display label for UI frameworks (visible in `$metadata` and Fiori Preview) | ❌ |
| `@description` | Field description for UI / documentation | ❌ |
| `@UI.MultiLineText` | Tells the UI to render the field as a textarea | ❌ |

---

## Project Structure

```
my-annotations/
├── db/
│   ├── schema.cds
│   └── data/
│       └── my.annotations-Products.csv
├── srv/
│   ├── cat-service.cds
│   └── cat-service.js
└── package.json
```

---

## Data Model

### `db/schema.cds`

```cds
namespace my.annotations;
using { cuid, managed } from '@sap/cds/common';

entity Products : cuid, managed {
  title        : String(200);
  description  : String(1000);
  price        : Decimal(9, 2);
  stock        : Integer default 0;
  sku          : String(50);
  category     : String(100);
  rating       : Decimal(3, 2) default 0;
  priceWithTax : Decimal(9, 2);   // computed field — filled in after READ
}
```

### `db/data/my.annotations-Products.csv`

```
ID,title,description,price,stock,sku,category,rating
p0000001-0000-0000-0000-000000000001,Laptop Pro,High performance laptop,1200.00,10,SKU-001,Electronics,4.50
p0000001-0000-0000-0000-000000000002,Wireless Mouse,Ergonomic wireless mouse,35.00,50,SKU-002,Electronics,4.20
p0000001-0000-0000-0000-000000000003,Desk Lamp,LED desk lamp,45.00,30,SKU-003,Furniture,4.00
```

---

## Service Definition

### `srv/cat-service.cds`

```cds
using my.annotations as db from '../db/schema';

service CatalogService {
  entity Products as projection on db.Products;
}

annotate CatalogService.Products with {

  // @readonly: field is silently ignored if sent by the client
  // Applies to both CREATE and UPDATE
  ID          @readonly;
  createdAt   @readonly;
  createdBy   @readonly;
  modifiedAt  @readonly;
  modifiedBy  @readonly;
  rating      @readonly;       // rating is calculated server-side

  // @Core.Computed: marks the field as server-computed
  // Pair with @readonly to prevent client writes
  priceWithTax @Core.Computed @readonly;

  // @mandatory: returns 400 on CREATE if the field is null or empty
  // No JS validation code needed
  title  @mandatory;
  price  @mandatory;
  sku    @mandatory;

  // @assert.range: validates a numeric range
  price @assert.range: [0.01, 99999.99];
  stock @assert.range: [0, 9999];

  // @assert.range with enum: restricts to a fixed set of values
  category @assert.range enum {
    Electronics;
    Furniture;
    Clothing;
    Books;
  };

  // @assert.format: validates against a regex pattern
  // SKU must match SKU- followed by 3-10 uppercase letters or digits
  sku @assert.format: 'SKU-[A-Z0-9]{3,10}';

  // @title / @description: UI metadata — visible in $metadata and Fiori Preview
  title        @title: 'Product Name';
  price        @title: 'Unit Price (USD)';
  stock        @title: 'Stock Quantity';
  description  @title: 'Description'  @UI.MultiLineText;
  sku          @title: 'SKU'  @description: 'Unique product identifier for inventory tracking';
}
```

---

## Service Implementation

### `srv/cat-service.js`

```js
const cds = require('@sap/cds')

module.exports = class CatalogService extends cds.ApplicationService {
  async init() {
    const { Products } = this.entities

    // @readonly and @mandatory are handled automatically by CAP
    // No JS needed for those — only business logic goes here

    // Fill the @Core.Computed field after every READ
    this.after('READ', Products, products => {
      if (!products) return
      const list = Array.isArray(products) ? products : [products]
      const TAX_RATE = 0.1
      for (const p of list) {
        if (p.price != null) {
          p.priceWithTax = +(p.price * (1 + TAX_RATE)).toFixed(2)
        }
      }
    })

    // Additional business validation beyond what annotations provide
    this.before('CREATE', Products, req => {
      // If @mandatory passes, all required fields are guaranteed to be present here
      console.log('Mandatory check passed, req.data:', req.data)
      console.log('Note: even if client sent "rating", it is NOT in req.data (@readonly)')
    })

    return super.init()
  }
}
```

---

## Running the Project

```bash
cds watch
```

---

## HTTP Request Examples

### Trigger `@mandatory` — missing required field
```http
POST /odata/v4/catalog/Products
Content-Type: application/json

{
  "price": 100.00,
  "sku": "SKU-999"
}
# → 400 Value is required for element 'Products.title'
```

### Trigger `@readonly` — sent field is silently ignored
```http
POST /odata/v4/catalog/Products
Content-Type: application/json

{
  "title": "Test Product",
  "price": 99.00,
  "sku": "SKU-004",
  "stock": 5,
  "category": "Electronics",
  "rating": 9.99,
  "createdAt": "2000-01-01"
}
# → 201 Created
# rating and createdAt are silently ignored — not written to the database
```

### Trigger `@assert.range` — price out of range
```http
POST /odata/v4/catalog/Products
Content-Type: application/json

{ "title": "Test", "price": -10, "sku": "SKU-005", "category": "Electronics" }
# → 400 Value -10 is not in range [0.01, 99999.99]
```

### Trigger `@assert.range` enum — invalid category
```http
{ "title": "Test", "price": 10, "sku": "SKU-006", "category": "Food" }
# → 400 Value 'Food' is not a valid enum value
```

### Trigger `@assert.format` — invalid SKU format
```http
{ "title": "Test", "price": 10, "sku": "abc-123", "category": "Books" }
# → 400 Value 'abc-123' does not match format 'SKU-[A-Z0-9]{3,10}'
```

### Read products — priceWithTax is computed in after READ
```http
GET /odata/v4/catalog/Products
# → each record includes priceWithTax = price * 1.1
```

### Verify `@title` — check OData metadata
```http
GET /odata/v4/catalog/$metadata
```

Look for `Core.Description` annotations on the `Products` entity properties in the returned XML.

### Verify `@title` visually — Fiori Preview (built into cds watch)
```
http://localhost:4004/$fiori-preview/CatalogService/Products#preview-app
```

Column headers in the table will show the values from `@title` — no Fiori setup required.

---

## Gotchas

**`@readonly` silently ignores — it does NOT return an error**
```js
// If the client sends a @readonly field, CAP ignores it quietly
// If you want to return an error instead, add a before handler:
this.before('CREATE', Products, req => {
  if (req.data.rating != null) {
    return req.error(400, 'rating is read-only and cannot be set by the client')
  }
})
```

**`@mandatory` only applies on CREATE, not on PATCH**
```cds
// PATCH /Products(key) with { "price": null } will NOT trigger @mandatory
// Add a before UPDATE handler if you need this check on updates too
```

**`@Core.Computed` is metadata only — you must fill the value yourself**
```js
// @Core.Computed just tells the client "don't send this field"
// The actual value must be set in after READ:
this.after('READ', Products, products => {
  for (const p of list) {
    p.priceWithTax = +(p.price * 1.1).toFixed(2)  // you fill it
  }
})
```

**Annotations do NOT need a `using` import**
```cds
// ❌ There is no such import
using from '@sap/cds/core';

// ✅ Write the full annotation name directly — CAP recognises it automatically
@Core.Computed
@assert.range: [0, 100]
@assert.format: 'SKU-[A-Z0-9]+'
```

**`priceWithTax` must be declared in `db/schema.cds` before it can be annotated**
```cds
// ❌ annotate fails if the field doesn't exist in the entity
annotate CatalogService.Products with {
  priceWithTax @Core.Computed;   // Error: element not found
}

// ✅ Add it to the entity first
entity Products : cuid, managed {
  ...
  priceWithTax : Decimal(9, 2);  // declare here first
}
```
