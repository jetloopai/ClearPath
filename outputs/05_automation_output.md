# ClearPath Email + SMS Automation

**Document:** 05 of 10
**Phase:** Phase 2
**Status:** Complete
**Generated:** 2026-04-04

---

## Overview

The ClearPath automation system is designed to convert attention (Analyzer tool) into trust and execution (Asset Group service). It operates on two tracks:
1.  **The Cook County Track:** High-touch, local, and sales-focused.
2.  **The National Track:** Educative, brand-focused, and long-term nurture.

**Automation Tooling:**
*   **Email:** Resend (Transactional) + MailerLite/ActiveCampaign (Nurture).
*   **SMS:** Twilio API (via Supabase Edge Functions).
*   **Triggers:** Supabase Database Webhooks.

---

## Automation Triggers

| Event | Condition | Action |
|---|---|---|
| **Lead Captured (National)** | `is_service_area == false` | Trigger "National Welcome" Sequence |
| **Lead Captured (Cook County)** | `is_service_area == true` | Trigger "Cook County Priority" Sequence + Internal Alert |
| **High Profit / Green Deal** | `deal_signal == 'green' AND is_service_area == true` | Trigger Immediate SMS Alert to Team + User |
| **Asset Group Inquiry** | `source == 'asset_group'` | Trigger "Asset Group Consultation" Sequence |

---

## Sequence 1: The Cook County Priority (Sales Focus)

**Goal:** Convert the analysis into a strategy call.
**Target:** Leads who analyzed a property in Cook County (Chicago, Tinley Park, Bolingbrook, etc.).

| Step | Timing | Channel | content / Subject |
|---|---|---|---|
| **Step 1** | Immediate | Email | **Subject:** Your Cook County Analysis + How we can help. <br> Summary of the deal + Intro to Asset Group service. |
| **Step 2** | +5 Mins | SMS | **To Lead:** "Hi [Name], I saw you just ran an analysis on [Address]. That's a solid area. Would you like a more detailed rehab estimate for it? - [Name], ClearPath" |
| **Step 3** | Day 1 | Email | **Subject:** How we handled a similar rehab in [Area/County]. <br> Case study of a Cook County project. Focus on stabilization. |
| **Step 4** | Day 3 | Email | **Subject:** Questions about your [Address] analysis? <br> Reach out directly for a 10-min strategy call. [Calendly Link] |
| **Step 5** | Day 7 | Email | **Subject:** Cook County Market Update. <br> Value-add content about local inventory and rehab costs. |

---

## Sequence 2: The National Nurture (Brand Focus)

**Goal:** Build authority and keep the tool top-of-mind.
**Target:** Leads outside the service area.

| Step | Timing | Channel | content / Subject |
|---|---|---|---|
| **Step 1** | Immediate | Email | **Subject:** Your Deal Analysis Breakdown. <br> Full results link + "How to read these numbers" guide. |
| **Step 2** | Day 2 | Email | **Subject:** The "70% Rule" and why it matters. <br> Educational content on calculating MAO like a pro. |
| **Step 3** | Day 5 | Email | **Subject:** 3 things that kill a deal (And how to spot them). <br> Red flag detection in listings. |
| **Step 4** | Day 10 | Email | **Subject:** Looking for boots on the ground? <br> How to find partners in your local market. |
| **Step 5** | Monthly | Email | **Subject:** ClearPath Monthly Digest. <br> Top analyzed zip codes + New analyzer features. |

---

## Sequence 3: Direct Service Inquiry (Asset Group)

**Goal:** Close the lead for a rehab/stabilization project.

| Step | Timing | Channel | content / Subject |
|---|---|---|---|
| **Step 1** | Immediate | Email | **Subject:** We received your inquiry - Next Steps. <br> Acknowledgment + Request for 1-2 photos or listing link. |
| **Step 2** | +15 Mins | SMS | **To Team:** "NEW DIRECT LEAD: [Name] for [Address]. Call them ASAP." |
| **Step 3** | Day 2 | Email | **Subject:** (If no response) Still interested in discussing [Address]? <br> Quick check-in from the project manager. |

---

## SMS Automation Logic (Team & User)

### 1. High-Priority Internal Alerts
When a "Green Signal" deal in Cook County is identified:
*   **Trigger:** `is_service_area == true AND deal_signal == 'green'`
*   **To Team:** "🔥 HOT DEAL ALERT: [Email] just analyzed [Address] - Net Profit: $[Profit]. Call them now."

### 2. User Follow-up (Cook County Only)
*   **Trigger:** 5 minutes after analysis completion.
*   **To User:** "Hey there, noticed you were looking at [Address] on ClearPath. I know that block well. Are you planning to flip or hold it? - [Name]"

---

## Technical Implementation (Pseudocode)

### Triggering Sequences (Supabase Webhook)
```javascript
// Supabase Edge Function: handle-new-lead
export const onRequest = async (req) => {
  const { record } = await req.json();
  
  if (record.is_service_area) {
    // Start Cook County Sequence
    await startResendSequence(record.email, 'cook_county_flow');
    
    if (record.deal_signal === 'green') {
      await sendInternalSms(`🔥 Hot Deal: ${record.address}`);
    }
  } else {
    // Start National Sequence
    await startResendSequence(record.email, 'national_nurture');
  }
}
```

---

## Cadence & Maintenance
*   **A/B Testing:** Regularly test subject lines for "Step 1" in both sequences.
*   **Unsubscribe Logic:** Ensure "Unsubscribe" in email automatically stops all automated SMS for that lead.
*   **Hand-off:** If a lead replies to an email or SMS, they must be manually tagged as `contacted` in the CRM, which **pauses** the automated sequence.

---

*Next Document → `06_sop.md` — Service Operations SOP*
