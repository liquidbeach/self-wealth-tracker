'use client'

import { useState } from 'react'
import { 
  Search, 
  Filter, 
  TrendingUp, 
  Star,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles
} from 'lucide-react'

interface ScreenerResult {
  rank: number
  symbol: string
  companyName: string
  sector: string
  industry: string
  marketCap: number
  price: number
  exchange: string
  peRatio: number | null
  pbRatio: number | null
  roic: number | null
  roe: number | null
  debtToEquity: number | null
  currentRatio: number | null
  dividendYield: number | null
  freeCashFlowYield: number | null
  qualityScore: number
  valuationScore: number
  totalScore: number
}

const SECTORS = [
  'All Sectors',
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Industrials',
  'Energy',
  'Basic Materials',
  'Utilities',
  'Real Estate',
  'Communication Services',
]

const MARKET_CAP_OPTIONS = [
  { label: 'All Sizes', min: 0, max: undefined },
  { label: 'Mega Cap (>$200B)', min: 200000000000, max: undefined },
  { label: 'Large Cap ($10B-$200B)', min: 10000000000, max: 200000000000 },
  { label: 'Mid Cap ($2B-$10B)', min: 2000000000, max: 10000000000 },
  { label: 'Small Cap ($300M-$2B)', min: 300000000, max: 2000000000 },
]

export default function AssessorPage() {
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  
  // Filters
  const [sector, setSector] = useState('All Sectors')
  const [marketCapIndex, setMarketCapIndex] = useState(1) // Default to Large Cap
  const [sortBy, setSortBy] = useState<'total' | 'quality' | 'valuation'>('total')
  const [showFilters, setShowFilters] = useState(true)
  
  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const runScreener = async () => {
    setLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const marketCap = MARKET_CAP_OPTIONS[marketCapIndex]
      
      const response = await fetch('/api/screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketCapMin: marketCap.min || 1000000000,
          marketCapMax: marketCap.max,
          sector: sector === 'All Sectors' ? undefined : sector,
          limit: 25,
          sortBy,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run screener')
      }

      setResults(data.stocks || [])
    } catch (err: any) {
      setError(err.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (symbol: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(symbol)) {
      newExpanded.delete(symbol)
    } else {
      newExpanded.add(symbol)
    }
    setExpandedRows(newExpanded)
  }

  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
    return `$${value.toLocaleString()}`
  }

  const formatPercent = (value: number | null | undefined) => {
    if (value == null) return '-'
    return `${value.toFixed(1)}%`
  }

  const formatRatio = (value: number | null | undefined) => {
    if (value == null) return '-'
    return value.toFixed(2)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    if (score >= 40) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Poor'
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stock Assessor</h1>
        <p className="text-slate-500">Find quality stocks at reasonable valuations</p>
      </div>

      {/* Filters */}
      <div className="card">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <span className="font-medium text-slate-900">Filters</span>
          </div>
          {showFilters ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Sector */}
              <div>
                <label className="text-sm text-slate-600">Sector</label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="input mt-1"
                >
                  {SECTORS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Market Cap */}
              <div>
                <label className="text-sm text-slate-600">Market Cap</label>
                <select
                  value={marketCapIndex}
                  onChange={(e) => setMarketCapIndex(Number(e.target.value))}
                  className="input mt-1"
                >
                  {MARKET_CAP_OPTIONS.map((opt, i) => (
                    <option key={i} value={i}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="text-sm text-slate-600">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="input mt-1"
                >
                  <option value="total">Total Score</option>
                  <option value="quality">Quality Score</option>
                  <option value="valuation">Valuation Score</option>
                </select>
              </div>

              {/* Run Button */}
              <div className="flex items-end">
                <button
                  onClick={runScreener}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Run Screener
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-4">
              Screens US stocks (NYSE, NASDAQ) and ranks by quality + valuation metrics.
              Uses ROIC, ROE, Debt/Equity, P/E, P/B, EV/EBITDA.
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Top {results.length} Stocks
            </h3>
            <span className="text-sm text-slate-400">
              Ranked by {sortBy === 'total' ? 'Total' : sortBy === 'quality' ? 'Quality' : 'Valuation'} Score
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-2" />
              <p className="text-slate-500">Analyzing stocks...</p>
              <p className="text-xs text-slate-400">This may take 15-30 seconds</p>
            </div>
          ) : results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 text-sm font-medium text-slate-500 w-12">#</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-slate-500">Stock</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-slate-500">Sector</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-slate-500">Mkt Cap</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-slate-500">Price</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-slate-500">Quality</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-slate-500">Value</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-slate-500">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((stock) => {
                    const isExpanded = expandedRows.has(stock.symbol)
                    return (
                      <>
                        <tr 
                          key={stock.symbol}
                          className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                          onClick={() => toggleExpanded(stock.symbol)}
                        >
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                              stock.rank <= 3 ? 'bg-amber-100 text-amber-700' :
                              stock.rank <= 10 ? 'bg-slate-100 text-slate-700' :
                              'text-slate-400'
                            }`}>
                              {stock.rank}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium text-slate-900">{stock.symbol}</p>
                              <p className="text-xs text-slate-500 truncate max-w-[200px]">{stock.companyName}</p>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-slate-600">{stock.sector}</td>
                          <td className="py-3 px-2 text-sm text-slate-900 text-right">{formatMarketCap(stock.marketCap)}</td>
                          <td className="py-3 px-2 text-sm text-slate-900 text-right">${stock.price?.toFixed(2)}</td>
                          <td className="py-3 px-2 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getScoreColor(stock.qualityScore)}`}>
                              {stock.qualityScore}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getScoreColor(stock.valuationScore)}`}>
                              {stock.valuationScore}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getScoreColor(stock.totalScore)}`}>
                              {stock.totalScore}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </td>
                        </tr>
                        {/* Expanded Details */}
                        {isExpanded && (
                          <tr key={`${stock.symbol}-details`}>
                            <td colSpan={9} className="bg-slate-50 px-4 py-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                <div>
                                  <p className="text-xs text-slate-500">P/E Ratio</p>
                                  <p className="font-medium text-slate-900">{formatRatio(stock.peRatio)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">P/B Ratio</p>
                                  <p className="font-medium text-slate-900">{formatRatio(stock.pbRatio)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">ROIC</p>
                                  <p className="font-medium text-slate-900">{formatPercent(stock.roic)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">ROE</p>
                                  <p className="font-medium text-slate-900">{formatPercent(stock.roe)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">Debt/Equity</p>
                                  <p className="font-medium text-slate-900">{formatRatio(stock.debtToEquity)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">Current Ratio</p>
                                  <p className="font-medium text-slate-900">{formatRatio(stock.currentRatio)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">Dividend Yield</p>
                                  <p className="font-medium text-slate-900">{formatPercent(stock.dividendYield)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">FCF Yield</p>
                                  <p className="font-medium text-slate-900">{formatPercent(stock.freeCashFlowYield)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">Industry</p>
                                  <p className="font-medium text-slate-900 text-sm">{stock.industry}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">Exchange</p>
                                  <p className="font-medium text-slate-900">{stock.exchange}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500">Rating</p>
                                  <p className={`font-medium ${getScoreColor(stock.totalScore).split(' ')[0]}`}>
                                    {getScoreBadge(stock.totalScore)}
                                  </p>
                                </div>
                                <div>
                                  <a
                                    href={`https://finance.yahoo.com/quote/${stock.symbol}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View Chart <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No results found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          )}
        </div>
      )}

      {/* Getting Started */}
      {!hasSearched && (
        <div className="card bg-gradient-to-br from-primary-50 to-blue-50 border-primary-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Welcome to Stock Assessor</h3>
              <p className="text-sm text-slate-600 mb-4">
                Find high-quality stocks trading at reasonable valuations. Our screener analyzes:
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-slate-700">ROIC & ROE</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-slate-700">Debt Levels</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-slate-700">P/E & P/B Ratios</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-slate-700">Free Cash Flow</span>
                </div>
              </div>
              <button
                onClick={runScreener}
                className="btn-primary mt-4 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Run Your First Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Methodology Note */}
      <div className="card bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Scoring Methodology</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
          <div>
            <p className="font-medium text-slate-700">Quality Score (0-100)</p>
            <p>Based on ROIC, ROE, Debt/Equity, Current Ratio, FCF Yield</p>
          </div>
          <div>
            <p className="font-medium text-slate-700">Valuation Score (0-100)</p>
            <p>Based on P/E, P/B, EV/EBITDA ratios vs market averages</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Data provided by Financial Modeling Prep. Scores are relative rankings, not investment recommendations.
        </p>
      </div>
    </div>
  )
}
