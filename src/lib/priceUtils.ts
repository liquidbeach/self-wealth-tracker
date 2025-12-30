// Price fetching utilities
// Uses Yahoo Finance API (free, no key required)

export interface StockPrice {
  ticker: string
  price: number
  change: number
  changePercent: number
  currency: string
  marketState: string
  lastUpdated: Date
}

export interface FxRates {
  AUDUSD: number
  USDINR: number
  AUDINR: number
  lastUpdated: Date
}

// Fetch single stock price from Yahoo Finance
export async function fetchStockPrice(ticker: string): Promise<StockPrice | null> {
  try {
    // Yahoo Finance API endpoint
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch ${ticker}: ${response.status}`)
      return null
    }

    const data = await response.json()
    const result = data.chart?.result?.[0]
    
    if (!result) {
      console.error(`No data for ${ticker}`)
      return null
    }

    const meta = result.meta
    const price = meta.regularMarketPrice || meta.previousClose
    const previousClose = meta.previousClose || price
    const change = price - previousClose
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

    return {
      ticker,
      price,
      change,
      changePercent,
      currency: meta.currency || 'USD',
      marketState: meta.marketState || 'CLOSED',
      lastUpdated: new Date()
    }
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error)
    return null
  }
}

// Fetch multiple stock prices in parallel
export async function fetchMultipleStockPrices(tickers: string[]): Promise<Map<string, StockPrice>> {
  const results = new Map<string, StockPrice>()
  
  // Batch in groups of 5 to avoid rate limiting
  const batchSize = 5
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize)
    const promises = batch.map(ticker => fetchStockPrice(ticker))
    const batchResults = await Promise.all(promises)
    
    batchResults.forEach((result, index) => {
      if (result) {
        results.set(batch[index], result)
      }
    })
    
    // Small delay between batches
    if (i + batchSize < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  return results
}

// Fetch FX rates
export async function fetchFxRates(): Promise<FxRates | null> {
  try {
    // Fetch AUD/USD and USD/INR from Yahoo Finance
    const [audusd, usdinr] = await Promise.all([
      fetchStockPrice('AUDUSD=X'),
      fetchStockPrice('USDINR=X')
    ])

    if (!audusd || !usdinr) {
      console.error('Failed to fetch FX rates')
      return null
    }

    const audusdRate = audusd.price
    const usdinrRate = usdinr.price
    const audinrRate = audusdRate * usdinrRate

    return {
      AUDUSD: audusdRate,
      USDINR: usdinrRate,
      AUDINR: audinrRate,
      lastUpdated: new Date()
    }
  } catch (error) {
    console.error('Error fetching FX rates:', error)
    return null
  }
}

// Format ticker for Yahoo Finance based on market
export function formatTickerForYahoo(ticker: string, market: string): string {
  // Already formatted
  if (ticker.includes('.') || ticker.includes('=')) {
    return ticker
  }
  
  switch (market) {
    case 'ASX':
      return `${ticker}.AX`
    case 'BSE':
      return `${ticker}.BO` // Yahoo uses .BO for BSE
    case 'US':
    default:
      return ticker
  }
}

// Convert Yahoo ticker back to display format
export function formatTickerForDisplay(yahooTicker: string): string {
  return yahooTicker
    .replace('.AX', '')
    .replace('.BO', '')
}
