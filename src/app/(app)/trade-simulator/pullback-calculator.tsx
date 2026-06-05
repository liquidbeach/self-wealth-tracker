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
  Search,
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
  { label: 'Low', percentage: 20, color: 'text-green-400' },
  { label: 'Medium', percentage: 40, color: 'text-yellow-400' },
  { label: 'High', percentage: 75, color: 'text-red-400' },
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
    momentum: 'border-blue-500/30 text-blue-400',
    cavalry: 'border-yellow-500/30 text-yellow-400',
    lth: 'border-green-500/30 text-green-400',
    universe: 'border-purple-500/30 text-purple-400',
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
                ? 'bg-white/10 border-white/30 text-white'
                : `bg-white/5 ${tierStyles[stock.tier]} hover:bg-white/10`
            }`}
          >
            <span className="font-mono">{stock.ticker}</span>
            <span className="ml-1.5 text-xs opacity-50">{stock.label}</span>
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
    <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">52-Week Range</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Low: <span className="text-red-400 font-mono">{fmt(weekLow52)}</span></span>
          <span>High: <span className="text-green-400 font-mono">{fmt(weekHigh52)}</span></span>
        </div>
      </div>

      <div className="relative h-8 mb-2">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-red-500/20 via-yellow-500/20 to-green-500/20 border border-gray-700" />

        {pullbackLevels.map((level, i) => {
          const pos = ((level.price - weekLow52) / range) * 100
          if (pos < 0 || pos > 100) return null
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-yellow-500/40"
              style={{ left: `${pos}%` }}
              title={`-${level.percentage}%: ${fmt(level.price)}`}
            />
          )
        })}

        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
          style={{ left: `${Math.min(Math.max(currentPos, 2), 98)}%` }}
        >
          <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-[#1c1c28] shadow-lg shadow-blue-500/30" />
        </div>
      </div>

      <div className="flex justify-between items-center text-xs">
        <span className="text-red-400 font-mono">{fmt(weekLow52)}</span>
        <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-gray-700">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-white font-mono font-medium">{fmt(currentPrice)}</span>
          <span className="text-gray-500">({currentPos.toFixed(0)}% of range)</span>
        </div>
        <span className="text-green-400 font-mono">{fmt(weekHigh52)}</span>
      </div>

      <div className="mt-2 text-center">
        <span className="text-xs text-gray-500">
          Currently <span className="text-yellow-400 font-mono font-medium">
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
    <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Crosshair className="w-4 h-4 text-yellow-500" />
        Pullback Strike Zones
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {pullbackLevels.map((level, i) => {
          const savings = (currentPrice - level.price) * level.shares
          return (
            <div key={i} className="bg-white/5 border border-gray-800 rounded-lg p-3 text-center hover:border-yellow-500/30 transition-colors">
              <div className="text-lg font-bold text-yellow-400 font-mono">-{level.percentage}%</div>
              <div className="text-white font-mono text-sm mt-1">{fmt(level.price)}</div>
              <div className="h-px bg-gray-800 my-2" />
              <div className="text-xs text-gray-400">
                <span className="text-green-400 font-mono font-semibold">{level.shares.toLocaleString()}</span> shares
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Save <span className="text-green-400 font-mono">{fmtShort(savings)}</span>
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
    <div className="bg-[#1c1c28] border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Pullback × Velocity Matrix
        </h3>

        <div className="flex items-center bg-black/30 rounded-lg p-0.5 border border-gray-800">
          <button
            onClick={() => setHoldMode('short')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              holdMode === 'short'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Clock className="w-3 h-3 inline mr-1" />
            &lt;12 Months
          </button>
          <button
            onClick={() => setHoldMode('long')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              holdMode === 'long'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <CheckCircle className="w-3 h-3 inline mr-1" />
            12+ Months (CGT)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">PULLBACK</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">ENTRY</th>
              {matrix[0]?.map((cell, i) => (
                <th key={i} className="px-3 py-2.5 text-center text-xs font-semibold">
                  <span className={DEFAULT_VELOCITIES[i]?.color}>
                    {cell.velocityLabel} (+{cell.velocityPct}%)
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                <td className="px-3 py-3">
                  <span className="text-yellow-400 font-mono font-bold">-{row[0].pullbackPct}%</span>
                </td>
                <td className="px-3 py-3">
                  <span className="text-white font-mono text-xs">{fmt(row[0].entryPrice)}</span>
                </td>
                {row.map((cell, colIdx) => {
                  const cellKey = `${rowIdx}-${colIdx}`
                  const isHovered = hoveredCell === cellKey
                  const netProfit = holdMode === 'long' ? cell.netProfitLong : cell.netProfitShort
                  const netReturn = holdMode === 'long' ? cell.netReturnLong : cell.netReturnShort
                  const tax = holdMode === 'long' ? cell.taxLongTerm : cell.taxShortTerm

                  const hurdleBg =
                    cell.hurdleStatus === 'momentum'
                      ? 'bg-green-500/10 border-green-500/20'
                      : cell.hurdleStatus === 'cavalry'
                        ? 'bg-yellow-500/10 border-yellow-500/20'
                        : 'bg-white/5 border-gray-800'

                  return (
                    <td
                      key={colIdx}
                      className="px-2 py-3 text-center relative"
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div className={`rounded-lg border p-2 transition-all ${hurdleBg} ${isHovered ? 'ring-1 ring-white/20 scale-105' : ''}`}>
                        <div className={`font-mono font-bold text-sm ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmtShort(netProfit)}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {fmtPct(netReturn)} net
                        </div>
                        {cell.hurdleStatus !== 'none' && (
                          <div className={`text-[9px] mt-1 px-1.5 py-0.5 rounded-full inline-block font-medium ${
                            cell.hurdleStatus === 'momentum'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {cell.hurdleStatus === 'momentum' ? 'MOM ✓' : 'CAV ✓'}
                          </div>
                        )}
                      </div>

                      {isHovered && (
                        <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-[#0d0d15] border border-gray-700 rounded-lg p-3 shadow-xl text-left pointer-events-none">
                          <div className="text-xs space-y-1.5 text-white">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Entry</span>
                              <span className="font-mono">{fmt(cell.entryPrice)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Exit</span>
                              <span className="font-mono">{fmt(cell.exitPrice)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Upside</span>
                              <span className="font-mono text-green-400">{fmtPct(cell.upsidePct)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Shares</span>
                              <span className="font-mono">{cell.shares.toLocaleString()}</span>
                            </div>
                            <div className="h-px bg-gray-700" />
                            <div className="flex justify-between">
                              <span className="text-gray-500">Gross Gain</span>
                              <span className="font-mono">{fmtShort(cell.grossGain)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">CGT</span>
                              <span className="font-mono text-red-400">-{fmtShort(tax)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                              <span className="text-gray-300">Net Profit</span>
                              <span className="font-mono text-green-400">{fmtShort(netProfit)}</span>
                            </div>
                          </div>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0d0d15] border-r border-b border-gray-700 rotate-45" />
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

      <div className="px-4 py-2 border-t border-gray-800 flex flex-wrap items-center gap-4 text-xs">
        <span className="text-gray-600 uppercase tracking-wider">Hurdle:</span>
        <span className="text-green-400">MOM ✓ = Momentum (20%+)</span>
        <span className="text-yellow-400">CAV ✓ = Cavalry (15%+)</span>
        <span className="text-gray-600">Below hurdle</span>
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

  const scored = allCells
    .map((cell) => {
      const netReturn = holdMode === 'long' ? cell.netReturnLong : cell.netReturnShort
      return { ...cell, score: netReturn / cell.pullbackPct, netReturn }
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0]

  const highestProfit = [...allCells].sort((a, b) => {
    const pa = holdMode === 'long' ? a.netProfitLong : a.netProfitShort
    const pb = holdMode === 'long' ? b.netProfitLong : b.netProfitShort
    return pb - pa
  })[0]

  const bestNet = holdMode === 'long' ? best.netProfitLong : best.netProfitShort
  const highNet = holdMode === 'long' ? highestProfit.netProfitLong : highestProfit.netProfitShort

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl border-t-2 border-t-green-500 p-4">
        <h4 className="text-xs font-semibold text-green-400 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          BEST RISK / REWARD
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Wait for</span>
            <span className="text-yellow-400 font-mono font-bold">-{best.pullbackPct}% pullback</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Enter at</span>
            <span className="text-white font-mono">{fmt(best.entryPrice)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Target</span>
            <span className="text-white font-mono">{fmt(best.exitPrice)} ({best.velocityLabel})</span>
          </div>
          <div className="pt-2 border-t border-gray-700">
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-white">Net Profit</span>
              <span className="text-xl font-bold font-mono text-green-400">{fmtShort(bestNet)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">Net Return</span>
              <span className="font-mono text-sm font-semibold text-green-400">{fmtPct(best.netReturn)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl border-t-2 border-t-blue-500 p-4">
        <h4 className="text-xs font-semibold text-blue-400 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          HIGHEST ABSOLUTE PROFIT
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Wait for</span>
            <span className="text-yellow-400 font-mono font-bold">-{highestProfit.pullbackPct}% pullback</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Enter at</span>
            <span className="text-white font-mono">{fmt(highestProfit.entryPrice)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-800/50">
            <span className="text-gray-400">Target</span>
            <span className="text-white font-mono">{fmt(highestProfit.exitPrice)} ({highestProfit.velocityLabel})</span>
          </div>
          <div className="pt-2 border-t border-gray-700">
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-white">Net Profit</span>
              <span className="text-xl font-bold font-mono text-blue-400">{fmtShort(highNet)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">Net Return</span>
              <span className="font-mono text-sm font-semibold text-blue-400">
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
    return Math.max(best, cgt.net - cgtNow.net)
  }, 0)

  return (
    <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-purple-400 mb-1 flex items-center gap-2">
        <Timer className="w-4 h-4" />
        PATIENCE PREMIUM
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Extra profit from waiting vs buying today — using Medium Velocity (+{medVel}%) target
      </p>

      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-gray-800">
          <div className="w-14 text-xs text-gray-500 font-semibold">NOW</div>
          <div className="flex-1 text-xs text-white font-mono">
            {fmt(currentPrice)} × {sharesNow} shares
          </div>
          <div className="text-xs text-gray-400 font-mono">Net: {fmtShort(cgtNow.net)}</div>
          <div className="w-24 text-right text-xs text-gray-600">— baseline —</div>
        </div>

        {pullbackLevels.map((level, i) => {
          const exitP = level.price * (1 + medVel / 100)
          const gross = (exitP - level.price) * level.shares
          const cgt = calcCGT(gross, holdMode === 'long')
          const premium = cgt.net - cgtNow.net

          return (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-gray-800 hover:border-purple-500/30 transition-colors">
              <div className="w-14 text-xs text-yellow-400 font-mono font-bold">-{level.percentage}%</div>
              <div className="flex-1 text-xs text-white font-mono">
                {fmt(level.price)} × {level.shares} shares
              </div>
              <div className="text-xs text-gray-400 font-mono">Net: {fmtShort(cgt.net)}</div>
              <div className="w-24 text-right">
                <span className={`text-xs font-mono font-bold ${premium > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {premium > 0 ? '+' : ''}{fmtShort(premium)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <p className="text-xs text-purple-300">
          <Sparkles className="w-3 h-3 inline mr-1" />
          Maximum patience premium: <span className="font-mono font-bold text-purple-400">{fmtShort(bestPremium)}</span> — extra profit from waiting for the deepest pullback vs buying today.
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
  const [showSettings, setShowSettings] = useState(false)

  const fetchStock = useCallback(async (sym: string) => {
    if (!sym.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pullback-quote?symbol=${sym.toUpperCase()}`)
      if (!res.ok) throw new Error('Failed to fetch stock data')
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      setStockData({
        ticker: data.symbol || sym.toUpperCase(),
        name: data.name || sym.toUpperCase(),
        currentPrice: data.currentPrice || 0,
        weekHigh52: data.weekHigh52 || 0,
        weekLow52: data.weekLow52 || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
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
      {/* ══════════════════════════════════════════════
          SEARCH BAR — Prominent, Yahoo Finance-style
          ══════════════════════════════════════════════ */}
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter' && searchInput.trim()) fetchStock(searchInput.trim()) }}
              placeholder="Search any stock... (e.g. AAPL, TSLA, MSFT)"
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-gray-700 rounded-xl text-white text-base font-mono placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
          </div>
          <button
            onClick={() => { if (searchInput.trim()) fetchStock(searchInput.trim()) }}
            disabled={loading || !searchInput.trim()}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {loading ? '' : 'Go'}
          </button>
        </div>

        {/* Presets below search */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-600">Quick:</span>
          <PresetBar onSelect={(t) => { setSearchInput(t); fetchStock(t) }} activeTicker={ticker} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SETTINGS (collapsed by default)
          ══════════════════════════════════════════════ */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {showSettings ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Deployment & Velocity Settings
      </button>

      {showSettings && (
        <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Deployment */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">DEPLOYMENT AMOUNT (USD)</label>
              <input
                type="number"
                value={deployment}
                onChange={(e) => setDeployment(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-white/5 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-1.5 mt-2">
                {[5000, 10000, 20000, 50000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setDeployment(amt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                      deployment === amt
                        ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                        : 'bg-white/5 border-gray-800 text-gray-500 hover:text-white hover:border-gray-600'
                    }`}
                  >
                    ${(amt / 1000).toFixed(0)}K
                  </button>
                ))}
              </div>
            </div>

            {/* Velocity targets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-500">VELOCITY TARGETS</label>
                <button
                  onClick={() => setShowVelocityEditor(!showVelocityEditor)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
                >
                  {showVelocityEditor ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Edit
                </button>
              </div>
              {!showVelocityEditor ? (
                <div className="flex gap-2">
                  {velocities.map((v, i) => (
                    <div key={i} className="flex-1 bg-white/5 border border-gray-800 rounded-lg px-3 py-2 text-center">
                      <div className={`text-xs font-medium ${v.color}`}>{v.label}</div>
                      <div className="text-white font-mono text-sm">+{v.percentage}%</div>
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
                        className="w-20 px-2 py-1 bg-white/5 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
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
                          className="w-full px-2 py-1 bg-white/5 border border-gray-700 rounded text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setVelocities(DEFAULT_VELOCITIES)}
                    className="text-[10px] text-gray-600 hover:text-gray-400"
                  >
                    Reset to defaults
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          RESULTS
          ══════════════════════════════════════════════ */}
      {stockData && (
        <>
          {/* Summary bar */}
          <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500 mb-1">TICKER</p>
                <p className="text-lg font-bold text-white font-mono">{stockData.ticker}</p>
                <p className="text-xs text-gray-500 truncate">{stockData.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">CURRENT PRICE</p>
                <p className="text-lg font-bold text-white font-mono">{fmt(stockData.currentPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">TODAY</p>
                <p className={`text-lg font-bold font-mono ${stockData.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(stockData.changePercent)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">DEPLOYMENT</p>
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
        <div className="bg-[#1c1c28] border border-gray-800 border-dashed rounded-xl p-10 text-center">
          <TrendingDown className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Search for any stock or use the quick-load presets above</p>
          <p className="text-gray-600 text-xs mt-1">Model pullback entry points against velocity exit targets</p>
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Pullback Calculator • Tax: 32.5% • CGT discount: 50% (12+ month hold) • Not financial advice
      </p>
    </div>
  )
}
