import { NextRequest, NextResponse } from 'next/server'

// Yahoo Finance fetch helper
async function fetchPriceHistory(symbol: string, days: number = 100) {
  const endDate = Math.floor(Date.now() / 1000)
  const startDate = endDate - days * 24 * 60 * 60

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) return null

    const data = await response.json()
    const result = data.chart?.result?.[0]

    if (!result) return null

    const timestamps = result.timestamp || []
    const quotes = result.indicators?.quote?.[0] || {}
    const meta = result.meta || {}

    const prices = []
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.close[i] !== null) {
        prices.push({
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          open: quotes.open[i] || 0,
          high: quotes.high[i] || 0,
          low: quotes.low[i] || 0,
          close: quotes.close[i] || 0,
          volume: quotes.volume[i] || 0,
        })
      }
    }

    return {
      symbol: meta.symbol,
      name: meta.shortName || meta.symbol,
      prices,
    }
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error)
    return null
  }
}

// Calculate SMA
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return 0
  const slice = prices.slice(-period)
  return slice.reduce((sum, p) => sum + p, 0) / period
}

// Calculate EMA
function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return 0
  const multiplier = 2 / (period + 1)
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema
  }
  return ema
}

// Calculate RSI
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50
  
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) gains += change
    else losses -= change
  }
  
  let avgGain = gains / period
  let avgLoss = losses / period
  
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period
  }
  
  if (avgLoss === 0) return 100
  return 100 - (100 / (1 + avgGain / avgLoss))
}

// Calculate MACD
function calculateMACD(prices: number[]) {
  if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  
  const ema12 = calculateEMA(prices, 12)
  const ema26 = calculateEMA(prices, 26)
  const macd = ema12 - ema26
  
  // Simplified signal line
  const macdValues = []
  for (let i = 26; i <= prices.length; i++) {
    const slice = prices.slice(0, i)
    macdValues.push(calculateEMA(slice, 12) - calculateEMA(slice, 26))
  }
  
  const signal = macdValues.length >= 9 ? calculateEMA(macdValues, 9) : macd
  return { macd, signal, histogram: macd - signal }
}

// Analyze a single stock
function analyzeStock(data: any) {
  const prices = data.prices
  const closes = prices.map((p: any) => p.close)
  const volumes = prices.map((p: any) => p.volume)
  const currentPrice = closes[closes.length - 1]
  const previousPrice = closes[closes.length - 2] || currentPrice
  
  // Calculate indicators
  const rsi = calculateRSI(closes, 14)
  const { macd, signal, histogram } = calculateMACD(closes)
  const sma20 = calculateSMA(closes, 20)
  const sma50 = calculateSMA(closes, 50)
  const avgVolume = calculateSMA(volumes, 20)
  const currentVolume = volumes[volumes.length - 1]
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1
  
  // Calculate momentum score
  let score = 50
  
  // RSI contribution
  if (rsi < 30) score += 15
  else if (rsi < 40) score += 10
  else if (rsi > 70) score -= 15
  else if (rsi > 60) score -= 5
  
  // MACD contribution
  if (histogram > 0 && macd > signal) score += 15
  else if (histogram > 0) score += 8
  else if (histogram < 0 && macd < signal) score -= 15
  else if (histogram < 0) score -= 8
  
  // Trend contribution
  if (currentPrice > sma50 && sma50 > sma20 * 0.98) score += 10
  else if (currentPrice > sma50) score += 5
  else if (currentPrice < sma50) score -= 10
  
  // Volume contribution
  if (volumeRatio > 1.5 && histogram > 0) score += 10
  
  score = Math.max(0, Math.min(100, score))
  
  // Determine signal
  let signalType = 'HOLD'
  if (score >= 75) signalType = 'STRONG_BUY'
  else if (score >= 60) signalType = 'BUY'
  else if (score <= 25) signalType = 'STRONG_SELL'
  else if (score <= 40) signalType = 'SELL'
  
  // Calculate targets
  const stopLossPercent = 0.08
  const targetPercent = score >= 70 ? 0.20 : score >= 60 ? 0.15 : 0.10
  
  // Collect signals
  const bullishSignals = []
  const bearishSignals = []
  
  if (rsi < 30) bullishSignals.push('RSI oversold')
  else if (rsi > 70) bearishSignals.push('RSI overbought')
  
  if (histogram > 0 && macd > signal) bullishSignals.push('MACD bullish')
  else if (histogram < 0) bearishSignals.push('MACD bearish')
  
  if (currentPrice > sma50) bullishSignals.push('Above 50-MA')
  else bearishSignals.push('Below 50-MA')
  
  if (volumeRatio > 1.5) bullishSignals.push(`Volume ${volumeRatio.toFixed(1)}x`)
  
  return {
    symbol: data.symbol,
    name: data.name,
    price: currentPrice,
    change: currentPrice - previousPrice,
    changePercent: ((currentPrice - previousPrice) / previousPrice) * 100,
    signal: signalType,
    strength: Math.round(score),
    rsi: Math.round(rsi),
    macdHistogram: histogram,
    volumeRatio: Math.round(volumeRatio * 10) / 10,
    entryPrice: currentPrice,
    targetPrice: Math.round(currentPrice * (1 + targetPercent) * 100) / 100,
    stopLoss: Math.round(currentPrice * (1 - stopLossPercent) * 100) / 100,
    potentialGain: Math.round(targetPercent * 100),
    riskReward: Math.round((targetPercent / stopLossPercent) * 10) / 10,
    bullishSignals,
    bearishSignals,
  }
}

// Stock lists
const STOCK_LISTS: Record<string, string[]> = {
  sp500_top: [
    'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'META', 'TSLA', 'BRK-B', 'UNH', 'JNJ',
    'JPM', 'V', 'PG', 'XOM', 'MA', 'HD', 'CVX', 'MRK', 'ABBV', 'PEP',
    'KO', 'COST', 'AVGO', 'LLY', 'WMT', 'MCD', 'CSCO', 'ACN', 'TMO', 'ABT'
  ],
  tech: [
    'NVDA', 'AMD', 'SMCI', 'PLTR', 'SNOW', 'NET', 'CRWD', 'ZS', 'PANW', 'DDOG',
    'MDB', 'COIN', 'SHOP', 'SQ', 'ROKU', 'ARM', 'MRVL', 'AVGO', 'AMAT', 'MU'
  ],
  momentum: [
    'NVDA', 'SMCI', 'ARM', 'PLTR', 'COIN', 'MSTR', 'CELH', 'CRWD', 'PANW', 'LLY',
    'DECK', 'COST', 'META', 'AMZN', 'NFLX', 'UBER', 'ABNB', 'DASH', 'DKNG', 'RBLX'
  ],
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { list = 'sp500_top', customSymbols } = body

    // Get stock list
    const symbols = customSymbols || STOCK_LISTS[list] || STOCK_LISTS.sp500_top

    // Fetch and analyze each stock
    const results = []
    const batchSize = 5
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const batchPromises = batch.map(async (symbol: string) => {
        const data = await fetchPriceHistory(symbol, 100)
        if (data && data.prices.length >= 50) {
          return analyzeStock(data)
        }
        return null
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter(Boolean))
      
      // Rate limiting delay
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // Sort by strength (highest first)
    results.sort((a: any, b: any) => b.strength - a.strength)

    // Filter to only show BUY signals at top
    const buySignals = results.filter((r: any) => r.signal === 'STRONG_BUY' || r.signal === 'BUY')
    const otherSignals = results.filter((r: any) => r.signal !== 'STRONG_BUY' && r.signal !== 'BUY')

    return NextResponse.json({
      signals: [...buySignals, ...otherSignals],
      summary: {
        total: results.length,
        strongBuy: results.filter((r: any) => r.signal === 'STRONG_BUY').length,
        buy: results.filter((r: any) => r.signal === 'BUY').length,
        hold: results.filter((r: any) => r.signal === 'HOLD').length,
        sell: results.filter((r: any) => r.signal === 'SELL' || r.signal === 'STRONG_SELL').length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Scanner error:', error)
    return NextResponse.json(
      { error: error.message || 'Scanner failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run momentum scanner',
    lists: Object.keys(STOCK_LISTS),
    example: { list: 'tech' }
  })
}
