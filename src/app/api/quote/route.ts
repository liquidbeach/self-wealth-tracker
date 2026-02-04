import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol required' }, { status: 400 })
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 })
    }

    const data = await response.json()
    const result = data.chart?.result?.[0]
    const meta = result?.meta

    if (!meta) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    const quote = result.indicators?.quote?.[0]
    const currentPrice = meta.regularMarketPrice || 0
    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice

    return NextResponse.json({
      symbol: meta.symbol,
      name: meta.shortName || meta.symbol,
      price: currentPrice,
      previousClose,
      change: currentPrice - previousClose,
      changePercent: ((currentPrice - previousClose) / previousClose) * 100,
      high: meta.regularMarketDayHigh || 0,
      low: meta.regularMarketDayLow || 0,
      volume: quote?.volume?.[quote.volume.length - 1] || 0,
      marketCap: meta.marketCap || 0,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Quote fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
