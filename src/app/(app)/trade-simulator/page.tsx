'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Target,
  TrendingUp,
  Clock,
  Calendar,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Zap,
  RefreshCw,
  History,
} from 'lucide-react'

const TAX_RATE = 0.325
const CGT_DISCOUNT = 0.5

const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = (n: number) => `${n.toFixed(2)}%`

interface Scenario {
  id: string
  ticker: string
  entry_price: number
  exit_price: number
  shares: number
  upside_pct: number
  hurdle_status: string
  net_profit_short: number
  net_profit_long: number
  trade_thesis: string
  status: string
  created_at: string
}

export default function TradeSimulatorPage() {
  const [ticker, setTicker] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [shares, setShares] = useState('')
  const [capitalLoss, setCapitalLoss] = useState('')
  const [brokerage, setBrokerage] = useState('3')
  const [tradeThesis, setTradeThesis] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadScenarios()
  }, [])

  const loadScenarios = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('trade_scenarios')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setScenarios(data || [])
  }

  // All calculations
  const entry = parseFloat(entryPrice) || 0
  const exit = parseFloat(exitPrice) || 0
  const qty = parseInt(shares) || 0
  const loss = parseFloat(capitalLoss) || 0
  const brk = parseFloat(brokerage) || 0

  const totalInvested = entry * qty
  const totalExit = exit * qty
  const grossGain = totalExit - totalInvested
  const upsidePct = entry > 0 ? ((exit - entry) / entry) * 100 : 0

  const netGainAfterLoss = Math.max(0, grossGain - loss)
  const taxShort = netGainAfterLoss * TAX_RATE
  const taxLong = netGainAfterLoss * CGT_DISCOUNT * TAX_RATE
  const netProfitShort = grossGain - taxShort - (brk * 2)
  const netProfitLong = grossGain - taxLong - (brk * 2)
  const taxSaving = taxShort - taxLong
  const netReturnShort = totalInvested > 0 ? (netProfitShort / totalInvested) * 100 : 0
  const netReturnLong = totalInvested > 0 ? (netProfitLong / totalInvested) * 100 : 0

  const hurdleStatus = upsidePct >= 20 ? 'MOMENTUM' : upsidePct >= 15 ? 'CAVALRY' : 'BELOW'

  // Quick exits
  const quickExits = entry > 0 ? [
    { label: '+15%', price: entry * 1.15 },
    { label: '+25%', price: entry * 1.25 },
    { label: '+50%', price: entry * 1.50 },
    { label: '+100%', price: entry * 2.00 },
    { label: '🚀 3x', price: entry * 3.00 },
  ] : []

  // Exit scenarios table
  const exitRows = entry > 0 && qty > 0 ? [1.05, 1.10, 1.15, 1.20, 1.25, 1.30, 1.50, 1.75, 2.00, 2.50, 3.00].map(mult => {
    const rowExit = entry * mult
    const rowGross = (rowExit - entry) * qty
    const rowNet = Math.max(0, rowGross - loss)
    const rowTaxS = rowNet * TAX_RATE
    const rowTaxL = rowNet * CGT_DISCOUNT * TAX_RATE
    const rowNetS = rowGross - rowTaxS - (brk * 2)
    const rowNetL = rowGross - rowTaxL - (brk * 2)
    const rowUp = (mult - 1) * 100
    const rowHurdle = rowUp >= 20 ? 'MOM ✅' : rowUp >= 15 ? 'CAV ✅' : '❌'
    return { mult, exit: rowExit, gross: rowGross, taxS: rowTaxS, taxL: rowTaxL, netS: rowNetS, netL: rowNetL, up: rowUp, hurdle: rowHurdle }
  }) : []

  const saveScenario = async () => {
    if (!ticker || entry <= 0 || exit <= 0 || qty <= 0) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('trade_scenarios').insert({
        user_id: user.id,
        ticker: ticker.toUpperCase(),
        entry_price: entry,
        exit_price: exit,
        shares: qty,
        capital_loss_offset: loss,
        brokerage: brk,
        upside_pct: upsidePct,
        gross_gain: grossGain,
        net_profit_short: netProfitShort,
        net_profit_long: netProfitLong,
        hurdle_status: hurdleStatus,
        trade_thesis: tradeThesis,
      })
      setTradeThesis('')
      loadScenarios()
    }
    setSaving(false)
  }

  const deleteScenario = async (id: string) => {
    const supabase = createClient()
    await supabase.from('trade_scenarios').delete().eq('id', id)
    loadScenarios()
  }

  const hasInput = entry > 0 && exit > 0 && qty > 0

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-600" />
            Trade Simulator
          </h1>
          <p className="text-sm text-gray-500">Model entry → exit economics before pulling the trigger</p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg"
        >
          <History className="w-4 h-4" />
          History
          <span className="bg-slate-300 text-xs px-1.5 py-0.5 rounded-full">{scenarios.length}</span>
        </button>
      </div>

      {/* Input Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">TICKER</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="NVDA"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ENTRY PRICE</label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">EXIT PRICE</label>
            <input
              type="number"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">SHARES</label>
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="100"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
            />
          </div>
        </div>

        {quickExits.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-gray-500 self-center">Quick exits:</span>
            {quickExits.map((q) => (
              <button
                key={q.label}
                onClick={() => setExitPrice(q.price.toFixed(2))}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Show Capital Loss Offset & Brokerage
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CAPITAL LOSS OFFSET</label>
              <input
                type="number"
                value={capitalLoss}
                onChange={(e) => setCapitalLoss(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">BROKERAGE (per trade)</label>
              <input
                type="number"
                value={brokerage}
                onChange={(e) => setBrokerage(e.target.value)}
                placeholder="3.00"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Row */}
      {hasInput && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400 mb-1">TICKER</p>
              <p className="text-lg font-bold text-white font-mono">{ticker || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">CAPITAL DEPLOYED</p>
              <p className="text-lg font-bold text-white font-mono">{fmt(totalInvested)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">EXIT VALUE</p>
              <p className="text-lg font-bold text-white font-mono">{fmt(totalExit)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">GROSS GAIN</p>
              <p className={`text-lg font-bold font-mono ${grossGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(grossGain)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">UPSIDE</p>
              <p className={`text-lg font-bold font-mono ${upsidePct >= 15 ? 'text-emerald-400' : 'text-orange-400'}`}>{fmtPct(upsidePct)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Hurdle Banner */}
      {hasInput && upsidePct > 0 && (
        <div className={`rounded-xl p-4 border ${
          hurdleStatus === 'MOMENTUM' ? 'bg-emerald-50 border-emerald-200' :
          hurdleStatus === 'CAVALRY' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            {hurdleStatus === 'MOMENTUM' && <CheckCircle className="w-6 h-6 text-emerald-600" />}
            {hurdleStatus === 'CAVALRY' && <Zap className="w-6 h-6 text-yellow-600" />}
            {hurdleStatus === 'BELOW' && <XCircle className="w-6 h-6 text-red-500" />}
            <div>
              <p className={`font-bold ${
                hurdleStatus === 'MOMENTUM' ? 'text-emerald-700' :
                hurdleStatus === 'CAVALRY' ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {hurdleStatus === 'MOMENTUM' && 'MOMENTUM HURDLE CLEARED'}
                {hurdleStatus === 'CAVALRY' && 'CAVALRY HURDLE CLEARED'}
                {hurdleStatus === 'BELOW' && 'BELOW CAVALRY HURDLE (15%)'}
              </p>
              <p className="text-sm text-gray-600">
                {fmtPct(upsidePct)} upside
                {hurdleStatus === 'MOMENTUM' && ' qualifies for Momentum tier (20%+ target)'}
                {hurdleStatus === 'CAVALRY' && ' meets Cavalry minimum (15-20% pre-tax)'}
                {hurdleStatus === 'BELOW' && " — the mantra: if it doesn't clear the hurdle, don't touch it."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CGT Scenario Cards */}
      {hasInput && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Short Term */}
          <div className="rounded-xl border-t-4 border-t-orange-400 bg-white border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-gray-900">Sell &lt; 12 Months</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Gross Capital Gain</span>
                <span className={`font-mono font-semibold ${grossGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(grossGain)}</span>
              </div>
              {loss > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-600">Less: Capital Loss Offset</span>
                  <span className="font-mono text-orange-600">-{fmt(loss)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Taxable Amount</span>
                <span className="font-mono">{fmt(netGainAfterLoss)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">CGT @ 32.5%</span>
                <span className="font-mono text-red-600">-{fmt(taxShort)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500 text-xs">Brokerage (Buy + Sell)</span>
                <span className="font-mono text-gray-500 text-xs">-{fmt(brk * 2)}</span>
              </div>
              <div className="pt-2 border-t-2 border-gray-200">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-gray-900">Net Profit (After Tax)</span>
                  <span className={`text-xl font-bold font-mono ${netProfitShort >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(netProfitShort)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">Net Return on Capital</span>
                  <span className={`font-mono text-sm font-semibold ${netReturnShort >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtPct(netReturnShort)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Long Term */}
          <div className="rounded-xl border-t-4 border-t-emerald-400 bg-white border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-gray-900">Sell &gt; 12 Months (CGT Discount)</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Gross Capital Gain</span>
                <span className={`font-mono font-semibold ${grossGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(grossGain)}</span>
              </div>
              {loss > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-600">Less: Capital Loss Offset</span>
                  <span className="font-mono text-orange-600">-{fmt(loss)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">50% CGT Discount</span>
                <span className="font-mono text-cyan-600">-{fmt(netGainAfterLoss * 0.5)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Taxable Amount</span>
                <span className="font-mono">{fmt(netGainAfterLoss * 0.5)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">CGT @ 32.5%</span>
                <span className="font-mono text-red-600">-{fmt(taxLong)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500 text-xs">Brokerage (Buy + Sell)</span>
                <span className="font-mono text-gray-500 text-xs">-{fmt(brk * 2)}</span>
              </div>
              <div className="pt-2 border-t-2 border-gray-200">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-gray-900">Net Profit (After Tax)</span>
                  <span className={`text-xl font-bold font-mono ${netProfitLong >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(netProfitLong)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">Net Return on Capital</span>
                  <span className={`font-mono text-sm font-semibold ${netReturnLong >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtPct(netReturnLong)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12-Month Hold Advantage */}
      {hasInput && grossGain > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            12-MONTH HOLD ADVANTAGE
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400 mb-1">TAX IF SOLD &lt;12M</p>
              <p className="text-lg font-bold font-mono text-red-400">{fmt(taxShort)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">TAX IF SOLD &gt;12M</p>
              <p className="text-lg font-bold font-mono text-emerald-400">{fmt(taxLong)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">YOU SAVE BY WAITING</p>
              <p className="text-lg font-bold font-mono text-orange-400">{fmt(taxSaving)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Exit Scenario Table */}
      {exitRows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-purple-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              EXIT SCENARIO TABLE — {ticker.toUpperCase() || 'STOCK'} @ {fmt(entry)} × {qty} shares
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Exit $</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Upside %</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Gross Gain</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Tax (&lt;12m)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Net (&lt;12m)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Tax (&gt;12m)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Net (&gt;12m)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Hurdle</th>
                </tr>
              </thead>
              <tbody>
                {exitRows.map((row) => (
                  <tr
                    key={row.mult}
                    onClick={() => setExitPrice(row.exit.toFixed(2))}
                    className="border-b border-gray-50 cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 text-right font-mono">${row.exit.toFixed(0)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${row.up >= 15 ? 'text-emerald-600' : 'text-orange-500'}`}>{row.up.toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(row.gross)}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-500">{fmt(row.taxS)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">{fmt(row.netS)}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-500">{fmt(row.taxL)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">{fmt(row.netL)}</td>
                    <td className="px-3 py-2 text-right text-xs">{row.hurdle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 text-center py-2 bg-gray-50">
            Click any row to set as exit target • MOM = Momentum (20%+) • CAV = Cavalry (15%+)
          </p>
        </div>
      )}

      {/* Save Section */}
      {hasInput && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Save className="w-4 h-4 text-gray-400" />
            Save to Decision Journal
          </h4>
          <textarea
            value={tradeThesis}
            onChange={(e) => setTradeThesis(e.target.value)}
            placeholder="Why are you considering this trade?"
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3"
          />
          <button
            onClick={saveScenario}
            disabled={saving || !ticker}
            className="w-full py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Scenario
          </button>
        </div>
      )}

      {/* History */}
      {showHistory && scenarios.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="p-4 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900">Decision Journal</h4>
          </div>
          <div className="divide-y divide-gray-100">
            {scenarios.map((s) => (
              <div key={s.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold">{s.ticker}</span>
                    <span className="text-gray-400 mx-2">→</span>
                    <span className="font-mono text-sm">${s.entry_price} → ${s.exit_price}</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                      s.hurdle_status === 'MOMENTUM' ? 'bg-emerald-100 text-emerald-700' :
                      s.hurdle_status === 'CAVALRY' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{s.hurdle_status}</span>
                  </div>
                  <button onClick={() => deleteScenario(s.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {s.trade_thesis && <p className="text-xs text-gray-600 italic mt-2">"{s.trade_thesis}"</p>}
                <p className="text-xs text-gray-400 mt-2">{new Date(s.created_at).toLocaleDateString('en-AU')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        SWT Trade Simulator • Tax rate: 32.5% • CGT discount: 50% (12+ month hold) • Not financial advice
      </p>
    </div>
  )
}
