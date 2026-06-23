import { NextRequest, NextResponse } from 'next/server'

// Fetches index return for a given period
// Usage: /api/benchmark?symbol=^GSPC&startDate=2025-07-01
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') || '^GSPC'
  const startDate = req.nextUrl.searchParams.get('startDate')

  if (!startDate) {
    return NextResponse.json({ error: 'startDate required (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const startTs = Math.floor(new Date(startDate).getTime() / 1000)
    const endTs = Math.floor(Date.now() / 1000)

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${startTs}&period2=${endTs}&interval=1d`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo Finance error: ${res.status}` }, { status: 500 })
    }

    const data = await res.json()
    const result = data.chart?.result?.[0]

    if (!result || !result.indicators?.quote?.[0]?.close) {
      return NextResponse.json({ error: 'No data returned' }, { status: 404 })
    }

    const closes = result.indicators.quote[0].close.filter((c: number | null) => c !== null)
    const timestamps = result.timestamp || []

    if (closes.length < 2) {
      return NextResponse.json({ error: 'Insufficient data' }, { status: 404 })
    }

    const startPrice = closes[0]
    const endPrice = closes[closes.length - 1]
    const returnPct = ((endPrice - startPrice) / startPrice) * 100

    return NextResponse.json({
      symbol,
      startDate,
      startPrice: Math.round(startPrice * 100) / 100,
      endPrice: Math.round(endPrice * 100) / 100,
      returnPct: Math.round(returnPct * 100) / 100,
      dataPoints: closes.length,
    })
  } catch (err: any) {
    console.error('Benchmark fetch error:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch benchmark' }, { status: 500 })
  }
}
