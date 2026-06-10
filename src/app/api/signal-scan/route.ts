import { NextRequest, NextResponse } from 'next/server'

// Fetch 52-week data for a single symbol from Yahoo Finance
async function fetchStockData(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 300 },
    })

    if (!response.ok) return null

    const data = await response.json()
    const result = data.chart?.result?.[0]
    const meta = result?.meta
    if (!meta) return null

    const quote = result.indicators?.quote?.[0]
    let weekHigh52 = meta.fiftyTwoWeekHigh || 0
    let weekLow52 = meta.fiftyTwoWeekLow || 0

    if ((!weekHigh52 || !weekLow52) && quote?.high && quote?.low) {
      const highs = quote.high.filter((v: number | null) => v !== null && v > 0)
      const lows = quote.low.filter((v: number | null) => v !== null && v > 0)
      if (highs.length > 0) weekHigh52 = Math.max(...highs)
      if (lows.length > 0) weekLow52 = Math.min(...lows)
    }

    const currentPrice = meta.regularMarketPrice || 0
    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice

    // Calculate pullback metrics
    const pullbackFromHigh = weekHigh52 > 0
      ? ((weekHigh52 - currentPrice) / weekHigh52) * 100
      : 0
    const rangePosition = (weekHigh52 - weekLow52) > 0
      ? ((currentPrice - weekLow52) / (weekHigh52 - weekLow52)) * 100
      : 50

    return {
      symbol: meta.symbol || symbol,
      name: meta.shortName || meta.longName || symbol,
      currentPrice,
      previousClose,
      change: currentPrice - previousClose,
      changePercent: previousClose > 0
        ? ((currentPrice - previousClose) / previousClose) * 100
        : 0,
      weekHigh52,
      weekLow52,
      pullbackFromHigh: Math.round(pullbackFromHigh * 100) / 100,
      rangePosition: Math.round(rangePosition * 100) / 100,
    }
  } catch (error) {
    console.error(`Signal scan error for ${symbol}:`, error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { symbols } = await request.json()

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: 'symbols array required' }, { status: 400 })
    }

    // Cap at 50 symbols to avoid overloading
    const tickers = symbols.slice(0, 50)

    // Fetch in batches of 5 with small delay between batches
    const results: any[] = []
    const batchSize = 5

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map((sym: string) => fetchStockData(sym))
      )
      results.push(...batchResults)

      // Rate limit delay between batches
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // Filter out failures and sort by pullback depth (deepest first)
    const successful = results
      .filter(Boolean)
      .sort((a, b) => b.pullbackFromHigh - a.pullbackFromHigh)

    return NextResponse.json({
      stocks: successful,
      total: successful.length,
      failed: tickers.length - successful.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Signal scan error:', error)
    return NextResponse.json(
      { error: error.message || 'Scan failed' },
      { status: 500 }
    )
  }
}
