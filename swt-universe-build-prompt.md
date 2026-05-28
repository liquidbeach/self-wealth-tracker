# SWT Feature Build: AI Infrastructure Universe
## Prompt for Fund Manager Tool Window

---

## CONTEXT FOR CLAUDE IN THE OTHER WINDOW

Paste the following as your prompt:

---

### START OF PROMPT ###

I need to add a new feature to the Self Wealth Tracker (SWT) app: **AI Infrastructure Universe**.

## What It Is

A curated list of 37 quality-filtered AI and chip infrastructure stocks across NYSE and NASDAQ, organized by 6 sectors. Stocks earn their place or get removed based on inclusion/exclusion criteria (like the S&P 500). The universe is stored in Supabase and displayed as a new page in the sidebar.

## What Already Exists

- SWT is a Next.js 14 App Router app with Supabase backend, deployed on Vercel
- Supabase project ID: cvwtxvdprqfaehigmbcy
- Existing 21 tables including: stocks, holdings, lots, moat_scores, verdicts, screener_results, watchlist
- Existing features: Portfolio Tracker, Dashboard, Stock Assessor (Buffett 8-criteria scanner with moat scoring), Momentum Scanner, Trading Journal, Risk Dashboard, Screener, Live Prices
- Yahoo Finance API for live prices
- Tailwind CSS for styling, lucide-react for icons

## Database Migration

I have a complete SQL migration file that adds 3 new tables and seeds 37 stocks. I'll run this in Supabase SQL Editor separately. The tables are:

- `universe_sectors` — 6 sector reference rows
- `universe_stocks` — 37 curated stocks with ticker, name, sector, tier (heavyweight/velocity), exchange, market_cap, thesis, catalysts, risks, status (active/watch/review/removed), status_color (green/amber/red)
- `universe_alerts` — event log for price movements, earnings, analyst changes

## What I Need You to Build

### 1. New Sidebar Navigation Item
Add "AI Universe" to the sidebar nav, positioned after the existing Watchlist or Screener link. Use a globe or radar icon from lucide-react.

### 2. New Page: `/app/universe/page.tsx`
The main universe page with:

**Header section:**
- Title: "AI Infrastructure Universe"
- Subtitle: "37 quality-filtered stocks • Quarterly refresh • Next: June 2026"
- Total stock count badge
- Unread alerts count badge (amber/red dot if any)

**Sector filter tabs:**
- All Sectors, Silicon & Compute, Networking & Interconnect, Semiconductor Equipment, Memory & Storage, Power & Cooling, Cloud & Data Centre Infra
- Each tab shows count of stocks in that sector
- Active tab is highlighted

**Tier filter:**
- Dropdown or toggle: All | Heavyweights Only | Emerging Velocity Only

**Search:**
- Text input to search by ticker, name, or thesis keyword

**Stock cards (main content):**
- Each stock displays as a card with:
  - Ticker (monospace, prominent) + Tier badge (blue for Heavyweight, purple for Velocity)
  - Company name
  - Exchange badge (NYSE/NASDAQ)
  - Market cap (right-aligned)
  - One-line thesis
  - Status indicator: green dot (stable), amber dot (needs attention), red dot (review urgently)
- Click to expand: shows Catalysts (green section) and Key Risks (red section)
- Action button: "Run Buffett Scanner" — links to the existing Stock Assessor page with the ticker pre-filled (route to `/app/assessor?ticker=NVDA` or however the assessor accepts a ticker)

**Footer:**
- "Next refresh: June 2026 • Not financial advice"

### 3. Universe Alerts Panel
Either as a collapsible panel at the top of the page or as a separate sub-tab:
- Shows unread alerts sorted by severity (red first, then amber)
- Each alert shows: ticker, alert type icon, message, timestamp
- Click to dismiss (marks as read)
- "Mark all as read" button

### 4. Admin Actions (for manual quarterly refresh)
A small settings/admin section (could be a modal triggered by a gear icon):
- "Add Stock" — form to add a new stock to the universe with all fields
- "Edit Stock" — edit existing stock (status, status_color, thesis, catalysts, risks, market_cap)
- "Remove Stock" — sets status to 'removed', records removal_reason and removed_date
- "Create Alert" — manually create an alert for a stock (for when I spot something in the news)

### 5. API Routes
- `GET /api/universe/stocks` — returns all active universe stocks, joined with sector data
- `GET /api/universe/stocks?sector=silicon&tier=heavyweight` — filtered
- `GET /api/universe/alerts` — returns unread alerts
- `POST /api/universe/alerts` — create a new alert
- `PATCH /api/universe/stocks/[id]` — update stock status/details
- `POST /api/universe/stocks` — add new stock
- `PATCH /api/universe/alerts/[id]` — mark alert as read

### 6. Integration with Existing Stock Assessor
The "Run Buffett Scanner" button on each stock card should route to the existing Stock Assessor page with the ticker pre-loaded. If the assessor currently requires manual ticker entry, the universe page should pass the ticker as a URL parameter or query string.

## Design Requirements
- Match the existing SWT dark theme and UI patterns
- Use the same card/table styling patterns as the Portfolio Tracker and Watchlist pages
- Sector tabs should look similar to any existing tab navigation in the app
- Status indicators should use the same color conventions as the Risk Dashboard
- Responsive — should work on the same viewport sizes as the rest of the app

## Inclusion/Exclusion Criteria (for reference, not to code)
These are the rules I'll apply during quarterly reviews — they don't need to be automated, just documented in a comment:
- **Inclusion:** NYSE/NASDAQ listed, market cap >$5B, profitable (2+ consecutive quarters), direct/indirect AI infra exposure, 50%+ institutional ownership, 3+ analyst coverage
- **Exclusion triggers:** Market cap drops below $3B, two consecutive revenue decline quarters without catalyst, fundamental thesis broken, delisting/governance red flags

## File Structure Expected
```
app/
  universe/
    page.tsx              — Main universe page
    components/
      UniverseHeader.tsx  — Title, stats, search
      SectorTabs.tsx      — Sector filter tabs
      StockCard.tsx       — Individual stock card (expandable)
      AlertsPanel.tsx     — Alerts section
      AdminModal.tsx      — Add/Edit/Remove stock modal
api/
  universe/
    stocks/
      route.ts            — GET/POST for stocks
      [id]/
        route.ts          — PATCH for individual stock
    alerts/
      route.ts            — GET/POST for alerts
      [id]/
        route.ts          — PATCH for individual alert
```

Please build this step by step. Start with the Supabase connection and API routes, then the page components, then wire everything together. I'll run the database migration SQL separately.

### END OF PROMPT ###

---

## STEPS TO EXECUTE

### Step 1: Run the Database Migration
Before starting the build in the Fund Manager window:
1. Open Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Paste the contents of `swt-universe-migration.sql`
4. Click "Run"
5. Verify: Go to Table Editor, check that `universe_sectors` (6 rows), `universe_stocks` (37 rows), and `universe_alerts` (0 rows) exist

### Step 2: Paste the Prompt Above
Go to the Fund Manager tool chat window and paste everything between "START OF PROMPT" and "END OF PROMPT" above.

### Step 3: Follow the Build
Claude in that window will build the feature step by step, creating the API routes, components, and page. It will ask you to create files in your project directory.

### Step 4: Deploy
Once all files are created, deploy to Vercel as usual (`git push` if connected, or manual deploy).

### Step 5: Verify
- New "AI Universe" link in sidebar
- 37 stocks visible across 6 sectors
- Sector tabs filter correctly
- Search works
- Cards expand to show catalysts/risks
- "Run Buffett Scanner" routes to Stock Assessor
- Admin modal can add/edit/remove stocks

---

## QUARTERLY REFRESH PROCESS

Every quarter (March, June, September, December), come back to our investment strategy conversation and say:

"Run the quarterly universe refresh."

I'll:
1. Research any new AI infrastructure companies that have emerged
2. Check exclusion triggers against existing 37 stocks
3. Run the rotation analysis — which sectors are hot, where smart money is flowing
4. Provide updated SQL INSERT/UPDATE/DELETE statements to run in Supabase
5. Suggest which stocks from the universe deserve a Buffett scanner run

You'll:
1. Run the SQL updates in Supabase
2. Run the suggested Buffett scanner assessments in SWT
3. Make buy/hold/pass decisions based on the scanner results
4. Update your portfolio accordingly

---

## INCLUSION/EXCLUSION CRITERIA REFERENCE

### To Enter the Universe
- Listed on NYSE or NASDAQ
- Market cap above $5B
- Profitable (at least 2 consecutive profitable quarters) OR clear path with contracted revenue
- Direct or meaningful indirect exposure to AI infrastructure value chain
- Institutional ownership above 50%
- Analyst coverage from at least 3 major firms

### To Be Removed
- Market cap drops below $3B (with buffer to avoid churn)
- Two consecutive quarters of revenue decline without clear catalyst
- Fundamental thesis broken (lost major customer, technology obsolete)
- Delisting or major governance red flags
- Sector relevance diminished (company pivots away from AI infra)

### Status Indicators
- **Green (active):** Business as usual. Thesis intact. No action needed.
- **Amber (watch):** Something changed — earnings miss, price drop, analyst downgrade. Worth reviewing.
- **Red (review):** Significant event — thesis may be broken, governance concern, exclusion trigger approaching. Requires immediate assessment.
