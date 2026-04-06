# Integration Prompts for Claude Code

These prompts build on top of the existing backend (Supabase, API routes, sessionStorage flow). Execute them in order. Wait for each one to finish before pasting the next.

---

## Prompt 4: Zillow / RapidAPI Property Data Integration

```text
The file `apps/analyzer/src/lib/propertyData.ts` currently returns hardcoded stub data. Your task is to replace it with a real Zillow API call via RapidAPI.

**Environment variable:** `RAPIDAPI_ZILLOW_KEY` is already in `.env.local`.

**API endpoint to use:** `https://zillow-com1.p.rapidapi.com/propertyExtendedSearch`
- Method: GET
- Required headers: `x-rapidapi-key` and `x-rapidapi-host: zillow-com1.p.rapidapi.com`
- Query param: `location` (the address string)

**Your changes:**

1. Update `fetchPropertyData(address: string)` in `apps/analyzer/src/lib/propertyData.ts`:
   - Make a real `fetch` call to the RapidAPI endpoint above using `process.env.RAPIDAPI_ZILLOW_KEY`.
   - Parse the response to extract: `sqft` (livingArea), `bedrooms`, `bathrooms`, `yearBuilt`, `propertyType`, `city`, `county`, `state`, `zipcode`, and `zestimate`.
   - If the API returns no results or errors out, fall back gracefully to the existing stub defaults (sqft: 1400, beds: 3, baths: 2, yearBuilt: 1965) so the calculator never breaks. Log the error with `console.error`.
   - Keep the `PropertyData` interface the same so nothing downstream breaks.

2. Update the analyze API route at `apps/analyzer/src/app/api/analyze/route.ts`:
   - The route already calls `fetchPropertyData()`. Make sure the returned `property.sqft` is actually used for rehab calculations (it already is, but verify).
   - Use `property.yearBuilt` to apply the age adjustment from `outputs/01_calc_logic_output.md`:
     - If `yearBuilt < 1970`: multiply `rehabEstimate` by 1.15
     - If `yearBuilt < 1990`: multiply `rehabEstimate` by 1.07
   - Use `property.zestimate` as a fallback ARV method. Currently ARV is calculated as `price * arvMultiplier`. Update it:
     - If the Zillow API returned a valid zestimate, calculate ARV as: `zestimate * zestimateAdjustment[condition]` (the adjustments are: cosmetic 1.05, light 1.10, medium 1.18, heavy 1.25, gut 1.35 — from `01_calc_logic_output.md`).
     - If no zestimate is available, keep the current `price * arvMultiplier` fallback.
   - Save the raw property data into the `property_id` field or into the `inputs` JSONB field on the `analyses` table insert so we have a record of what data was pulled.

3. Do NOT install any new packages. Use the native `fetch` API. Test by running the dev server and analyzing a real Chicago address. Report the results.
```

---

## Prompt 5: Google Maps Places Autocomplete

```text
The analyzer landing page currently has a plain text input for the address. Your task is to add Google Maps Places Autocomplete so users get real, validated addresses as they type.

**Environment variable:** `GOOGLE_MAPS_API_KEY` is already in `.env.local`. You will need to expose it to the client as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` since the autocomplete runs in the browser.

**Your changes:**

1. Create a reusable component `apps/analyzer/src/components/AddressAutocomplete.tsx`:
   - Load the Google Maps JavaScript API using a `<script>` tag or dynamic import (do NOT install `@googlemaps/js-api-loader` — just use the script tag approach to keep it lightweight).
   - Render an `<input>` that matches the current hero input styling exactly (copy the className from the existing input in `page.tsx`).
   - Initialize `google.maps.places.Autocomplete` on mount, restricted to US addresses (`componentRestrictions: { country: 'us' }`).
   - When a place is selected, extract:
     - The full formatted address
     - The `county` from the `address_components` (type `administrative_area_level_2`)
   - Call an `onSelect(address: string, county: string)` callback prop with the results.
   - Add proper TypeScript type declarations for `google.maps`.

2. Update `apps/analyzer/src/app/page.tsx`:
   - Replace the existing `<input>` in the hero form with the new `<AddressAutocomplete>` component.
   - When the user selects an address, store both the formatted address AND the county in state.
   - Pass the county through to the ConfigModal so it can be included in the `/api/analyze` POST body.

3. Update `apps/analyzer/src/components/ConfigModal.tsx`:
   - Accept an optional `county` prop.
   - Include `county` in the POST body sent to `/api/analyze`.

4. Update the analyze API route `apps/analyzer/src/app/api/analyze/route.ts`:
   - Accept `county` from the request body.
   - If `county` is provided, use it directly for Cook County detection (`county === "Cook County"` or similar) instead of relying on the string-matching in `propertyData.ts`. This is more reliable.

5. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to the `.env.local` file (rename the key accordingly or add a new line).

Make sure the autocomplete dropdown visually matches the dark theme (you may need to add some CSS overrides for the `.pac-container` Google Maps dropdown). Test in the browser — type a partial address and verify the dropdown appears.
```

---

## Prompt 6: Resend Email on Lead Capture

```text
When a user submits their email on the results page, we currently save the lead to Supabase but send no email. Your task is to integrate Resend to send a confirmation email immediately after lead capture.

**Environment variable:** `RESEND_API_KEY` is already in `.env.local`.

Read `outputs/04_crm_output.md` and `outputs/05_automation_output.md` for the exact email flow. For MVP we are implementing the immediate Step 1 emails only (no drip sequences yet).

**Your changes:**

1. Install the Resend SDK: `npm install resend` in `apps/analyzer`.

2. Create `apps/analyzer/src/lib/email.ts`:
   - Initialize the Resend client using `process.env.RESEND_API_KEY`.
   - Export two functions:

   **`sendAnalysisEmail(to: string, data: {...})`**  
   For ALL leads. Sends a clean, branded HTML email with:
   - Subject: "Your ClearPath Deal Analysis"
   - Body: A summary of their analysis (address, ARV, rehab range, deal signal). Keep it simple and branded — dark background, white text, indigo accents matching our UI.
   - CTA button: "Run Another Analysis" linking to the analyzer homepage.

   **`sendCookCountyEmail(to: string, data: {...})`**  
   For Cook County leads ONLY. Sends everything in the above email PLUS:
   - An extra section: "We noticed your deal is in Cook County — that's where we operate."
   - A brief pitch for ClearPath Asset Group (1-2 sentences from the landing page copy).
   - CTA button: "Learn About Our Chicago Service" linking to the asset group site.

3. Update `apps/analyzer/src/app/api/leads/route.ts`:
   - After the successful Supabase upsert, call the appropriate email function:
     - If `is_service_area === true` → call `sendCookCountyEmail`
     - Otherwise → call `sendAnalysisEmail`
   - Fire the email asynchronously (don't block the API response). Use `.catch(console.error)` so email failures don't crash the lead capture.
   - The email functions need the deal data (ARV, rehab, flip profit, etc.) which is already in the request body — pass it through.

4. For the "from" address, use `onboarding@resend.dev` for now (Resend's free sandbox). We will switch to a custom domain later.

Test by running the full flow in the browser with a Chicago address, entering an email, and checking the Resend dashboard (or your inbox if using a real email) for delivery.
```

---

## Prompt 7: Auto-Tagging & Lead Enrichment

```text
The leads API currently saves basic information but doesn't apply the tag system described in `outputs/04_crm_output.md`. Your task is to add automatic tagging when a lead is captured.

**Your changes:**

1. Update `apps/analyzer/src/app/api/leads/route.ts`:
   - After assembling the lead data but before the Supabase insert, build a `tags` array (TEXT[]) based on these rules from the CRM doc:

   | Condition | Tag |
   |---|---|
   | `is_service_area === true` | `market:cook_county` |
   | `is_service_area === false` | `market:national` |
   | `deal_signal === 'green'` | `signal:strong` |
   | `deal_signal === 'yellow'` | `signal:marginal` |
   | `deal_signal === 'red'` | `signal:weak` |
   | `deal_arv > 200000` | `arv:high` |
   | `deal_flip_profit > 30000` | `flip:strong` |
   | `deal_cash_flow > 300` | `rental:strong` |
   | always | `source:analyzer` |

   - Include the `tags` array in the Supabase upsert payload.
   - Also compute and include `qualification_score` as a simple integer 0-25:
     - is_service_area = true (+5)
     - deal_signal = 'green' (+7), 'yellow' (+3), 'red' (+0)
     - deal_flip_profit > 30000 (+5)
     - deal_cash_flow > 300 (+5)
     - source = 'asset_group' (+3), 'analyzer' (+0)
   - Include `qualification_score` in the Supabase upsert.

2. No frontend changes needed. Test by running a deal analysis and checking the Supabase `leads` table to confirm tags and qualification_score are populated correctly.
```

---

## Prompt 8: Analytics Events & Error Boundaries

```text
Before deployment, we need basic analytics tracking and proper error handling across the analyzer app.

**Your changes:**

1. Create `apps/analyzer/src/lib/analytics.ts`:
   - Export a `trackEvent(name: string, properties?: Record<string, any>)` function.
   - For MVP, just log to console in development and POST to `/api/events` (which we'll wire to Supabase later or swap for Plausible).
   - Track these events:
     - `analysis_started` — when ConfigModal form submits
     - `analysis_completed` — when results page loads
     - `email_submitted` — when email gate is unlocked
     - `cook_county_cta_clicked` — when the Cook County badge or upsell banner is clicked
     - `share_deal_clicked` — when Share Deal is clicked

2. Add a React Error Boundary component at `apps/analyzer/src/components/ErrorBoundary.tsx`:
   - Wrap the main layout children in it.
   - On error, display a clean, branded error screen with: "Something went wrong" message, a "Go Home" button, and the ClearPath logo.
   - Log the error details to console.

3. Add error handling to `apps/analyzer/src/components/ConfigModal.tsx`:
   - If the `/api/analyze` call fails, show a user-friendly toast or inline error (the `error` state already exists — make sure it's visually prominent).

4. Add error handling to `apps/analyzer/src/components/ResultsView.tsx`:
   - If sessionStorage is empty or corrupted, redirect gracefully to `/` (this already happens — verify it works).
   - If the `/api/leads` call fails, show a subtle error message but still unlock the results (don't punish the user for an API hiccup).

No new packages needed. Test the error boundary by temporarily throwing an error in a component.
```
