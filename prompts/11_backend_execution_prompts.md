# Backend Execution Prompts for Claude Code

Below is a series of structured, copy-pasteable prompts you can feed into Claude Code one by one. I've designed these to act as autonomous "sprints." Wait for Claude to finish and verify one prompt before pasting the next.

---

## Prompt 1: Database Setup & Supabase Migration

```text
Please read the architecture constraints from `outputs/02_architecture_output.md` and the schema definitions from `outputs/09_database_output.md`. 

Your task is to set up our database layer for the Next.js `analyzer` app:
1. Install `@supabase/supabase-js` in `apps/analyzer`.
2. Create `apps/analyzer/src/lib/supabase.ts` setting up the secure server-side client (throw an error if the URL or SERVICE_KEY env vars are missing).
3. Generate a raw SQL migration file at `supabase/migrations/0000_initial_schema.sql` that contains the definitions for the following tables exactly as described in the `09_database_output.md` document:
   - `properties` 
   - `analyses`
   - `leads`
   - `system_defaults`
   Make sure to include the `INSERT INTO system_defaults` seed data block.
4. Ensure Row Level Security (RLS) policies are configured as described in the doc so the API has insert privileges.

Tell me when the migration is ready, and give me the exact command I need to run to apply it to my Supabase project.
```

---

## Prompt 2: API & Calculation Engine Migration

```text
Please read the calculation logic from `outputs/01_calc_logic_output.md`. 

Currently, `apps/analyzer/src/lib/calculations.ts` runs client-side with hardcoded mocks. Your task is to migrate this logic to the server:
1. Move the `performFastAnalysis` logic to a new server-side utility or keep it in lib but refactor it to pull baseline constants (like `down_payment_pct`, `rehab_cost_tiers`, etc.) dynamically from the Supabase `system_defaults` table instead of hardcoding them.
2. Create a new utility wrapper at `apps/analyzer/src/lib/propertyData.ts` representing the Zillow/RapidAPI integration. For now, stub a method `fetchPropertyData(address: string)` that returns a mock object matching the data we'd get (sqft: 1400, beds: 3, baths: 2, etc.) but structure it so we can easily swap in the real `fetch` call later.
3. Build the Next.js App Router API route at `apps/analyzer/src/app/api/analyze/route.ts` (POST). It must:
   - Receive the payload (address, price, condition).
   - Call `fetchPropertyData`.
   - Run the calculations.
   - Insert the resulting full analysis object into the `analyses` table in Supabase.
   - Return the calculation results and the generated `analysis_id` as JSON to the client.

Review the logic carefully to ensure the server response exactly matches the format expected by our UI.
```

---

## Prompt 3: Leads API & Client Refactoring

```text
The API calculation engine is built. Your final major task is to wire up the React client to use the real endpoints and implement the lead capture.

1. Build `apps/analyzer/src/app/api/leads/route.ts` (POST). It should receive an `email` and an `analysis_id`, and safely insert this data into the `leads` table in Supabase. Return a 200 success response.
2. Refactor `apps/analyzer/src/components/ConfigModal.tsx`: Replace the manual `router.push('/results?...')` logic. Instead, fire a `fetch('/api/analyze')` POST request on submit. Navigate the user to `/results` and ensure the API payload data safely persists across the route (either via Context, modifying the URL params, or simple sessionStorage).
3. Refactor `apps/analyzer/src/components/ResultsView.tsx`: 
   - Load the real result object from the API instead of recalculating anything locally. 
   - Remove the fake "staggered timeout" loading sequence. Rely on the actual network request time.
   - Update `handleUnlock` to execute a `fetch('/api/leads')` POST request with the user's email and the `analysis_id`. Ensure the UI only unlocks once a 2xx response is returned.

Check for any TypeScript errors, fix them, and tell me when it is safe to test the entire flow end-to-end in the browser.
```
