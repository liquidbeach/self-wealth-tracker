import { NextRequest, NextResponse } from 'next/server'

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3'

// Get API key - check both with and without NEXT_PUBLIC prefix
function getApiKey(): string {
  return process.env.FMP_API_KEY || process.env.NEXT_PUBLIC_FMP_API_KEY || ''
}

// FMP sector names (must match exactly)
const SECTOR_MAP: Record<string, string> = {
  'Technology': 'Technology',
  'Healthcare': 'Healthcare',
  'Financials': 'Financial Services',
  'Consumer Cyclical': 'Consumer Cyclical',
  'Consumer Defensive': 'Consumer Defensive',
  'Industrials': 'Industrials',
  'Energy': 'Energy',
  'Basic Materials': 'Basic Materials',
  'Utilities': 'Utilities',
  'Real Estate': 'Real Estate',
  'Communication Services': 'Communication Services',
}

// Fetch screener results from FMP
async function fetchScreenerResults(params: URLSearchParams) {
  const apiKey = getApiKey()
  
  if (!apiKey) {
    throw new Error('FMP API key not configured')
  }
  
  params.append('apikey', apiKey)
  const url = `${FMP_BASE_URL}/stock-screener?${params.toString()}`
  
  console.log('Fetching screener:', url.replace(apiKey, 'HIDDEN'))
  
  const response = await fetch(url)
  
  if (!response.ok) {
    const text = await response.text()
    console.error('FMP Error:', response.status, text)
    throw new Error(`FMP API error: ${response.status}`)
  }
  
  return response.json()
}

// Fetch key metrics for a symbol
async function fetchKeyMetrics(symbol: string) {
  const apiKey = getApiKey()
  
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/key-metrics/${symbol}?period=annual&limit=1&apikey=${apiKey}`
    )
    if (!response.ok) return null
    const data = await response.json()
    return data[0] || null
  } catch (error) {
    console.error(`Error fetching metrics for ${symbol}:`, error)
    return null
  }
}

// Calculate quality score
function calculateQualityScore(metrics: any): number {
  if (!metrics) return 50 // Default middle score if no metrics
  
  let score = 0
  let factors = 0
  
  // ROIC
  if (metrics.roic != null && !isNaN(metrics.roic)) {
    if (metrics.roic > 20) score += 25
    else if (metrics.roic > 15) score += 20
    else if (metrics.roic > 10) score += 15
    else if (metrics.roic > 5) score += 10
    else score += 5
    factors++
  }
  
  // ROE
  if (metrics.roe != null && !isNaN(metrics.roe)) {
    if (metrics.roe > 20) score += 20
    else if (metrics.roe > 15) score += 15
    else if (metrics.roe > 10) score += 10
    else score += 5
    factors++
  }
  
  // Debt to Equity (lower is better)
  if (metrics.debtToEquity != null && !isNaN(metrics.debtToEquity)) {
    if (metrics.debtToEquity < 0.3) score += 20
    else if (metrics.debtToEquity < 0.5) score += 15
    else if (metrics.debtToEquity < 1) score += 10
    else if (metrics.debtToEquity < 2) score += 5
    factors++
  }
  
  // Current Ratio
  if (metrics.currentRatio != null && !isNaN(metrics.currentRatio)) {
    if (metrics.currentRatio > 2) score += 15
    else if (metrics.currentRatio > 1.5) score += 12
    else if (metrics.currentRatio > 1) score += 8
    else score += 3
    factors++
  }
  
  return factors > 0 ? Math.round((score / factors) * 4) : 50
}

// Calculate valuation score
function calculateValuationScore(metrics: any): number {
  if (!metrics) return 50 // Default middle score if no metrics
  
  let score = 0
  let factors = 0
  
  // P/E (lower is better for value)
  if (metrics.peRatio != null && !isNaN(metrics.peRatio) && metrics.peRatio > 0) {
    if (metrics.peRatio < 10) score += 25
    else if (metrics.peRatio < 15) score += 20
    else if (metrics.peRatio < 20) score += 15
    else if (metrics.peRatio < 30) score += 10
    else score += 5
    factors++
  }
  
  // P/B (lower is better)
  if (metrics.pbRatio != null && !isNaN(metrics.pbRatio) && metrics.pbRatio > 0) {
    if (metrics.pbRatio < 1) score += 25
    else if (metrics.pbRatio < 2) score += 20
    else if (metrics.pbRatio < 3) score += 15
    else if (metrics.pbRatio < 5) score += 10
    else score += 5
    factors++
  }
  
  // EV/EBITDA (lower is better)
  if (metrics.enterpriseValueOverEBITDA != null && !isNaN(metrics.enterpriseValueOverEBITDA) && metrics.enterpriseValueOverEBITDA > 0) {
    if (metrics.enterpriseValueOverEBITDA < 8) score += 25
    else if (metrics.enterpriseValueOverEBITDA < 12) score += 20
    else if (metrics.enterpriseValueOverEBITDA < 15) score += 15
    else if (metrics.enterpriseValueOverEBITDA < 20) score += 10
    else score += 5
    factors++
  }
  
  return factors > 0 ? Math.round((score / factors) * 4) : 50
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      marketCapMin = 1000000000,  // $1B minimum by default
      marketCapMax,
      sector,
      country = 'US',
      limit = 25,
      sortBy = 'total',
    } = body

    // Check API key
    const apiKey = getApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'FMP API key not configured. Please add FMP_API_KEY to environment variables.' },
        { status: 500 }
      )
    }

    // Build screener params
    const params = new URLSearchParams()
    params.append('marketCapMoreThan', marketCapMin.toString())
    if (marketCapMax) params.append('marketCapLowerThan', marketCapMax.toString())
    
    // Map sector name to FMP format
    if (sector && sector !== 'All Sectors') {
      const fmpSector = SECTOR_MAP[sector] || sector
      params.append('sector', fmpSector)
    }
    
    if (country) params.append('country', country)
    params.append('exchange', 'NYSE,NASDAQ')
    params.append('isEtf', 'false')
    params.append('isActivelyTrading', 'true')
    params.append('limit', '100') // Get more to filter

    // Fetch screener results
    let screenerResults
    try {
      screenerResults = await fetchScreenerResults(params)
    } catch (error: any) {
      console.error('Screener fetch error:', error)
      return NextResponse.json(
        { error: `Failed to fetch from FMP: ${error.message}` },
        { status: 500 }
      )
    }

    if (!screenerResults || !Array.isArray(screenerResults) || screenerResults.length === 0) {
      return NextResponse.json({ 
        stocks: [], 
        message: 'No stocks found matching criteria',
        debug: { marketCapMin, sector, country }
      })
    }

    // Take top stocks for detailed analysis
    const topStocks = screenerResults.slice(0, Math.min(limit, 30))
    const stocksWithScores = []

    // Process in small batches
    const batchSize = 3
    for (let i = 0; i < topStocks.length; i += batchSize) {
      const batch = topStocks.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (stock: any) => {
        try {
          const metrics = await fetchKeyMetrics(stock.symbol)
          const qualityScore = calculateQualityScore(metrics)
          const valuationScore = calculateValuationScore(metrics)
          const totalScore = Math.round((qualityScore + valuationScore) / 2)

          return {
            symbol: stock.symbol,
            companyName: stock.companyName,
            sector: stock.sector,
            industry: stock.industry || 'N/A',
            marketCap: stock.marketCap,
            price: stock.price,
            exchange: stock.exchangeShortName || stock.exchange,
            // Metrics
            peRatio: metrics?.peRatio,
            pbRatio: metrics?.pbRatio,
            roic: metrics?.roic,
            roe: metrics?.roe,
            debtToEquity: metrics?.debtToEquity,
            currentRatio: metrics?.currentRatio,
            dividendYield: metrics?.dividendYield,
            freeCashFlowYield: metrics?.freeCashFlowYield,
            // Scores
            qualityScore,
            valuationScore,
            totalScore,
          }
        } catch (error) {
          console.error(`Error processing ${stock.symbol}:`, error)
          return {
            symbol: stock.symbol,
            companyName: stock.companyName,
            sector: stock.sector,
            industry: stock.industry || 'N/A',
            marketCap: stock.marketCap,
            price: stock.price,
            exchange: stock.exchangeShortName || stock.exchange,
            qualityScore: 50,
            valuationScore: 50,
            totalScore: 50,
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      stocksWithScores.push(...batchResults.filter(Boolean))

      // Rate limiting delay
      if (i + batchSize < topStocks.length) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    }

    // Sort by selected criteria
    let sorted = [...stocksWithScores]
    if (sortBy === 'quality') {
      sorted.sort((a, b) => (b?.qualityScore || 0) - (a?.qualityScore || 0))
    } else if (sortBy === 'valuation') {
      sorted.sort((a, b) => (b?.valuationScore || 0) - (a?.valuationScore || 0))
    } else {
      sorted.sort((a, b) => (b?.totalScore || 0) - (a?.totalScore || 0))
    }

    // Return results with rank
    const finalResults = sorted.slice(0, limit).map((stock, index) => ({
      ...stock,
      rank: index + 1,
    }))

    return NextResponse.json({
      stocks: finalResults,
      total: finalResults.length,
      filters: { marketCapMin, marketCapMax, sector, country }
    })

  } catch (error: any) {
    console.error('Screener error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to run screener' },
      { status: 500 }
    )
  }
}

export async function GET() {
  const hasKey = !!getApiKey()
  return NextResponse.json({
    message: 'Use POST to run screener',
    apiKeyConfigured: hasKey,
    example: {
      marketCapMin: 1000000000,
      sector: 'Technology',
      limit: 25
    }
  })
}
