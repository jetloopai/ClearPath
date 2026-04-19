# ClearPath Wiring Plan — CRM, Lead Capture & Email Automation

## What Was Built

### Lead Capture
- **Asset Group contact form** — replaces the Calendly placeholder on clearpathassetgroup.com. Fields: Name, Email, Phone, Deal Address, Message. Inline success/error states, no page reload.
- **Asset Group `/api/leads` route** — validates, rate-limits (5/min per IP), upserts to Supabase `leads` table with `source: 'asset_group'`, `is_service_area: true`, `qualification_score: 8`, fires emails.
- **Analyzer `/api/leads` route** — already existed; now fires confirmation email + internal alert on Cook County leads.
- **Newsletter `/api/newsletter` route** — email subscribe endpoint, upserts with `source: 'content'`, `email_sequence: 'national_nurture'`, fires welcome email.
- **Newsletter signup component** — added to Analyzer footer.

### Email System (Resend)
All email logic lives in `apps/analyzer/src/lib/email.ts`:

| Template | Trigger | To |
|---|---|---|
| A — Deal confirmation | Analyzer lead capture | Lead's email |
| B — Inquiry confirmation | Asset Group form submit | Lead's email |
| C — Internal alert | Cook County lead OR direct inquiry | hello@clearpathassetgroup.com |
| D — Newsletter welcome | /api/newsletter subscribe | Lead's email |

Cook County variant of Template A adds an Asset Group CTA block.

### CRM Activity Logging
Every email send logs a row to `lead_activity` (`type: 'email_sent'`) for a full audit trail in Supabase.

---

## Architecture

```
Asset Group Form
  → POST /api/leads (asset-group)
    → leads table (source: 'asset_group')
    → Template B (confirmation to lead)
    → Template C (internal alert)
    → lead_activity row

Analyzer Email Gate
  → POST /api/leads (analyzer)
    → leads table (source: 'analyzer')
    → Template A (deal confirmation)
    → Template C if Cook County
    → lead_activity row

Analyzer Footer
  → POST /api/newsletter
    → leads table (source: 'content')
    → Template D (welcome email)
```

---

## Files Created / Modified

| File | Change |
|---|---|
| `apps/analyzer/src/lib/email.ts` | NEW — all 4 Resend email templates |
| `apps/analyzer/src/app/api/leads/route.ts` | MODIFIED — added email send + activity log |
| `apps/analyzer/src/app/api/newsletter/route.ts` | NEW — subscribe endpoint |
| `apps/analyzer/src/components/NewsletterSignup.tsx` | NEW — footer subscribe form |
| `apps/analyzer/src/components/Footer.tsx` | MODIFIED — added newsletter signup |
| `apps/asset-group/src/components/LandingView.tsx` | MODIFIED — added ContactForm, replaced Calendly |
| `apps/asset-group/src/app/api/leads/route.ts` | NEW — direct inquiry API |
| `apps/asset-group/src/lib/supabase-server.ts` | NEW — admin Supabase client |
| `apps/asset-group/src/lib/rateLimit.ts` | NEW — IP rate limiter |

---

## Env Vars Required

Both apps need `RESEND_API_KEY` in Vercel environment variables.

1. Create account at resend.com
2. Add a sending domain (clearpathanalyzer.com or clearpathassetgroup.com) in Resend dashboard → Domains
3. Copy API key → Vercel → Project Settings → Environment Variables → `RESEND_API_KEY`
4. Set on both the `analyzer` and `asset-group` Vercel projects

Until this key is set, emails silently no-op (the code checks `if (!process.env.RESEND_API_KEY) return`) — lead capture still works.

---

## Planned Next: Email Drip Sequences

The `email_sequence` field is now being set on every lead:
- `cook_county_flow` — 5-step sales sequence (see `outputs/05_automation_output.md`)
- `national_nurture` — 5-step educational drip
- `asset_group_inquiry` — 3-step follow-up

These sequences are **not yet automated** — they require a scheduled trigger (Supabase Edge Function cron or Vercel cron job) to read the queue and send follow-up emails at the right intervals. That's the next phase.
