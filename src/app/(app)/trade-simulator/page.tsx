'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Target,
  Calculator,
  TrendingUp,
  Clock,
  Calendar,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  History,
  Zap,
  ArrowRight,
} from 'lucide-react'

const TAX_RATE = 0.325
const CGT_DISCOUNT = 0.5
const BROKERAGE_DEFAULT = 3.00

const formatCurrency = (n: number) => 
  `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatPercent = (n: number) => `${n.toFixed(2)}%`

interface TradeScenario {
  id: string
  ticker: string
  entry_price: number
  exit_price: number
  shares: number
  capital_loss_offset: number
  brokerage: number
  upside_pct: number
  gross_gain: number
  net_profit_short: number
  net_profit_long: number
  hurdle_status: string
  trade_thesis: string
  status: string
  actual_entry_price?: number
  actual_exit_price?: number
  actual_profit?: number
  outcome_notes?: string
  created_at: string
}

export default function TradeSimulatorPage() {
  // Input state
  const [ticker, setTicker] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [shares, setShares] = useState('')
  const [capitalLoss, setCapitalLoss] = useState('')
  const [brokerage, setBrokerage] = useState(String(BROKERAGE_DEFAULT))
  const [tradeThesis, setTradeThesis] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Saved scenarios
  const [savedScenarios, setSavedScenarios] = useState<TradeScenario[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load saved scenarios
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
    
    setSavedScenarios(data || [])
    setLoading(false)
  }

  // Calculations
  const calc = useMemo(() => {
    const entry = parseFloat(entryPrice) || 0
    const exit = parseFloat(exitPrice) || 0
    const qty = parseInt(shares) || 0
    const loss = parseFloat(capitalLoss) || 0
    const brk = parseFloat(brokerage) || 0

    const totalInvested = entry * qty
    const totalExit = exit * qty
    const grossGain = totalExit - totalInvested
    const upsidePct = entry > 0 ? ((exit - entry) / entry) * 100 : 0

    // <12 month calculation (no CGT discount)
    const netGainAfterLoss = Math.max(0, grossGain - loss)
    const taxShort = netGainAfterLoss * TAX_RATE
    const netProfitShort = grossGain - taxShort - (brk * 2)

    // >12 month calculation (50% CGT discount)
    const taxableLong = netGainAfterLoss * CGT_DISCOUNT
    const taxLong = taxableLong * TAX_RATE
    const netProfitLong = grossGain - taxLong - (brk * 2)

    // Tax savings by holding 12+ months
    const taxSaving = taxShort - taxLong

    // Net return %
    const netReturnShort = totalInvested > 0 ? (netProfitShort / totalInvested) * 100 : 0
    const netReturnLong = totalInvested > 0 ? (netProfitLong / totalInvested) * 100 : 0

    // Hurdle status
    let hurdleStatus = 'BELOW'
    if (upsidePct >= 20) hurdleStatus = 'MOMENTUM'
    else if (upsidePct >= 15) hurdleStatus = 'CAVALRY'

    return {
      entry, exit, qty, loss, brk,
      totalInvested, totalExit, grossGain, upsidePct,
      netGainAfterLoss, taxShort, taxLong,
      netProfitShort, netProfitLong,
      netReturnShort, netReturnLong,
      taxSaving, hurdleStatus
    }
  }, [entryPrice, exitPrice, shares, capitalLoss, brokerage])

  // Quick exit scenarios
  const quickExits = useMemo(() => {
    const entry = calc.entry
    if (entry <= 0) return []
    return [
      { label: '+15%', price: entry * 1.15, pct: 15 },
      { label: '+25%', price: entry * 1.25, pct: 25 },
      { label: '+50%', price: entry * 1.50, pct: 50 },
      { label: '+100%', price: entry * 2.00, pct: 100 },
      { label: '🚀 3x', price: entry * 3.00, pct: 200 },
    ]
  }, [calc.entry])

  // Exit scenario table data
  const exitScenarios = useMemo(() => {
    if (calc.entry <= 0 || calc.qty <= 0) return []
    
    return [1.05, 1.10, 1.15, 1.20, 1.25, 1.30, 1.50, 1.75, 2.00, 2.50, 3.00].map(mult => {
      const exit = calc.entry * mult
      const gross = (exit - calc.entry) * calc.qty
      const netGain = Math.max(0, gross - calc.loss)
      const taxS = netGain * TAX_RATE
      const taxL = netGain * CGT_DISCOUNT * TAX_RATE
      const brk2 = calc.brk * 2
      const netS = gross - taxS - brk2
      const netL = gross - taxL - brk2
      const upPct = (mult - 1) * 100
      const hurdle = upPct >= 20 ? 'MOM' : upPct >= 15 ? 'CAV' : 'BELOW'

      return { mult, exit, gross, taxS, taxL, netS, netL, upPct, hurdle }
    })
  }, [calc])

  // Save scenario
  const saveScenario = async () => {
    if (!ticker || calc.entry <= 0 || calc.exit <= 0 || calc.qty <= 0) {
      alert('Please fill in ticker, entry price, exit price, and shares')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      alert('Please log in to save scenarios')
      setSaving(false)
      return
    }

    await supabase.from('trade_scenarios').insert({
      user_id: user.id,
      ticker: ticker.toUpperCase(),
      entry_price: calc.entry,
      exit_price: calc.exit,
      shares: calc.qty,
      capital_loss_offset: calc.loss,
      brokerage: calc.brk,
      upside_pct: calc.upsidePct,
      gross_gain: calc.grossGain,
      net_profit_short: calc.netProfitShort,
      net_profit_long: calc.netProfitLong,
      hurdle_status: calc.hurdleStatus,
      trade_thesis: tradeThesis,
    })

    setSaving(false)
    setTradeThesis('')
    loadScenarios()
  }

  // Delete scenario
  const deleteScenario = async (id: string) => {
    if (!confirm('Delete this scenario?')) return
    const supabase = createClient()
    await supabase.from('trade_scenarios').delete().eq('id', id)
    loadScenarios()
  }

  // Update scenario status
  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient()
    await supabase.from('trade_scenarios').update({ status }).eq('id', id)
    loadScenarios()
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-600" />
            Trade Simulator
          </h1>
          <p className="text-sm text-gray-500">Model entry → exit economics before pulling the trigger</p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200"
        >
          <History className="w-4 h-4" />
          <span className="hidden sm:inline">History</span>
          <span className="bg-slate-300 text-slate-700 text-xs px-1.5 py-0.5 rounded-full">{savedScenarios.length}</span>
        </button>
      </div>

      {/* Input Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">TICKER</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="NVDA"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">ENTRY PRICE</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">EXIT PRICE</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">SHARES</label>
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="100"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Quick Exit Buttons */}
        {calc.entry > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-gray-500 self-center mr-1">Quick exits:</span>
            {quickExits.map((q) => (
              <button
                key={q.label}
                onClick={() => setExitPrice(q.price.toFixed(2))}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  Math.abs(calc.exit - q.price) < 0.01
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        {/* Advanced Options Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-3"
        >
          {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Advanced options
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 mb-4 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CAPITAL LOSS OFFSET</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  value={capitalLoss}
                  onChange={(e) => setCapitalLoss(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Losses to offset against this gain</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">BROKERAGE (per trade)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  value={brokerage}
                  onChange={(e) => setBrokerage(e.target.value)}
                  placeholder="3.00"
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Row */}
      {calc.entry > 0 && calc.exit > 0 && calc.qty > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400 mb-1">TICKER</p>
              <p className="text-lg font-bold text-white font-mono">{ticker || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">CAPITAL DEPLOYED</p>
              <p className="text-lg font-bold text-white font-mono">{formatCurrency(calc.totalInvested)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">EXIT VALUE</p>
              <p className="text-lg font-bold text-white font-mono">{formatCurrency(calc.totalExit)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">GROSS GAIN</p>
              <p className={`text-lg font-bold font-mono ${calc.grossGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(calc.grossGain)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">UPSIDE</p>
              <p className={`text-lg font-bold font-mono ${calc.upsidePct >= 15 ? 'text-emerald-400' : 'text-orange-400'}`}>
                {formatPercent(calc.upsidePct)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hurdle Status Banner */}
      {calc.upsidePct > 0 && (
        <div className={`rounded-xl p-4 border ${
          calc.hurdleStatus === 'MOMENTUM' 
            ? 'bg-emerald-50 border-emerald-200' 
            : calc.hurdleStatus === 'CAVALRY'
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            {calc.hurdleStatus === 'MOMENTUM' && <CheckCircle className="w-6 h-6 text-emerald-600" />}
            {calc.hurdleStatus === 'CAVALRY' && <Zap className="w-6 h-6 text-yellow-600" />}
            {calc.hurdleStatus === 'BELOW' && <XCircle className="w-6 h-6 text-red-500" />}
            <div>
              <p className={`font-bold ${
                calc.hurdleStatus === 'MOMENTUM' ? 'text-emerald-700' :
                calc.hurdleStatus === 'CAVALRY' ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {calc.hurdleStatus === 'MOMENTUM' && 'MOMENTUM HURDLE CLEARED'}
                {calc.hurdleStatus === 'CAVALRY' && 'CAVALRY HURDLE CLEARED'}
                {calc.hurdleStatus === 'BELOW' && 'BELOW CAVALRY HURDLE (15%)'}
              </p>
              <p className="text-sm text-gray-600">
                {formatPercent(calc.upsidePct)} upside
                {calc.hurdleStatus === 'MOMENTUM' && ' qualifies for Momentum tier (20%+ target)'}
                {calc.hurdleStatus === 'CAVALRY' && ' meets Cavalry minimum (15-20% pre-tax)'}
                {calc.hurdleStatus === 'BELOW' && " — the mantra: if it doesn't clear the hurdle, don't touch it."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CGT Scenario Cards */}
      {calc.entry > 0 && calc.exit > 0 && calc.qty > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Short Term (<12 months) */}
          <div className={`rounded-xl border-t-4 ${calc.grossGain > 0 ? 'border-t-orange-400' : 'border-t-red-400'} bg-white border border-gray-200 p-4`}>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-gray-900">Sell &lt; 12 Months</h3>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Gross Capital Gain</span>
                <span className={`font-mono font-semibold ${calc.grossGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(calc.grossGain)}
                </span>
              </div>
              {calc.loss > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-600">Less: Capital Loss Offset</span>
                  <span className="font-mono text-orange-600">-{formatCurrency(calc.loss)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Taxable Amount</span>
                <span className="font-mono">{formatCurrency(calc.netGainAfterLoss)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">CGT @ 32.5%</span>
                <span className="font-mono text-red-600">-{formatCurrency(calc.taxShort)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500 text-xs">Brokerage (Buy + Sell)</span>
                <span className="font-mono text-gray-500 text-xs">-{formatCurrency(calc.brk * 2)}</span>
              </div>
              
              <div className="pt-2 border-t-2 border-gray-200">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-gray-900">Net Profit (After Tax)</span>
                  <span className={`text-xl font-bold font-mono ${calc.netProfitShort >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(calc.netProfitShort)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">Net Return on Capital</span>
                  <span className={`font-mono text-sm font-semibold ${calc.netReturnShort >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPercent(calc.netReturnShort)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Long Term (>12 months) */}
          <div className={`rounded-xl border-t-4 ${calc.grossGain > 0 ? 'border-t-emerald-400' : 'border-t-red-400'} bg-white border border-gray-200 p-4`}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-gray-900">Sell &gt; 12 Months (CGT Discount)</h3>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Gross Capital Gain</span>
                <span className={`font-mono font-semibold ${calc.grossGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(calc.grossGain)}
                </span>
              </div>
              {calc.loss > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-600">Less: Capital Loss Offset</span>
                  <span className="font-mono text-orange-600">-{formatCurrency(calc.loss)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">50% CGT Discount</span>
                <span className="font-mono text-cyan-600">-{formatCurrency(calc.netGainAfterLoss * 0.5)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">Taxable Amount</span>
                <span className="font-mono">{formatCurrency(calc.netGainAfterLoss * 0.5)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">CGT @ 32.5%</span>
                <span className="font-mono text-red-600">-{formatCurrency(calc.taxLong)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500 text-xs">Brokerage (Buy + Sell)</span>
                <span className="font-mono text-gray-500 text-xs">-{formatCurrency(calc.brk * 2)}</span>
              </div>
              
              <div className="pt-2 border-t-2 border-gray-200">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-gray-900">Net Profit (After Tax)</span>
                  <span className={`text-xl font-bold font-mono ${calc.netProfitLong >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(calc.netProfitLong)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">Net Return on Capital</span>
                  <span className={`font-mono text-sm font-semibold ${calc.netReturnLong >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPercent(calc.netReturnLong)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12-Month Hold Advantage */}
      {calc.entry > 0 && calc.exit > 0 && calc.qty > 0 && calc.grossGain > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            12-MONTH HOLD ADVANTAGE
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400 mb-1">TAX IF SOLD &lt;12M</p>
              <p className="text-lg font-bold font-mono text-red-400">{formatCurrency(calc.taxShort)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">TAX IF SOLD &gt;12M</p>
              <p className="text-lg font-bold font-mono text-emerald-400">{formatCurrency(calc.taxLong)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">YOU SAVE BY WAITING</p>
              <p className="text-lg font-bold font-mono text-orange-400">{formatCurrency(calc.taxSaving)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Exit Scenario Table */}
      {calc.entry > 0 && calc.qty > 0 && exitScenarios.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-purple-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              EXIT SCENARIO TABLE — {ticker.toUpperCase() || 'STOCK'} @ {formatCurrency(calc.entry)} × {calc.qty} shares
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Exit $</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Upside</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Gross Gain</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Tax (&lt;12m)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Net (&lt;12m)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Tax (&gt;12m)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Net (&gt;12m)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Hurdle</th>
                </tr>
              </thead>
              <tbody>
                {exitScenarios.map((row) => {
                  const isCurrentExit = Math.abs(row.exit - calc.exit) < 1
                  return (
                    <tr
                      key={row.mult}
                      onClick={() => setExitPrice(row.exit.toFixed(2))}
                      className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${isCurrentExit ? 'bg-cyan-50' : ''}`}
                    >
                      <td className={`px-3 py-2 text-right font-mono ${isCurrentExit ? 'font-bold' : ''}`}>
                        ${row.exit.toFixed(0)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${row.upPct >= 15 ? 'text-emerald-600' : 'text-orange-500'}`}>
                        {row.upPct.toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.gross)}</td>
                      <td className="px-3 py-2 text-right font-mono text-red-500">{formatCurrency(row.taxS)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">{formatCurrency(row.netS)}</td>
                      <td className="px-3 py-2 text-right font-mono text-red-500">{formatCurrency(row.taxL)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">{formatCurrency(row.netL)}</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {row.hurdle === 'MOM' && <span className="text-emerald-600 font-semibold">MOM ✅</span>}
                        {row.hurdle === 'CAV' && <span className="text-yellow-600 font-semibold">CAV ✅</span>}
                        {row.hurdle === 'BELOW' && <span className="text-gray-400">❌</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 text-center py-2 bg-gray-50">
            Click any row to set as exit target • MOM = Momentum (20%+) • CAV = Cavalry (15%+)
          </p>
        </div>
      )}

      {/* Save Scenario Section */}
      {calc.entry > 0 && calc.exit > 0 && calc.qty > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Save className="w-4 h-4 text-gray-400" />
            Save to Decision Journal
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Trade Thesis (optional)</label>
              <textarea
                value={tradeThesis}
                onChange={(e) => setTradeThesis(e.target.value)}
                placeholder="Why are you considering this trade? What's the catalyst?"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
            <button
              onClick={saveScenario}
              disabled={saving || !ticker}
              className="w-full py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Scenario
            </button>
            <p className="text-xs text-gray-400 text-center">
              Review your modelled trades vs actual outcomes during your annual wealth review
            </p>
          </div>
        </div>
      )}

      {/* Saved Scenarios History */}
      {showHistory && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              Decision Journal
            </h4>
            <span className="text-xs text-gray-500">{savedScenarios.length} scenarios</span>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
            </div>
          ) : savedScenarios.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No saved scenarios yet. Model a trade and save it to start your decision journal.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {savedScenarios.map((scenario) => (
                <div key={scenario.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-bold text-gray-900">{scenario.ticker}</span>
                      <span className="text-gray-400 mx-2">→</span>
                      <span className="font-mono text-sm">
                        ${scenario.entry_price} → ${scenario.exit_price}
                      </span>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                        scenario.hurdle_status === 'MOMENTUM' ? 'bg-emerald-100 text-emerald-700' :
                        scenario.hurdle_status === 'CAVALRY' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {scenario.hurdle_status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={scenario.status}
                        onChange={(e) => updateStatus(scenario.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="MODELLED">Modelled</option>
                        <option value="ENTERED">Entered</option>
                        <option value="CLOSED">Closed</option>
                        <option value="PASSED">Passed</option>
                      </select>
                      <button
                        onClick={() => deleteScenario(scenario.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-gray-500">Shares:</span>
                      <span className="ml-1 font-mono">{scenario.shares}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Upside:</span>
                      <span className={`ml-1 font-mono ${scenario.upside_pct >= 15 ? 'text-emerald-600' : 'text-orange-500'}`}>
                        {scenario.upside_pct?.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Net (&lt;12m):</span>
                      <span className="ml-1 font-mono text-emerald-600">{formatCurrency(scenario.net_profit_short)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Net (&gt;12m):</span>
                      <span className="ml-1 font-mono text-emerald-600">{formatCurrency(scenario.net_profit_long)}</span>
                    </div>
                  </div>
                  
                  {scenario.trade_thesis && (
                    <p className="text-xs text-gray-600 italic">"{scenario.trade_thesis}"</p>
                  )}
                  
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(scenario.created_at).toLocaleDateString('en-AU', { 
                      day: 'numeric', month: 'short', year: 'numeric' 
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-gray-400 text-center">
        SWT Trade Simulator • Tax rate: 32.5% marginal • CGT discount: 50% (12+ month hold) • Not financial advice
      </p>
    </div>
  )
}
