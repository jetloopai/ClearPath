<div class="page">
  <div class="header">
    <div>
      <div class="eyebrow">App Summary</div>
      <h1>ClearPath Analyzer</h1>
      <p class="subhead">Repo-backed overview of the real estate deal analysis app in <code>apps/analyzer</code>.</p>
    </div>
    <div class="badge">Next.js + Supabase</div>
  </div>

  <div class="section">
    <h2>What it is</h2>
    <p>A Next.js web app that analyzes real estate investment deals from an address or Zillow-style property search flow. It estimates ARV, rehab cost, rent, cash flow, flip profit, and MAO, then stores analyses and lead data in Supabase.</p>
  </div>

  <div class="grid">
    <div class="section">
      <h2>Who it's for</h2>
      <p>Primary persona: residential real estate investors evaluating flip or buy-and-hold deals, with added emphasis on Cook County prospects that can route into ClearPath's service business.</p>
    </div>

    <div class="section">
      <h2>What it does</h2>
      <ul>
        <li>Searches by address with Google Places autocomplete on the landing page.</li>
        <li>Calculates ARV, rehab range, rent, cash flow, flip profit, ROI, and MAO.</li>
        <li>Uses nearby sold comps and nearby rent listings when Zillow data is available, with formula fallbacks.</li>
        <li>Gates the full results behind email capture and saves leads to Supabase.</li>
        <li>Shows saved analyses for signed-in users on a dashboard.</li>
        <li>Publishes an insights page that aggregates recent analyses.</li>
        <li>Exports a 1-page deal sheet or a fuller HTML/PDF report.</li>
      </ul>
    </div>
  </div>

  <div class="section">
    <h2>How it works</h2>
    <ul>
      <li><strong>Frontend:</strong> Next.js App Router pages in <code>src/app</code> render the landing page, results flow, dashboard, insights, share page, and widget page.</li>
      <li><strong>Input:</strong> The home page opens a config modal after address selection, then posts deal inputs to <code>/api/analyze</code>.</li>
      <li><strong>Data fetch:</strong> <code>src/lib/propertyData.ts</code> calls a RapidAPI Zillow scraper for subject details, sold comps, and rentals; if <code>RAPIDAPI_ZILLOW_KEY</code> is missing or calls fail, it falls back to Cook County-flavored stub data.</li>
      <li><strong>Calculation layer:</strong> <code>/api/analyze</code> combines fetched property data with configurable defaults from Supabase <code>system_defaults</code> to compute ARV, rehab, rental, flip, and signal outputs.</li>
      <li><strong>Persistence:</strong> The analyze route inserts analyses into Supabase; <code>/api/leads</code> upserts captured emails into <code>leads</code>; <code>/api/events</code> stores analytics events.</li>
      <li><strong>User loop:</strong> Results are cached in browser session storage for the results page, and authenticated users can attach saved analyses to their Supabase user ID for the dashboard.</li>
    </ul>
  </div>

  <div class="grid getting-started">
    <div class="section">
      <h2>How to run</h2>
      <ol>
        <li>From <code>apps/analyzer</code>, install dependencies: <code>npm install</code>.</li>
        <li>Create <code>.env.local</code> with <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and <code>SUPABASE_SERVICE_ROLE_KEY</code>.</li>
        <li>Optional for live property/comps/rent data: add <code>RAPIDAPI_ZILLOW_KEY</code>; otherwise the app uses stub property data.</li>
        <li>Run the app with <code>npm run dev</code> and open <code>http://localhost:3000</code>.</li>
      </ol>
    </div>

    <div class="section">
      <h2>Repo gaps</h2>
      <ul>
        <li><strong>Production deployment URL:</strong> Not found in repo.</li>
        <li><strong>Supabase local start command/config:</strong> Migration files exist, but a repo-level local bootstrap command was not found.</li>
        <li><strong>Asset Group app runtime details:</strong> Not included in this summary because this page focuses on the analyzer app.</li>
      </ul>
    </div>
  </div>
</div>
