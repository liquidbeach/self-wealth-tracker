import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
  }

  try {
    // Fetch 1-year daily chart — gives us current price + 52-week range
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 300 }, // Cache 5 minutes (52-week range doesn't change fast)
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    const data = await response.json()
    const result = data.chart?.result?.[0]
    const meta = result?.meta

    if (!meta) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    // Extract highs and lows from 1-year chart data for 52-week range
    const quote = result.indicators?.quote?.[0]
    let weekHigh52 = meta.fiftyTwoWeekHigh || 0
    let weekLow52 = meta.fiftyTwoWeekLow || 0

    // If meta doesn't have 52-week data, calculate from chart
    if ((!weekHigh52 || !weekLow52) && quote?.high && quote?.low) {
      const highs = quote.high.filter((v: number | null) => v !== null && v > 0)
      const lows = quote.low.filter((v: number | null) => v !== null && v > 0)
      if (highs.length > 0) weekHigh52 = Math.max(...highs)
      if (lows.length > 0) weekLow52 = Math.min(...lows)
    }

    const currentPrice = meta.regularMarketPrice || 0
    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice

    return NextResponse.json({
      symbol: meta.symbol,
      name: meta.shortName || meta.longName || meta.symbol,
      currentPrice,
      previousClose,
      change: currentPrice - previousClose,
      changePercent: previousClose > 0
        ? ((currentPrice - previousClose) / previousClose) * 100
        : 0,
      weekHigh52,
      weekLow52,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Pullback quote fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
