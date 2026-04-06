-- ClearPath Initial Schema
-- Tables: properties, analyses, leads, lead_activity, system_defaults
-- Phase 2 tables (projects, project_updates) included for completeness

-- ─── 1. PROPERTIES ───────────────────────────────────────────────────────────

CREATE TABLE properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address         TEXT NOT NULL,
    city            TEXT,
    county          TEXT,
    state           TEXT DEFAULT 'IL',
    zip             TEXT,
    lat             DECIMAL(10, 7),
    lng             DECIMAL(10, 7),
    sqft            INTEGER,
    bedrooms        INTEGER,
    bathrooms       DECIMAL(3, 1),
    year_built      INTEGER,
    lot_size_sqft   INTEGER,
    property_type   TEXT,
    zestimate       INTEGER,
    data            JSONB,
    is_service_area BOOLEAN GENERATED ALWAYS AS (county = 'Cook') STORED,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_properties_address ON properties (address);
CREATE INDEX idx_properties_zip ON properties (zip);
CREATE INDEX idx_properties_county ON properties (county);
CREATE INDEX idx_properties_service_area ON properties (is_service_area);

-- ─── 2. ANALYSES ─────────────────────────────────────────────────────────────

CREATE TABLE analyses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,

    input_address       TEXT NOT NULL,
    input_condition     TEXT NOT NULL CHECK (input_condition IN (
                            'cosmetic', 'light', 'medium', 'heavy', 'gut'
                        )),
    input_purchase_price INTEGER NOT NULL,
    input_down_pct      DECIMAL(4, 3) DEFAULT 0.25,
    input_hold_months   INTEGER DEFAULT 6,
    input_interest_rate DECIMAL(5, 4) DEFAULT 0.075,
    inputs          JSONB,

    arv                 INTEGER,
    rehab_low           INTEGER,
    rehab_high          INTEGER,
    rehab_estimate      INTEGER,
    rent_estimate       INTEGER,
    monthly_mortgage    INTEGER,
    monthly_cash_flow   INTEGER,
    cash_on_cash_return DECIMAL(5, 2),
    flip_profit         INTEGER,
    mao                 INTEGER,
    results         JSONB,

    deal_signal_rental  TEXT CHECK (deal_signal_rental IN ('green', 'yellow', 'red')),
    deal_signal_flip    TEXT CHECK (deal_signal_flip IN ('green', 'yellow', 'red')),
    deal_signal         TEXT CHECK (deal_signal IN ('green', 'yellow', 'red')),

    is_service_area BOOLEAN DEFAULT false,
    arv_method      TEXT,
    rent_method     TEXT,

    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analyses_property ON analyses (property_id);
CREATE INDEX idx_analyses_deal_signal ON analyses (deal_signal);
CREATE INDEX idx_analyses_service_area ON analyses (is_service_area);
CREATE INDEX idx_analyses_created ON analyses (created_at DESC);

-- ─── 3. LEADS ────────────────────────────────────────────────────────────────

CREATE TABLE leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email           TEXT NOT NULL,
    name            TEXT,
    phone           TEXT,

    analysis_id     UUID REFERENCES analyses(id) ON DELETE SET NULL,
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,

    address         TEXT,
    is_service_area BOOLEAN DEFAULT false,
    deal_signal     TEXT,
    deal_arv        INTEGER,
    deal_flip_profit INTEGER,
    deal_cash_flow  INTEGER,
    deal_condition  TEXT,

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

    qualification_score INTEGER,
    budget_range        TEXT,
    strategy            TEXT,
    experience_level    TEXT,
    financing_type      TEXT,

    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,

    email_sequence  TEXT,
    sequence_paused BOOLEAN DEFAULT false,

    last_contacted_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_leads_email ON leads (email);
CREATE INDEX idx_leads_status ON leads (status);
CREATE INDEX idx_leads_service_area ON leads (is_service_area);
CREATE INDEX idx_leads_deal_signal ON leads (deal_signal);
CREATE INDEX idx_leads_source ON leads (source);
CREATE INDEX idx_leads_created ON leads (created_at DESC);
CREATE INDEX idx_leads_crm_view ON leads (is_service_area DESC, deal_signal, created_at DESC);

-- ─── 4. LEAD ACTIVITY ────────────────────────────────────────────────────────

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

    notes       TEXT,
    metadata    JSONB,
    created_by  TEXT DEFAULT 'system',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_lead ON lead_activity (lead_id);
CREATE INDEX idx_activity_type ON lead_activity (type);
CREATE INDEX idx_activity_created ON lead_activity (created_at DESC);

-- ─── 5. PROJECTS ─────────────────────────────────────────────────────────────

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
    property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
    analysis_id     UUID REFERENCES analyses(id) ON DELETE SET NULL,

    project_name    TEXT,
    address         TEXT NOT NULL,
    strategy        TEXT CHECK (strategy IN ('flip', 'hold')),

    status          TEXT DEFAULT 'planning' CHECK (status IN (
                        'planning', 'approved', 'in_progress',
                        'punch_list', 'lease_up', 'stabilized',
                        'completed', 'cancelled'
                    )),

    sow             JSONB,
    condition_tier  TEXT,
    budget_total    INTEGER,
    budget_spent    INTEGER DEFAULT 0,
    contingency     INTEGER,

    estimated_start DATE,
    estimated_end   DATE,
    actual_start    DATE,
    actual_end      DATE,

    payment_schedule JSONB,

    rent_listed     INTEGER,
    rent_actual     INTEGER,
    tenant_name     TEXT,
    lease_start     DATE,
    lease_end       DATE,

    final_arv       INTEGER,
    final_rehab_cost INTEGER,
    final_cash_flow INTEGER,

    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_lead ON projects (lead_id);
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_projects_created ON projects (created_at DESC);

-- ─── 6. PROJECT UPDATES ──────────────────────────────────────────────────────

CREATE TABLE project_updates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    type        TEXT NOT NULL CHECK (type IN (
                    'weekly_update', 'milestone', 'change_order',
                    'inspection', 'issue', 'photo_update',
                    'budget_update', 'completion'
                )),

    title       TEXT,
    content     TEXT,
    photos      TEXT[],

    change_amount   INTEGER,
    change_approved BOOLEAN,

    budget_spent_to_date INTEGER,
    budget_remaining     INTEGER,

    created_by  TEXT DEFAULT 'system',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_updates_project ON project_updates (project_id);
CREATE INDEX idx_updates_type ON project_updates (type);
CREATE INDEX idx_updates_created ON project_updates (created_at DESC);

-- ─── 7. SYSTEM DEFAULTS ──────────────────────────────────────────────────────

CREATE TABLE system_defaults (
    key         TEXT PRIMARY KEY,
    value       DECIMAL(10, 4) NOT NULL,
    label       TEXT,
    category    TEXT,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO system_defaults (key, value, label, category) VALUES
    ('down_payment_pct',        0.2500, 'Down Payment %',               'finance'),
    ('interest_rate',           0.0750, 'Interest Rate',                'finance'),
    ('loan_term_years',         30,     'Loan Term (years)',            'finance'),
    ('hold_months',             6,      'Flip Hold Time (months)',      'finance'),
    ('vacancy_rate',            0.0800, 'Vacancy Rate',                 'expense'),
    ('mgmt_rate',               0.1000, 'Property Management Rate',     'expense'),
    ('maintenance_rate',        0.0600, 'Maintenance Rate',             'expense'),
    ('capex_rate',              0.0500, 'CapEx Reserve Rate',           'expense'),
    ('insurance_monthly',       100,    'Monthly Insurance',            'expense'),
    ('property_tax_rate',       0.0150, 'Annual Property Tax Rate',     'expense'),
    ('closing_cost_buy_pct',    0.0200, 'Buyer Closing Costs %',       'finance'),
    ('closing_cost_sell_pct',   0.0800, 'Seller Closing Costs %',      'finance'),
    ('holding_cost_monthly_pct',0.0100, 'Monthly Holding Cost %',      'finance'),
    ('mao_arv_multiplier',      0.7000, 'MAO ARV Multiplier (70% rule)','finance'),
    ('default_rent_ratio',      0.0090, 'Rent-to-Value Ratio',         'finance'),
    ('rehab_cosmetic_low',      10,     'Cosmetic $/sqft (low)',        'rehab'),
    ('rehab_cosmetic_high',     20,     'Cosmetic $/sqft (high)',       'rehab'),
    ('rehab_light_low',         20,     'Light $/sqft (low)',           'rehab'),
    ('rehab_light_high',        35,     'Light $/sqft (high)',          'rehab'),
    ('rehab_medium_low',        35,     'Medium $/sqft (low)',          'rehab'),
    ('rehab_medium_high',       55,     'Medium $/sqft (high)',         'rehab'),
    ('rehab_heavy_low',         55,     'Heavy $/sqft (low)',           'rehab'),
    ('rehab_heavy_high',        85,     'Heavy $/sqft (high)',          'rehab'),
    ('rehab_gut_low',           85,     'Gut $/sqft (low)',             'rehab'),
    ('rehab_gut_high',          150,    'Gut $/sqft (high)',            'rehab'),
    ('signal_cashflow_green',   300,    'Green signal: min cash flow',  'deal_signal'),
    ('signal_cashflow_red',     0,      'Red signal: below cash flow',  'deal_signal'),
    ('signal_flip_green',       30000,  'Green signal: min flip profit','deal_signal'),
    ('signal_flip_red',         10000,  'Red signal: below flip profit','deal_signal');

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON properties FOR SELECT USING (true);
CREATE POLICY "Service write" ON properties FOR INSERT WITH CHECK (auth.role() = 'service_role');

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON analyses FOR SELECT USING (true);
CREATE POLICY "Service write" ON analyses FOR INSERT WITH CHECK (auth.role() = 'service_role');

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read/write" ON leads USING (auth.role() = 'service_role');

ALTER TABLE lead_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read/write" ON lead_activity USING (auth.role() = 'service_role');

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read/write" ON projects USING (auth.role() = 'service_role');

ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read/write" ON project_updates USING (auth.role() = 'service_role');

ALTER TABLE system_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON system_defaults FOR SELECT USING (true);
CREATE POLICY "Admin write" ON system_defaults FOR UPDATE USING (auth.role() = 'service_role');
