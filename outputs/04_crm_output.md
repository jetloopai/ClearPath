# ClearPath CRM + Lead Flow

**Document:** 04 of 10
**Phase:** MVP
**Status:** Complete
**Generated:** 2026-04-04

---

## Overview

The ClearPath CRM is not a separate tool — it is built directly into the Supabase database and managed through a lightweight admin view. The goal is to capture every lead from the Analyzer, route them correctly, and move them through a defined pipeline toward conversion into Asset Group clients (for Chicagoland leads) or future nurture (for all others).

> **Service Area Definition:** The ClearPath Asset Group serves **Cook County, IL** — which includes Chicago proper and all Cook County suburbs (Tinley Park, Oak Forest, Oak Lawn, Matteson, Calumet City, Orland Park, Evergreen Park, etc.). Any property in Cook County qualifies for the Asset Group CTA and high-priority routing.
> 
> **Detection method:** Match county field from Google Maps/Zillow API response against `"Cook County"`.

**Core Flow:**
```
Analyzer Tool → Email Capture → Lead Tagged → Pipeline Stage → Follow-Up Action
```

---

## Inputs (How Leads Enter)

| Source | Trigger | Tag Applied |
|---|---|---|
| Analyzer email gate | User submits email to unlock full results | `source:analyzer` |
| Asset Group contact form | User fills out form on `/asset-group` | `source:asset_group` |
| Content / social (Phase 2) | Link in bio, YouTube, newsletter | `source:content` |

---

## Lead Data Captured

Every lead record stores the following at capture:

```sql
-- Captured automatically
id                UUID          -- System generated
email             TEXT          -- Required
name              TEXT          -- Optional at capture (ask in follow-up)
created_at        TIMESTAMP     -- System generated

-- From the analysis session
analysis_id       UUID          -- Links to the analyses table
address           TEXT          -- Property they analyzed
is_service_area   BOOLEAN       -- TRUE if property is in Cook County, IL (Chicago + suburbs)
deal_arv          INTEGER       -- ARV from analysis
deal_flip_profit  INTEGER       -- Flip profit from analysis
deal_cash_flow    INTEGER       -- Monthly cash flow from analysis
deal_signal       TEXT          -- 'green', 'yellow', 'red'
condition         TEXT          -- Rehab condition they selected

-- CRM fields (updated manually or via automation)
name              TEXT
phone             TEXT
status            TEXT          -- Pipeline stage (see below)
source            TEXT          -- 'analyzer', 'asset_group', 'content'
tags              TEXT[]        -- Array of tags
notes             TEXT          -- Internal notes
assigned_to       TEXT          -- Team member name (Phase 2)
last_contacted_at TIMESTAMP
updated_at        TIMESTAMP
```

---

## Lead Tagging System

Tags are applied automatically at capture and updated as leads progress.

### Auto-Applied Tags (at capture)

| Condition | Tag |
|---|---|
| Cook County address (Chicago + suburbs) | `market:cook_county` |
| Outside Chicagoland | `market:national` |
| Deal signal = green | `signal:strong` |
| Deal signal = yellow | `signal:marginal` |
| Deal signal = red | `signal:weak` |
| ARV > $200,000 | `arv:high` |
| Flip profit > $30,000 | `flip:strong` |
| Cash flow > $300/mo | `rental:strong` |
| Source = analyzer | `source:analyzer` |
| Source = asset group form | `source:asset_group` |

### Manually Applied Tags (by team)

| Tag | Meaning |
|---|---|
| `qualified` | Lead is serious and meets criteria |
| `hot` | Actively looking to move forward |
| `nurture` | Not ready now, keep warm |
| `do_not_contact` | Opted out or bad lead |
| `chicago_prospect` | Chicago lead ready for Asset Group pitch |
| `client` | Converted to a paying client |

---

## Pipeline Stages

All leads move through a defined pipeline. This applies to ALL leads but the conversion goal differs by market.

```
[NEW] → [CONTACTED] → [QUALIFIED] → [PROPOSAL SENT] → [CONVERTED] → [CLIENT]
                                                                  ↘ [LOST]
```

### Stage Definitions

| Stage | Description | Who Moves Them |
|---|---|---|
| `new` | Lead just captured. No contact yet. | Automated |
| `contacted` | First email/message sent. | Automated (email) |
| `qualified` | Two-way communication. Investor is serious. | Manual (team) |
| `proposal_sent` | Asset Group scope sent to Chicago lead. | Manual (team) |
| `converted` | Client signed or deal agreed. | Manual (team) |
| `client` | Active client — project underway. | Manual (team) |
| `lost` | No longer interested or disqualified. | Manual (team) |
| `nurture` | Long-term follow-up only. | Automated (drip) |

---

## Lead Routing Logic

The most critical fork: **Chicago vs. Non-Chicago**

```
Lead Created
     │
     ├─── is_service_area = TRUE
     │    (county == "Cook County, IL")
     │         │
     │         ▼
     │    Tag: market:cook_county
     │    Status: new
     │    Action: Send "Cook County Deal" email sequence
     │    Priority: HIGH (manual follow-up within 24 hrs)
     │
     └─── is_service_area = FALSE
               │
               ▼
          Tag: market:national
          Status: new
          Action: Send "Thank You + Tips" email sequence
          Priority: STANDARD (nurture drip, no manual follow-up in MVP)
```

### Chicago Lead Priority Criteria

A Chicagoland lead should be flagged as **high priority** if ANY of the following are true:

| Condition | Flag |
|---|---|
| `deal_signal = 'green'` AND `is_service_area = TRUE` | 🔴 HIGH PRIORITY |
| `flip_profit > $25,000` AND `is_service_area = TRUE` | 🔴 HIGH PRIORITY |
| Source = `asset_group` (directly contacted us) | 🔴 HIGH PRIORITY |
| `cash_flow > $200` AND `is_service_area = TRUE` | 🟡 MEDIUM PRIORITY |

**Rule:** High priority Chicago leads should receive a personal email or call within **24 hours**.

---

## Lead Flow: Step by Step

### Flow A: Analyzer Lead (Non-Chicago)

```
Step 1: User submits email on analyzer results page

Step 2: POST /api/leads fires
        → Lead inserted into DB with:
          status: 'new'
          source: 'analyzer'
          is_service_area: false
          tags: ['source:analyzer', 'market:national', ...deal signal tags]

Step 3: Resend API triggers "Welcome" email
        → Subject: "Your ClearPath deal analysis is ready"
        → Contains: Link back to their results, tips on reading the numbers
        → CTA: "Run another analysis" or "Join our investor list"

Step 4: Lead sits in 'new' stage
        → Drip sequence begins (Phase 2 automation)
        → No immediate manual follow-up required in MVP
```

---

### Flow B: Analyzer Lead (Chicago)

```
Step 1: User submits email on analyzer results page
        → Cook County address detected (is_service_area = TRUE)
        → Detection: Google Maps API returns county = "Cook County, IL"

Step 2: POST /api/leads fires
        → Lead inserted with:
          status: 'new'
          source: 'analyzer'
          is_service_area: true
          tags: ['source:analyzer', 'market:cook_county', ...deal signal tags]

Step 3: Resend API triggers "Cook County Deal" email
        → Subject: "Your deal analysis + a note from our team"
        → Contains: Full results summary, Asset Group intro paragraph
        → CTA: "Learn how we execute Chicago deals" → /asset-group

Step 4: Internal notification sent to team
        → Email/Slack alert: "New Cook County lead: [address], Signal: [green/yellow/red]"
        → Link to lead record in admin view

Step 5: Team reviews within 24 hours
        → If strong deal: Move to 'contacted', send personal follow-up
        → If weak deal: Leave in nurture, no manual outreach
```

---

### Flow C: Asset Group Direct Inquiry

```
Step 1: User fills out contact form on /asset-group
        → Inputs: Name, Email, Phone (required), Property Address, Message

Step 2: POST /api/leads fires
        → Lead inserted with:
          source: 'asset_group'
          status: 'new'
          tags: ['source:asset_group', 'market:cook_county']

Step 3: Auto-reply email sent
        → Subject: "We got your message — here's what's next"
        → Contains: What to expect, typical timeline, what deals we take

Step 4: HIGH PRIORITY internal alert fires immediately
        → "New direct inquiry from [name]: [message]"

Step 5: Team responds within 24 hours
        → Discovery call booked
        → Move status to 'contacted'
```

---

## CRM Admin View (MVP)

In MVP, the admin view is a filtered Supabase Table View or a simple internal page.

**Default Filter:** `status != 'lost' AND status != 'nurture'`

**Columns Visible:**
- Email
- Address
- is_service_area (checkbox — Chicagoland metro)
- deal_signal (🟢🟡🔴)
- flip_profit
- cash_flow
- source
- status
- created_at
- last_contacted_at

**Sort:** `is_service_area DESC, deal_signal ASC, created_at DESC`
(Chicagoland leads with strong signals always appear at the top)

**Actions (manual):**
- Update status
- Add tags
- Add notes
- Mark as contacted

---

## Lead Qualification Criteria

A lead becomes "Qualified" when they meet:

| Criterion | Minimum Threshold |
|---|---|
| Engaged in 2-way communication | Yes |
| Has capital to fund a deal | $50,000+ (Chicago) |
| Deal signal is green or yellow | Yes |
| Property in Chicagoland metro (6 counties) | Yes (for Asset Group) |

Leads that don't meet criteria → Move to `nurture` or `lost`.

---

## Key Metrics to Track

| Metric | Formula | Target |
|---|---|---|
| Lead Capture Rate | Emails captured / Total analyses run | > 25% |
| Chicago Lead Rate | Chicago leads / Total leads | Track only |
| Chicago Conversion Rate | Clients / Chicago leads | > 5% |
| Time to First Contact | Avg hours from capture to team outreach | < 24 hrs |
| Pipeline Velocity | Avg days from `new` to `qualified` | < 7 days |

---

## Tools Required

| Tool | Purpose | MVP? |
|---|---|---|
| Supabase | Lead database + pipeline tracking | ✅ Yes |
| Resend | Transactional emails | ✅ Yes |
| Supabase Table View | Manual CRM admin in MVP | ✅ Yes |
| Internal email/Slack alert | New Chicago lead notifications | ✅ Yes |
| Calendly | Discovery call booking (Asset Group) | ✅ Yes |
| HubSpot / GoHighLevel | Full CRM (if volume grows) | ❌ Phase 2 |
| Automated drip sequences | Email nurture for non-Chicago | ❌ Phase 2 |

---

## Flow Summary Diagram

```
                    ┌──────────────┐
                    │  Analyzer    │
                    │  Email Gate  │
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │   POST /api/leads       │
              │   Save to Supabase      │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  Chicagoland?           │
              └────────────┬────────────┘
                           │
           ┌───────────────┴───────────────┐
           │ YES                           │ NO
           ▼                               ▼
  ┌────────────────────┐        ┌─────────────────────┐
  │ Chicagoland Email  │        │ Welcome Email Sent  │
  │ Internal Alert     │        │ Nurture Drip (P2)   │
  │ Manual Review 24hr │        │ No manual action    │
  └────────┬───────────┘        └─────────────────────┘
           │
    ┌──────▼──────┐
    │ Strong deal?│
    └──────┬──────┘
           │
     ┌─────┴──────┐
     │ YES        │ NO
     ▼            ▼
  Personal    Move to
  Follow-Up   Nurture
     │
     ▼
  Discovery
  Call Booked
     │
     ▼
  Proposal
  Sent
     │
     ▼
  Converted
  → CLIENT
```

---

*Next Document → `05_automation.md` — Email + SMS Automation*
