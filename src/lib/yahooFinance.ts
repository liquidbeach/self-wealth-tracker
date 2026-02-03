// Yahoo Finance API helper
// Fetches historical price data for technical analysis

export interface PriceData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  adjustedClose: number
}

export interface StockQuote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  avgVolume: number
  marketCap: number
  high52Week: number
  low52Week: number
}

// Fetch historical prices from Yahoo Finance
export async function fetchPriceHistory(
  symbol: string,
  days: number = 100
): Promise<PriceData[]> {
  const endDate = Math.floor(Date.now() / 1000)
  const startDate = endDate - days * 24 * 60 * 60

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch data for ${symbol}`)
    }

    const data = await response.json()
    const result = data.chart?.result?.[0]

    if (!result) {
      throw new Error(`No data found for ${symbol}`)
    }

    const timestamps = result.timestamp || []
    const quotes = result.indicators?.quote?.[0] || {}
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose || quotes.close

    const prices: PriceData[] = []

    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.close[i] !== null) {
        prices.push({
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          open: quotes.open[i] || 0,
          high: quotes.high[i] || 0,
          low: quotes.low[i] || 0,
          close: quotes.close[i] || 0,
          volume: quotes.volume[i] || 0,
          adjustedClose: adjClose?.[i] || quotes.close[i] || 0,
        })
      }
    }

    return prices
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error)
    return []
  }
}

// Fetch current quote for a stock
export async function fetchQuote(symbol: string): Promise<StockQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    const result = data.chart?.result?.[0]
    const meta = result?.meta

    if (!meta) return null

    const quote = result.indicators?.quote?.[0]
    const currentPrice = meta.regularMarketPrice || 0
    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice

    return {
      symbol: meta.symbol,
      name: meta.shortName || meta.symbol,
      price: currentPrice,
      change: currentPrice - previousClose,
      changePercent: ((currentPrice - previousClose) / previousClose) * 100,
      volume: quote?.volume?.[quote.volume.length - 1] || 0,
      avgVolume: meta.averageDailyVolume10Day || 0,
      marketCap: meta.marketCap || 0,
      high52Week: meta.fiftyTwoWeekHigh || 0,
      low52Week: meta.fiftyTwoWeekLow || 0,
    }
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error)
    return null
  }
}

// Fetch quotes for multiple symbols
export async function fetchMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>()
  
  // Process in batches of 5 to avoid rate limiting
  const batchSize = 5
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const promises = batch.map(symbol => fetchQuote(symbol))
    const batchResults = await Promise.all(promises)
    
    batchResults.forEach((quote, index) => {
      if (quote) {
        results.set(batch[index], quote)
      }
    })
    
    // Small delay between batches
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  return results
}

// Popular stock lists for scanning
export const SP500_TOP_50 = [
  'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'META', 'TSLA', 'BRK-B', 'UNH', 'JNJ',
  'JPM', 'V', 'PG', 'XOM', 'MA', 'HD', 'CVX', 'MRK', 'ABBV', 'PEP',
  'KO', 'COST', 'AVGO', 'LLY', 'WMT', 'MCD', 'CSCO', 'ACN', 'TMO', 'ABT',
  'DHR', 'NEE', 'NKE', 'VZ', 'ADBE', 'TXN', 'PM', 'CRM', 'CMCSA', 'UPS',
  'RTX', 'ORCL', 'HON', 'INTC', 'LOW', 'QCOM', 'IBM', 'AMD', 'CAT', 'SPGI'
]

export const TECH_MOMENTUM = [
  'NVDA', 'AMD', 'SMCI', 'PLTR', 'SNOW', 'NET', 'CRWD', 'ZS', 'PANW', 'DDOG',
  'MDB', 'COIN', 'SHOP', 'SQ', 'ROKU', 'TTD', 'U', 'RBLX', 'ABNB', 'DASH',
  'ARM', 'MRVL', 'AVGO', 'AMAT', 'LRCX', 'KLAC', 'ASML', 'TSM', 'MU', 'QCOM'
]

export const HIGH_VOLUME = [
  'AAPL', 'TSLA', 'AMD', 'NVDA', 'AMZN', 'META', 'MSFT', 'GOOGL', 'PLTR', 'SOFI',
  'BAC', 'F', 'T', 'INTC', 'AAL', 'NIO', 'RIVN', 'LCID', 'SNAP', 'UBER'
]
