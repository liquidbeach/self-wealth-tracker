'use client'

import { useState, useMemo } from 'react'
import {
  Calculator, DollarSign, TrendingUp, TrendingDown,
  Shield, ArrowRight, AlertTriangle,
} from 'lucide-react'

const CGT_SHORT = 0.37
const CGT_LONG = 0.185

function fmt(n: number) { return '$' + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtInt(n: number) { return '$' + Math.abs(Math.round(n)).toLocaleString('en-AU') }
function pct(n: number) { return (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%' }

interface QuickCalcProps {
  onUseInSimulator?: (values: { ticker: string; entry: number; exit: number; shares: number }) => void
}

export default function QuickCalc({ onUseInSimulator }: QuickCalcProps) {
  const [ticker, setTicker] = useState('')
  const [investmentAmt, setInvestmentAmt] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')

  const calc = useMemo(() => {
    const invest = parseFloat(investmentAmt) || 0
    const entry = parseFloat(entryPrice) || 0
    const exit = parseFloat(exitPrice) || 0
    const stop = parseFloat(stopPrice) || 0

    if (entry <= 0 || invest <= 0) return null

    const shares = Math.floor(invest / entry)
    const invested = shares * entry
    const leftover = invest - invested
    const exitValue = shares * exit
    const gross = exitValue - invested
    const upside = (exit - entry) / entry

    const cgtShort = gross > 0 ? gross * CGT_SHORT : 0
    const netShort = gross - cgtShort
    const cgtLong = gross > 0 ? gross * CGT_LONG : 0
    const netLong = gross - cgtLong

    const stopLoss = stop > 0 ? (stop - entry) * shares : null
    const stopPct = stop > 0 ? (stop - entry) / entry : null

    return { shares, invested, leftover, exitValue, gross, upside, cgtShort, netShort, cgtLong, netLong, stopLoss, stopPct }
  }, [investmentAmt, entryPrice, exitPrice, stopPrice])

  const hasExit = parseFloat(exitPrice) > 0
  const hasResult = calc && calc.shares > 0

  return (
    <div className="space-y-4">
      {/* Input Card */}
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-bold text-white">Quick Calc</h2>
          <span className="text-xs text-gray-500">— enter your numbers, get instant results</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {/* Ticker */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. IREN"
              className="w-full px-3 py-2.5 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Investment Amount */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Investment ($)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="number"
                value={investmentAmt}
                onChange={(e) => setInvestmentAmt(e.target.value)}
                placeholder="12500"
                className="w-full pl-8 pr-3 py-2.5 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                step="any" min="0"
              />
            </div>
          </div>

          {/* Entry Price */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Entry Price ($)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="49.50"
                className="w-full pl-8 pr-3 py-2.5 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                step="any" min="0"
              />
            </div>
          </div>

          {/* Exit Price */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Exit Price ($)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500/50" />
              <input
                type="number"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder="90.00"
                className="w-full pl-8 pr-3 py-2.5 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono placeholder:text-gray-600 focus:outline-none focus:border-green-500"
                step="any" min="0"
              />
            </div>
          </div>

          {/* Stop Price */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Stop Price ($)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500/50" />
              <input
                type="number"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder="32.00"
                className="w-full pl-8 pr-3 py-2.5 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono placeholder:text-gray-600 focus:outline-none focus:border-red-500"
                step="any" min="0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {hasResult && (
        <>
          {/* Position Summary */}
          <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-5">
            <h3 className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Position</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Shares</p>
                <p className="text-xl font-bold text-white font-mono">{calc.shares.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Invested</p>
                <p className="text-xl font-bold text-white font-mono">{fmtInt(calc.invested)}</p>
                {calc.leftover > 0.01 && (
                  <p className="text-[10px] text-gray-600 font-mono">{fmt(calc.leftover)} remaining</p>
                )}
              </div>
              {hasExit && (
                <>
                  <div>
                    <p className="text-xs text-gray-500">Exit Value</p>
                    <p className="text-xl font-bold text-blue-400 font-mono">{fmtInt(calc.exitValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Upside</p>
                    <p className={`text-xl font-bold font-mono ${calc.upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pct(calc.upside)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* CGT Breakdown */}
          {hasExit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Short-term */}
              <div className="bg-[#1c1c28] border border-gray-800 rounded-xl border-t-2 border-t-red-500/50 p-5">
                <h3 className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-3">
                  Hold {'<'} 12 Months (CGT @ {(CGT_SHORT * 100).toFixed(0)}%)
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-gray-800/50">
                    <span className="text-sm text-gray-400">Gross Profit</span>
                    <span className={`font-mono font-medium ${calc.gross >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {calc.gross >= 0 ? fmtInt(calc.gross) : `-${fmtInt(calc.gross)}`}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-800/50">
                    <span className="text-sm text-gray-400">CGT Payable</span>
                    <span className="font-mono text-red-400">{calc.cgtShort > 0 ? `-${fmtInt(calc.cgtShort)}` : '$0'}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm font-semibold text-white">Net Profit</span>
                    <span className={`text-lg font-mono font-bold ${calc.netShort >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {calc.netShort >= 0 ? fmtInt(calc.netShort) : `-${fmtInt(calc.netShort)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Net Return</span>
                    <span className={`text-xs font-mono ${calc.netShort >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pct(calc.invested > 0 ? calc.netShort / calc.invested : 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Long-term */}
              <div className="bg-[#1c1c28] border border-gray-800 rounded-xl border-t-2 border-t-green-500/50 p-5">
                <h3 className="text-[10px] text-green-400 uppercase tracking-wider font-semibold mb-3">
                  Hold {'>'} 12 Months (CGT @ {(CGT_LONG * 100).toFixed(1)}%)
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-gray-800/50">
                    <span className="text-sm text-gray-400">Gross Profit</span>
                    <span className={`font-mono font-medium ${calc.gross >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {calc.gross >= 0 ? fmtInt(calc.gross) : `-${fmtInt(calc.gross)}`}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-800/50">
                    <span className="text-sm text-gray-400">CGT Payable</span>
                    <span className="font-mono text-red-400">{calc.cgtLong > 0 ? `-${fmtInt(calc.cgtLong)}` : '$0'}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm font-semibold text-white">Net Profit</span>
                    <span className={`text-lg font-mono font-bold ${calc.netLong >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {calc.netLong >= 0 ? fmtInt(calc.netLong) : `-${fmtInt(calc.netLong)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Net Return</span>
                    <span className={`text-xs font-mono ${calc.netLong >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pct(calc.invested > 0 ? calc.netLong / calc.invested : 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 12-Month Advantage */}
          {hasExit && calc.gross > 0 && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-green-400 font-semibold">12-MONTH HOLD ADVANTAGE</p>
                <p className="text-xs text-gray-500 mt-0.5">You save <span className="text-green-400 font-mono font-bold">{fmtInt(calc.cgtShort - calc.cgtLong)}</span> in CGT by holding 12+ months</p>
              </div>
              <p className="text-2xl font-bold text-green-400 font-mono">+{fmtInt(calc.cgtShort - calc.cgtLong)}</p>
            </div>
          )}

          {/* Stop Loss */}
          {calc.stopLoss !== null && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-400" />
                <div>
                  <p className="text-xs text-red-400 font-semibold">STOP LOSS @ {fmt(parseFloat(stopPrice))}</p>
                  <p className="text-xs text-gray-500">Maximum downside risk</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-red-400 font-mono">-{fmtInt(Math.abs(calc.stopLoss))}</p>
                <p className="text-xs text-gray-500 font-mono">{pct(calc.stopPct!)}</p>
              </div>
            </div>
          )}

          {/* Use in Simulator button */}
          {onUseInSimulator && hasExit && ticker && (
            <button
              onClick={() => onUseInSimulator({
                ticker,
                entry: parseFloat(entryPrice),
                exit: parseFloat(exitPrice),
                shares: calc.shares,
              })}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-sm font-medium rounded-xl hover:bg-blue-600/20 transition-colors"
            >
              Use in Trade Simulator <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </>
      )}

      {/* Empty state */}
      {!hasResult && (
        <div className="bg-[#1c1c28] border border-gray-800 border-dashed rounded-xl p-10 text-center">
          <Calculator className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Enter investment amount and entry price to calculate shares</p>
          <p className="text-gray-600 text-xs mt-1">Add exit price and stop for full P&L and CGT breakdown</p>
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Quick Calc • CGT {'<'}12m: {(CGT_SHORT * 100).toFixed(0)}% • CGT {'>'}12m: {(CGT_LONG * 100).toFixed(1)}% • Not financial advice
      </p>
    </div>
  )
}
