'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Radar,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Eye,
  Crosshair,
  BarChart3,
  ExternalLink,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const TAX_RATE = 0.325
const CGT_DISCOUNT = 0.5
const CAVALRY_HURDLE = 15   // 15% pre-tax
const MOMENTUM_HURDLE = 20  // 20% pre-tax
const DEFAULT_DEPLOYMENT = 20000

const STRIKE_ZONES = [
  { min: 30, label: 'DEEP', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: '🔴' },
  { min: 20, label: 'HEAVY', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: '🟠' },
  { min: 15, label: 'STRONG', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: '🟡' },
  { min: 10, label: 'MODERATE', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: '🔵' },
  { min: 5, label: 'LIGHT', color: 'text-gray-400', bg: 'bg-white/5 border-gray-800', icon: '⚪' },
  { min: 0, label: 'NEAR HIGH', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: '🟢' },
]

function getStrikeZone(pullbackPct: number) {
  return STRIKE_ZONES.find(z => pullbackPct >= z.min) || STRIKE_ZONES[STRIKE_ZONES.length - 1]
}

function getHurdleStatus(pullbackPct: number): { label: string; color: string; clears: boolean } {
  // At this pullback, if stock recovers to prior high, the upside is: pullback / (1 - pullback/100)
  const upsideToHigh = (pullbackPct / (100 - pullbackPct)) * 100
  if (upsideToHigh >= MOMENTUM_HURDLE) return { label: 'MOM', color: 'text-green-400', clears: true }
  if (upsideToHigh >= CAVALRY_HURDLE) return { label: 'CAV', color: 'text-yellow-400', clears: true }
  return { label: '—', color: 'text-gray-600', clears: false }
}

function calcPotentialProfit(currentPrice: number, pullbackPct: number, deployment: number) {
  // If stock recovers to 52-week high
  const upsideToHigh = (pullbackPct / (100 - pullbackPct)) * 100
  const shares = Math.floor(deployment / currentPrice)
  const exitPrice = currentPrice * (1 + upsideToHigh / 100)
  const grossGain = (exitPrice - currentPrice) * shares
  const taxLong = grossGain > 0 ? grossGain * CGT_DISCOUNT * TAX_RATE : 0
  const netProfit = grossGain - taxLong
  return { shares, upsideToHigh, grossGain, netProfit }
}

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtShort(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}

// ═══════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════

interface UniverseStock {
  id: string
  ticker: string
  name: string
  tier: string
  sector_id: string
  status: string
  thesis: string | null
}

interface SignalData {
  symbol: string
  name: string
  currentPrice: number
  previousClose: number
  change: number
  changePercent: number
  weekHigh52: number
  weekLow52: number
  pullbackFromHigh: number
  rangePosition: number
}

interface MergedSignal {
  ticker: string
  name: string
  tier: string
  thesis: string | null
  currentPrice: number
  change: number
  changePercent: number
  weekHigh52: number
  weekLow52: number
  pullbackFromHigh: number
  rangePosition: number
  strikeZone: ReturnType<typeof getStrikeZone>
  hurdle: ReturnType<typeof getHurdleStatus>
  potential: ReturnType<typeof calcPotentialProfit>
}

type SortField = 'pullback' | 'change' | 'ticker' | 'potential'

// ═══════════════════════════════════════════════════════════════
// MINI RANGE BAR
// ═══════════════════════════════════════════════════════════════

function MiniRangeBar({ position }: { position: number }) {
  return (
    <div className="w-20 h-1.5 rounded-full bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-green-500/30 relative">
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-400 border border-[#1c1c28]"
        style={{ left: `${Math.min(Math.max(position, 5), 95)}%`, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SignalMonitorPage() {
  const [signals, setSignals] = useState<MergedSignal[]>([])
  const [loading, setLoading] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('pullback')
  const [sortAsc, setSortAsc] = useState(false)
  const [filterZone, setFilterZone] = useState<string>('all')
  const [deployment, setDeployment] = useState(DEFAULT_DEPLOYMENT)

  const runScan = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Step 1: Fetch universe stocks
      const uniRes = await fetch('/api/universe/stocks')
      if (!uniRes.ok) throw new Error('Failed to fetch universe stocks')
      const uniData = await uniRes.json()
      const stocks: UniverseStock[] = (uniData.stocks || []).filter(
        (s: UniverseStock) => s.status === 'active'
      )

      if (stocks.length === 0) {
        setError('No active universe stocks found')
        setLoading(false)
        return
      }

      // Step 2: Batch fetch pullback data
      const tickers = stocks.map(s => s.ticker)
      const scanRes = await fetch('/api/signal-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: tickers }),
      })

      if (!scanRes.ok) throw new Error('Signal scan failed')
      const scanData = await scanRes.json()
      const signalMap = new Map<string, SignalData>()
      for (const s of scanData.stocks || []) {
        signalMap.set(s.symbol, s)
      }

      // Step 3: Merge universe data with signal data
      const merged: MergedSignal[] = stocks
        .map(stock => {
          const signal = signalMap.get(stock.ticker)
          if (!signal) return null

          const strikeZone = getStrikeZone(signal.pullbackFromHigh)
          const hurdle = getHurdleStatus(signal.pullbackFromHigh)
          const potential = calcPotentialProfit(signal.currentPrice, signal.pullbackFromHigh, deployment)

          return {
            ticker: stock.ticker,
            name: signal.name || stock.name,
            tier: stock.tier,
            thesis: stock.thesis,
            currentPrice: signal.currentPrice,
            change: signal.change,
            changePercent: signal.changePercent,
            weekHigh52: signal.weekHigh52,
            weekLow52: signal.weekLow52,
            pullbackFromHigh: signal.pullbackFromHigh,
            rangePosition: signal.rangePosition,
            strikeZone,
            hurdle,
            potential,
          }
        })
        .filter(Boolean) as MergedSignal[]

      setSignals(merged)
      setLastScan(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }, [deployment])

  // Auto-scan on mount
  useEffect(() => {
    runScan()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sorting
  const sorted = [...signals].sort((a, b) => {
    let diff = 0
    switch (sortField) {
      case 'pullback': diff = b.pullbackFromHigh - a.pullbackFromHigh; break
      case 'change': diff = b.changePercent - a.changePercent; break
      case 'ticker': diff = a.ticker.localeCompare(b.ticker); break
      case 'potential': diff = b.potential.netProfit - a.potential.netProfit; break
    }
    return sortAsc ? -diff : diff
  })

  // Filtering
  const filtered = filterZone === 'all'
    ? sorted
    : sorted.filter(s => {
        if (filterZone === 'strike') return s.pullbackFromHigh >= 10
        if (filterZone === 'hurdle') return s.hurdle.clears
        return true
      })

  // Stats
  const inStrikeZone = signals.filter(s => s.pullbackFromHigh >= 10).length
  const clearHurdle = signals.filter(s => s.hurdle.clears).length
  const deepest = signals.length > 0
    ? signals.reduce((a, b) => a.pullbackFromHigh > b.pullbackFromHigh ? a : b)
    : null

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(false) }
  }

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className={`ml-1 text-[10px] ${sortField === field ? 'text-blue-400' : 'text-gray-600'}`}>
      {sortField === field ? (sortAsc ? '▲' : '▼') : '⇅'}
    </span>
  )

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Radar className="w-6 h-6 text-green-400" />
            Signal Monitor
          </h1>
          <p className="text-sm text-gray-500">AI Universe pullback scanner — spot strike opportunities</p>
        </div>
        <div className="flex items-center gap-3">
          {lastScan && (
            <span className="text-xs text-gray-500">
              Last scan: {lastScan}
            </span>
          )}
          <button
            onClick={runScan}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {loading ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {signals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">STOCKS SCANNED</p>
            <p className="text-2xl font-bold text-white font-mono">{signals.length}</p>
          </div>
          <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">IN STRIKE ZONE (10%+)</p>
            <p className={`text-2xl font-bold font-mono ${inStrikeZone > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
              {inStrikeZone}
            </p>
          </div>
          <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">CLEAR HURDLE</p>
            <p className={`text-2xl font-bold font-mono ${clearHurdle > 0 ? 'text-green-400' : 'text-gray-500'}`}>
              {clearHurdle}
            </p>
          </div>
          <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">DEEPEST PULLBACK</p>
            {deepest ? (
              <>
                <p className="text-2xl font-bold text-red-400 font-mono">-{deepest.pullbackFromHigh.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 font-mono">{deepest.ticker}</p>
              </>
            ) : (
              <p className="text-2xl font-bold text-gray-600 font-mono">—</p>
            )}
          </div>
        </div>
      )}

      {/* Alert Banner — stocks in deep strike zone */}
      {signals.filter(s => s.pullbackFromHigh >= 20).length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-red-400">Heavy Pullback Alert</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {signals.filter(s => s.pullbackFromHigh >= 20).map(s => (
              <Link
                key={s.ticker}
                href={`/trade-simulator?tab=pullback&ticker=${s.ticker}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
              >
                <span className="font-mono font-bold text-white">{s.ticker}</span>
                <span className="text-red-400 font-mono">-{s.pullbackFromHigh.toFixed(1)}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters & Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-[#1c1c28] border border-gray-800 rounded-lg p-0.5">
          {[
            { id: 'all', label: 'All Stocks' },
            { id: 'strike', label: 'In Strike Zone' },
            { id: 'hurdle', label: 'Clears Hurdle' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterZone(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterZone === f.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">Deploy:</span>
          {[10000, 20000, 50000].map(amt => (
            <button
              key={amt}
              onClick={() => setDeployment(amt)}
              className={`px-2 py-1 rounded text-xs font-mono border transition-all ${
                deployment === amt
                  ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                  : 'bg-white/5 border-gray-800 text-gray-500 hover:text-white'
              }`}
            >
              ${(amt / 1000).toFixed(0)}K
            </button>
          ))}
        </div>
      </div>

      {/* Main Signal Table */}
      {filtered.length > 0 && (
        <div className="bg-[#1c1c28] border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-300" onClick={() => handleSort('ticker')}>
                    STOCK <SortIcon field="ticker" />
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">PRICE</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-300" onClick={() => handleSort('change')}>
                    TODAY <SortIcon field="change" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-300" onClick={() => handleSort('pullback')}>
                    PULLBACK <SortIcon field="pullback" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">ZONE</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">RANGE</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">HURDLE</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-300" onClick={() => handleSort('potential')}>
                    NET PROFIT <SortIcon field="potential" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((signal) => {
                  const isDeepPullback = signal.pullbackFromHigh >= 15
                  return (
                    <tr
                      key={signal.ticker}
                      className={`border-b border-gray-800/30 hover:bg-white/5 transition-colors ${
                        isDeepPullback ? 'bg-yellow-500/5' : ''
                      }`}
                    >
                      {/* Stock */}
                      <td className="px-3 py-3">
                        <div>
                          <span className="font-mono font-bold text-white">{signal.ticker}</span>
                          <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            signal.tier === 'heavyweight'
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {signal.tier === 'heavyweight' ? 'HW' : 'VEL'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate max-w-[160px]">{signal.name}</p>
                      </td>

                      {/* Price */}
                      <td className="px-3 py-3 text-right">
                        <span className="font-mono text-white">{fmt(signal.currentPrice)}</span>
                      </td>

                      {/* Today's Change */}
                      <td className="px-3 py-3 text-right">
                        <div className={`flex items-center justify-end gap-1 font-mono ${
                          signal.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {signal.changePercent >= 0
                            ? <ArrowUpRight className="w-3 h-3" />
                            : <ArrowDownRight className="w-3 h-3" />
                          }
                          {fmtPct(signal.changePercent)}
                        </div>
                      </td>

                      {/* Pullback from High */}
                      <td className="px-3 py-3 text-center">
                        <span className={`font-mono font-bold ${signal.strikeZone.color}`}>
                          -{signal.pullbackFromHigh.toFixed(1)}%
                        </span>
                      </td>

                      {/* Strike Zone */}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${signal.strikeZone.bg} ${signal.strikeZone.color}`}>
                          {signal.strikeZone.label}
                        </span>
                      </td>

                      {/* Range Position */}
                      <td className="px-3 py-3">
                        <div className="flex justify-center">
                          <MiniRangeBar position={signal.rangePosition} />
                        </div>
                      </td>

                      {/* Hurdle */}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs font-bold ${signal.hurdle.color}`}>
                          {signal.hurdle.clears && '✓ '}{signal.hurdle.label}
                        </span>
                      </td>

                      {/* Potential Net Profit (if recovers to high, 12+ month hold) */}
                      <td className="px-3 py-3 text-right">
                        {signal.potential.netProfit > 0 ? (
                          <div>
                            <span className="font-mono font-bold text-green-400">
                              {fmtShort(signal.potential.netProfit)}
                            </span>
                            <p className="text-[10px] text-gray-500">
                              {fmtPct(signal.potential.upsideToHigh)} upside
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3 text-center">
                        <Link
                          href={`/trade-simulator?tab=pullback&ticker=${signal.ticker}`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded-lg text-xs text-blue-400 hover:bg-blue-600/30 transition-colors"
                        >
                          <Crosshair className="w-3 h-3" />
                          Analyse
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-4 py-2 border-t border-gray-800 flex flex-wrap items-center gap-4 text-xs">
            <span className="text-gray-600">
              {filtered.length} stock{filtered.length !== 1 ? 's' : ''} shown
            </span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-500">Net profit assumes recovery to 52-week high, {fmtShort(deployment)} deployment, 12+ month hold (CGT discount)</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && signals.length === 0 && (
        <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-10 text-center">
          <Loader2 className="w-8 h-8 text-green-400 mx-auto mb-3 animate-spin" />
          <p className="text-gray-400">Scanning universe stocks for pullback signals...</p>
          <p className="text-gray-600 text-xs mt-1">Fetching 52-week data from Yahoo Finance</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && signals.length === 0 && (
        <div className="bg-[#1c1c28] border border-gray-800 border-dashed rounded-xl p-10 text-center">
          <Radar className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No signals yet</p>
          <p className="text-gray-600 text-xs mt-1">Click &quot;Scan Now&quot; to check your AI Universe for pullback opportunities</p>
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Signal Monitor • Scans AI Universe stocks • Tax: 32.5% • CGT discount: 50% (12+ month hold) • Not financial advice
      </p>
    </div>
  )
}
