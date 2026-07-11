import { NextRequest, NextResponse } from 'next/server'

// Historical price series for the indexed trajectory chart
// Usage: /api/price-history?symbol=NVDA&range=2y&interval=3mo

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')?.toUpperCase()
  const range = req.nextUrl.searchParams.get('range') || '2y'
  const interval = req.nextUrl.searchParams.get('interval') || '1mo'

  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo Finance error: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const result = data.chart?.result?.[0]

    if (!result) {
      return NextResponse.json({ error: 'No data' }, { status: 404 })
    }

    const timestamps = result.timestamp || []
    const closes = result.indicators?.quote?.[0]?.close || []

    const series = timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: closes[i] ?? null,
    })).filter((p: any) => p.close !== null)

    return NextResponse.json({ symbol, range, interval, series })
  } catch (err: any) {
    console.error('Price history error:', err)
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
