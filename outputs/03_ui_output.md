# ClearPath UI/UX Wireframes

**Document:** 03 of 10
**Phase:** MVP
**Status:** Complete
**Generated:** 2026-04-04

---

## Overview

The ClearPath ecosystem has two distinct frontends:
1. **ClearPath Analyzer:** A free, lead-generating tool. Focused on speed, clean UI, and trust.
2. **ClearPath Asset Group:** A service landing page for Chicago execution. Focused on conversion and project management.

**Design Principles:**
*   **Mobile-First:** 70%+ of analysis will happen on phones (investors driving for dollars).
*   **Minimalist & High Contrast:** Dark mode primary with vibrant accents (green for good deals, red for bad).
*   **Progressive Disclosure:** Don't overwhelm the user. Show simple inputs first, reveal deeper data later.
*   **The "Tease" (Email Gate):** Give them enough value (ARV, Rehab) to prove the tool works, but hold back the core answers (Cash Flow, Profit, MAO) until they enter their email.

---

## Global Navigation & Layout

**Navigation Bar**
*   **Logo (Left):** "ClearPath Analyzer" (or "ClearPath Asset Group" depending on active site)
*   **Links (Right - Desktop / Hamburger - Mobile):** "Tool", "Chicago Service", "Contact"
*   **Theme Toggle (Optional):** Dark/Light mode (Default to Dark for a premium feel)

**Footer**
*   Links: Terms, Privacy, Disclaimer ("Estimates are for educational purposes only")
*   Copyright info

---

## Screen 1: Analyzer Landing / Home (`/`)

**Goal:** Get the user to input an address immediately.

**Hero Section**
*   **Headline:** "Analyze Any Real Estate Deal in 60 Seconds."
*   **Subheadline:** "Instant ARV, rehab estimates, rent projections, and profit calculations. No spreadsheets required."
*   **Primary Input:** Large Google-autocomplete address search bar.
    *   *Input Field:* Placeholder "Enter property address..."
    *   *Action Button:* "Analyze Deal →" (High contrast primary color)

**Social Proof / "How It Works" Section (Below the fold)**
*   **3 Steps:**
    1. Enter Address
    2. Review Numbers
    3. Make Offers
*   **Metrics:** "Data powered by millions of local comps."

---

## Screen 2: Deal Input Form (`/analyze` or Modal)

**Goal:** Gather the required variables for the calculation engine.

*This appears immediately after they click "Analyze Deal" on the hero, pre-filled with their address.*

**Header:** "Configure Deal Details"
*   **Address:** `[Pre-filled from previous step]` (Editable)
*   **Purchase Price:** `[ $ Input ]` (Required)
*   **Property Condition:** Option Selector (Radio buttons or large toggle buttons)
    *   [  ] Cosmetic (Paint/carpet)
    *   [  ] Light (Cosmetic + kitchen/bath)
    *   [✓] Medium (Light + systems)
    *   [  ] Heavy (Structural)
    *   [  ] Gut (Full rebuild)

**Advanced Options (Collapsed by default "Show Advanced"):**
*   Down Payment % `[ 25% ]`
*   Hold Time (Months) `[ 6 ]`

**Action Button:** "Run Analysis" (Shows loading spinner when clicked)

---

## Screen 3: The Tease & Lead Gate (`/results` - State 1)

**Goal:** Prove value, capture email.

**Loading State (crucial for trust):**
*   Skeleton loaders showing "Pulling comps...", "Estimating rehab...", "Calculating cash flow..." for ~2-3 seconds.

**Top Section:** Property Details
*   1234 W Chicago Ave, Chicago, IL 60622
*   3 Bed • 2 Bath • 1,400 SqFt • Built 1965

**Results Section (Partial):**
*   **ARV:** $185,000 (Clear, large text)
*   **Est. Rehab (Medium):** $28,000 – $44,000

**The Gate (Overlay/Blur over the rest of the numbers):**
*   Blurred out boxes for Cash Flow, Flip Profit, and MAO.
*   **Overlay Box:** "Unlock the Full Deal Breakdown"
    *   "Enter your email to see exact monthly cash flow, net flip profit, and your Maximum Allowable Offer (MAO)."
    *   *Input Field:* "Email address..."
    *   *Action Button:* "Unlock Full Analysis"
    *   *Disclaimer text:* "We respect your inbox. No spam."

---

## Screen 4: Full Results & Service Upsell (`/results` - State 2)

**Goal:** Present data clearly and trigger the service upsell if applicable.

*(This state replaces the gate after email submission).*

**Top Section:** (Same as State 1)

**Grid Layout (2 columns desktop, 1 column mobile):**

*   **Card 1: Value & Rehab**
    *   ARV: $185,000
    *   Rehab Estimate: $28k – $44k
    *   Condition: Medium

*   **Card 2: Flip Economics**
    *   Net Profit: **$34,200** (Color-coded based on deal signal)
    *   ROI: 24%
    *   Maximum Allowable Offer (MAO): $154,500
    *   *Signal Icon:* 🟢 Strong Flip

*   **Card 3: Buy & Hold (Rental)**
    *   Monthly Rent Est: $1,665
    *   Net Cash Flow: **+$247/mo** (Color-coded)
    *   Cash-on-Cash Return: 6.2%
    *   *Signal Icon:* 🟡 Marginal Deal

**Action Buttons (Sticky at bottom on mobile):**
*   "Edit Inputs" (Goes back to Screen 2)
*   "Share Deal" (Copies link)

**The Upsell (Conditional - IF address is in Chicago/Cook County):**
*   A visually distinct banner (e.g., solid brand color background) sitting just below the results.
*   **Headline:** "Looks like a solid Chicago deal."
*   **Text:** "Need reliable boots on the ground? ClearPath Asset Group handles rehab, leasing, and stabilization in the Chicago market."
*   **Action Button:** "Learn About Our Service →" (Links to `/asset-group`)

---

## Screen 5: Asset Group Landing Page (`/asset-group`)

**Goal:** Sell the execution service to qualified leads.

**Design Tone:** Professional, experienced, authoritative.

**Hero Section**
*   **Headline:** "Chicago Real Estate Execution, Handled."
*   **Subheadline:** "We manage the rehab, lease-up, and exact stabilization of your Chicago investment properties. You fund the deal, we run the project."
*   **Action Button:** "Book a Strategy Call" (Scrolls to calendar or opens modal)

**Services Grid (3 columns):**
1.  **Rehab Management:** "From permits to punch list. We execute the scope."
2.  **Lease-Up:** "Aggressive marketing and strict tenant screening."
3.  **Stabilization:** "Handing you a performing, cash-flowing asset."

**Social Proof:**
*   Logos of lenders or partners (if any).
*   Testimonials or mini case studies ("Bought for $X, Rehabbed for $Y, Renting for $Z").

**The Pitch / CTA Section:**
*   "We only take on projects where the numbers make sense. Let's look at your deal."
*   Embedded Calendly widget for booking a call.

---

## User Flow Diagram

```text
[User Lands on Analyzer]
       │
       ▼
[Enters Address & Clicks 'Analyze']
       │
       ▼
[Modal: Enters Price & Condition]
       │
       ▼
[Results Page (Blurred / Gated)] ───(Show ARV & Rehab only)
       │
       ▼
[User Submits Email] ───────────────(Lead Saved to DB)
       │
       ▼
[Full Results Revealed]
       │
       ├──► IF Non-Chicago: "Edit Inputs" / "New Deal"
       │
       └──► IF Chicago: [Display Asset Group Banner CTA]
                  │
                  ▼
          [User Clicks Banner]
                  │
                  ▼
     [Asset Group Landing Page]
                  │
                  ▼
        [Books Strategy Call]
```

---

*Next Document → `04_crm_flow.md` — CRM + Lead Flow*
