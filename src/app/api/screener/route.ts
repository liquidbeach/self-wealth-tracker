import { NextRequest, NextResponse } from 'next/server'

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3'
const FMP_API_KEY = process.env.FMP_API_KEY || ''

// Fetch screener results from FMP
async function fetchScreenerResults(params: URLSearchParams) {
  params.append('apikey', FMP_API_KEY)
  const response = await fetch(`${FMP_BASE_URL}/stock-screener?${params.toString()}`)
  if (!response.ok) throw new Error('Failed to fetch screener')
  return response.json()
}

// Fetch key metrics for a symbol
async function fetchKeyMetrics(symbol: string) {
  const response = await fetch(
    `${FMP_BASE_URL}/key-metrics/${symbol}?period=annual&limit=1&apikey=${FMP_API_KEY}`
  )
  if (!response.ok) return null
  const data = await response.json()
  return data[0] || null
}

// Fetch financial ratios for a symbol
async function fetchRatios(symbol: string) {
  const response = await fetch(
    `${FMP_BASE_URL}/ratios/${symbol}?period=annual&limit=1&apikey=${FMP_API_KEY}`
  )
  if (!response.ok) return null
  const data = await response.json()
  return data[0] || null
}

// Calculate quality score
function calculateQualityScore(metrics: any): number {
  if (!metrics) return 0
  
  let score = 0
  let factors = 0
  
  // ROIC
  if (metrics.roic != null) {
    if (metrics.roic > 20) score += 25
    else if (metrics.roic > 15) score += 20
    else if (metrics.roic > 10) score += 15
    else if (metrics.roic > 5) score += 10
    else score += 5
    factors++
  }
  
  // ROE
  if (metrics.roe != null) {
    if (metrics.roe > 20) score += 20
    else if (metrics.roe > 15) score += 15
    else if (metrics.roe > 10) score += 10
    else score += 5
    factors++
  }
  
  // Debt to Equity
  if (metrics.debtToEquity != null) {
    if (metrics.debtToEquity < 0.3) score += 20
    else if (metrics.debtToEquity < 0.5) score += 15
    else if (metrics.debtToEquity < 1) score += 10
    else if (metrics.debtToEquity < 2) score += 5
    factors++
  }
  
  // Current Ratio
  if (metrics.currentRatio != null) {
    if (metrics.currentRatio > 2) score += 15
    else if (metrics.currentRatio > 1.5) score += 12
    else if (metrics.currentRatio > 1) score += 8
    else score += 3
    factors++
  }
  
  return factors > 0 ? Math.round((score / factors) * 4) : 0
}

// Calculate valuation score
function calculateValuationScore(metrics: any): number {
  if (!metrics) return 0
  
  let score = 0
  let factors = 0
  
  // P/E
  if (metrics.peRatio != null && metrics.peRatio > 0) {
    if (metrics.peRatio < 10) score += 25
    else if (metrics.peRatio < 15) score += 20
    else if (metrics.peRatio < 20) score += 15
    else if (metrics.peRatio < 30) score += 10
    else score += 5
    factors++
  }
  
  // P/B
  if (metrics.pbRatio != null && metrics.pbRatio > 0) {
    if (metrics.pbRatio < 1) score += 25
    else if (metrics.pbRatio < 2) score += 20
    else if (metrics.pbRatio < 3) score += 15
    else if (metrics.pbRatio < 5) score += 10
    else score += 5
    factors++
  }
  
  // EV/EBITDA
  if (metrics.enterpriseValueOverEBITDA != null && metrics.enterpriseValueOverEBITDA > 0) {
    if (metrics.enterpriseValueOverEBITDA < 8) score += 25
    else if (metrics.enterpriseValueOverEBITDA < 12) score += 20
    else if (metrics.enterpriseValueOverEBITDA < 15) score += 15
    else if (metrics.enterpriseValueOverEBITDA < 20) score += 10
    else score += 5
    factors++
  }
  
  return factors > 0 ? Math.round((score / factors) * 4) : 0
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      marketCapMin = 1000000000,  // $1B minimum by default
      marketCapMax,
      sector,
      country = 'US',
      exchange = 'NYSE,NASDAQ',
      limit = 50,
      sortBy = 'total',  // 'total', 'quality', 'valuation'
    } = body

    // Step 1: Get screener results from FMP
    const params = new URLSearchParams()
    params.append('marketCapMoreThan', marketCapMin.toString())
    if (marketCapMax) params.append('marketCapLowerThan', marketCapMax.toString())
    if (sector) params.append('sector', sector)
    if (country) params.append('country', country)
    params.append('exchange', exchange)
    params.append('isEtf', 'false')
    params.append('isActivelyTrading', 'true')
    params.append('limit', Math.min(limit * 2, 200).toString())  // Get more for filtering

    const screenerResults = await fetchScreenerResults(params)

    if (!screenerResults || screenerResults.length === 0) {
      return NextResponse.json({ stocks: [], message: 'No results found' })
    }

    // Step 2: Fetch key metrics for top stocks (limit API calls)
    const topStocks = screenerResults.slice(0, Math.min(limit, 50))
    const stocksWithScores = []

    // Process in batches to avoid rate limits
    const batchSize = 5
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
            industry: stock.industry,
            marketCap: stock.marketCap,
            price: stock.price,
            exchange: stock.exchangeShortName,
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
          console.error(`Error fetching metrics for ${stock.symbol}:`, error)
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      stocksWithScores.push(...batchResults.filter(Boolean))

      // Rate limiting delay
      if (i + batchSize < topStocks.length) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // Step 3: Sort by selected criteria
    let sorted = [...stocksWithScores]
    if (sortBy === 'quality') {
      sorted.sort((a, b) => (b?.qualityScore || 0) - (a?.qualityScore || 0))
    } else if (sortBy === 'valuation') {
      sorted.sort((a, b) => (b?.valuationScore || 0) - (a?.valuationScore || 0))
    } else {
      sorted.sort((a, b) => (b?.totalScore || 0) - (a?.totalScore || 0))
    }

    // Step 4: Return top results
    const finalResults = sorted.slice(0, limit).map((stock, index) => ({
      ...stock,
      rank: index + 1,
    }))

    return NextResponse.json({
      stocks: finalResults,
      total: finalResults.length,
      filters: { marketCapMin, sector, country, exchange }
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
  return NextResponse.json({
    message: 'Use POST to run screener',
    example: {
      marketCapMin: 1000000000,
      sector: 'Technology',
      limit: 25
    }
  })
}
