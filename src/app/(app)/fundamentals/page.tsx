'use client'

import { useState } from 'react'
import {
  Search, TrendingUp, TrendingDown, Activity, AlertTriangle,
  Info, RefreshCw, Gauge, DollarSign, BarChart3, Zap,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// Signal colours
const GREEN = '#238636'
const AMBER = '#f0883e'
const RED = '#da3633'

interface QuarterPoint { date: string; revenue: number | null; eps: number | null }
interface FundamentalsData {
  symbol: string; name: string; currency: string
  currentPrice: number | null; priceChange: number | null
  forwardPE: number | null; trailingPE: number | null; pegRatio: number | null
  sharesOutstanding: number | null
  revenueGrowth: number | null; earningsGrowth: number | null
  volume: number | null; avgVolume10d: number | null; avgVolume3m: number | null
  fiftyTwoWeekHigh: number | null; fiftyTwoWeekLow: number | null
  ttmRevenue: number | null
  revenueByQuarter: QuarterPoint[]; combinedQuarterly: QuarterPoint[]
  error?: string
}

interface PricePoint { date: string; close: number }

const fmtB = (n: number | null) => {
  if (n === null || n === undefined) return '—'
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  return '$' + n.toLocaleString()
}
const fmtNum = (n: number | null, d = 2) => (n === null || n === undefined ? '—' : n.toFixed(d))
const fmtPct = (n: number | null) => (n === null || n === undefined ? '—' : (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%')
const fmtVol = (n: number | null) => {
  if (n === null || n === undefined) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toString()
}

export default function FundamentalsScannerPage() {
  const [ticker, setTicker] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FundamentalsData | null>(null)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])

  const runScan = async () => {
    const sym = ticker.trim().toUpperCase()
    if (!sym) return
    setLoading(true)
    setError(null)
    setData(null)
    setPriceHistory([])

    try {
      const [fRes, pRes] = await Promise.all([
        fetch(`/api/fundamentals?symbol=${encodeURIComponent(sym)}`),
        fetch(`/api/price-history?symbol=${encodeURIComponent(sym)}&range=2y&interval=1mo`),
      ])

      const fData = await fRes.json()
      if (fData.error) {
        setError(fData.error)
        setLoading(false)
        return
      }
      setData(fData)

      if (pRes.ok) {
        const pData = await pRes.json()
        if (pData.series) setPriceHistory(pData.series)
      }
    } catch (err: any) {
      setError(err.message || 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  // ---- Divergence calculation ----
  // Compare price growth vs fundamental growth over the available window
  const divergence = (() => {
    if (!data) return null
    const quarters = data.combinedQuarterly.filter(q => q.revenue !== null || q.eps !== null)
    if (quarters.length < 2 || priceHistory.length < 2) return null

    // Revenue growth over window
    const firstRev = quarters.find(q => q.revenue !== null)?.revenue ?? null
    const lastRev = [...quarters].reverse().find(q => q.revenue !== null)?.revenue ?? null
    const revGrowth = (firstRev && lastRev && firstRev !== 0) ? (lastRev - firstRev) / Math.abs(firstRev) : null

    // EPS growth over window
    const firstEps = quarters.find(q => q.eps !== null)?.eps ?? null
    const lastEps = [...quarters].reverse().find(q => q.eps !== null)?.eps ?? null
    const epsGrowth = (firstEps && lastEps && firstEps !== 0) ? (lastEps - firstEps) / Math.abs(firstEps) : null

    // Price growth over window
    const firstPrice = priceHistory[0].close
    const lastPrice = priceHistory[priceHistory.length - 1].close
    const priceGrowth = firstPrice !== 0 ? (lastPrice - firstPrice) / firstPrice : null

    if (priceGrowth === null) return null

    // Fundamental growth = average of available (revenue, eps) growth
    const fundamentals: number[] = []
    if (revGrowth !== null) fundamentals.push(revGrowth)
    if (epsGrowth !== null) fundamentals.push(epsGrowth)
    const fundGrowth = fundamentals.length > 0 ? fundamentals.reduce((a, b) => a + b, 0) / fundamentals.length : null

    // Detect pre-revenue / no meaningful fundamentals
    const isPreRevenue = (data.ttmRevenue === null || (data.ttmRevenue !== null && data.ttmRevenue < 1e6)) &&
                         (lastEps === null || lastEps < 0)

    let verdict: string, color: string, explanation: string
    if (isPreRevenue) {
      verdict = 'PRE-REVENUE / SPECULATIVE'
      color = RED
      explanation = `${data.symbol} has little or no revenue to assess. Price is driven by story and expectation, not current fundamentals. No fundamental floor — size any position for speculation, not conviction.`
    } else if (fundGrowth === null) {
      verdict = 'INSUFFICIENT DATA'
      color = AMBER
      explanation = `Not enough fundamental history returned for ${data.symbol} to judge divergence. Verify on a paid data source before relying on this.`
    } else {
      const gap = priceGrowth - fundGrowth
      if (gap > 0.5) {
        verdict = 'HYPE DIVERGENCE'
        color = RED
        explanation = `Price up ${(priceGrowth * 100).toFixed(0)}% vs fundamentals up ${(fundGrowth * 100).toFixed(0)}% over the window. Price has outrun the business — elevated risk of a valuation reset.`
      } else if (gap < -0.3) {
        verdict = 'FUNDAMENTALLY SUPPORTED'
        color = GREEN
        explanation = `Fundamentals up ${(fundGrowth * 100).toFixed(0)}% vs price up ${(priceGrowth * 100).toFixed(0)}%. The business is growing faster than the price — possible value if the thesis holds.`
      } else {
        verdict = 'FAIRLY VALUED'
        color = AMBER
        explanation = `Price up ${(priceGrowth * 100).toFixed(0)}% and fundamentals up ${(fundGrowth * 100).toFixed(0)}% are roughly in line. Price broadly tracks the business.`
      }
    }

    return { verdict, color, explanation, priceGrowth, fundGrowth, revGrowth, epsGrowth, isPreRevenue }
  })()

  // ---- Indexed chart data (price, EPS, revenue all indexed to 100 at start) ----
  const indexedChartData = (() => {
    if (!data) return []
    const quarters = data.combinedQuarterly.filter(q => q.revenue !== null || q.eps !== null)
    if (quarters.length < 2) return []

    const baseRev = quarters.find(q => q.revenue !== null && q.revenue !== 0)?.revenue ?? null
    const baseEps = quarters.find(q => q.eps !== null && q.eps !== 0)?.eps ?? null

    // Sample price history to align roughly with quarters (take evenly spaced points)
    const basePrice = priceHistory.length > 0 ? priceHistory[0].close : null

    return quarters.map((q, i) => {
      // Find a price point roughly aligned by index position
      const priceIdx = priceHistory.length > 0
        ? Math.min(priceHistory.length - 1, Math.floor((i / (quarters.length - 1)) * (priceHistory.length - 1)))
        : -1
      const priceVal = priceIdx >= 0 ? priceHistory[priceIdx].close : null

      return {
        quarter: q.date,
        Price: (basePrice && priceVal) ? Math.round((priceVal / basePrice) * 100) : null,
        Revenue: (baseRev && q.revenue) ? Math.round((q.revenue / baseRev) * 100) : null,
        EPS: (baseEps && q.eps) ? Math.round((q.eps / baseEps) * 100) : null,
      }
    })
  })()

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Gauge className="w-6 h-6 text-cyan-400" />
          Fundamentals Scanner
        </h1>
        <p className="text-sm text-gray-500">The pre-strike check — is the price profit or hype?</p>
      </div>

      {/* Search */}
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') runScan() }}
              placeholder="Enter ticker (e.g. NVDA, IREN, SMR)"
              className="w-full pl-9 pr-3 py-2.5 bg-white/5 text-white border border-gray-700 rounded-lg text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            onClick={runScan}
            disabled={loading || !ticker.trim()}
            className="px-5 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Scanning...' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Company header */}
          <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{data.symbol}</h2>
                <span className="text-xs text-gray-500">{data.currency}</span>
              </div>
              <p className="text-sm text-gray-400">{data.name}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white font-mono">
                {data.currentPrice !== null ? `$${data.currentPrice.toFixed(2)}` : '—'}
              </p>
              {data.priceChange !== null && (
                <p className={`text-sm font-mono ${data.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(data.priceChange / 100)}
                </p>
              )}
            </div>
          </div>

          {/* DIVERGENCE GAUGE — Hero */}
          {divergence && (
            <div className="rounded-xl p-5 border" style={{ backgroundColor: `${divergence.color}10`, borderColor: `${divergence.color}40` }}>
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="w-5 h-5" style={{ color: divergence.color }} />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Price vs Fundamentals</h3>
              </div>
              <p className="text-2xl font-bold mb-2" style={{ color: divergence.color }}>{divergence.verdict}</p>
              <p className="text-sm text-gray-300 leading-relaxed">{divergence.explanation}</p>

              {/* Growth comparison bars */}
              {!divergence.isPreRevenue && divergence.fundGrowth !== null && (
                <div className="mt-4 space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Price Growth</span>
                      <span className="font-mono text-gray-300">{fmtPct(divergence.priceGrowth)}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(divergence.priceGrowth) * 100)}%`, backgroundColor: '#58a6ff' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Fundamental Growth (Rev + EPS avg)</span>
                      <span className="font-mono text-gray-300">{fmtPct(divergence.fundGrowth)}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(divergence.fundGrowth) * 100)}%`, backgroundColor: divergence.color }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PARAMETER 1: EPS & Revenue Trajectory */}
          <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">EPS & Revenue Trajectory</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">All indexed to 100 at start — divergence between the lines is the signal</p>

            {indexedChartData.length >= 2 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={indexedChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis dataKey="quarter" stroke="#6b7280" style={{ fontSize: '11px' }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '11px' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1c1c28', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="Price" stroke="#58a6ff" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                    <Line type="monotone" dataKey="Revenue" stroke="#238636" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                    <Line type="monotone" dataKey="EPS" stroke="#f0883e" strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-sm text-gray-500">
                Insufficient quarterly history from Yahoo Finance for this ticker
              </div>
            )}

            {/* Growth stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-800">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Revenue Growth (YoY)</p>
                <p className={`text-sm font-mono font-medium ${(data.revenueGrowth || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(data.revenueGrowth)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Earnings Growth (YoY)</p>
                <p className={`text-sm font-mono font-medium ${(data.earningsGrowth || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(data.earningsGrowth)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">TTM Revenue</p>
                <p className="text-sm font-mono font-medium text-gray-300">{fmtB(data.ttmRevenue)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Shares Out.</p>
                <p className="text-sm font-mono font-medium text-gray-300">{fmtVol(data.sharesOutstanding)}</p>
              </div>
            </div>

            {/* Educational note */}
            <div className="mt-4 bg-blue-500/5 border border-blue-500/10 rounded-lg p-3 flex gap-2">
              <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-400 italic leading-relaxed">
                EPS = company profit ÷ shares. Track it against revenue. Price rising while EPS AND revenue fall = hype.
                EPS falling but revenue accelerating + capex rising = a company investing through a build-out = possible buy.
                Never read EPS alone — always against revenue.
              </p>
            </div>
          </div>

          {/* Data source note */}
          <p className="text-xs text-gray-600 text-center">
            Data: Yahoo Finance (validation build) • Fundamentals verdict describes the business, not a trade instruction • Not financial advice
          </p>
        </>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="bg-[#1c1c28] border border-gray-800 border-dashed rounded-xl p-10 text-center">
          <Gauge className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Enter a ticker to run the fundamental divergence scan</p>
          <p className="text-gray-600 text-xs mt-1">Checks whether price is supported by EPS and revenue, or running on hype</p>
        </div>
      )}
    </div>
  )
}
