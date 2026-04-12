# ClearPath — Master Improvement Checklist

---

## 🔴 Data Quality

### Critical
- [x] Never silently serve stub/fallback data — `isStubData` flag + amber warning banner in ResultsView
- [x] `cookCountyStub()` returned for any non-Cook address on API failure — flagged via `isStubData: true`
- [x] `sqft` defaulting to 1,400 on property detail failure — route now returns 422, ConfigModal prompts manual sqft entry
- [ ] Remove `price × multiplier` ARV fallback entirely — currently kept but warns; ideally blocked with "ARV unavailable" UI

### High
- [x] Property tax flat 1.5% nationally — replaced with 50-state lookup table
- [x] Insurance hardcoded $100/mo — replaced with `max($75, ARV × 0.5% ÷ 12)`
- [x] Rehab per-sqft rates — metro tier multipliers added (SF 1.75×, NYC 1.65×, Chicago 1.15×, Detroit 0.88×, etc.)

### Transparency
- [x] `dataWarnings[]` banner in ResultsView — stub data, rough ARV, formula rent all flagged
- [x] ARV source surfaced inline — "Comps-based" vs "Rough estimate" + explainer text
- [x] Rent source surfaced inline — "Nearby listings" vs "Formula estimate" + explainer text
- [x] Subject Facts card — sqft source, summary of what data was used
- [x] Show ARV confidence range visual bar (low/high endpoints + dot marker at current ARV)
- [x] One-line comps explainer: "5 sales within 0.4 mi, 3bd, sold Oct 2025–Feb 2026"

---

## 🟡 Dashboard

### Bugs
- [x] Remove Cook County / National filter pills
- [x] Fix `+ New Analysis` → `/analyze`
- [x] Add Share and PDF buttons to individual deal cards — Share copies `/r/[id]` link, View Report opens public share page

### UX Improvements
- [x] Deal notes — free-text textarea per card, auto-saves to Supabase `notes` column with 800ms debounce; "Note ✓" indicator when populated
- [x] "Re-analyze" button — pre-fills ConfigModal from saved deal (sessionStorage handoff)
- [x] Portfolio view — capital deployed, best ZIP, avg cash flow across all deals

---

## 🟢 Results Page UX

### Done
- [x] MAO hero card — large number, green/red vs. current price, Copy button
- [x] Price sensitivity — ±$10K–$30K quick-adjust, live flip recalc
- [x] Share link — `/r/[analysisId]` public page, `handleShare` copies permanent URL

### Remaining
- [x] Comp map — subject + comps plotted on map (coordinates in `compsUsed`)
- [x] Reverse MAO — "I need $X profit → what can I pay?"
- [x] "Run this condition" — click row in alternatives table to switch live view (override banner + reset)

---

## 🔵 Config Modal & Analyze Page

- [x] sqft manual entry fallback — 422 response triggers amber prompt in ConfigModal
- [x] Mobile layout — ConfigModal slides up as bottom sheet on mobile, condition grid reflows, submit button stays sticky; ResultsView card padding, font sizes, and action buttons all responsive
- [x] Purchase price validation — amber warning for <$20K or >$5M

---

## ⚪ Growth & Retention

- [x] PDF deal sheet — `/api/report` renders HTML; "View Report" opens `/r/[id]` with print-to-PDF tip
- [ ] Email summary after save — 4 key numbers + MAO + link back
- [ ] "Alert me" for a ZIP — notify when green deal analyzed in watched ZIP

---

## Priority Order

| # | Item | Impact | Effort | Status |
|---|------|--------|--------|--------|
| 1 | Data warnings + stub detection | Critical | Low | ✅ |
| 2 | State property tax + insurance | High | Low | ✅ |
| 3 | MAO hero + price sensitivity | High | Low | ✅ |
| 4 | Dashboard bug fixes | Medium | Low | ✅ |
| 5 | Share link `/r/[id]` | High | Medium | ✅ |
| 6 | ARV/rent source inline + sqft fallback | High | Low | ✅ |
| 7 | Mobile layout (ConfigModal + Results) | High | Medium | ✅ |
| 8 | Deal notes | Medium | Low | ✅ |
| 9 | Share + PDF buttons on dashboard cards | Medium | Low | ✅ |
| 10 | Comp map | Medium | Medium | ✅ |
| 11 | Reverse MAO calculator | Medium | Low | ✅ |
| 12 | ARV confidence range visual bar | Medium | Low | ✅ |
| 13 | Portfolio view | Medium | Medium | ✅ |
| 14 | PDF download end-to-end verify | Medium | Low | ✅ |
| 15 | Rehab rates by market tier | Medium | High | ✅ |
| 16 | Comps date range in explainer | Low | Low | ✅ |
| 17 | Purchase price validation | Low | Low | ✅ |
| 18 | Re-analyze from dashboard | Medium | Low | ✅ |
| 19 | Run this condition (alt table switcher) | Medium | Medium | ✅ |
