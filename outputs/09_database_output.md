# ClearPath Database Schema

**Document:** 09 of 10
**Phase:** Phase 3
**Status:** Complete
**Generated:** 2026-04-04

---

## Overview

The ClearPath database is hosted on **Supabase (PostgreSQL)**. It is designed to be simple, flat where possible, and JSONB-flexible where the data shape may evolve. Every table has Row Level Security (RLS) enabled.

**Design Principles:**
- No premature normalization — keep it flat until complexity demands otherwise
- Use JSONB for variable-shape data (analysis inputs/outputs, property data)
- Timestamps on everything
- Soft deletes where applicable (no data destruction)

---

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│  properties  │       │   analyses   │       │      leads       │
│──────────────│       │──────────────│       │──────────────────│
│ id (PK)      │◄──┐   │ id (PK)      │   ┌──►│ id (PK)          │
│ address      │   │   │ property_id  │───┘   │ email            │
│ city         │   └───│ (FK)         │       │ analysis_id (FK) │
│ county       │       │ inputs       │       │ is_service_area  │
│ state        │       │ results      │       │ status           │
│ zip          │       │ deal_signal  │       │ source           │
│ data (JSONB) │       │ created_at   │       │ tags             │
│ created_at   │       └──────────────┘       │ created_at       │
└──────────────┘                              └──────────────────┘
                                                      │
                                              ┌───────▼──────────┐
                                              │   lead_activity  │
                                              │──────────────────│
                                              │ id (PK)          │
                                              │ lead_id (FK)     │
                                              │ type             │
                                              │ notes            │
                                              │ created_at       │
                                              └──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│     projects     │       │ project_updates  │
│──────────────────│       │──────────────────│
│ id (PK)          │◄──────│ project_id (FK)  │
│ lead_id (FK)     │       │ id (PK)          │
│ property_id (FK) │       │ type             │
│ status           │       │ content          │
│ sow (JSONB)      │       │ photos           │
│ budget           │       │ created_at       │
│ created_at       │       └──────────────────┘
└──────────────────┘
```

---

## Table Definitions

---

### 1. `properties`

Stores raw property data pulled from Zillow/API or entered manually. One row per unique address.

```sql
CREATE TABLE properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address         TEXT NOT NULL,
    city            TEXT,
    county          TEXT,                -- "Cook" for service area detection
    state           TEXT DEFAULT 'IL',
    zip             TEXT,
    lat             DECIMAL(10, 7),
    lng             DECIMAL(10, 7),
    sqft            INTEGER,
    bedrooms        INTEGER,
    bathrooms       DECIMAL(3, 1),       -- 2.5 baths
    year_built      INTEGER,
    lot_size_sqft   INTEGER,
    property_type   TEXT,                -- 'single_family', 'multi_family', 'condo'
    zestimate       INTEGER,             -- Zillow estimate at time of pull
    data            JSONB,               -- Full raw API response for future use
    is_service_area BOOLEAN GENERATED ALWAYS AS (county = 'Cook') STORED,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_properties_address ON properties (address);
CREATE INDEX idx_properties_zip ON properties (zip);
CREATE INDEX idx_properties_county ON properties (county);
CREATE INDEX idx_properties_service_area ON properties (is_service_area);
```

**Key design decision:** `is_service_area` is a **generated column** — it auto-computes from `county = 'Cook'`. No need to set it manually. If the service area ever expands, update this one expression.

---

### 2. `analyses`

One row per deal analysis run. A single property can have multiple analyses (different conditions, prices).

```sql
CREATE TABLE analyses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
    
    -- User inputs (stored explicitly for auditability)
    input_address       TEXT NOT NULL,
    input_condition     TEXT NOT NULL CHECK (input_condition IN (
                            'cosmetic', 'light', 'medium', 'heavy', 'gut'
                        )),
    input_purchase_price INTEGER NOT NULL,
    input_down_pct      DECIMAL(4, 3) DEFAULT 0.25,
    input_hold_months   INTEGER DEFAULT 6,
    input_interest_rate DECIMAL(5, 4) DEFAULT 0.075,
    
    -- All inputs as JSONB (for flexibility / future fields)
    inputs          JSONB,
    
    -- Calculated results
    arv                 INTEGER,
    rehab_low           INTEGER,
    rehab_high          INTEGER,
    rehab_estimate      INTEGER,         -- midpoint
    rent_estimate       INTEGER,
    monthly_mortgage    INTEGER,
    monthly_cash_flow   INTEGER,
    cash_on_cash_return DECIMAL(5, 2),   -- e.g., 6.20
    flip_profit         INTEGER,
    mao                 INTEGER,
    
    -- All results as JSONB (for flexibility / future fields)
    results         JSONB,
    
    -- Deal signals
    deal_signal_rental  TEXT CHECK (deal_signal_rental IN ('green', 'yellow', 'red')),
    deal_signal_flip    TEXT CHECK (deal_signal_flip IN ('green', 'yellow', 'red')),
    deal_signal         TEXT CHECK (deal_signal IN ('green', 'yellow', 'red')),
    
    -- Metadata
    is_service_area BOOLEAN DEFAULT false,
    arv_method      TEXT,                -- 'comp_based' or 'zestimate_adjusted'
    rent_method     TEXT,                -- 'ratio' or 'bedroom_based'
    
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_analyses_property ON analyses (property_id);
CREATE INDEX idx_analyses_deal_signal ON analyses (deal_signal);
CREATE INDEX idx_analyses_service_area ON analyses (is_service_area);
CREATE INDEX idx_analyses_created ON analyses (created_at DESC);
```

**Why both explicit columns AND JSONB?** Explicit columns let you query and filter (`WHERE deal_signal = 'green'`). JSONB stores the full payload for future-proofing without migrations.

---

### 3. `leads`

Every email captured. The CRM core.

```sql
CREATE TABLE leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Contact info
    email           TEXT NOT NULL,
    name            TEXT,
    phone           TEXT,
    
    -- Linked data
    analysis_id     UUID REFERENCES analyses(id) ON DELETE SET NULL,
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
    
    -- Deal context (denormalized for CRM views — no joins needed)
    address         TEXT,
    is_service_area BOOLEAN DEFAULT false,
    deal_signal     TEXT,
    deal_arv        INTEGER,
    deal_flip_profit INTEGER,
    deal_cash_flow  INTEGER,
    deal_condition  TEXT,
    
    -- CRM fields
    status          TEXT DEFAULT 'new' CHECK (status IN (
                        'new', 'contacted', 'qualified', 
                        'proposal_sent', 'converted', 'client',
                        'nurture', 'lost'
                    )),
    source          TEXT DEFAULT 'analyzer' CHECK (source IN (
                        'analyzer', 'asset_group', 'content', 
                        'referral', 'manual'
                    )),
    tags            TEXT[] DEFAULT '{}',
    notes           TEXT,
    
    -- Qualification
    qualification_score INTEGER,          -- 0-25 from the DEAL scorecard
    budget_range        TEXT,             -- "$50K-$100K", "$100K-$200K", etc.
    strategy            TEXT,             -- 'flip', 'hold', 'undecided'
    experience_level    TEXT,             -- 'first_deal', 'beginner', 'experienced'
    financing_type      TEXT,             -- 'cash', 'hard_money', 'dscr', 'conventional'
    
    -- Tracking
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    
    -- Automation
    email_sequence  TEXT,                 -- 'cook_county_flow', 'national_nurture', etc.
    sequence_paused BOOLEAN DEFAULT false,
    
    -- Timestamps
    last_contacted_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_leads_email ON leads (email);
CREATE INDEX idx_leads_status ON leads (status);
CREATE INDEX idx_leads_service_area ON leads (is_service_area);
CREATE INDEX idx_leads_deal_signal ON leads (deal_signal);
CREATE INDEX idx_leads_source ON leads (source);
CREATE INDEX idx_leads_created ON leads (created_at DESC);

-- Composite index for CRM default view (service area leads with strong signals first)
CREATE INDEX idx_leads_crm_view ON leads (is_service_area DESC, deal_signal, created_at DESC);
```

---

### 4. `lead_activity`

Activity log for every interaction with a lead. Append-only — never edit or delete.

```sql
CREATE TABLE lead_activity (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    
    type        TEXT NOT NULL CHECK (type IN (
                    'email_sent', 'email_opened', 'email_clicked',
                    'sms_sent', 'sms_replied',
                    'call_completed', 'call_missed',
                    'note_added', 'status_changed',
                    'tag_added', 'tag_removed',
                    'meeting_booked', 'meeting_completed',
                    'proposal_sent', 'agreement_signed'
                )),
    
    notes       TEXT,                    -- "Discussed Oak Forest property. Ready to move."
    metadata    JSONB,                   -- Flexible payload (email subject, call duration, etc.)
    created_by  TEXT DEFAULT 'system',   -- 'system', 'team_member_name', etc.
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_activity_lead ON lead_activity (lead_id);
CREATE INDEX idx_activity_type ON lead_activity (type);
CREATE INDEX idx_activity_created ON lead_activity (created_at DESC);
```

---

### 5. `projects`

When a lead converts to a client and a rehab project begins. Ties everything together.

```sql
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
    analysis_id     UUID REFERENCES analyses(id) ON DELETE SET NULL,
    
    -- Project info
    project_name    TEXT,                -- "1234 W Chicago Ave Rehab"
    address         TEXT NOT NULL,
    strategy        TEXT CHECK (strategy IN ('flip', 'hold')),
    
    -- Status
    status          TEXT DEFAULT 'planning' CHECK (status IN (
                        'planning', 'approved', 'in_progress',
                        'punch_list', 'lease_up', 'stabilized', 
                        'completed', 'cancelled'
                    )),
    
    -- Scope & Budget
    sow             JSONB,               -- Full scope of work (line items)
    condition_tier  TEXT,
    budget_total    INTEGER,
    budget_spent    INTEGER DEFAULT 0,
    contingency     INTEGER,
    
    -- Timeline
    estimated_start DATE,
    estimated_end   DATE,
    actual_start    DATE,
    actual_end      DATE,
    
    -- Payment
    payment_schedule JSONB,              -- Array of {milestone, amount, status, paid_at}
    
    -- Leasing (populated during lease-up phase)
    rent_listed     INTEGER,
    rent_actual     INTEGER,
    tenant_name     TEXT,
    lease_start     DATE,
    lease_end       DATE,
    
    -- Outcome
    final_arv       INTEGER,
    final_rehab_cost INTEGER,
    final_cash_flow INTEGER,
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_projects_lead ON projects (lead_id);
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_projects_created ON projects (created_at DESC);
```

---

### 6. `project_updates`

Weekly updates and milestone logs for active projects. Client-facing.

```sql
CREATE TABLE project_updates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    type        TEXT NOT NULL CHECK (type IN (
                    'weekly_update', 'milestone', 'change_order',
                    'inspection', 'issue', 'photo_update',
                    'budget_update', 'completion'
                )),
    
    title       TEXT,                    -- "Week 3 Update" or "Rough-In Inspection Passed"
    content     TEXT,                    -- Markdown-formatted update body
    photos      TEXT[],                  -- Array of photo URLs (Supabase Storage)
    
    -- For change orders
    change_amount   INTEGER,             -- Additional cost (positive) or credit (negative)
    change_approved BOOLEAN,
    
    -- Budget snapshot at time of update
    budget_spent_to_date INTEGER,
    budget_remaining     INTEGER,
    
    created_by  TEXT DEFAULT 'system',
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_updates_project ON project_updates (project_id);
CREATE INDEX idx_updates_type ON project_updates (type);
CREATE INDEX idx_updates_created ON project_updates (created_at DESC);
```

---

### 7. `system_defaults`

Configuration values used by the calculation engine. Editable without code changes.

```sql
CREATE TABLE system_defaults (
    key         TEXT PRIMARY KEY,
    value       DECIMAL(10, 4) NOT NULL,
    label       TEXT,                    -- Human-readable label
    category    TEXT,                    -- 'finance', 'expense', 'rehab', 'deal_signal'
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed data
INSERT INTO system_defaults (key, value, label, category) VALUES
    ('down_payment_pct',        0.2500, 'Down Payment %',              'finance'),
    ('interest_rate',           0.0750, 'Interest Rate',               'finance'),
    ('loan_term_years',         30,     'Loan Term (years)',           'finance'),
    ('hold_months',             6,      'Flip Hold Time (months)',     'finance'),
    ('vacancy_rate',            0.0800, 'Vacancy Rate',                'expense'),
    ('mgmt_rate',               0.1000, 'Property Management Rate',    'expense'),
    ('maintenance_rate',        0.0600, 'Maintenance Rate',            'expense'),
    ('capex_rate',              0.0500, 'CapEx Reserve Rate',          'expense'),
    ('insurance_monthly',       100,    'Monthly Insurance',           'expense'),
    ('property_tax_rate',       0.0150, 'Annual Property Tax Rate',    'expense'),
    ('closing_cost_buy_pct',    0.0200, 'Buyer Closing Costs %',      'finance'),
    ('closing_cost_sell_pct',   0.0800, 'Seller Closing Costs %',     'finance'),
    ('holding_cost_monthly_pct',0.0100, 'Monthly Holding Cost %',     'finance'),
    ('mao_arv_multiplier',      0.7000, 'MAO ARV Multiplier (70% rule)','finance'),
    ('default_rent_ratio',      0.0090, 'Rent-to-Value Ratio',        'finance'),
    ('rehab_cosmetic_low',      10,     'Cosmetic $/sqft (low)',       'rehab'),
    ('rehab_cosmetic_high',     20,     'Cosmetic $/sqft (high)',      'rehab'),
    ('rehab_light_low',         20,     'Light $/sqft (low)',          'rehab'),
    ('rehab_light_high',        35,     'Light $/sqft (high)',         'rehab'),
    ('rehab_medium_low',        35,     'Medium $/sqft (low)',         'rehab'),
    ('rehab_medium_high',       55,     'Medium $/sqft (high)',        'rehab'),
    ('rehab_heavy_low',         55,     'Heavy $/sqft (low)',          'rehab'),
    ('rehab_heavy_high',        85,     'Heavy $/sqft (high)',         'rehab'),
    ('rehab_gut_low',           85,     'Gut $/sqft (low)',            'rehab'),
    ('rehab_gut_high',          150,    'Gut $/sqft (high)',           'rehab'),
    ('signal_cashflow_green',   300,    'Green signal: min cash flow', 'deal_signal'),
    ('signal_cashflow_red',     0,      'Red signal: below cash flow', 'deal_signal'),
    ('signal_flip_green',       30000,  'Green signal: min flip profit','deal_signal'),
    ('signal_flip_red',         10000,  'Red signal: below flip profit','deal_signal');
```

**Why a table instead of hardcoded constants?** So you can tweak rehab rates, interest rates, and signal thresholds without redeploying code.

---

## Row Level Security (RLS) Policies

```sql
-- Properties: public read (anyone can analyze), no public write
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON properties FOR SELECT USING (true);
CREATE POLICY "Service write" ON properties FOR INSERT 
    WITH CHECK (auth.role() = 'service_role');

-- Analyses: public read (results are shareable), service write
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON analyses FOR SELECT USING (true);
CREATE POLICY "Service write" ON analyses FOR INSERT 
    WITH CHECK (auth.role() = 'service_role');

-- Leads: admin only (not public)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read/write" ON leads 
    USING (auth.role() = 'service_role');

-- Lead activity: admin only
ALTER TABLE lead_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read/write" ON lead_activity 
    USING (auth.role() = 'service_role');

-- Projects: admin only
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read/write" ON projects 
    USING (auth.role() = 'service_role');

-- Project updates: admin only
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read/write" ON project_updates 
    USING (auth.role() = 'service_role');

-- System defaults: public read (frontend needs these), admin write
ALTER TABLE system_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON system_defaults FOR SELECT USING (true);
CREATE POLICY "Admin write" ON system_defaults FOR UPDATE 
    USING (auth.role() = 'service_role');
```

---

## Supabase Storage Buckets

| Bucket | Purpose | Access |
|---|---|---|
| `project-photos` | Rehab progress photos, before/after | Private (signed URLs) |
| `documents` | SOWs, agreements, stabilization packages | Private |
| `listing-photos` | Lease-up listing photos | Public |

---

## Useful Queries

### CRM Default View (Hot leads first)
```sql
SELECT email, address, is_service_area, deal_signal, 
       deal_flip_profit, deal_cash_flow, status, source, created_at
FROM leads
WHERE status NOT IN ('lost', 'nurture')
ORDER BY is_service_area DESC, 
         CASE deal_signal WHEN 'green' THEN 1 WHEN 'yellow' THEN 2 ELSE 3 END,
         created_at DESC;
```

### Weekly Analysis Volume
```sql
SELECT date_trunc('week', created_at) AS week,
       COUNT(*) AS total_analyses,
       COUNT(*) FILTER (WHERE is_service_area = true) AS cook_county,
       COUNT(*) FILTER (WHERE deal_signal = 'green') AS green_deals
FROM analyses
GROUP BY 1
ORDER BY 1 DESC;
```

### Lead Conversion Funnel
```sql
SELECT status, COUNT(*) AS count,
       ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) AS pct
FROM leads
GROUP BY status
ORDER BY CASE status 
    WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'qualified' THEN 3
    WHEN 'proposal_sent' THEN 4 WHEN 'converted' THEN 5 WHEN 'client' THEN 6
    WHEN 'nurture' THEN 7 WHEN 'lost' THEN 8 END;
```

### Project Budget Tracking
```sql
SELECT p.address, p.budget_total, p.budget_spent,
       p.budget_total - p.budget_spent AS remaining,
       ROUND(p.budget_spent::numeric / p.budget_total * 100, 1) AS pct_spent,
       p.status
FROM projects p
WHERE p.status IN ('in_progress', 'punch_list')
ORDER BY pct_spent DESC;
```

---

## Migration Notes

- **MVP:** Tables 1–4 + 7 (`properties`, `analyses`, `leads`, `lead_activity`, `system_defaults`)
- **Phase 2:** Add `projects` + `project_updates` when Asset Group takes first client
- **Phase 3:** Add user accounts table when the dashboard is built

---

*Next Document → `10_legal.md` — Legal + Disclaimers*
