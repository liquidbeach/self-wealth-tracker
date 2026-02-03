// Technical Indicators Calculator
// Calculates RSI, MACD, Moving Averages, and other momentum indicators

import { PriceData } from './yahooFinance'

export interface TechnicalIndicators {
  // Current values
  rsi: number
  macd: number
  macdSignal: number
  macdHistogram: number
  sma20: number
  sma50: number
  sma200: number
  ema12: number
  ema26: number
  
  // Signals
  rsiSignal: 'oversold' | 'overbought' | 'neutral'
  macdSignal: 'bullish' | 'bearish' | 'neutral'
  trendSignal: 'bullish' | 'bearish' | 'neutral'
  
  // Volume analysis
  volumeRatio: number // Current volume / average volume
  volumeSignal: 'high' | 'normal' | 'low'
  
  // Price position
  priceVsSma50: number // % above/below 50-day MA
  priceVsSma200: number // % above/below 200-day MA
  
  // Overall
  momentumScore: number // 0-100 composite score
}

export interface MomentumSignal {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  
  // Signals
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL'
  strength: number // 0-100
  
  // Key indicators
  rsi: number
  macdHistogram: number
  volumeRatio: number
  trendStrength: number
  
  // Trade setup
  entryPrice: number
  targetPrice: number
  stopLoss: number
  potentialGain: number // %
  riskReward: number // ratio
  
  // Reasons
  bullishSignals: string[]
  bearishSignals: string[]
}

// Calculate Simple Moving Average
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return 0
  const slice = prices.slice(-period)
  return slice.reduce((sum, p) => sum + p, 0) / period
}

// Calculate Exponential Moving Average
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return 0
  
  const multiplier = 2 / (period + 1)
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema
  }
  
  return ema
}

// Calculate RSI (Relative Strength Index)
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50 // Default neutral
  
  let gains = 0
  let losses = 0
  
  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) gains += change
    else losses -= change
  }
  
  let avgGain = gains / period
  let avgLoss = losses / period
  
  // Calculate smoothed RSI
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }
  
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

// Calculate MACD
export function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 }
  
  const ema12 = calculateEMA(prices, 12)
  const ema26 = calculateEMA(prices, 26)
  const macd = ema12 - ema26
  
  // Calculate signal line (9-day EMA of MACD)
  // For simplicity, we'll use a rough approximation
  const macdValues: number[] = []
  for (let i = 26; i <= prices.length; i++) {
    const slice = prices.slice(0, i)
    const e12 = calculateEMA(slice, 12)
    const e26 = calculateEMA(slice, 26)
    macdValues.push(e12 - e26)
  }
  
  const signal = macdValues.length >= 9 ? calculateEMA(macdValues, 9) : macd
  const histogram = macd - signal
  
  return { macd, signal, histogram }
}

// Calculate all technical indicators
export function calculateIndicators(priceData: PriceData[]): TechnicalIndicators {
  const closes = priceData.map(p => p.close)
  const volumes = priceData.map(p => p.volume)
  const currentPrice = closes[closes.length - 1]
  
  // Moving Averages
  const sma20 = calculateSMA(closes, 20)
  const sma50 = calculateSMA(closes, 50)
  const sma200 = calculateSMA(closes, 200) || calculateSMA(closes, closes.length) // Fallback if not enough data
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)
  
  // RSI
  const rsi = calculateRSI(closes, 14)
  const rsiSignal: 'oversold' | 'overbought' | 'neutral' = 
    rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral'
  
  // MACD
  const { macd, signal, histogram } = calculateMACD(closes)
  const macdSignalType: 'bullish' | 'bearish' | 'neutral' =
    histogram > 0 && macd > signal ? 'bullish' :
    histogram < 0 && macd < signal ? 'bearish' : 'neutral'
  
  // Volume Analysis
  const avgVolume = calculateSMA(volumes, 20)
  const currentVolume = volumes[volumes.length - 1]
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1
  const volumeSignal: 'high' | 'normal' | 'low' =
    volumeRatio > 1.5 ? 'high' : volumeRatio < 0.5 ? 'low' : 'normal'
  
  // Trend Analysis
  const priceVsSma50 = sma50 > 0 ? ((currentPrice - sma50) / sma50) * 100 : 0
  const priceVsSma200 = sma200 > 0 ? ((currentPrice - sma200) / sma200) * 100 : 0
  const trendSignal: 'bullish' | 'bearish' | 'neutral' =
    currentPrice > sma50 && sma50 > sma200 ? 'bullish' :
    currentPrice < sma50 && sma50 < sma200 ? 'bearish' : 'neutral'
  
  // Calculate Momentum Score (0-100)
  let score = 50 // Start neutral
  
  // RSI contribution (-15 to +15)
  if (rsi < 30) score += 15 // Oversold = bullish
  else if (rsi < 40) score += 10
  else if (rsi > 70) score -= 15 // Overbought = bearish
  else if (rsi > 60) score -= 5
  
  // MACD contribution (-15 to +15)
  if (histogram > 0 && macd > signal) score += 15
  else if (histogram > 0) score += 8
  else if (histogram < 0 && macd < signal) score -= 15
  else if (histogram < 0) score -= 8
  
  // Trend contribution (-10 to +10)
  if (currentPrice > sma50 && sma50 > sma200) score += 10
  else if (currentPrice > sma50) score += 5
  else if (currentPrice < sma50 && sma50 < sma200) score -= 10
  else if (currentPrice < sma50) score -= 5
  
  // Volume contribution (-5 to +10)
  if (volumeRatio > 2 && histogram > 0) score += 10 // High volume + bullish
  else if (volumeRatio > 1.5 && histogram > 0) score += 5
  else if (volumeRatio > 2 && histogram < 0) score -= 5 // High volume + bearish
  
  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score))
  
  return {
    rsi,
    macd,
    macdSignal: signal,
    macdHistogram: histogram,
    sma20,
    sma50,
    sma200,
    ema12,
    ema26,
    rsiSignal,
    macdSignal: macdSignalType,
    trendSignal,
    volumeRatio,
    volumeSignal,
    priceVsSma50,
    priceVsSma200,
    momentumScore: Math.round(score),
  }
}

// Generate trading signal with entry/exit points
export function generateSignal(
  symbol: string,
  name: string,
  priceData: PriceData[],
  indicators: TechnicalIndicators
): MomentumSignal {
  const currentPrice = priceData[priceData.length - 1].close
  const previousPrice = priceData[priceData.length - 2]?.close || currentPrice
  const change = currentPrice - previousPrice
  const changePercent = (change / previousPrice) * 100
  
  // Collect bullish and bearish signals
  const bullishSignals: string[] = []
  const bearishSignals: string[] = []
  
  // RSI signals
  if (indicators.rsi < 30) bullishSignals.push('RSI oversold (<30)')
  else if (indicators.rsi < 40) bullishSignals.push('RSI approaching oversold')
  else if (indicators.rsi > 70) bearishSignals.push('RSI overbought (>70)')
  else if (indicators.rsi > 60) bearishSignals.push('RSI approaching overbought')
  
  // MACD signals
  if (indicators.macdHistogram > 0 && indicators.macd > indicators.macdSignal) {
    bullishSignals.push('MACD bullish crossover')
  } else if (indicators.macdHistogram < 0 && indicators.macd < indicators.macdSignal) {
    bearishSignals.push('MACD bearish crossover')
  }
  
  // Trend signals
  if (indicators.trendSignal === 'bullish') {
    bullishSignals.push('Price above 50 & 200 MA (uptrend)')
  } else if (indicators.trendSignal === 'bearish') {
    bearishSignals.push('Price below 50 & 200 MA (downtrend)')
  }
  
  // Volume signals
  if (indicators.volumeRatio > 1.5 && indicators.macdHistogram > 0) {
    bullishSignals.push(`High volume (${indicators.volumeRatio.toFixed(1)}x avg)`)
  }
  
  // 52-week position
  if (indicators.priceVsSma50 > 0 && indicators.priceVsSma50 < 5) {
    bullishSignals.push('Near 50-day support')
  }
  
  // Determine signal
  const score = indicators.momentumScore
  let signal: MomentumSignal['signal'] = 'HOLD'
  
  if (score >= 75) signal = 'STRONG_BUY'
  else if (score >= 60) signal = 'BUY'
  else if (score <= 25) signal = 'STRONG_SELL'
  else if (score <= 40) signal = 'SELL'
  
  // Calculate trade setup
  const atr = calculateATR(priceData, 14)
  const stopLossPercent = 0.08 // 8% stop loss
  const stopLoss = currentPrice * (1 - stopLossPercent)
  
  // Target based on momentum score
  const targetPercent = score >= 70 ? 0.20 : score >= 60 ? 0.15 : 0.10
  const targetPrice = currentPrice * (1 + targetPercent)
  
  const potentialGain = targetPercent * 100
  const riskReward = potentialGain / (stopLossPercent * 100)
  
  return {
    symbol,
    name,
    price: currentPrice,
    change,
    changePercent,
    signal,
    strength: score,
    rsi: indicators.rsi,
    macdHistogram: indicators.macdHistogram,
    volumeRatio: indicators.volumeRatio,
    trendStrength: Math.abs(indicators.priceVsSma50),
    entryPrice: currentPrice,
    targetPrice,
    stopLoss,
    potentialGain,
    riskReward,
    bullishSignals,
    bearishSignals,
  }
}

// Calculate Average True Range (for volatility/stop loss)
function calculateATR(priceData: PriceData[], period: number = 14): number {
  if (priceData.length < period + 1) return 0
  
  const trueRanges: number[] = []
  
  for (let i = 1; i < priceData.length; i++) {
    const high = priceData[i].high
    const low = priceData[i].low
    const prevClose = priceData[i - 1].close
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    )
    trueRanges.push(tr)
  }
  
  return calculateSMA(trueRanges, period)
}
