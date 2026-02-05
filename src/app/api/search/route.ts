import { NextRequest, NextResponse } from 'next/server'

// Search for stocks using Yahoo Finance
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.length < 1) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  try {
    // Yahoo Finance search API
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=false`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    const data = await response.json()
    const quotes = data.quotes || []

    // Filter and format results
    const results = quotes
      .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange,
        type: q.quoteType,
        // Determine market based on exchange
        market: getMarket(q.exchange, q.symbol),
      }))

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getMarket(exchange: string, symbol: string): string {
  // ASX
  if (exchange === 'ASX' || symbol.endsWith('.AX')) return 'ASX'
  // BSE / NSE India
  if (exchange === 'BSE' || exchange === 'NSI' || symbol.endsWith('.BO') || symbol.endsWith('.NS')) return 'BSE'
  // US markets
  if (['NYQ', 'NMS', 'NGM', 'NYSE', 'NASDAQ', 'AMEX', 'PCX', 'BTS'].includes(exchange)) return 'US'
  // Default
  return 'US'
}
