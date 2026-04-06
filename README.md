# ClearPath

A dual-system real estate platform built to attract, qualify, and convert real estate investors.

---

## What Is ClearPath?

| System | Description |
|---|---|
| **ClearPath Analyzer** | A global deal analysis tool — users input an address or Zillow link and instantly get ARV, rehab estimate, rent estimate, cash flow, and flip profit |
| **ClearPath Asset Group** | A Cook County, IL execution service (Chicago + suburbs) — handles rehab, lease-up, and stabilization for qualified investors |

**Core Strategy:** Tool builds trust → Service captures revenue

---

## Project Structure

```
ClearPath/
├── README.md                   ← You are here
│
├── strategy/                   ← High-level vision and product docs
│   ├── PRD.md                  ← Product Requirements Document
│   ├── master_prompt.md        ← Master build prompt for AI generation
│   └── system_instructions.md  ← AI operating instructions
│
├── build/                      ← Execution playbook and workflow rules
│   └── build_system.md         ← Step-by-step build order (10 documents)
│
├── prompts/                    ← AI prompts, one per document to generate
│   ├── 01_calc_logic.md
│   ├── 02_architecture.md
│   ├── 03_ui_wireframes.md
│   ├── 04_crm_flow.md
│   ├── 05_automation.md
│   ├── 06_sop.md
│   ├── 07_sales.md
│   ├── 08_content.md
│   ├── 09_database.md
│   └── 10_legal.md
│
├── outputs/                    ← Raw AI-generated outputs (one per prompt)
│
└── docs/                       ← Final cleaned, production-ready documents
```

---

## Build Phases

### Phase 1 — MVP ✅
- [x] ~~Deal Calculation Logic~~
- [x] ~~System Architecture~~
- [x] ~~UI / UX Wireframes~~
- [x] ~~CRM + Lead Flow~~

### Phase 2 ✅
- [x] ~~Email + SMS Automation~~
- [x] ~~Service Operations SOP~~
- [x] ~~Sales Script + Qualification~~

### Phase 3 ✅
- [x] ~~Content Engine~~
- [x] ~~Database Schema~~
- [x] ~~Legal + Disclaimers~~

---

## Rules
- Complete ONE document at a time
- Save outputs immediately after generation
- Keep Analyzer and Asset Group logic separate
- Do not overbuild early â€” MVP first

