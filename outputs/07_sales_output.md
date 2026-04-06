# ClearPath Sales Script + Qualification

**Document:** 07 of 10
**Phase:** Phase 2
**Status:** Complete
**Generated:** 2026-04-04

---

## Overview

This document defines how ClearPath qualifies leads and closes them into Asset Group clients. The sales process is short, direct, and consultative — not high-pressure. The tool already did the heavy lifting by proving value. Now the conversation is about execution.

**Sales Philosophy:**
> "We don't sell rehab services. We show investors what a deal looks like on paper, then offer to make it real."

**Conversion Path:**
```
Analyzer proves value → Lead captured → Cook County detected
→ Automated follow-up → Discovery call booked → Qualification
→ Property assessment → SOW presented → Agreement signed → Client
```

---

## Lead Qualification Framework

### The DEAL Filter

Every lead is run through four criteria before spending time on a call:

| Letter | Criterion | What You're Asking |
|---|---|---|
| **D** | Deal | Is there an actual property? Under contract or identified? |
| **E** | Equity | Do they have capital or financing lined up? |
| **A** | Area | Is the property in Cook County? |
| **L** | Level | What's their experience level? (Affects how you communicate) |

**Minimum Qualification:**

| Requirement | Threshold |
|---|---|
| Property identified | Must have a specific address (not "I'm looking around") |
| Capital available | $50,000+ total project budget (purchase + rehab) |
| Location | Cook County, IL |
| Timeline | Ready to move within 60 days |

**If they don't qualify:**
- Still valuable — they stay in the CRM as `nurture`
- Send them educational content (National Nurture sequence)
- Revisit in 30–60 days

---

## Pre-Call Preparation

Before getting on any discovery call, review:

| Item | Where to Find It |
|---|---|
| Their analysis results | `analyses` table — look up by email |
| Deal signal | Green / Yellow / Red |
| Property address | From analysis or lead record |
| ARV, rehab estimate, cash flow | From their analysis output |
| Source | Did they come from analyzer or direct inquiry? |

**Why this matters:** You already know their deal better than they expect. Walking into the call with their numbers builds instant credibility.

---

## Discovery Call Script

### Opening (2 min)

```
"Hey [Name], thanks for hopping on. I saw you ran an analysis on 
[Address] through ClearPath — [ARV], looking at about [rehab range] 
in rehab costs. That's actually a neighborhood we know really well.

Before I get into what we do, I'd love to hear from you — 
what's your plan with this property?"
```

**Why it works:** You're leading with THEIR data. Shows you're prepared, not generic.

---

### Discovery Questions (10 min)

Ask in this order. Listen more than you talk.

**1. The Deal**
```
"Tell me about the property. Are you under contract, or still evaluating?"

"How did you find it — MLS, off-market, wholesaler, driving for dollars?"

"Have you been inside yet? What's the actual condition?"
```

**2. The Strategy**
```
"Are you thinking flip or buy-and-hold?"

"What's your target? For flips, are you looking for $30K+ profit? 
For rentals, what cash flow would make this worth it?"
```

**3. The Money**
```
"How are you financing this — cash, hard money, DSCR, conventional?"

"What's your total budget for acquisition plus rehab?"

"Have you worked with a lender yet, or do you need a recommendation?"
```

**4. The Experience**
```
"Have you done a rehab before, or would this be your first?"

"Are you local to the Chicago area, or investing from out of state?"

"Do you have a team on the ground — contractor, PM, agent — 
or are you looking for someone to handle the execution?"
```

**5. The Timeline**
```
"When are you looking to get started?"

"If you're under contract, when does the inspection period end?"
```

---

### The Transition (2 min)

After discovery, bridge into the Asset Group pitch:

**If they're qualified (property + capital + Cook County):**
```
"So here's where we could help. ClearPath Asset Group is the 
execution side of what we do. We handle the rehab management, 
lease-up, and stabilization — essentially taking you from 
'I have a contract' to 'I have a cash-flowing asset.'

We don't do open-ended projects. We scope the work, give you 
a fixed budget with a contingency buffer, and send you weekly 
photo updates. When the rehab is done, we market it, screen 
tenants, place them, and hand you a stabilized property.

Would it be helpful if we walked the property and put together 
a scope of work for you?"
```

**If they're NOT qualified (no property, no capital, wrong area):**
```
"It sounds like you're still in the research phase, which is smart. 
I'd say keep using the analyzer to run deals — it'll sharpen your 
eye for what makes a good number. When you've got a specific deal 
locked in, we'd love to look at it with you.

In the meantime, I'll make sure you're getting our market updates 
for Cook County — there's been some solid inventory moving through 
[area]. Sound good?"
```

---

### The Close (3 min)

You're not closing a sale on the call. You're closing the **next step**.

**For qualified leads:**
```
"Here's what I'd suggest as a next step: I'll have our project 
manager walk the property this week. We'll put together a scope 
of work with a budget and timeline, and send it over for your 
review. No commitment at that point — just data so you can 
make a decision.

What day works best for the walkthrough — would [Tuesday] 
or [Thursday] work?"
```

**For strong leads who are hesitant:**
```
"Totally understand wanting to think it over. The walkthrough 
and scope are free — we only get paid when we do the work. 
So there's no cost to getting the numbers in front of you. 

I'll send you a calendar link and you can pick a time 
that works. Fair?"
```

---

## Objection Handling

| Objection | Response |
|---|---|
| **"I already have a contractor"** | "That's great. A lot of our clients come to us after a bad contractor experience, but if yours is solid, you may not need us at all. Want us to review your scope and budget as a second set of eyes? No charge." |
| **"What do you charge?"** | "We build our fee into the project budget — typically 15–20% of the rehab cost. So if the job is $60K, our management fee is baked into that number. You see one total, not hidden extras." |
| **"I want to do it myself"** | "Respect that 100%. If you're local and have the time, self-managing can save you money. We're here if the project scope gets bigger than expected or if you need help with the lease-up side." |
| **"I'm not ready yet"** | "No rush. Keep running deals through the analyzer — when you've got one that hits, send it my way and we'll take a look. I'll keep you on our Cook County market updates in the meantime." |
| **"How do I know you're legit?"** | "Fair question. I can send you photos and numbers from our last three projects — before/after, budget vs. actuals, and what they're renting for now. That'll tell you more than anything I say on this call." |
| **"Can you do deals outside Cook County?"** | "Right now we're focused on Cook County because we know the contractors, the inspectors, and the neighborhoods. Expanding our area means expanding our team, so we want to do that right. If you've got a Cook County deal, we're your guys." |

---

## Post-Call Actions

### Lead is Qualified → Moving Forward

| Action | Timeline | Owner |
|---|---|---|
| Update CRM status to `qualified` | Same day | Sales |
| Send recap email (summary of call + next steps) | Within 2 hours | Sales |
| Schedule property walkthrough | Within 5 business days | PM |
| Send calendar invite to client | Same day | Sales |
| Pause automated email sequence | Immediately | System (auto on status change) |

**Recap Email Template:**
```
Subject: Next Steps — [Address]

Hey [Name],

Great talking with you today. Here's a quick recap:

Property: [Address]
Strategy: [Flip / Hold]
Budget Range: [From your analysis: $XX,XXX – $XX,XXX]

Next Step: Property walkthrough scheduled for [Date/Time].
Our PM [Name] will be there to assess the property and 
we'll have a scope of work with budget back to you within 
3 business days after that.

No commitment at this stage — just getting you real numbers.

Talk soon,
[Your Name]
ClearPath Asset Group
```

---

### Lead is Not Qualified → Nurture

| Action | Timeline | Owner |
|---|---|---|
| Update CRM status to `nurture` | Same day | Sales |
| Add tag: `not_ready` or `no_deal` or `out_of_area` | Same day | Sales |
| Resume automated nurture sequence | Immediately | System |
| Set 30-day follow-up reminder | Same day | Sales |

---

## Qualification Scorecard

Use this internally to rate each lead after the discovery call:

| Factor | Score (1–5) | Notes |
|---|---|---|
| Has a specific deal | __ / 5 | Under contract = 5, "just looking" = 1 |
| Capital / financing ready | __ / 5 | Cash or pre-approved = 5, "figuring it out" = 1 |
| Property in Cook County | __ / 5 | Yes = 5, No = 0 (disqualify) |
| Timeline ≤ 60 days | __ / 5 | Ready now = 5, 6+ months = 1 |
| Realistic expectations | __ / 5 | Understands costs = 5, expects miracles = 1 |
| **TOTAL** | __ / 25 | |

| Score | Action |
|---|---|
| 20–25 | 🟢 **Hot** — Schedule walkthrough immediately |
| 13–19 | 🟡 **Warm** — Follow up in 1 week, keep engaged |
| 0–12 | 🔴 **Cold** — Move to nurture, revisit in 30 days |

---

## Sales KPIs

| Metric | Target |
|---|---|
| Discovery calls / week | 5–10 |
| Qualification rate (calls → qualified) | ≥ 40% |
| Walkthrough conversion (qualified → SOW sent) | ≥ 70% |
| SOW → signed agreement | ≥ 50% |
| Average time: call → signed agreement | ≤ 14 days |
| Revenue per project (mgmt fee) | $8,000 – $20,000 |

---

*Next Document → `08_content.md` — Content Engine*
