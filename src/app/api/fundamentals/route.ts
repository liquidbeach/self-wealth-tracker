import { NextRequest, NextResponse } from 'next/server'

// Fundamentals data from Yahoo Finance quoteSummary
// quoteSummary now requires a cookie + crumb. We fetch those first, then call the endpoint.
// Usage: /api/fundamentals?symbol=NVDA

interface QuarterPoint {
  date: string
  revenue: number | null
  eps: number | null
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Cache the cookie + crumb across requests (they last a while)
let cachedCookie: string | null = null
let cachedCrumb: string | null = null
let crumbFetchedAt = 0
const CRUMB_TTL = 1000 * 60 * 30 // 30 min

async function getCookieAndCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  // Reuse if fresh
  if (cachedCookie && cachedCrumb && Date.now() - crumbFetchedAt < CRUMB_TTL) {
    return { cookie: cachedCookie, crumb: cachedCrumb }
  }

  try {
    // Step 1: get a cookie from Yahoo
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    })
    let cookie = ''
    const setCookie = cookieRes.headers.get('set-cookie')
    if (setCookie) {
      cookie = setCookie.split(';')[0]
    }

    // Some environments need the consent flow; try the getcrumb endpoint with the cookie
    // Step 2: get a crumb using the cookie
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': UA,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    })

    if (!crumbRes.ok) {
      return null
    }

    const crumb = await crumbRes.text()
    if (!crumb || crumb.includes('<html') || crumb.length > 20) {
      // crumb should be a short token; if we got HTML back, it failed
      return null
    }

    cachedCookie = cookie
    cachedCrumb = crumb
    crumbFetchedAt = Date.now()
    return { cookie, crumb }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  }

  const modules = [
    'incomeStatementHistoryQuarterly',
    'earnings',
    'defaultKeyStatistics',
    'price',
    'summaryDetail',
    'financialData',
  ].join(',')

  try {
    const auth = await getCookieAndCrumb()

    // Build URL — include crumb if we have one
    const crumbParam = auth?.crumb ? `&crumb=${encodeURIComponent(auth.crumb)}` : ''
    const headers: Record<string, string> = { 'User-Agent': UA }
    if (auth?.cookie) headers.Cookie = auth.cookie

    const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']
    let lastStatus = 0

    for (const host of hosts) {
      const url = `https://${host}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}${crumbParam}`
      const res = await fetch(url, { headers })
      lastStatus = res.status

      if (res.ok) {
        const data = await res.json()
        return NextResponse.json(parseYahoo(data, symbol))
      }

      // If 401 and we had no auth, one more try after forcing a fresh crumb
      if (res.status === 401 && auth) {
        cachedCrumb = null
        cachedCookie = null
      }
    }

    // Fallback: try the chart endpoint for at least price + basic data (no crumb needed)
    return NextResponse.json({
      error: `Yahoo Finance error: ${lastStatus}. quoteSummary requires auth that failed — data source swap (EODHD) recommended for reliability.`,
      symbol,
      partial: true,
    }, { status: 502 })
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

  const currentPrice = price.regularMarketPrice?.raw ?? null
  const priceChange = price.regularMarketChangePercent?.raw ?? null

  const revenueByQuarter: QuarterPoint[] = incomeQuarterly.map((q: any) => ({
    date: q.endDate?.fmt || '',
    revenue: q.totalRevenue?.raw ?? null,
    eps: null,
  })).reverse()

  const epsQuarterly = earnings.earningsChart?.quarterly || []
  const finChartQuarterly = earnings.financialsChart?.quarterly || []
  const revChartMap: Record<string, number> = {}
  finChartQuarterly.forEach((f: any) => {
    if (f.date && f.revenue?.raw !== undefined) revChartMap[f.date] = f.revenue.raw
  })

  const combinedQuarterly: QuarterPoint[] = epsQuarterly.map((e: any) => ({
    date: e.date || '',
    eps: e.actual?.raw ?? null,
    revenue: revChartMap[e.date] ?? null,
  }))

  const forwardPE = summaryDetail.forwardPE?.raw ?? keyStats.forwardPE?.raw ?? null
  const trailingPE = summaryDetail.trailingPE?.raw ?? null
  const pegRatio = keyStats.pegRatio?.raw ?? null
  const sharesOutstanding = keyStats.sharesOutstanding?.raw ?? price.sharesOutstanding?.raw ?? null

  const volume = summaryDetail.volume?.raw ?? price.regularMarketVolume?.raw ?? null
  const avgVolume10d = summaryDetail.averageVolume10days?.raw ?? null
  const avgVolume3m = summaryDetail.averageDailyVolume3Month?.raw ?? null

  const revenueGrowth = financialData.revenueGrowth?.raw ?? null
  const earningsGrowth = financialData.earningsGrowth?.raw ?? null

  const fiftyTwoWeekHigh = summaryDetail.fiftyTwoWeekHigh?.raw ?? null
  const fiftyTwoWeekLow = summaryDetail.fiftyTwoWeekLow?.raw ?? null

  const ttmRevenue = revenueByQuarter.slice(-4).reduce((s, q) => s + (q.revenue || 0), 0) || null

  return {
    symbol,
    name: price.longName || price.shortName || symbol,
    currency: price.currency || 'USD',
    currentPrice, priceChange,
    forwardPE, trailingPE, pegRatio, sharesOutstanding,
    revenueGrowth, earningsGrowth,
    volume, avgVolume10d, avgVolume3m,
    fiftyTwoWeekHigh, fiftyTwoWeekLow,
    ttmRevenue,
    revenueByQuarter, combinedQuarterly,
    fetchedAt: new Date().toISOString(),
    dataSource: 'yahoo',
  }
}
