# LINQ CRM — Complete Reports Reference

> **Purpose:** Single authoritative reference for the entire LINQ CRM Google Sheets reporting engine.
> **Covers:** Architecture, sheet registry, column mappings, formulas, transformations, filters, grouping, calculations, relationships, and sync configuration.
> **Maintainer:** Linq CRM Admin Team
> **Last Updated:** _(update when you add a new report)_

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Google Sheets Registry](#2-google-sheets-registry)
3. [Column Mappings](#3-column-mappings)
4. [Report Formulas](#4-report-formulas)
5. [Data Transformations](#5-data-transformations)
6. [Report Filter Rules](#6-report-filter-rules)
7. [Report Grouping Rules](#7-report-grouping-rules)
8. [Report Calculation Rules](#8-report-calculation-rules)
9. [Report Relationships](#9-report-relationships)
10. [Sync Configuration](#10-sync-configuration)

---

## 1. ARCHITECTURE OVERVIEW

### System Flow

```
40–50 Google Sheets
        ↓  (Google Sheets API v4 — service account credentials)
GoogleSheetsConnector
        ↓  (batch reads, retry, rate-limit handling)
GoogleSheetReportImporter
        ↓  (column mapping, transformation, SHA-256 change detection)
ReportRow (PostgreSQL — report_rows table)
        ↓  (paginated REST API with search/filter)
CRM Frontend Reports Module
        ↓
Live Operational Reports
```

### Key Models

| Model | Table | Purpose |
|-------|-------|---------|
| `GoogleSheetSource` | `report_sheet_sources` | One Google Sheet tab configured as a data source |
| `ReportDefinition` | `report_definitions` | Named report grouping one or more sources |
| `ReportRow` | `report_rows` | Normalized data row from a synced sheet |
| `ReportSyncLog` | `report_sync_logs` | Per-run audit log for every sync operation |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/reports/sources/` | List / create sheet sources |
| GET/PATCH/DELETE | `/api/reports/sources/{id}/` | Detail / update / delete |
| POST | `/api/reports/sources/{id}/sync/` | Trigger single-source sync |
| POST | `/api/reports/sources/sync-all/` | Sync all active sources |
| GET | `/api/reports/sources/{id}/rows/` | Paginated rows |
| GET | `/api/reports/sources/{id}/preview/` | First 20 rows |
| POST | `/api/reports/sources/{id}/detect-columns/` | Introspect headers |
| POST | `/api/reports/sources/list-worksheets/` | List tabs in a spreadsheet |
| GET | `/api/reports/sync-logs/` | Sync history |
| GET | `/api/reports/docs/` | List documentation files |
| GET | `/api/reports/docs/{filename}/` | Serve documentation |

### Report Categories Quick Reference

| # | Report Name | Sheet Type | Worksheet | Sync Frequency | Status |
|---|-------------|------------|-----------|----------------|--------|
| 1 | _(add report name)_ | _(bookings/events/revenue/custom)_ | _(tab name)_ | manual/daily | active |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

_Add each Google Sheet source as a row above. This index should mirror what is configured in `/api/reports/sources/`._

### Booking Reports

| Report | Source Sheet | Primary Key | Linked To |
|--------|-------------|-------------|-----------|
| _(add)_ | | | |

### Event Reports

| Report | Source Sheet | Primary Key | Linked To |
|--------|-------------|-------------|-----------|
| _(add)_ | | | |

### Revenue Reports

| Report | Source Sheet | Primary Key | Linked To |
|--------|-------------|-------------|-----------|
| _(add)_ | | | |

### Delegate Reports

| Report | Source Sheet | Primary Key | Linked To |
|--------|-------------|-------------|-----------|
| _(add)_ | | | |

### How to Add a New Google Sheet

1. Go to **CRM → Reports → Sheet Registry → + Add Sheet**
2. Enter the Google Sheet URL or ID
3. Set the worksheet/tab name exactly as it appears in the sheet
4. Configure column mappings (map sheet headers to CRM field names)
5. Set transformation rules if needed (trim, date_iso, strip_currency, etc.)
6. Click **Detect Columns** to auto-read headers from the live sheet
7. Click **Sync Now** to import the first batch of data
8. Document the sheet in [Section 2 — Google Sheets Registry](#2-google-sheets-registry)

---

## 2. GOOGLE SHEETS REGISTRY

> **Instructions:** Copy the template block below for each new sheet. Fill in all sections.

This section is the authoritative reference for:
- Which sheets feed which reports
- What columns each sheet contains
- What CRM fields each column maps to
- What formulas are used in the sheet
- What transformations are applied on import

### TEMPLATE — Copy this block for each new sheet

```
-----------------------------------------------------------
REPORT NAME: [Enter report/sheet name]
-----------------------------------------------------------

Google Sheet URL:      [Paste full URL here]
Worksheet/Tab Name:    [Exact tab name — case-sensitive]
Sheet ID:              [Auto-extracted from URL, or paste raw ID]
Sheet Type:            [bookings / events / delegates / revenue / pipeline / custom]
Purpose:               [What does this sheet track?]
Sync Frequency:        [manual / hourly / daily / weekly]
Primary Identifier:    [The column that uniquely identifies each row, e.g. InvoiceNumber]
Data Owner:            [Who maintains this sheet?]
Last Updated By:       [Name and date]

-----------------------------------------------------------
COLUMN DEFINITIONS
-----------------------------------------------------------

| Column Name (Sheet) | CRM Field Name | Data Type | Required | Notes |
|---------------------|---------------|-----------|----------|-------|
|                     |               |           |          |       |

-----------------------------------------------------------
FORMULAS USED IN THIS SHEET
-----------------------------------------------------------

| Formula Name | Google Sheet Formula | CRM Equivalent | Output Column |
|-------------|---------------------|----------------|---------------|
|             |                     |                |               |

-----------------------------------------------------------
TRANSFORMATION RULES
-----------------------------------------------------------

| Source Column | Transformation | Destination Field | Notes |
|--------------|----------------|-------------------|-------|
|              |                |                   |       |

-----------------------------------------------------------
FILTER RULES
-----------------------------------------------------------

| Field | Filter Type | Options | Notes |
|-------|------------|---------|-------|
|       |            |         |       |

-----------------------------------------------------------
GROUPING RULES
-----------------------------------------------------------

| Group By Column | Aggregation | Aggregated Field | Notes |
|----------------|------------|-----------------|-------|
|                |            |                 |       |

-----------------------------------------------------------
NOTES / BUSINESS RULES
-----------------------------------------------------------

[Add any business rules, edge cases, or special handling notes here]
```

### EXAMPLE ENTRY — Bookings Revenue Sheet

**REPORT NAME:** Monthly Bookings Revenue

**Google Sheet URL:** `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
**Worksheet/Tab Name:** `Revenue`
**Sheet ID:** `[SHEET_ID]`
**Sheet Type:** `revenue`
**Purpose:** Tracks confirmed booking revenue by event and payment status
**Sync Frequency:** `daily`
**Primary Identifier:** `InvoiceNumber`
**Data Owner:** Finance Team
**Last Updated By:** _(your name, date)_

#### Column Definitions

| Column Name (Sheet) | CRM Field Name | Data Type | Required | Notes |
|---------------------|---------------|-----------|----------|-------|
| Invoice Number | invoice_number | string | Yes | Primary key — must match CRM invoice |
| Event Code | event_code | string | Yes | |
| Company Name | company_name | string | No | |
| Total Amount | total_amount | decimal | No | May include currency symbol — use strip_currency |
| Payment Status | payment_status | string | No | Values: Paid, Pending, Cancelled |
| Booking Date | booking_date | date | No | Use date_iso transform |
| Delegate Count | delegate_count | integer | No | |

#### Transformation Rules

| Source Column | Transformation | Destination Field | Notes |
|--------------|----------------|-------------------|-------|
| Total Amount | strip_currency, to_float | total_amount | Strips £/$ symbols |
| Booking Date | date_iso | booking_date | Converts to YYYY-MM-DD |
| Company Name | trim, title | company_name | Normalises casing |

### REGISTERED SHEETS

> Add a copy of the template above for each registered sheet.

---

_(Add sheet entries here)_

---

### Sheet Inventory

| # | Sheet Name | Tab | Type | Sync Freq | Last Synced | Status |
|---|-----------|-----|------|-----------|-------------|--------|
| 1 | _(enter)_ | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |
| 9 | | | | | | |
| 10 | | | | | | |

_Expand this table as you add more sheets. Target: 40–50 sheets._

---

## 3. COLUMN MAPPINGS

### How Column Mappings Work

When a Google Sheet is synced, the importer reads the sheet's header row and builds a `raw_data` dict:
```json
{
  "Invoice No": "INV-2025-001",
  "Company": "Acme Corp",
  "Total (£)": "£1,234.00"
}
```

The `column_mappings` config transforms this to `processed_data`:
```json
{
  "invoice_number": "INV-2025-001",
  "company_name":   "Acme Corp",
  "total_amount":   "1234.00"
}
```

The JSON format for `column_mappings` in the CRM is:
```json
{
  "Sheet Column Header": "crm_field_name",
  "Invoice No":          "invoice_number",
  "Company":             "company_name",
  "Total (£)":           "total_amount"
}
```

### Mapping Template

```
-----------------------------------------------------------
SOURCE: [Google Sheet Name]
-----------------------------------------------------------

Sheet URL:      [URL]
Worksheet Tab:  [Tab Name]

| Google Sheet Column | CRM Field Name    | Data Type | Validation          | Required | Notes |
|---------------------|------------------|-----------|---------------------|----------|-------|
| (exact header text) | (snake_case name) | string    | (regex / range / ø) | Yes/No   |       |
```

### Registered Column Mappings

> Add one section per Google Sheet source.

#### SOURCE: _(Enter Sheet Name)_

**Sheet URL:** _(enter)_
**Worksheet Tab:** _(enter)_
**Last Updated:** _(date)_

| Google Sheet Column | CRM Field Name | Data Type | Validation | Required | Notes |
|---------------------|---------------|-----------|------------|----------|-------|
| _(enter)_ | _(enter)_ | _(enter)_ | | | |

**JSON for `column_mappings` field (copy into CRM admin):**
```json
{
  "Sheet Column 1": "crm_field_1",
  "Sheet Column 2": "crm_field_2"
}
```

### Standard CRM Field Reference

#### Booking Fields (BookEvent)

| CRM Field Name | Data Type | Description |
|---------------|-----------|-------------|
| `invoice_number` | string | Primary booking identifier |
| `event_code` | string | Event code (e.g. SUMMIT2025) |
| `event_name` | string | Full event name |
| `event_date` | date | Event date (ISO format: YYYY-MM-DD) |
| `company_name` | string | Booking company name |
| `contact_name` | string | Primary contact full name |
| `contact_email` | email | Primary contact email address |
| `total_amount` | decimal | Total booking amount (numeric only) |
| `pre_tax_amount` | decimal | Pre-tax amount |
| `tax_amount` | decimal | Tax/VAT amount |
| `payment_status` | string | Paid / Pending / Cancelled |
| `discount` | decimal | Discount amount |
| `discount_code` | string | Discount code applied |
| `currency` | string | Currency code (USD / GBP / EUR) |
| `delegate_count` | integer | Number of delegates |
| `source` | string | Booking source (website / manual / webhook) |
| `form_name` | string | Form name from website |
| `form_url` | url | Form URL from website |

#### Delegate Fields (BookDelegate)

| CRM Field Name | Data Type | Description |
|---------------|-----------|-------------|
| `first_name` | string | Delegate first name |
| `last_name` | string | Delegate last name |
| `full_name` | string | Full name (first + last) |
| `email` | email | Delegate email |
| `phone_number` | string | Phone number |
| `company_name` | string | Delegate's company |
| `position` | string | Job title/position |
| `ticket_package` | string | Ticket/package name |
| `sponsorship_level` | string | Sponsorship level if applicable |

#### Event Fields (Event)

| CRM Field Name | Data Type | Description |
|---------------|-----------|-------------|
| `event_code` | string | Unique event code |
| `event_name` | string | Full event name |
| `event_date` | date | Event date |
| `venue` | string | Venue name |
| `city` | string | City |
| `country` | string | Country |
| `capacity` | integer | Maximum capacity |
| `status` | string | Live / Upcoming / Completed / Cancelled |

#### Custom / Report-specific Fields

| CRM Field Name | Data Type | Description |
|---------------|-----------|-------------|
| `report_date` | date | Date of the report row |
| `report_value` | decimal | Primary numeric value |
| `report_label` | string | Label/category |
| `report_category` | string | Grouping category |
| `report_notes` | string | Free-text notes |
| `row_identifier` | string | Unique identifier for the row |

### Data Type Reference

| Type | Format | Validation | Example |
|------|--------|------------|---------|
| `string` | Any text | max_length depends on field | `"Acme Corp"` |
| `email` | RFC 5321 email | `^\S+@\S+\.\S+$` | `"user@example.com"` |
| `date` | ISO 8601 | `^\d{4}-\d{2}-\d{2}$` | `"2025-05-01"` |
| `decimal` | Numeric string | Digits and decimal point only | `"1234.56"` |
| `integer` | Whole number string | Digits only | `"42"` |
| `url` | Full URL | Starts with http/https | `"https://example.com"` |
| `boolean` | true/false string | `"true"` or `"false"` | `"true"` |

---

## 4. REPORT FORMULAS

### Why Document Formulas

Google Sheets formulas calculate values dynamically in the spreadsheet.
When we import data into the CRM, we need to either:
1. **Import the result** — let Google Sheets calculate and import the computed value, OR
2. **Reproduce the logic** — recreate the calculation in Python so the CRM computes it independently

This section documents every formula so both approaches are possible.

### Formula Template

```
-----------------------------------------------------------
FORMULA: [Formula Name]
-----------------------------------------------------------

Report / Sheet:       [Which report does this formula belong to?]
Worksheet Tab:        [Which tab/worksheet?]
Column / Cell:        [Which column or cell range?]

Purpose:
  [What does this formula calculate? Why is it needed?]

Google Sheet Formula:
  [Paste the exact formula here]
  Example: =SUMIF(B:B, "Paid", D:D)

CRM Equivalent Logic:
  [Describe the Python/Django equivalent]

Dependencies:
  - [List columns or sheets this formula depends on]

Output Format:
  [Number / Currency / Percentage / Date / Text]

Calculation Rules:
  1. [Step 1]
  2. [Step 2]

Edge Cases:
  - [What happens if the column is empty?]
  - [What happens if there are zero matching rows?]

Import Strategy:
  [ ] Import computed value from sheet
  [ ] Reproduce in CRM
  Notes: [Explain which approach and why]
```

### Registered Formulas

> Add one block per formula, grouped by report/sheet.

#### Report: _(Enter Report Name)_

##### FORMULA: _(Enter Formula Name)_

**Report / Sheet:** _(enter)_
**Worksheet Tab:** _(enter)_
**Column / Cell:** _(enter)_

**Purpose:** _(describe what this formula does)_

**Google Sheet Formula:**
```
=(enter formula here)
```

**CRM Equivalent Logic:**
```python
# Enter Python equivalent here
```

**Dependencies:** _(enter)_
**Output Format:** _(enter)_

**Import Strategy:**
- [ ] Import computed value from sheet
- [ ] Reproduce in CRM
- Notes: _(enter)_

### Formula Inventory

| # | Formula Name | Sheet | Tab | Column | Type | Import Strategy |
|---|-------------|-------|-----|--------|------|-----------------|
| 1 | _(enter)_ | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

### Standard Formula Patterns

#### Revenue Aggregation
```
=SUMIF(status_column, "Paid", amount_column)
```
CRM equivalent:
```python
BookEvent.objects.filter(payment_status="Paid").aggregate(total=Sum("total_amount"))["total"]
```

#### Count by Status
```
=COUNTIF(status_column, "Pending")
```
CRM equivalent:
```python
BookEvent.objects.filter(payment_status="Pending").count()
```

#### Percentage of Total
```
=B2/SUM(B:B)*100
```
CRM equivalent:
```python
value / queryset.aggregate(total=Sum("field"))["total"] * 100
```

#### Running Total (Cumulative Sum)
```
=SUM($D$2:D2)
```
CRM equivalent: Annotate queryset with `window=` function using `Sum` over ordered rows.

#### Conditional Flag
```
=IF(D2>1000, "High Value", "Standard")
```
CRM equivalent:
```python
processed = "High Value" if float(row.get("total_amount", 0)) > 1000 else "Standard"
```

#### Date Difference
```
=DAYS(C2, B2)
```
CRM equivalent:
```python
(date_c - date_b).days
```

---

## 5. DATA TRANSFORMATIONS

### How Transformations Work

During import, after column mapping is applied, each field value can be passed through one or more transformations.

The `transformation_config` JSON format is:
```json
{
  "SheetColumnName": ["rule1", "rule2"],
  "Total Amount":    ["strip_currency", "to_float"],
  "Booking Date":    ["trim", "date_iso"],
  "Company":         ["trim", "title"]
}
```

Transformations are applied in order — output of one becomes input of the next.

### Built-in Transformation Rules

| Rule Name | Input → Output | Description | Edge Cases |
|-----------|---------------|-------------|------------|
| `trim` | `" value "` → `"value"` | Remove leading and trailing whitespace | Empty string stays empty |
| `upper` | `"london"` → `"LONDON"` | Convert all characters to uppercase | Non-ASCII characters preserved |
| `lower` | `"LONDON"` → `"london"` | Convert all characters to lowercase | Non-ASCII characters preserved |
| `title` | `"john smith"` → `"John Smith"` | Title-case every word | Contractions (O'Brien) handled by Python str.title() |
| `strip_currency` | `"£1,234.56"` → `"1234.56"` | Remove £ $ € symbols, commas, spaces | Leaves decimal point; use to_float after |
| `strip_html` | `"<b>text</b>"` → `"text"` | Remove all HTML tags | Content between tags is preserved |
| `date_iso` | `"01/05/2025"` → `"2025-05-01"` | Reformat date to ISO 8601 | Uses dateutil parser — handles most formats |
| `to_int` | `"42.0"` → `"42"` | Convert to integer string | Removes decimal; fails gracefully on non-numeric |
| `to_float` | `"42"` → `"42.00"` | Convert to 2-decimal float string | Handles strings with commas removed |
| `bool_yes_no` | `"Yes"` → `"true"` | Normalise yes/no/1/0 to true/false | Case-insensitive; "Y", "1", "TRUE" all → "true" |

### Transformation Template

```
-----------------------------------------------------------
TRANSFORMATION SET: [Sheet Name — Column Name]
-----------------------------------------------------------

Sheet Source:      [Sheet name]
Column in Sheet:   [Exact column header]
CRM Field:         [Destination CRM field name]

Transformation Rules (in order):
  1. [rule name] — [why this rule is needed]
  2. [rule name] — [why this rule is needed]

Input Examples:
  "£1,234.56"  →  [expected output]
  "  N/A  "    →  [expected output]
  ""           →  [expected output — empty input behavior]

Output Format:    [string / decimal / date / boolean]
Null Handling:    [What happens if the cell is empty?]
Error Handling:   [What happens if the rule fails?]

JSON Config:
  "ColumnName": ["rule1", "rule2"]
```

### Registered Transformation Sets

> Add one block per column that has transformation rules applied.

#### SOURCE: _(Enter Sheet Name)_

**Column:** _(Enter Column Name)_
**CRM Field:** _(enter)_
**Rules:** _(enter)_

| Input Value | After Transformation |
|-------------|---------------------|
| _(enter)_ | _(enter)_ |

```json
{
  "Column Name": ["rule1", "rule2"]
}
```

### Transformation Inventory

| # | Sheet Source | Column | Rules Applied | Output Field | Notes |
|---|------------|--------|---------------|--------------|-------|
| 1 | _(enter)_ | | | | |
| 2 | | | | | |
| 3 | | | | | |

### Common Transformation Patterns

#### Pattern 1: Currency Field
**Problem:** Sheet has `"£1,234.56"` — need clean decimal for CRM.
```json
{ "Total Amount": ["strip_currency", "to_float"] }
```

#### Pattern 2: Date Field
**Problem:** Sheet has `"01/05/2025"` — need ISO format `"2025-05-01"`.
```json
{ "Booking Date": ["trim", "date_iso"] }
```

#### Pattern 3: Name Field
**Problem:** Sheet has `"  JOHN SMITH  "` — need clean title case.
```json
{ "Delegate Name": ["trim", "title"] }
```

#### Pattern 4: Email Field
**Problem:** Sheet has `"User@Example.COM"` — need lowercase email.
```json
{ "Email": ["trim", "lower"] }
```

#### Pattern 5: Boolean Field
**Problem:** Sheet has `"Yes"` / `"No"` — need `"true"` / `"false"`.
```json
{ "Attended": ["trim", "bool_yes_no"] }
```

#### Pattern 6: Integer Count
**Problem:** Sheet has `"3.0"` — need `"3"`.
```json
{ "Delegate Count": ["to_int"] }
```

#### Pattern 7: Chained — Currency then Integer
**Problem:** Sheet has `"£100"` — need `"100"` (integer pounds).
```json
{ "Amount Rounded": ["strip_currency", "to_int"] }
```

### Adding Custom Transformation Rules

To add a new transformation rule, edit `reports/services/importer.py`:

```python
def _transform(self, value: str, transforms: list[str]) -> str:
    for t in transforms:
        # ... existing rules ...
        elif t == "your_new_rule":
            value = your_transformation_logic(value)
    return value
```

Then document the new rule in this section.

---

## 6. REPORT FILTER RULES

### How Filters Work

Each report row has a `processed_data` JSON field.
The CRM reports API supports text-based search across `processed_data`:
```
GET /api/reports/sources/{id}/rows/?search=INV-2025
```

For advanced filtering, the `filter_config` JSON in `GoogleSheetSource` documents
which columns should be filterable and what filter type applies.

### Filter Config JSON Format
```json
{
  "filters": [
    {
      "field":        "payment_status",
      "label":        "Payment Status",
      "type":         "dropdown",
      "options":      ["Paid", "Pending", "Cancelled"],
      "multi_select": true
    },
    {
      "field":       "booking_date",
      "label":       "Booking Date",
      "type":        "date_range"
    },
    {
      "field":       "total_amount",
      "label":       "Total Amount",
      "type":        "numeric_range",
      "min":         0,
      "max":         100000
    }
  ]
}
```

### Filter Types

| Filter Type | Description | UI Component | Example |
|------------|-------------|--------------|---------|
| `text` | Free-text substring search | Input field | Search by company name |
| `dropdown` | Exact match from predefined list | Select menu | Payment status: Paid/Pending/Cancelled |
| `multi_dropdown` | Select one or more values | Multi-select | Event codes: SUMMIT, FORUM, GALA |
| `date_range` | Filter by start and end date | Date pickers | Bookings between Jan 1 – Mar 31 |
| `numeric_range` | Filter by min and/or max value | Number inputs | Revenue between £5,000 – £50,000 |
| `boolean` | True/False filter | Toggle | Attended: Yes/No |
| `contains` | Value contains substring | Input | Invoice number contains "2025" |
| `starts_with` | Value starts with string | Input | Event code starts with "SUMMIT" |

### Filter Rules Template

```
-----------------------------------------------------------
REPORT: [Report Name]
-----------------------------------------------------------

| Field (CRM Name) | Label in UI | Filter Type | Options / Range | Multi-select | Backend Logic |
|-----------------|-------------|-------------|-----------------|-------------|---------------|
```

### Registered Filter Rules

> Add one section per report/source.

#### REPORT: _(Enter Report Name)_

**Source Sheet:** _(enter)_

| Field | Label in UI | Filter Type | Options / Range | Multi-select | Notes |
|-------|------------|-------------|-----------------|--------------|-------|
| _(enter)_ | _(enter)_ | _(text/dropdown/date_range/numeric_range)_ | _(enter)_ | Yes/No | |

**JSON for `filter_config` field:**
```json
{
  "filters": [
  ]
}
```

### Standard Filter Sets

#### Booking Reports — Standard Filters

| Field | Label | Filter Type | Options | Multi-select |
|-------|-------|-------------|---------|--------------|
| `payment_status` | Payment Status | dropdown | Paid, Pending, Cancelled | Yes |
| `event_code` | Event | multi_dropdown | _(list from events)_ | Yes |
| `booking_date` | Booking Date | date_range | — | — |
| `total_amount` | Total Amount | numeric_range | 0 – ∞ | — |
| `company_name` | Company | text | — | — |
| `invoice_number` | Invoice | text | — | — |

#### Event Reports — Standard Filters

| Field | Label | Filter Type | Options | Multi-select |
|-------|-------|-------------|---------|--------------|
| `event_code` | Event Code | text | — | — |
| `event_date` | Event Date | date_range | — | — |
| `status` | Status | dropdown | Live, Upcoming, Completed, Cancelled | Yes |
| `city` | City | multi_dropdown | _(list)_ | Yes |

#### Delegate Reports — Standard Filters

| Field | Label | Filter Type | Options | Multi-select |
|-------|-------|-------------|---------|--------------|
| `event_code` | Event | multi_dropdown | _(list)_ | Yes |
| `company_name` | Company | text | — | — |
| `ticket_package` | Package | dropdown | _(list)_ | Yes |
| `attended` | Attended | boolean | — | — |

### Filter Priority Order

When multiple filters are applied simultaneously, they are combined with AND logic:
```
results = rows WHERE (filter1 AND filter2 AND filter3...)
```

| Report | Exception | Logic |
|--------|----------|-------|
| _(enter)_ | | |

---

## 7. REPORT GROUPING RULES

### How Grouping Works

Grouping is defined via the `grouping_config` JSON in each `GoogleSheetSource` or `ReportDefinition` record.

### Grouping Config JSON Format
```json
{
  "groups": [
    {
      "field":       "event_code",
      "label":       "Event",
      "aggregations": [
        { "field": "total_amount",   "function": "sum",   "label": "Total Revenue" },
        { "field": "invoice_number", "function": "count", "label": "Bookings" },
        { "field": "delegate_count", "function": "sum",   "label": "Delegates" }
      ]
    }
  ]
}
```

### Aggregation Functions

| Function | Description | Input Type | Output Type | Null Handling |
|----------|-------------|------------|-------------|---------------|
| `sum` | Total of all values | numeric | numeric | Nulls treated as 0 |
| `count` | Count of rows | any | integer | Counts all including nulls |
| `count_distinct` | Count unique values | any | integer | Nulls excluded |
| `avg` | Arithmetic mean | numeric | numeric | Nulls excluded from average |
| `min` | Minimum value | numeric / date | same type | Nulls excluded |
| `max` | Maximum value | numeric / date | same type | Nulls excluded |
| `first` | First value in group | any | same type | Order-dependent |
| `last` | Last value in group | any | same type | Order-dependent |
| `concat` | Concatenate unique values | string | string | Separated by ", " |

### Grouping Template

```
-----------------------------------------------------------
REPORT: [Report Name]
GROUP BY: [Column Name(s)]
-----------------------------------------------------------

Description:
  [What question does this grouping answer?]

Group By Fields:
  - [primary grouping field]
  - [secondary grouping field (if nested)]

Aggregations:
  | Aggregated Field | Function | Output Label | Notes |
  |-----------------|----------|-------------|-------|

Sort Order:
  [How are groups sorted?]

Totals Row:
  [Should a totals/grand total row be shown?]

JSON Config:
  { "groups": [...] }
```

### Registered Grouping Rules

> Add one section per report that uses grouping.

#### REPORT: _(Enter Report Name)_

**Group By:** _(enter field name)_
**Description:** _(enter)_

| Aggregated Field | Function | Output Label | Format | Notes |
|-----------------|----------|-------------|--------|-------|
| _(enter)_ | _(enter)_ | _(enter)_ | _(currency/number/%)_ | |

**Sort Order:** _(enter)_
**Totals Row:** _(Yes/No)_

```json
{
  "groups": [
    {
      "field": "",
      "label": "",
      "aggregations": []
    }
  ]
}
```

### Standard Grouping Patterns

#### Pattern 1: Revenue by Event
```json
{
  "groups": [{
    "field": "event_code",
    "label": "Event",
    "aggregations": [
      { "field": "total_amount",   "function": "sum",   "label": "Total Revenue" },
      { "field": "invoice_number", "function": "count", "label": "Bookings" },
      { "field": "delegate_count", "function": "sum",   "label": "Delegates" }
    ]
  }]
}
```

#### Pattern 2: Bookings by Payment Status
```json
{
  "groups": [{
    "field": "payment_status",
    "label": "Payment Status",
    "aggregations": [
      { "field": "invoice_number", "function": "count", "label": "Count" },
      { "field": "total_amount",   "function": "sum",   "label": "Total" }
    ]
  }]
}
```

#### Pattern 3: Delegates by Company
```json
{
  "groups": [{
    "field": "company_name",
    "label": "Company",
    "aggregations": [
      { "field": "email",     "function": "count_distinct", "label": "Delegates" },
      { "field": "event_code", "function": "concat",        "label": "Events Attended" }
    ]
  }]
}
```

#### Pattern 4: Monthly Booking Trend
```json
{
  "groups": [{
    "field": "booking_month",
    "label": "Month",
    "aggregations": [
      { "field": "invoice_number", "function": "count", "label": "Bookings" },
      { "field": "total_amount",   "function": "sum",   "label": "Revenue" }
    ]
  }]
}
```

### Grouping Inventory

| # | Report | Group By | Aggregations | Sort | Notes |
|---|--------|----------|-------------|------|-------|
| 1 | _(enter)_ | | | | |
| 2 | | | | | |
| 3 | | | | | |

---

## 8. REPORT CALCULATION RULES

> Document every calculation rule that should be reproduced in the CRM from Google Sheets formulas.
> This is the reference for implementing server-side calculations in the `formula_config` of each `GoogleSheetSource`.

### Calculation Types

| Type | Description | Where Executed |
|------|-------------|----------------|
| **Row-level** | Calculated per row from other fields in the same row | During import (importer.py) |
| **Aggregate** | Calculated across all rows for a group | At report query time |
| **Cross-source** | Calculated using values from multiple sheet sources | Dedicated calculation service |
| **Conditional** | Calculated based on conditional logic (IF/SWITCH) | During import or at query time |
| **Lookup** | Value looked up from another table or sheet | During import (after join) |

### Calculation Template

```
-----------------------------------------------------------
CALCULATION: [Calculation Name]
-----------------------------------------------------------

Report:          [Which report uses this calculation?]
Type:            [row-level / aggregate / cross-source / conditional / lookup]
Output Field:    [Name of the field this calculation produces]
Output Format:   [Currency / Number / Percentage / Date / Text / Boolean]

Description:
  [What does this calculation produce? Why is it needed?]

Google Sheet Formula:
  [Exact formula from the sheet]

CRM Calculation Logic:
  Step 1: [description]
  Step 2: [description]

Python Implementation:
  def calculate_xxx(row_data: dict) -> str:
      ...

Input Fields Required:
  - [list fields this calculation depends on]

Validation:
  - [Expected output range]
  - [Known edge cases]
  - [Test cases]

formula_config JSON:
  {
    "output_field_name": {
      "type":    "conditional",
      "formula": "..."
    }
  }
```

### Registered Calculations

> Add one block per calculation.

#### CALCULATION: _(Enter Name)_

**Report:** _(enter)_
**Type:** _(enter)_
**Output Field:** _(enter)_
**Output Format:** _(enter)_

**Description:** _(enter)_

**Google Sheet Formula:**
```
=(enter)
```

**Python Implementation:**
```python
# enter implementation
```

**Input Fields Required:** _(enter)_

### Standard Calculation Patterns

#### Pattern 1: Discount Amount
**Purpose:** Calculate discount amount from percentage × total.

**Formula:** `=total_amount * discount_rate / 100`

```python
total    = float(row.get("total_amount", 0) or 0)
rate     = float(row.get("discount_rate", 0) or 0)
discount = round(total * rate / 100, 2)
```

#### Pattern 2: Revenue After Discount
**Purpose:** Net revenue after discount applied.

**Formula:** `=total_amount - discount_amount`

```python
total    = float(row.get("total_amount", 0) or 0)
discount = float(row.get("discount_amount", 0) or 0)
net      = round(total - discount, 2)
```

#### Pattern 3: Value Band Classification
**Purpose:** Classify bookings into value bands (Low / Mid / High).

**Formula:** `=IF(D2<500,"Low",IF(D2<2000,"Mid","High"))`

```python
total = float(row.get("total_amount", 0) or 0)
if total < 500:
    band = "Low"
elif total < 2000:
    band = "Mid"
else:
    band = "High"
```

#### Pattern 4: Days Since Booking
**Purpose:** Calculate how many days have passed since the booking date.

**Formula:** `=TODAY()-booking_date`

```python
from datetime import date
from dateutil import parser
booking_date = parser.parse(row.get("booking_date", "")).date()
days_since   = (date.today() - booking_date).days
```

#### Pattern 5: Attendance Rate
**Purpose:** Calculate delegate attendance rate as a percentage.

**Formula:** `=attended_count / registered_count * 100`

```python
registered = int(row.get("registered_count", 0) or 0)
attended   = int(row.get("attended_count", 0) or 0)
rate       = round(attended / registered * 100, 1) if registered > 0 else 0
```

#### Pattern 6: Revenue per Delegate
**Purpose:** Average revenue generated per delegate.

**Formula:** `=total_amount / delegate_count`

```python
total     = float(row.get("total_amount", 0) or 0)
delegates = int(row.get("delegate_count", 0) or 1)
per_del   = round(total / delegates, 2) if delegates > 0 else 0
```

### Calculation Inventory

| # | Calculation Name | Report | Type | Output Field | Formula Origin |
|---|-----------------|--------|------|-------------|----------------|
| 1 | _(enter)_ | | | | |
| 2 | | | | | |
| 3 | | | | | |

### Implementing Calculations in the CRM

Calculations are implemented in `reports/services/importer.py` inside `_apply_mappings_and_transforms()`.

To add a new calculated field:
1. Document it in this section following the template
2. Implement the Python logic in `importer.py`
3. Reference the output field name in the source's `formula_config` JSON:
```json
{
  "calculated_fields": [
    {
      "output_field": "value_band",
      "type":         "conditional",
      "depends_on":   ["total_amount"]
    }
  ]
}
```

---

## 9. REPORT RELATIONSHIPS

### Why Relationships Matter

Some reports combine data from multiple Google Sheets.
For example: a Revenue report may join booking data from Sheet A with payment data from Sheet B using the invoice number as the shared key.

This section documents every such relationship so the CRM can:
1. Join data across sources correctly
2. Detect referential integrity issues
3. Build multi-source ReportDefinition configurations

### Relationship Types

| Type | Description | Example |
|------|-------------|---------|
| **One-to-one** | Each row in A maps to exactly one row in B | Invoice ↔ Payment record |
| **One-to-many** | One row in A maps to multiple rows in B | Invoice ↔ Delegates |
| **Many-to-one** | Multiple rows in A reference one row in B | Bookings → Event |
| **Lookup** | A value in A is looked up in B | Event code → Event name |
| **Aggregation** | Multiple rows in A summarised per key | Delegates → Count per invoice |

### Relationship Template

```
-----------------------------------------------------------
RELATIONSHIP: [Relationship Name]
-----------------------------------------------------------

Type:                 [one-to-one / one-to-many / many-to-one / lookup / aggregation]
Description:          [What does this relationship represent?]

Primary Source:       [Sheet name / report name]
Secondary Source:     [Sheet name / report name]

Join Key (Primary):   [Column in primary source used for join]
Join Key (Secondary): [Matching column in secondary source]

Join Type:            [INNER / LEFT OUTER / RIGHT OUTER]
Join Logic:           [Exact matching / fuzzy / normalised]

Relationship Rules:
  - [Rule 1: What determines a valid match?]
  - [Rule 2: What to do if no match found?]
  - [Rule 3: What to do if multiple matches found?]

Output Fields Used:
  From Primary:   [list of columns]
  From Secondary: [list of columns]

Known Issues:
  - [Any data quality issues with the join key?]
```

### Registered Relationships

> Add one block per relationship.

#### RELATIONSHIP: _(Enter Name)_

**Type:** _(enter)_
**Description:** _(enter)_

**Primary Source:** _(enter)_
**Secondary Source:** _(enter)_

**Join Key (Primary):** _(enter)_
**Join Key (Secondary):** _(enter)_
**Join Type:** _(enter)_

**Relationship Rules:** _(enter)_

**Output Fields Used:**
- From Primary: _(enter)_
- From Secondary: _(enter)_

### Shared Identifiers

| Identifier | Description | Used In Sheets | Format | Notes |
|-----------|-------------|----------------|--------|-------|
| `invoice_number` | Primary booking key | _(list sheets)_ | `INV-YYYY-NNN` or similar | Must match exactly |
| `event_code` | Event identifier | _(list sheets)_ | Uppercase, no spaces | |
| `delegate_email` | Delegate key | _(list sheets)_ | Lowercase email | |
| _(add more)_ | | | | |

### Dependency Map

```
[Add a dependency diagram here using ASCII art or plain text]

Example:
Monthly Revenue Report
├── depends on: Bookings Sheet (source of invoice data)
├── depends on: Payments Sheet (source of payment confirmation)
└── depends on: Events Sheet (source of event names/dates)

Delegate Attendance Report
├── depends on: Delegates Sheet
└── depends on: Events Sheet
```

### Data Integrity Rules

| Rule | Source Sheet | Target Sheet | Key | Action if Violated |
|------|-------------|-------------|-----|-------------------|
| Invoice must exist in CRM | Any booking sheet | CRM invoices | invoice_number | Flag row as warning |
| Event code must exist in CRM | Any event sheet | CRM events | event_code | Flag row as warning |
| Email must be valid format | Any delegate sheet | — | delegate_email | Apply validation on import |
| _(add more)_ | | | | |

---

## 10. SYNC CONFIGURATION

### Sync Architecture Overview

```
Trigger (Manual click / Scheduler)
        ↓
ReportSyncOrchestrator.sync_source(source) or .sync_all()
        ↓
GoogleSheetsConnector.read_worksheet(sheet_id, worksheet_name)
  → Batch reads via Google Sheets API v4 batchGet
  → Retry on rate-limit (429) or server error (503) — up to 3 attempts
        ↓
GoogleSheetReportImporter.run()
  → Parse headers from row 0
  → Build raw_data dict per row
  → Apply column_mappings → processed_data
  → Apply transformation_config → transformed values
  → SHA-256 hash raw_data for change detection
  → Upsert ReportRow records in a transaction
  → Soft-delete rows not present in current sync
        ↓
ReportSyncLog (per-run audit record)
GoogleSheetSource (counters + timestamps updated)
```

### Global Sync Settings

| Setting | Value | Notes |
|---------|-------|-------|
| Max retries per API call | 3 | Exponential backoff: 1.5s, 3s, 4.5s |
| Sheet read range | `A:ZZ` | All columns up to ZZ |
| Value render option | `UNFORMATTED_VALUE` | Gets actual values, not display strings |
| Date render option | `FORMATTED_STRING` | Dates as text in sheet's format |
| Batch size (sync_all) | All active sources | Sequential to respect API quotas |
| Row hash algorithm | SHA-256 | Of JSON-serialised raw_data |
| Soft delete on sync | Yes | Inactive rows kept 30 days |

### Google Sheets API Quotas

| Quota | Limit | Strategy |
|-------|-------|----------|
| Read requests per minute per user | 60 | Sequential sync + retry with backoff |
| Read requests per 100 seconds per project | 100 | Spacing between sources in sync_all |
| Max response size | 10MB | Use column range `A:ZZ` not `A:ZZZ` |

### Sync Frequencies

| Frequency | When Used | Notes |
|-----------|----------|-------|
| `manual` | Default for all sources | Admin clicks "Sync Now" in CRM |
| `hourly` | High-frequency operational sheets | Requires Celery beat or cron job |
| `daily` | Standard reporting sheets | Typically runs overnight |
| `weekly` | Low-change reference sheets | Run on Monday morning |

### Sync Configuration Template

```
-----------------------------------------------------------
SOURCE: [Sheet Name]
-----------------------------------------------------------

Sync Frequency:    [manual / hourly / daily / weekly]
Sync Enabled:      [Yes / No]
Is Active:         [Yes / No]
Sheet ID:          [extracted from URL]
Worksheet:         [Tab name]
Range:             [A:ZZ or custom range]

Pre-sync Notes:
  [Any checks to perform before syncing?]

Post-sync Actions:
  [Any actions to take after sync completes?]

Error Handling:
  [What to do if sync fails?]

Expected Row Count:    [approximate]
Expected Column Count: [approximate]
Performance Notes:     [Any large datasets?]
```

### Registered Sync Configurations

> Add one section per sheet source.

#### SOURCE: _(Enter Sheet Name)_

**Sync Frequency:** _(enter)_
**Sync Enabled:** _(Yes/No)_
**Expected Row Count:** _(enter)_
**Expected Column Count:** _(enter)_

**Pre-sync Notes:** _(enter)_
**Post-sync Actions:** _(enter)_
**Error Handling:** _(enter)_

### Sync Status Reference

| Status | Meaning |
|--------|---------|
| `never` | Source has never been synced |
| `idle` | Sync completed successfully, waiting for next run |
| `syncing` | Sync currently in progress |
| `success` | Last sync completed successfully (all rows processed) |
| `partial` | Last sync completed with some row-level failures |
| `failed` | Last sync failed entirely (connector or API error) |

### Incremental Sync Logic

The importer uses SHA-256 row hashing for efficient incremental sync:

1. All existing rows for the source are soft-deleted (`is_active=False`)
2. Sheet rows are read fresh from the API
3. For each row:
   - Build `raw_data` dict
   - Compute `row_hash = SHA256(JSON(raw_data))`
   - If existing row at same `row_number`:
     - Hash matches → re-activate, no update (unchanged)
     - Hash differs → re-activate, update all fields (changed)
   - If no existing row → create new (inserted)
4. Rows not re-activated remain soft-deleted (removed from sheet)
5. Source `records_count` updated to active row count

This means each sync does exactly the minimum writes to the database.

### Troubleshooting Sync Failures

| Error | Likely Cause | Resolution |
|-------|-------------|------------|
| `Credentials file not found` | `GOOGLE_SHEETS_CREDENTIALS` env var not set | Set correct path to service account JSON |
| `The caller does not have permission` | Service account not granted access to sheet | Share sheet with service account email |
| `Requested entity was not found` | Sheet ID is wrong or sheet was deleted | Verify sheet URL in registry |
| `Invalid range` | Worksheet tab name is wrong | Check exact tab name (case-sensitive) |
| `Quota exceeded` | Too many API calls per minute | Reduce sync frequency or add delays |
| `Connection timeout` | Network issue | Automatic retry (3 attempts) handles this |

---

_This is the single authoritative reference for the LINQ CRM reporting system._
_Keep it updated whenever you add a new Google Sheet, change a configuration, or discover new behavior._
