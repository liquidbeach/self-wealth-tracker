'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  TrendingDown,
  TrendingUp,
  Target,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Loader2,
  Crosshair,
  Timer,
  Sparkles,
  BarChart3,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface StockData {
  ticker: string
  name: string
  currentPrice: number
  weekHigh52: number
  weekLow52: number
  change: number
  changePercent: number
}

interface VelocityTarget {
  label: string
  percentage: number
  color: string
  bgColor: string
}

interface PullbackLevel {
  percentage: number
  price: number
  shares: number
  dropFromHigh: number
}

interface MatrixCell {
  entryPrice: number
  exitPrice: number
  pullbackPct: number
  velocityPct: number
  velocityLabel: string
  upsidePct: number
  grossGain: number
  taxShortTerm: number
  taxLongTerm: number
  netProfitShort: number
  netProfitLong: number
  netReturnShort: number
  netReturnLong: number
  hurdleStatus: 'cavalry' | 'momentum' | 'none'
  shares: number
}

interface PresetStock {
  ticker: string
  label: string
  tier: 'momentum' | 'cavalry' | 'lth' | 'universe'
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const TAX_RATE = 0.325
const CGT_DISCOUNT = 0.5
const CAVALRY_HURDLE = 0.15
const MOMENTUM_HURDLE = 0.20

const DEFAULT_PULLBACK_LEVELS = [5, 10, 15, 20, 25, 30]

const DEFAULT_VELOCITIES: VelocityTarget[] = [
  { label: 'Low', percentage: 20, color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' },
  { label: 'Medium', percentage: 40, color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' },
  { label: 'High', percentage: 75, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' },
]

const PRESET_STOCKS: PresetStock[] = [
  { ticker: 'MU', label: 'Micron', tier: 'momentum' },
  { ticker: 'AMD', label: 'AMD', tier: 'momentum' },
  { ticker: 'NVDA', label: 'NVIDIA', tier: 'universe' },
  { ticker: 'MOD', label: 'Modine', tier: 'cavalry' },
  { ticker: 'VST', label: 'Vistra', tier: 'universe' },
  { ticker: 'AVGO', label: 'Broadcom', tier: 'universe' },
  { ticker: 'VRT', label: 'Vertiv', tier: 'universe' },
  { ticker: 'CEG', label: 'Constell.', tier: 'universe' },
]

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtShort(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}

function calcCGT(gain: number, isLong: boolean): { tax: number; net: number } {
  if (gain <= 0) return { tax: 0, net: gain }
  const taxable = isLong ? gain * CGT_DISCOUNT : gain
  const tax = taxable * TAX_RATE
  return { tax, net: gain - tax }
}

function getHurdle(upsidePct: number): 'cavalry' | 'momentum' | 'none' {
  if (upsidePct >= MOMENTUM_HURDLE * 100) return 'momentum'
  if (upsidePct >= CAVALRY_HURDLE * 100) return 'cavalry'
  return 'none'
}

// ═══════════════════════════════════════════════════════════════
// PRESET BAR
// ═══════════════════════════════════════════════════════════════

function PresetBar({ onSelect, activeTicker }: { onSelect: (t: string) => void; activeTicker: string }) {
  const tierStyles: Record<string, string> = {
    momentum: 'bg-blue-50 border-blue-200 text-blue-700',
    cavalry: 'bg-amber-50 border-amber-200 text-amber-700',
    lth: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    universe: 'bg-purple-50 border-purple-200 text-purple-700',
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_STOCKS.map((stock) => {
        const isActive = activeTicker.toUpperCase() === stock.ticker
        return (
          <button
            key={stock.ticker}
            onClick={() => onSelect(stock.ticker)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
              isActive
                ? 'bg-slate-800 border-slate-700 text-white'
                : `${tierStyles[stock.tier]} hover:shadow-sm`
            }`}
          >
            <span className="font-mono">{stock.ticker}</span>
            <span className="ml-1.5 text-xs opacity-60">{stock.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 52-WEEK RANGE BAR
// ═══════════════════════════════════════════════════════════════

function RangeBar({ stockData, pullbackLevels }: { stockData: StockData; pullbackLevels: PullbackLevel[] }) {
  const { currentPrice, weekHigh52, weekLow52 } = stockData
  const range = weekHigh52 - weekLow52
  if (range <= 0) return null

  const currentPos = ((currentPrice - weekLow52) / range) * 100

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">52-Week Range</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Low: <span className="text-red-600 font-mono">{fmt(weekLow52)}</span></span>
          <span>High: <span className="text-emerald-600 font-mono">{fmt(weekHigh52)}</span></span>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-8 mb-2">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-red-100 via-amber-100 to-emerald-100 border border-gray-200" />

        {/* Pullback markers */}
        {pullbackLevels.map((level, i) => {
          const pos = ((level.price - weekLow52) / range) * 100
          if (pos < 0 || pos > 100) return null
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-amber-400 opacity-50"
              style={{ left: `${pos}%` }}
              title={`-${level.percentage}%: ${fmt(level.price)}`}
            />
          )
        })}

        {/* Current price dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
          style={{ left: `${Math.min(Math.max(currentPos, 2), 98)}%` }}
        >
          <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-white shadow-md" />
        </div>
      </div>

      <div className="flex justify-between items-center text-xs">
        <span className="text-red-500 font-mono">{fmt(weekLow52)}</span>
        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full">
          <div className="w-2 h-2 rounded-full bg-slate-800" />
          <span className="text-gray-900 font-mono font-medium">{fmt(currentPrice)}</span>
          <span className="text-gray-500">({currentPos.toFixed(0)}% of range)</span>
        </div>
        <span className="text-emerald-600 font-mono">{fmt(weekHigh52)}</span>
      </div>

      <div className="mt-2 text-center">
        <span className="text-xs text-gray-500">
          Currently <span className="text-amber-600 font-mono font-medium">
            {(((weekHigh52 - currentPrice) / weekHigh52) * 100).toFixed(1)}%
          </span> below 52-week high
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// STRIKE ZONE CARDS
// ═══════════════════════════════════════════════════════════════

function StrikeZones({ pullbackLevels, currentPrice }: { pullbackLevels: PullbackLevel[]; currentPrice: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Crosshair className="w-4 h-4 text-amber-500" />
        Pullback Strike Zones
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {pullbackLevels.map((level, i) => {
          const savings = (currentPrice - level.price) * level.shares
          return (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center hover:border-amber-300 transition-colors">
              <div className="text-lg font-bold text-amber-600 font-mono">-{level.percentage}%</div>
              <div className="text-gray-900 font-mono text-sm mt-1">{fmt(level.price)}</div>
              <div className="h-px bg-gray-200 my-2" />
              <div className="text-xs text-gray-500">
                <span className="text-emerald-600 font-mono font-semibold">{level.shares.toLocaleString()}</span> shares
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Save <span className="text-emerald-600 font-mono">{fmtShort(savings)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PULLBACK × VELOCITY MATRIX
// ═══════════════════════════════════════════════════════════════

function PullbackMatrix({
  matrix,
  holdMode,
  setHoldMode,
}: {
  matrix: MatrixCell[][]
  holdMode: 'short' | 'long'
  setHoldMode: (m: 'short' | 'long') => void
}) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-purple-600 uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Pullback × Velocity Matrix
        </h3>

        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setHoldMode('short')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              holdMode === 'short'
                ? 'bg-white shadow-sm text-orange-600 border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-3 h-3 inline mr-1" />
            &lt;12 Months
          </button>
          <button
            onClick={() => setHoldMode('long')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              holdMode === 'long'
                ? 'bg-white shadow-sm text-emerald-600 border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircle className="w-3 h-3 inline mr-1" />
            12+ Months (CGT Discount)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">PULLBACK</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">ENTRY</th>
              {matrix[0]?.map((cell, i) => (
                <th key={i} className="px-3 py-2 text-center text-xs font-semibold">
                  <span className={DEFAULT_VELOCITIES[i]?.color}>
                    {cell.velocityLabel} (+{cell.velocityPct}%)
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-3 py-3">
                  <span className="text-amber-600 font-mono font-bold">-{row[0].pullbackPct}%</span>
                </td>
                <td className="px-3 py-3">
                  <span className="text-gray-900 font-mono text-xs">{fmt(row[0].entryPrice)}</span>
                </td>
                {row.map((cell, colIdx) => {
                  const cellKey = `${rowIdx}-${colIdx}`
                  const isHovered = hoveredCell === cellKey
                  const netProfit = holdMode === 'long' ? cell.netProfitLong : cell.netProfitShort
                  const netReturn = holdMode === 'long' ? cell.netReturnLong : cell.netReturnShort
                  const tax = holdMode === 'long' ? cell.taxLongTerm : cell.taxShortTerm

                  const hurdleBg =
                    cell.hurdleStatus === 'momentum'
                      ? 'bg-emerald-50 border border-emerald-200'
                      : cell.hurdleStatus === 'cavalry'
                        ? 'bg-yellow-50 border border-yellow-200'
                        : 'bg-gray-50 border border-gray-200'

                  return (
                    <td
                      key={colIdx}
                      className="px-2 py-3 text-center relative"
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div className={`rounded-lg p-2 transition-all ${hurdleBg} ${isHovered ? 'ring-2 ring-slate-300 shadow-md' : ''}`}>
                        <div className={`font-mono font-bold text-sm ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {fmtShort(netProfit)}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {fmtPct(netReturn)} net
                        </div>
                        {cell.hurdleStatus !== 'none' && (
                          <div className={`text-[9px] mt-1 px-1.5 py-0.5 rounded-full inline-block font-medium ${
                            cell.hurdleStatus === 'momentum'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {cell.hurdleStatus === 'momentum' ? 'MOM ✅' : 'CAV ✅'}
                          </div>
                        )}
                      </div>

                      {/* Hover tooltip */}
                      {isHovered && (
                        <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-slate-800 rounded-lg p-3 shadow-xl text-left pointer-events-none">
                          <div className="text-xs space-y-1.5 text-white">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Entry</span>
                              <span className="font-mono">{fmt(cell.entryPrice)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Exit</span>
                              <span className="font-mono">{fmt(cell.exitPrice)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Upside</span>
                              <span className="font-mono text-emerald-400">{fmtPct(cell.upsidePct)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Shares</span>
                              <span className="font-mono">{cell.shares.toLocaleString()}</span>
                            </div>
                            <div className="h-px bg-slate-700" />
                            <div className="flex justify-between">
                              <span className="text-slate-400">Gross Gain</span>
                              <span className="font-mono">{fmtShort(cell.grossGain)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">CGT</span>
                              <span className="font-mono text-red-400">-{fmtShort(tax)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                              <span className="text-slate-300">Net Profit</span>
                              <span className="font-mono text-emerald-400">{fmtShort(netProfit)}</span>
                            </div>
                          </div>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45" />
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center gap-4 text-xs">
        <span className="text-gray-400 uppercase tracking-wider">Hurdle:</span>
        <span className="text-emerald-600">MOM ✅ = Momentum (20%+)</span>
        <span className="text-yellow-600">CAV ✅ = Cavalry (15%+)</span>
        <span className="text-gray-400">❌ = Below hurdle</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// OPTIMAL STRIKE ANALYSIS
// ═══════════════════════════════════════════════════════════════

function OptimalStrike({ matrix, holdMode }: { matrix: MatrixCell[][]; holdMode: 'short' | 'long' }) {
  const allCells = matrix.flat()
  if (allCells.length === 0) return null

  // Best risk/reward: highest net return per pullback unit
  const scored = allCells
    .map((cell) => {
      const netReturn = holdMode === 'long' ? cell.netReturnLong : cell.netReturnShort
      return { ...cell, score: netReturn / cell.pullbackPct, netReturn }
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0]

  // Highest absolute profit
  const highestProfit = [...allCells].sort((a, b) => {
    const pa = holdMode === 'long' ? a.netProfitLong : a.netProfitShort
    const pb = holdMode === 'long' ? b.netProfitLong : b.netProfitShort
    return pb - pa
  })[0]

  const bestNet = holdMode === 'long' ? best.netProfitLong : best.netProfitShort
  const highNet = holdMode === 'long' ? highestProfit.netProfitLong : highestProfit.netProfitShort

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Best risk/reward */}
      <div className="bg-white border border-gray-200 rounded-xl border-t-4 border-t-emerald-400 p-4">
        <h4 className="text-xs font-semibold text-emerald-600 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          BEST RISK / REWARD
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Wait for</span>
            <span className="text-amber-600 font-mono font-bold">-{best.pullbackPct}% pullback</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Enter at</span>
            <span className="text-gray-900 font-mono">{fmt(best.entryPrice)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Target</span>
            <span className="text-gray-900 font-mono">{fmt(best.exitPrice)} ({best.velocityLabel})</span>
          </div>
          <div className="pt-2 border-t-2 border-gray-200">
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-gray-900">Net Profit</span>
              <span className="text-xl font-bold font-mono text-emerald-600">{fmtShort(bestNet)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">Net Return</span>
              <span className="font-mono text-sm font-semibold text-emerald-600">{fmtPct(best.netReturn)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Highest absolute profit */}
      <div className="bg-white border border-gray-200 rounded-xl border-t-4 border-t-blue-400 p-4">
        <h4 className="text-xs font-semibold text-blue-600 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          HIGHEST ABSOLUTE PROFIT
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Wait for</span>
            <span className="text-amber-600 font-mono font-bold">-{highestProfit.pullbackPct}% pullback</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Enter at</span>
            <span className="text-gray-900 font-mono">{fmt(highestProfit.entryPrice)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Target</span>
            <span className="text-gray-900 font-mono">{fmt(highestProfit.exitPrice)} ({highestProfit.velocityLabel})</span>
          </div>
          <div className="pt-2 border-t-2 border-gray-200">
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-gray-900">Net Profit</span>
              <span className="text-xl font-bold font-mono text-blue-600">{fmtShort(highNet)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">Net Return</span>
              <span className="font-mono text-sm font-semibold text-blue-600">
                {fmtPct(holdMode === 'long' ? highestProfit.netReturnLong : highestProfit.netReturnShort)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PATIENCE PREMIUM
// ═══════════════════════════════════════════════════════════════

function PatiencePremium({
  pullbackLevels,
  velocities,
  deployment,
  currentPrice,
  holdMode,
}: {
  pullbackLevels: PullbackLevel[]
  velocities: VelocityTarget[]
  deployment: number
  currentPrice: number
  holdMode: 'short' | 'long'
}) {
  const medVel = velocities[1]?.percentage || 40
  const sharesNow = Math.floor(deployment / currentPrice)
  const exitNow = currentPrice * (1 + medVel / 100)
  const grossNow = (exitNow - currentPrice) * sharesNow
  const cgtNow = calcCGT(grossNow, holdMode === 'long')

  const bestPremium = pullbackLevels.reduce((best, level) => {
    const exitP = level.price * (1 + medVel / 100)
    const gross = (exitP - level.price) * level.shares
    const cgt = calcCGT(gross, holdMode === 'long')
    const premium = cgt.net - cgtNow.net
    return premium > best ? premium : best
  }, 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-purple-600 mb-1 flex items-center gap-2">
        <Timer className="w-4 h-4" />
        PATIENCE PREMIUM
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Extra profit from waiting for each pullback vs buying today — using Medium Velocity (+{medVel}%) target
      </p>

      <div className="space-y-2">
        {/* NOW baseline */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="w-14 text-xs text-gray-500 font-semibold">NOW</div>
          <div className="flex-1 text-xs text-gray-900 font-mono">
            {fmt(currentPrice)} × {sharesNow} shares
          </div>
          <div className="text-xs text-gray-600 font-mono">Net: {fmtShort(cgtNow.net)}</div>
          <div className="w-24 text-right text-xs text-gray-400">— baseline —</div>
        </div>

        {pullbackLevels.map((level, i) => {
          const exitP = level.price * (1 + medVel / 100)
          const gross = (exitP - level.price) * level.shares
          const cgt = calcCGT(gross, holdMode === 'long')
          const premium = cgt.net - cgtNow.net

          return (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 hover:border-purple-300 transition-colors">
              <div className="w-14 text-xs text-amber-600 font-mono font-bold">-{level.percentage}%</div>
              <div className="flex-1 text-xs text-gray-900 font-mono">
                {fmt(level.price)} × {level.shares} shares
              </div>
              <div className="text-xs text-gray-600 font-mono">Net: {fmtShort(cgt.net)}</div>
              <div className="w-24 text-right">
                <span className={`text-xs font-mono font-bold ${premium > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {premium > 0 ? '+' : ''}{fmtShort(premium)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 p-3 rounded-lg bg-purple-50 border border-purple-200">
        <p className="text-xs text-purple-700">
          <Sparkles className="w-3 h-3 inline mr-1" />
          Maximum patience premium: <span className="font-mono font-bold">{fmtShort(bestPremium)}</span> — the extra profit earned by waiting for the deepest pullback vs buying at today&apos;s price.
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PullbackCalculator() {
  const [ticker, setTicker] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [deployment, setDeployment] = useState(20000)
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holdMode, setHoldMode] = useState<'short' | 'long'>('long')
  const [velocities, setVelocities] = useState<VelocityTarget[]>(DEFAULT_VELOCITIES)
  const [showVelocityEditor, setShowVelocityEditor] = useState(false)

  const fetchStock = useCallback(async (sym: string) => {
    if (!sym.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/yahoo-finance?ticker=${sym.toUpperCase()}`)
      if (!res.ok) throw new Error('Failed to fetch stock data')
      const data = await res.json()

      const price = data.regularMarketPrice || data.currentPrice || data.price || 0
      const high52 = data.fiftyTwoWeekHigh || data.weekHigh52 || price * 1.3
      const low52 = data.fiftyTwoWeekLow || data.weekLow52 || price * 0.6

      setStockData({
        ticker: sym.toUpperCase(),
        name: data.shortName || data.longName || data.name || sym.toUpperCase(),
        currentPrice: price,
        weekHigh52: high52,
        weekLow52: low52,
        change: data.regularMarketChange || data.change || 0,
        changePercent: data.regularMarketChangePercent || data.changePercent || 0,
      })
      setTicker(sym.toUpperCase())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock data')
      setStockData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const pullbackLevels: PullbackLevel[] = useMemo(() => {
    if (!stockData) return []
    return DEFAULT_PULLBACK_LEVELS.map((pct) => {
      const price = stockData.currentPrice * (1 - pct / 100)
      const shares = Math.floor(deployment / price)
      const dropFromHigh = ((stockData.weekHigh52 - price) / stockData.weekHigh52) * 100
      return { percentage: pct, price, shares, dropFromHigh }
    })
  }, [stockData, deployment])

  const matrix: MatrixCell[][] = useMemo(() => {
    if (!stockData || pullbackLevels.length === 0) return []
    return pullbackLevels.map((level) =>
      velocities.map((velocity) => {
        const entryPrice = level.price
        const exitPrice = entryPrice * (1 + velocity.percentage / 100)
        const shares = level.shares
        const grossGain = (exitPrice - entryPrice) * shares
        const shortTerm = calcCGT(grossGain, false)
        const longTerm = calcCGT(grossGain, true)
        const cost = entryPrice * shares

        return {
          entryPrice,
          exitPrice,
          pullbackPct: level.percentage,
          velocityPct: velocity.percentage,
          velocityLabel: velocity.label,
          upsidePct: velocity.percentage,
          grossGain,
          taxShortTerm: shortTerm.tax,
          taxLongTerm: longTerm.tax,
          netProfitShort: shortTerm.net,
          netProfitLong: longTerm.net,
          netReturnShort: cost > 0 ? (shortTerm.net / cost) * 100 : 0,
          netReturnLong: cost > 0 ? (longTerm.net / cost) * 100 : 0,
          hurdleStatus: getHurdle(velocity.percentage),
          shares,
        }
      })
    )
  }, [stockData, pullbackLevels, velocities])

  return (
    <div className="space-y-4">
      {/* Input Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        {/* Presets */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">QUICK LOAD</label>
          <PresetBar onSelect={(t) => { setSearchInput(t); fetchStock(t) }} activeTicker={ticker} />
        </div>

        {/* Input row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">TICKER</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter' && searchInput.trim()) fetchStock(searchInput.trim()) }}
                placeholder="e.g. MU"
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
              />
              <button
                onClick={() => { if (searchInput.trim()) fetchStock(searchInput.trim()) }}
                disabled={loading || !searchInput.trim()}
                className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">DEPLOYMENT (USD)</label>
            <input
              type="number"
              value={deployment}
              onChange={(e) => setDeployment(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
            />
            <div className="flex gap-1.5 mt-1.5">
              {[5000, 10000, 20000, 50000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDeployment(amt)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    deployment === amt
                      ? 'bg-slate-800 border-slate-700 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  ${(amt / 1000).toFixed(0)}K
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">VELOCITY TARGETS</label>
              <button
                onClick={() => setShowVelocityEditor(!showVelocityEditor)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                {showVelocityEditor ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Customise
              </button>
            </div>
            {!showVelocityEditor ? (
              <div className="flex gap-2">
                {velocities.map((v, i) => (
                  <div key={i} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center">
                    <div className={`text-xs font-medium ${v.color}`}>{v.label}</div>
                    <div className="text-gray-900 font-mono text-sm">+{v.percentage}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {velocities.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={v.label}
                      onChange={(e) => {
                        const upd = [...velocities]
                        upd[i] = { ...upd[i], label: e.target.value }
                        setVelocities(upd)
                      }}
                      className="w-20 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs"
                    />
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={v.percentage}
                        onChange={(e) => {
                          const upd = [...velocities]
                          upd[i] = { ...upd[i], percentage: Number(e.target.value) }
                          setVelocities(upd)
                        }}
                        className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-mono"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setVelocities(DEFAULT_VELOCITIES)}
                  className="text-[10px] text-gray-400 hover:text-gray-600"
                >
                  Reset to defaults
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}
      </div>

      {/* ── RESULTS ── */}
      {stockData && (
        <>
          {/* Summary bar */}
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-400 mb-1">TICKER</p>
                <p className="text-lg font-bold text-white font-mono">{stockData.ticker}</p>
                <p className="text-xs text-slate-400 truncate">{stockData.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">CURRENT PRICE</p>
                <p className="text-lg font-bold text-white font-mono">{fmt(stockData.currentPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">TODAY</p>
                <p className={`text-lg font-bold font-mono ${stockData.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtPct(stockData.changePercent)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">DEPLOYMENT</p>
                <p className="text-lg font-bold text-white font-mono">{fmtShort(deployment)}</p>
              </div>
            </div>
          </div>

          <RangeBar stockData={stockData} pullbackLevels={pullbackLevels} />
          <StrikeZones pullbackLevels={pullbackLevels} currentPrice={stockData.currentPrice} />
          <PullbackMatrix matrix={matrix} holdMode={holdMode} setHoldMode={setHoldMode} />
          <OptimalStrike matrix={matrix} holdMode={holdMode} />
          <PatiencePremium
            pullbackLevels={pullbackLevels}
            velocities={velocities}
            deployment={deployment}
            currentPrice={stockData.currentPrice}
            holdMode={holdMode}
          />
        </>
      )}

      {/* Empty state */}
      {!stockData && !loading && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <TrendingDown className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Select a stock or enter a ticker to model pullback scenarios</p>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        SWT Pullback Calculator • Tax rate: 32.5% • CGT discount: 50% (12+ month hold) • Not financial advice
      </p>
    </div>
  )
}
