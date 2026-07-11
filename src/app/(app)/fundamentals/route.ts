import { NextRequest, NextResponse } from 'next/server'

// Fundamentals data from Yahoo Finance
// Returns quarterly EPS, revenue, price history, and key stats for a ticker
// Usage: /api/fundamentals?symbol=NVDA

interface QuarterPoint {
  date: string
  revenue: number | null
  eps: number | null
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  }

  try {
    // Yahoo Finance fundamentals via quoteSummary
    // Modules: incomeStatementHistoryQuarterly (revenue), earnings (eps), defaultKeyStatistics, price, summaryDetail
    const modules = [
      'incomeStatementHistoryQuarterly',
      'earnings',
      'defaultKeyStatistics',
      'price',
      'summaryDetail',
      'financialData',
    ].join(',')

    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    })

    if (!res.ok) {
      // Fallback: try query2 host
      const url2 = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`
      const res2 = await fetch(url2, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res2.ok) {
        return NextResponse.json({ error: `Yahoo Finance error: ${res.status}` }, { status: 502 })
      }
      const data2 = await res2.json()
      return NextResponse.json(parseYahoo(data2, symbol))
    }

    const data = await res.json()
    return NextResponse.json(parseYahoo(data, symbol))
  } catch (err: any) {
    console.error('Fundamentals fetch error:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch fundamentals' }, { status: 500 })
  }
}

function parseYahoo(data: any, symbol: string) {
  const result = data?.quoteSummary?.result?.[0]
  if (!result) {
    return { error: 'No data returned for ' + symbol, symbol }
  }

  const price = result.price || {}
  const keyStats = result.defaultKeyStatistics || {}
  const summaryDetail = result.summaryDetail || {}
  const financialData = result.financialData || {}
  const earnings = result.earnings || {}
  const incomeQuarterly = result.incomeStatementHistoryQuarterly?.incomeStatementHistory || []

  // Current price
  const currentPrice = price.regularMarketPrice?.raw ?? null
  const priceChange = price.regularMarketChangePercent?.raw ?? null

  // Quarterly revenue (from income statement)
  const revenueByQuarter: QuarterPoint[] = incomeQuarterly.map((q: any) => ({
    date: q.endDate?.fmt || '',
    revenue: q.totalRevenue?.raw ?? null,
    eps: null, // filled from earnings below
  })).reverse() // oldest first

  // Quarterly EPS (from earnings module)
  const epsQuarterly = earnings.earningsChart?.quarterly || []
  const epsMap: Record<string, number> = {}
  epsQuarterly.forEach((e: any) => {
    // e.date is like "1Q2024"
    if (e.date && e.actual?.raw !== undefined) {
      epsMap[e.date] = e.actual.raw
    }
  })

  // Financial revenue chart (quarterly) — alternative revenue source
  const finChartQuarterly = earnings.financialsChart?.quarterly || []
  const revChartMap: Record<string, number> = {}
  finChartQuarterly.forEach((f: any) => {
    if (f.date && f.revenue?.raw !== undefined) {
      revChartMap[f.date] = f.revenue.raw
    }
  })

  // Build a combined quarterly series from earnings chart (has both eps + revenue aligned)
  const combinedQuarterly: QuarterPoint[] = epsQuarterly.map((e: any) => ({
    date: e.date || '',
    eps: e.actual?.raw ?? null,
    revenue: revChartMap[e.date] ?? null,
  }))

  // Key valuation metrics
  const forwardPE = summaryDetail.forwardPE?.raw ?? keyStats.forwardPE?.raw ?? null
  const trailingPE = summaryDetail.trailingPE?.raw ?? null
  const pegRatio = keyStats.pegRatio?.raw ?? null
  const sharesOutstanding = keyStats.sharesOutstanding?.raw ?? price.sharesOutstanding?.raw ?? null

  // Volume
  const volume = summaryDetail.volume?.raw ?? price.regularMarketVolume?.raw ?? null
  const avgVolume10d = summaryDetail.averageVolume10days?.raw ?? null
  const avgVolume3m = summaryDetail.averageDailyVolume3Month?.raw ?? null

  // Growth metrics
  const revenueGrowth = financialData.revenueGrowth?.raw ?? null
  const earningsGrowth = financialData.earningsGrowth?.raw ?? null

  // 52-week range
  const fiftyTwoWeekHigh = summaryDetail.fiftyTwoWeekHigh?.raw ?? null
  const fiftyTwoWeekLow = summaryDetail.fiftyTwoWeekLow?.raw ?? null

  // TTM revenue (sum of last 4 quarters if available)
  const ttmRevenue = revenueByQuarter.slice(-4).reduce((s, q) => s + (q.revenue || 0), 0) || null

  return {
    symbol,
    name: price.longName || price.shortName || symbol,
    currency: price.currency || 'USD',
    currentPrice,
    priceChange,
    // Valuation
    forwardPE,
    trailingPE,
    pegRatio,
    sharesOutstanding,
    // Growth
    revenueGrowth,
    earningsGrowth,
    // Volume
    volume,
    avgVolume10d,
    avgVolume3m,
    // Range
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    // TTM
    ttmRevenue,
    // Time series
    revenueByQuarter,      // from income statement (actual $ revenue)
    combinedQuarterly,     // from earnings chart (eps + revenue aligned by quarter label)
    // Meta
    fetchedAt: new Date().toISOString(),
    dataSource: 'yahoo',
  }
}
