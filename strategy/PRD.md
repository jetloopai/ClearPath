# ClearPath PRD Prompt

You are a senior product architect and full-stack system designer.

I am building a dual-system real estate platform called ClearPath:

1) ClearPath Analyzer (deal analysis product)  
2) ClearPath Asset Group (Chicago-based execution service)

Your job is to interpret this PRD and generate all necessary system, technical, and implementation documentation for building an MVP and scaling it.

---

## PRODUCT OVERVIEW

ClearPath is a two-layer ecosystem:

- The Analyzer is a global tool used to attract and qualify real estate investors  
- The Asset Group is a Chicago-only service that executes deals for qualified investors  

Core strategy:
Tool builds trust → Service captures revenue

---

## CLEARPATH ANALYZER (PRODUCT)

### Goal
Allow users to analyze real estate deals instantly with clear, simple outputs.

### Core Features
- Property Input (address or Zillow link)
- ARV
- Rehab estimate
- Rent estimate
- Cash flow
- Flip profit

### UX Principles
- Fast
- Clean
- Mobile-first
- Trust-focused

---

## CLEARPATH ASSET GROUP (SERVICE)

### Goal
Convert qualified investors into execution clients in Chicago.

### Core Offer
- Rehab management
- Lease-up
- Stabilization

---

## SYSTEM FLOW

Content → Analyzer → Email capture → Service pitch  
Analyzer → Chicago deal → Service CTA → Conversion  

---

## TECH REQUIREMENTS

Frontend:
- Clean UI
- Mobile optimized

Backend:
- Calculation engine
- Lead storage

---

## BUILD PHASES

Phase 1:
- Analyzer MVP
- Service site
- Email capture

Phase 2:
- Improve accuracy
- Add automation

Phase 3:
- Accounts
- Dashboard
