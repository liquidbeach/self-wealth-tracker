# AI Infrastructure Universe - SWT Feature

A curated universe of 37 quality-filtered AI/chip infrastructure stocks across 6 sectors.

## Files Included

```
app/universe/
  page.tsx                    — Main universe page
  components/
    UniverseHeader.tsx        — Title, stats, search bar, alerts badge
    SectorTabs.tsx            — 6 sector filter tabs + tier dropdown
    StockCard.tsx             — Expandable card with thesis, catalysts, risks
    AlertsPanel.tsx           — Slide-out alerts panel
    AdminModal.tsx            — Add/Edit stock, Create alert modal

api/universe/
  stocks/route.ts             — GET all stocks, POST new stock
  stocks/[id]/route.ts        — GET/PATCH/DELETE individual stock
  alerts/route.ts             — GET alerts, POST new alert
  alerts/[id]/route.ts        — PATCH (mark read), DELETE alert
  sectors/route.ts            — GET all sectors

supabase-universe-migration.sql — Database migration with 37 seed stocks
```

## Installation

### 1. Copy Files to Your SWT Project

```bash
# Copy page and components
cp -r app/universe /path/to/swt/app/

# Copy API routes
cp -r api/universe /path/to/swt/app/api/
```

### 2. Run Database Migration

1. Go to Supabase Dashboard → SQL Editor
2. Paste contents of `supabase-universe-migration.sql`
3. Click "Run"

Verify with:
```sql
SELECT COUNT(*) FROM universe_sectors;  -- Should be 6
SELECT COUNT(*) FROM universe_stocks;   -- Should be 37
```

### 3. Add Sidebar Navigation

In your sidebar component (e.g., `components/Sidebar.tsx`), add:

```tsx
import { Globe } from 'lucide-react'

// In your nav items array, add:
{
  name: 'AI Universe',
  href: '/universe',
  icon: Globe,
}
```

Or copy this full nav item JSX:

```tsx
<Link
  href="/universe"
  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
    pathname === '/universe'
      ? 'bg-emerald-600 text-white'
      : 'text-gray-600 hover:bg-gray-100'
  }`}
>
  <Globe className="w-5 h-5" />
  <span>AI Universe</span>
</Link>
```

### 4. Deploy

```bash
git add .
git commit -m "Add AI Infrastructure Universe feature"
git push
```

## Features

- **37 Quality-Filtered Stocks** across 6 sectors
- **Sector Filtering** — Silicon, Networking, Equipment, Memory, Power, Cloud
- **Tier Filtering** — Heavyweights vs Velocity (emerging)
- **Search** — By ticker, company name, or thesis
- **Expandable Cards** — Click to see catalysts (green) and risks (red)
- **Buffett Scanner Integration** — "Run Buffett Scanner" links to `/assessor?ticker=TICKER`
- **Alerts System** — Create and track alerts by severity (red/amber/green)
- **Admin Controls** — Add/edit/remove stocks, create manual alerts

## Stock Universe by Sector

| Sector | Count | Examples |
|--------|-------|----------|
| Silicon & Compute | 8 | NVDA, AMD, AVGO, QCOM, INTC, ARM, MRVL, MPWR |
| Networking & Interconnect | 6 | CSCO, ANET, CDNS, SNPS, LITE, COHR |
| Semiconductor Equipment | 6 | ASML, LRCX, AMAT, KLAC, TER, ONTO |
| Memory & Storage | 5 | MU, WDC, STX, PSTG, NTAP |
| Power & Cooling | 5 | VRT, ETN, EMR, GNRC, PWR |
| Cloud & Data Centre Infra | 7 | AMZN, MSFT, GOOGL, ORCL, DLR, EQIX, AMT |

## Inclusion/Exclusion Criteria

**Inclusion:**
- NYSE/NASDAQ listed
- Market cap >$5B
- Profitable (2+ consecutive quarters)
- Direct/indirect AI infrastructure exposure
- 50%+ institutional ownership
- 3+ analyst coverage

**Exclusion Triggers:**
- Market cap drops below $3B
- Two consecutive revenue decline quarters without catalyst
- Fundamental thesis broken
- Delisting/governance red flags

## Quarterly Refresh Schedule

- **Next refresh:** June 2026
- Review all positions against inclusion criteria
- Update market caps, status colors, catalysts/risks
- Add/remove stocks as needed
