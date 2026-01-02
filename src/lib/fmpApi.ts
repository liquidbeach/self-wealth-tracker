// FMP (Financial Modeling Prep) API utilities
// Documentation: https://site.financialmodelingprep.com/developer/docs

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3'

// Get API key from environment
const getApiKey = () => {
  return process.env.FMP_API_KEY || process.env.NEXT_PUBLIC_FMP_API_KEY || ''
}

// Types
export interface StockScreenerResult {
  symbol: string
  companyName: string
  marketCap: number
  sector: string
  industry: string
  beta: number
  price: number
  lastAnnualDividend: number
  volume: number
  exchange: string
  exchangeShortName: string
  country: string
  isEtf: boolean
  isActivelyTrading: boolean
}

export interface CompanyProfile {
  symbol: string
  companyName: string
  currency: string
  exchange: string
  exchangeShortName: string
  price: number
  mktCap: number
  sector: string
  industry: string
  description: string
  website: string
  ceo: string
  country: string
  fullTimeEmployees: string
  ipoDate: string
  image: string
  beta: number
  volAvg: number
  lastDiv: number
  range: string
  changes: number
  dcfDiff: number
  dcf: number
  isEtf: boolean
  isActivelyTrading: boolean
}

export interface KeyMetrics {
  symbol: string
  date: string
  period: string
  revenuePerShare: number
  netIncomePerShare: number
  operatingCashFlowPerShare: number
  freeCashFlowPerShare: number
  cashPerShare: number
  bookValuePerShare: number
  tangibleBookValuePerShare: number
  shareholdersEquityPerShare: number
  interestDebtPerShare: number
  marketCap: number
  enterpriseValue: number
  peRatio: number
  priceToSalesRatio: number
  pocfratio: number
  pfcfRatio: number
  pbRatio: number
  ptbRatio: number
  evToSales: number
  enterpriseValueOverEBITDA: number
  evToOperatingCashFlow: number
  evToFreeCashFlow: number
  earningsYield: number
  freeCashFlowYield: number
  debtToEquity: number
  debtToAssets: number
  netDebtToEBITDA: number
  currentRatio: number
  interestCoverage: number
  incomeQuality: number
  dividendYield: number
  payoutRatio: number
  salesGeneralAndAdministrativeToRevenue: number
  researchAndDevelopmentToRevenue: number
  intangiblesToTotalAssets: number
  capexToOperatingCashFlow: number
  capexToRevenue: number
  capexToDepreciation: number
  stockBasedCompensationToRevenue: number
  grahamNumber: number
  roic: number
  returnOnTangibleAssets: number
  grahamNetNet: number
  workingCapital: number
  tangibleAssetValue: number
  netCurrentAssetValue: number
  investedCapital: number
  averageReceivables: number
  averagePayables: number
  averageInventory: number
  daysSalesOutstanding: number
  daysPayablesOutstanding: number
  daysOfInventoryOnHand: number
  receivablesTurnover: number
  payablesTurnover: number
  inventoryTurnover: number
  roe: number
  capexPerShare: number
}

export interface FinancialRatios {
  symbol: string
  date: string
  period: string
  currentRatio: number
  quickRatio: number
  cashRatio: number
  daysOfSalesOutstanding: number
  daysOfInventoryOutstanding: number
  operatingCycle: number
  daysOfPayablesOutstanding: number
  cashConversionCycle: number
  grossProfitMargin: number
  operatingProfitMargin: number
  pretaxProfitMargin: number
  netProfitMargin: number
  effectiveTaxRate: number
  returnOnAssets: number
  returnOnEquity: number
  returnOnCapitalEmployed: number
  netIncomePerEBT: number
  ebtPerEbit: number
  ebitPerRevenue: number
  debtRatio: number
  debtEquityRatio: number
  longTermDebtToCapitalization: number
  totalDebtToCapitalization: number
  interestCoverage: number
  cashFlowToDebtRatio: number
  companyEquityMultiplier: number
  receivablesTurnover: number
  payablesTurnover: number
  inventoryTurnover: number
  fixedAssetTurnover: number
  assetTurnover: number
  operatingCashFlowPerShare: number
  freeCashFlowPerShare: number
  cashPerShare: number
  payoutRatio: number
  operatingCashFlowSalesRatio: number
  freeCashFlowOperatingCashFlowRatio: number
  cashFlowCoverageRatios: number
  shortTermCoverageRatios: number
  capitalExpenditureCoverageRatio: number
  dividendPaidAndCapexCoverageRatio: number
  dividendPayoutRatio: number
  priceBookValueRatio: number
  priceToBookRatio: number
  priceToSalesRatio: number
  priceEarningsRatio: number
  priceToFreeCashFlowsRatio: number
  priceToOperatingCashFlowsRatio: number
  priceCashFlowRatio: number
  priceEarningsToGrowthRatio: number
  priceSalesRatio: number
  dividendYield: number
  enterpriseValueMultiple: number
  priceFairValue: number
}

export interface IncomeGrowth {
  symbol: string
  date: string
  period: string
  revenueGrowth: number
  grossProfitGrowth: number
  ebitgrowth: number
  operatingIncomeGrowth: number
  netIncomeGrowth: number
  epsgrowth: number
  epsdilutedGrowth: number
  weightedAverageSharesGrowth: number
  weightedAverageSharesDilutedGrowth: number
  dividendsperShareGrowth: number
  operatingCashFlowGrowth: number
  freeCashFlowGrowth: number
  tenYRevenueGrowthPerShare: number
  fiveYRevenueGrowthPerShare: number
  threeYRevenueGrowthPerShare: number
  tenYOperatingCFGrowthPerShare: number
  fiveYOperatingCFGrowthPerShare: number
  threeYOperatingCFGrowthPerShare: number
  tenYNetIncomeGrowthPerShare: number
  fiveYNetIncomeGrowthPerShare: number
  threeYNetIncomeGrowthPerShare: number
  tenYShareholdersEquityGrowthPerShare: number
  fiveYShareholdersEquityGrowthPerShare: number
  threeYShareholdersEquityGrowthPerShare: number
  tenYDividendperShareGrowthPerShare: number
  fiveYDividendperShareGrowthPerShare: number
  threeYDividendperShareGrowthPerShare: number
}

// API Functions

export async function fetchStockScreener(params: {
  marketCapMoreThan?: number
  marketCapLowerThan?: number
  priceMoreThan?: number
  priceLowerThan?: number
  betaMoreThan?: number
  betaLowerThan?: number
  volumeMoreThan?: number
  volumeLowerThan?: number
  dividendMoreThan?: number
  dividendLowerThan?: number
  isEtf?: boolean
  isActivelyTrading?: boolean
  sector?: string
  industry?: string
  country?: string
  exchange?: string
  limit?: number
}): Promise<StockScreenerResult[]> {
  const apiKey = getApiKey()
  const queryParams = new URLSearchParams()
  
  if (params.marketCapMoreThan) queryParams.append('marketCapMoreThan', params.marketCapMoreThan.toString())
  if (params.marketCapLowerThan) queryParams.append('marketCapLowerThan', params.marketCapLowerThan.toString())
  if (params.priceMoreThan) queryParams.append('priceMoreThan', params.priceMoreThan.toString())
  if (params.priceLowerThan) queryParams.append('priceLowerThan', params.priceLowerThan.toString())
  if (params.betaMoreThan) queryParams.append('betaMoreThan', params.betaMoreThan.toString())
  if (params.betaLowerThan) queryParams.append('betaLowerThan', params.betaLowerThan.toString())
  if (params.volumeMoreThan) queryParams.append('volumeMoreThan', params.volumeMoreThan.toString())
  if (params.volumeLowerThan) queryParams.append('volumeLowerThan', params.volumeLowerThan.toString())
  if (params.dividendMoreThan) queryParams.append('dividendMoreThan', params.dividendMoreThan.toString())
  if (params.dividendLowerThan) queryParams.append('dividendLowerThan', params.dividendLowerThan.toString())
  if (params.isEtf !== undefined) queryParams.append('isEtf', params.isEtf.toString())
  if (params.isActivelyTrading !== undefined) queryParams.append('isActivelyTrading', params.isActivelyTrading.toString())
  if (params.sector) queryParams.append('sector', params.sector)
  if (params.industry) queryParams.append('industry', params.industry)
  if (params.country) queryParams.append('country', params.country)
  if (params.exchange) queryParams.append('exchange', params.exchange)
  if (params.limit) queryParams.append('limit', params.limit.toString())
  
  queryParams.append('apikey', apiKey)
  
  const response = await fetch(`${FMP_BASE_URL}/stock-screener?${queryParams.toString()}`)
  if (!response.ok) throw new Error('Failed to fetch screener results')
  
  return response.json()
}

export async function fetchCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  const apiKey = getApiKey()
  const response = await fetch(`${FMP_BASE_URL}/profile/${symbol}?apikey=${apiKey}`)
  if (!response.ok) return null
  
  const data = await response.json()
  return data[0] || null
}

export async function fetchKeyMetrics(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 1): Promise<KeyMetrics[]> {
  const apiKey = getApiKey()
  const response = await fetch(`${FMP_BASE_URL}/key-metrics/${symbol}?period=${period}&limit=${limit}&apikey=${apiKey}`)
  if (!response.ok) return []
  
  return response.json()
}

export async function fetchFinancialRatios(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 1): Promise<FinancialRatios[]> {
  const apiKey = getApiKey()
  const response = await fetch(`${FMP_BASE_URL}/ratios/${symbol}?period=${period}&limit=${limit}&apikey=${apiKey}`)
  if (!response.ok) return []
  
  return response.json()
}

export async function fetchIncomeGrowth(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 1): Promise<IncomeGrowth[]> {
  const apiKey = getApiKey()
  const response = await fetch(`${FMP_BASE_URL}/income-statement-growth/${symbol}?period=${period}&limit=${limit}&apikey=${apiKey}`)
  if (!response.ok) return []
  
  return response.json()
}

export async function fetchBatchQuotes(symbols: string[]): Promise<any[]> {
  const apiKey = getApiKey()
  const symbolList = symbols.join(',')
  const response = await fetch(`${FMP_BASE_URL}/quote/${symbolList}?apikey=${apiKey}`)
  if (!response.ok) return []
  
  return response.json()
}

// Fetch multiple stocks' key metrics in batch
export async function fetchBatchKeyMetrics(symbols: string[]): Promise<Map<string, KeyMetrics>> {
  const results = new Map<string, KeyMetrics>()
  
  // Process in batches of 5 to avoid rate limits
  const batchSize = 5
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const promises = batch.map(symbol => fetchKeyMetrics(symbol, 'annual', 1))
    const batchResults = await Promise.all(promises)
    
    batchResults.forEach((metrics, index) => {
      if (metrics && metrics.length > 0) {
        results.set(batch[index], metrics[0])
      }
    })
    
    // Small delay between batches
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  return results
}

// Calculate quality score based on key metrics
export function calculateQualityScore(metrics: KeyMetrics, ratios?: FinancialRatios): number {
  let score = 0
  let factors = 0
  
  // ROIC (Return on Invested Capital) - very important
  if (metrics.roic !== undefined && metrics.roic !== null) {
    if (metrics.roic > 20) score += 25
    else if (metrics.roic > 15) score += 20
    else if (metrics.roic > 10) score += 15
    else if (metrics.roic > 5) score += 10
    else score += 5
    factors++
  }
  
  // ROE (Return on Equity)
  if (metrics.roe !== undefined && metrics.roe !== null) {
    if (metrics.roe > 20) score += 20
    else if (metrics.roe > 15) score += 15
    else if (metrics.roe > 10) score += 10
    else score += 5
    factors++
  }
  
  // Debt to Equity
  if (metrics.debtToEquity !== undefined && metrics.debtToEquity !== null) {
    if (metrics.debtToEquity < 0.3) score += 20
    else if (metrics.debtToEquity < 0.5) score += 15
    else if (metrics.debtToEquity < 1) score += 10
    else if (metrics.debtToEquity < 2) score += 5
    factors++
  }
  
  // Current Ratio (Liquidity)
  if (metrics.currentRatio !== undefined && metrics.currentRatio !== null) {
    if (metrics.currentRatio > 2) score += 15
    else if (metrics.currentRatio > 1.5) score += 12
    else if (metrics.currentRatio > 1) score += 8
    else score += 3
    factors++
  }
  
  // Free Cash Flow Yield
  if (metrics.freeCashFlowYield !== undefined && metrics.freeCashFlowYield !== null) {
    if (metrics.freeCashFlowYield > 10) score += 20
    else if (metrics.freeCashFlowYield > 5) score += 15
    else if (metrics.freeCashFlowYield > 2) score += 10
    else score += 5
    factors++
  }
  
  // Normalize to 100
  return factors > 0 ? Math.round((score / factors) * (100 / 25)) : 0
}

// Calculate valuation score
export function calculateValuationScore(metrics: KeyMetrics): number {
  let score = 0
  let factors = 0
  
  // P/E Ratio
  if (metrics.peRatio !== undefined && metrics.peRatio !== null && metrics.peRatio > 0) {
    if (metrics.peRatio < 10) score += 25
    else if (metrics.peRatio < 15) score += 20
    else if (metrics.peRatio < 20) score += 15
    else if (metrics.peRatio < 30) score += 10
    else score += 5
    factors++
  }
  
  // P/B Ratio
  if (metrics.pbRatio !== undefined && metrics.pbRatio !== null && metrics.pbRatio > 0) {
    if (metrics.pbRatio < 1) score += 25
    else if (metrics.pbRatio < 2) score += 20
    else if (metrics.pbRatio < 3) score += 15
    else if (metrics.pbRatio < 5) score += 10
    else score += 5
    factors++
  }
  
  // EV/EBITDA
  if (metrics.enterpriseValueOverEBITDA !== undefined && metrics.enterpriseValueOverEBITDA !== null && metrics.enterpriseValueOverEBITDA > 0) {
    if (metrics.enterpriseValueOverEBITDA < 8) score += 25
    else if (metrics.enterpriseValueOverEBITDA < 12) score += 20
    else if (metrics.enterpriseValueOverEBITDA < 15) score += 15
    else if (metrics.enterpriseValueOverEBITDA < 20) score += 10
    else score += 5
    factors++
  }
  
  // Price to Sales
  if (metrics.priceToSalesRatio !== undefined && metrics.priceToSalesRatio !== null && metrics.priceToSalesRatio > 0) {
    if (metrics.priceToSalesRatio < 1) score += 25
    else if (metrics.priceToSalesRatio < 2) score += 20
    else if (metrics.priceToSalesRatio < 3) score += 15
    else if (metrics.priceToSalesRatio < 5) score += 10
    else score += 5
    factors++
  }
  
  // Normalize to 100
  return factors > 0 ? Math.round((score / factors) * (100 / 25)) : 0
}
