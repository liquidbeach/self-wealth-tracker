'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Target,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  ExternalLink,
  Activity,
  DollarSign,
  Percent,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Download,
  Filter,
} from 'lucide-react'

interface MomentumSignal {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL'
  strength: number
  rsi: number
  macdHistogram: number
  volumeRatio: number
  entryPrice: number
  targetPrice: number
  stopLoss: number
  potentialGain: number
  riskReward: number
  bullishSignals: string[]
  bearishSignals: string[]
}

interface ActiveTrade {
  id: string
  symbol: string
  name: string
  entryPrice: number
  entryDate: string
  units: number
  targetPrice: number
  stopLoss: number
  currentPrice?: number
  currentPL?: number
  currentPLPercent?: number
  status: 'open' | 'closed'
  notes?: string
}

interface TradeHistory {
  id: string
  symbol: string
  name: string
  entryPrice: number
  entryDate: string
  exitPrice: number
  exitDate: string
  units: number
  pnl: number
  pnlPercent: number
  result: 'win' | 'loss'
}

const STOCK_LISTS = [
  { id: 'sp500_top', name: 'S&P 500 Top 30' },
  { id: 'tech', name: 'Tech & Growth' },
  { id: 'momentum', name: 'High Momentum' },
]

const PERIOD_FILTERS = [
  { id: 'all', name: 'All Time' },
  { id: 'month', name: 'This Month' },
  { id: 'quarter', name: 'This Quarter' },
  { id: 'halfyear', name: 'Last 6 Months' },
  { id: 'year', name: 'This Year' },
]

export default function MomentumPage() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'active' | 'history'>('scanner')
  const [signals, setSignals] = useState<MomentumSignal[]>([])
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([])
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedList, setSelectedList] = useState('sp500_top')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [periodFilter, setPeriodFilter] = useState('all')

  // Load active trades from Supabase
  useEffect(() => {
    loadActiveTrades()
    loadTradeHistory()
  }, [])

  const loadActiveTrades = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('momentum_trades')
      .select('*')
      .eq('status', 'open')
      .order('entry_date', { ascending: false })
    
    if (data) {
      setActiveTrades(data.map(t => ({
        id: t.id,
        symbol: t.symbol,
        name: t.name,
        entryPrice: t.entry_price,
        entryDate: t.entry_date,
        units: t.units,
        targetPrice: t.target_price,
        stopLoss: t.stop_loss,
        status: t.status,
        notes: t.notes,
      })))
    }
  }

  const loadTradeHistory = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('momentum_trades')
      .select('*')
      .eq('status', 'closed')
      .order('exit_date', { ascending: false })
      .limit(100)
    
    if (data) {
      setTradeHistory(data.map(t => ({
        id: t.id,
        symbol: t.symbol,
        name: t.name,
        entryPrice: t.entry_price,
        entryDate: t.entry_date,
        exitPrice: t.exit_price,
        exitDate: t.exit_date,
        units: t.units,
        pnl: (t.exit_price - t.entry_price) * t.units,
        pnlPercent: ((t.exit_price - t.entry_price) / t.entry_price) * 100,
        result: t.exit_price > t.entry_price ? 'win' : 'loss',
      })))
    }
  }

  const runScanner = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/momentum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list: selectedList }),
      })
      
      const data = await response.json()
      if (data.signals) {
        setSignals(data.signals)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Scanner error:', error)
    } finally {
      setLoading(false)
    }
  }

  const addToActiveTrades = async (signal: MomentumSignal) => {
    const units = prompt(`How many shares of ${signal.symbol}?`, '10')
    if (!units) return
    
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return
    
    const { error } = await supabase.from('momentum_trades').insert({
      user_id: user.id,
      symbol: signal.symbol,
      name: signal.name,
      entry_price: signal.entryPrice,
      entry_date: new Date().toISOString().split('T')[0],
      units: parseInt(units),
      target_price: signal.targetPrice,
      stop_loss: signal.stopLoss,
      status: 'open',
    })
    
    if (!error) {
      loadActiveTrades()
      alert(`Added ${units} shares of ${signal.symbol} to active trades!`)
    }
  }

  const closeTrade = async (trade: ActiveTrade) => {
    const exitPrice = prompt(`Exit price for ${trade.symbol}?`, trade.entryPrice.toString())
    if (!exitPrice) return
    
    const supabase = createClient()
    
    const { error } = await supabase
      .from('momentum_trades')
      .update({
        status: 'closed',
        exit_price: parseFloat(exitPrice),
        exit_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', trade.id)
    
    if (!error) {
      loadActiveTrades()
      loadTradeHistory()
    }
  }

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'STRONG_BUY': return 'bg-green-100 text-green-800'
      case 'BUY': return 'bg-emerald-100 text-emerald-700'
      case 'HOLD': return 'bg-slate-100 text-slate-600'
      case 'SELL': return 'bg-orange-100 text-orange-700'
      case 'STRONG_SELL': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-100 text-slate-600'
    }
  }

  const getStrengthColor = (strength: number) => {
    if (strength >= 70) return 'text-green-600'
    if (strength >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Filter trades by period
  const getFilteredHistory = () => {
    if (periodFilter === 'all') return tradeHistory
    
    const now = new Date()
    let startDate: Date
    
    switch (periodFilter) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
        break
      case 'halfyear':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        return tradeHistory
    }
    
    return tradeHistory.filter(t => new Date(t.exitDate) >= startDate)
  }

  const filteredHistory = getFilteredHistory()

  // Calculate performance stats for filtered period
  const stats = {
    totalTrades: filteredHistory.length,
    wins: filteredHistory.filter(t => t.result === 'win').length,
    losses: filteredHistory.filter(t => t.result === 'loss').length,
    winRate: filteredHistory.length > 0 
      ? (filteredHistory.filter(t => t.result === 'win').length / filteredHistory.length) * 100 
      : 0,
    totalPnL: filteredHistory.reduce((sum, t) => sum + t.pnl, 0),
    avgWin: filteredHistory.filter(t => t.result === 'win').length > 0
      ? filteredHistory.filter(t => t.result === 'win').reduce((sum, t) => sum + t.pnlPercent, 0) / filteredHistory.filter(t => t.result === 'win').length
      : 0,
    avgLoss: filteredHistory.filter(t => t.result === 'loss').length > 0
      ? filteredHistory.filter(t => t.result === 'loss').reduce((sum, t) => sum + t.pnlPercent, 0) / filteredHistory.filter(t => t.result === 'loss').length
      : 0,
  }

  // Group trades by month for breakdown
  const getMonthlyBreakdown = () => {
    const breakdown: Record<string, { trades: number; pnl: number; wins: number; losses: number }> = {}
    
    filteredHistory.forEach(trade => {
      const monthKey = trade.exitDate.substring(0, 7) // YYYY-MM
      if (!breakdown[monthKey]) {
        breakdown[monthKey] = { trades: 0, pnl: 0, wins: 0, losses: 0 }
      }
      breakdown[monthKey].trades++
      breakdown[monthKey].pnl += trade.pnl
      if (trade.result === 'win') breakdown[monthKey].wins++
      else breakdown[monthKey].losses++
    })
    
    return Object.entries(breakdown)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
  }

  const monthlyBreakdown = getMonthlyBreakdown()

  // Export to CSV for tax purposes
  const exportToCSV = () => {
    const headers = ['Symbol', 'Name', 'Entry Date', 'Entry Price', 'Exit Date', 'Exit Price', 'Units', 'P&L ($)', 'P&L (%)', 'Result', 'Holding Period']
    
    const rows = filteredHistory.map(t => {
      const entryDate = new Date(t.entryDate)
      const exitDate = new Date(t.exitDate)
      const holdingDays = Math.ceil((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24))
      const holdingPeriod = holdingDays <= 365 ? 'Short-term' : 'Long-term'
      
      return [
        t.symbol,
        t.name,
        t.entryDate,
        t.entryPrice.toFixed(2),
        t.exitDate,
        t.exitPrice.toFixed(2),
        t.units,
        t.pnl.toFixed(2),
        t.pnlPercent.toFixed(2),
        t.result,
        holdingPeriod,
      ].join(',')
    })
    
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `momentum-trades-${periodFilter}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Momentum Scanner</h1>
        <p className="text-slate-500">Find stocks with strong buy/sell signals</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'scanner' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="w-4 h-4 inline mr-2" />
          Scanner
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'active' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          Active ({activeTrades.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'history' 
              ? 'bg-white text-slate-900 shadow-sm' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          History
        </button>
      </div>

      {/* Scanner Tab */}
      {activeTab === 'scanner' && (
        <div className="space-y-4">
          {/* Controls - FIXED ALIGNMENT */}
          <div className="card">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-sm text-slate-600 block mb-1">Stock List</label>
                <select
                  value={selectedList}
                  onChange={(e) => setSelectedList(e.target.value)}
                  className="input"
                >
                  {STOCK_LISTS.map(list => (
                    <option key={list.id} value={list.id}>{list.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={runScanner}
                disabled={loading}
                className="btn-primary flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Run Scanner
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Summary */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="card bg-green-50">
                <p className="text-sm text-green-600">Strong Buy</p>
                <p className="text-2xl font-bold text-green-700">{summary.strongBuy}</p>
              </div>
              <div className="card bg-emerald-50">
                <p className="text-sm text-emerald-600">Buy</p>
                <p className="text-2xl font-bold text-emerald-700">{summary.buy}</p>
              </div>
              <div className="card bg-slate-50">
                <p className="text-sm text-slate-600">Hold</p>
                <p className="text-2xl font-bold text-slate-700">{summary.hold}</p>
              </div>
              <div className="card bg-orange-50">
                <p className="text-sm text-orange-600">Sell</p>
                <p className="text-2xl font-bold text-orange-700">{summary.sell}</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-600">Total Scanned</p>
                <p className="text-2xl font-bold text-slate-700">{summary.total}</p>
              </div>
            </div>
          )}

          {/* Signals Table */}
          {signals.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Stock</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-500">Signal</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-500">Strength</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Price</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Target</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Potential</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-500">RSI</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((signal) => (
                    <>
                      <tr 
                        key={signal.symbol}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === signal.symbol ? null : signal.symbol)}
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-slate-900">{signal.symbol}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[150px]">{signal.name}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getSignalColor(signal.signal)}`}>
                            {signal.signal.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${getStrengthColor(signal.strength)}`}>
                            {signal.strength}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-medium">${signal.price.toFixed(2)}</span>
                          <span className={`block text-xs ${signal.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {signal.changePercent >= 0 ? '+' : ''}{signal.changePercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 font-medium">
                          ${signal.targetPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-green-600 font-medium">+{signal.potentialGain}%</span>
                          <span className="block text-xs text-slate-400">{signal.riskReward}:1 R/R</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`${
                            signal.rsi < 30 ? 'text-green-600' : 
                            signal.rsi > 70 ? 'text-red-600' : 'text-slate-600'
                          }`}>
                            {signal.rsi}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {(signal.signal === 'STRONG_BUY' || signal.signal === 'BUY') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  addToActiveTrades(signal)
                                }}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Add to active trades"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                            {expandedRow === signal.symbol ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Details */}
                      {expandedRow === signal.symbol && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 px-4 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-slate-500">Entry Price</p>
                                <p className="font-medium">${signal.entryPrice.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Stop Loss</p>
                                <p className="font-medium text-red-600">${signal.stopLoss.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Volume</p>
                                <p className="font-medium">{signal.volumeRatio}x avg</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">MACD</p>
                                <p className={`font-medium ${signal.macdHistogram > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {signal.macdHistogram > 0 ? 'Bullish' : 'Bearish'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Bullish Signals</p>
                                <div className="flex flex-wrap gap-1">
                                  {signal.bullishSignals.map((s, i) => (
                                    <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                      {s}
                                    </span>
                                  ))}
                                  {signal.bullishSignals.length === 0 && (
                                    <span className="text-xs text-slate-400">None</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Bearish Signals</p>
                                <div className="flex flex-wrap gap-1">
                                  {signal.bearishSignals.map((s, i) => (
                                    <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                      {s}
                                    </span>
                                  ))}
                                  {signal.bearishSignals.length === 0 && (
                                    <span className="text-xs text-slate-400">None</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <a
                                href={`https://finance.yahoo.com/quote/${signal.symbol}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                              >
                                View Chart <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!loading && signals.length === 0 && (
            <div className="card text-center py-12">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500">Run the scanner to find momentum opportunities</p>
              <p className="text-sm text-slate-400 mt-1">We'll analyze RSI, MACD, and volume patterns</p>
            </div>
          )}
        </div>
      )}

      {/* Active Trades Tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeTrades.length > 0 ? (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Stock</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Entry</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Target</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Stop Loss</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Units</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Date</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {activeTrades.map(trade => (
                    <tr key={trade.id} className="border-b border-slate-100">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{trade.symbol}</p>
                        <p className="text-xs text-slate-500">{trade.name}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">${trade.entryPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-green-600">${trade.targetPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-red-600">${trade.stopLoss.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">{trade.units}</td>
                      <td className="py-3 px-4 text-right text-sm text-slate-500">{trade.entryDate}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => closeTrade(trade)}
                          className="text-sm text-primary-600 hover:text-primary-700"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card text-center py-12">
              <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500">No active trades</p>
              <p className="text-sm text-slate-400 mt-1">Use the scanner to find opportunities and add trades</p>
            </div>
          )}
        </div>
      )}

      {/* History Tab - ENHANCED */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Period Filter and Export */}
          <div className="card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <label className="text-sm text-slate-600 block mb-1">Time Period</label>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="input"
                >
                  {PERIOD_FILTERS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={exportToCSV}
                disabled={filteredHistory.length === 0}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV (Tax)
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-slate-500">Total Trades</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalTrades}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Win Rate</p>
              <p className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.winRate.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-400">{stats.wins}W / {stats.losses}L</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Avg Win</p>
              <p className="text-2xl font-bold text-green-600">+{stats.avgWin.toFixed(1)}%</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Total P&L</p>
              <p className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${stats.totalPnL.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Monthly Breakdown */}
          {monthlyBreakdown.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Monthly Breakdown
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {monthlyBreakdown.map(([month, data]) => (
                  <div key={month} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{formatMonth(month)}</p>
                    <p className={`text-lg font-bold ${data.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${data.pnl.toFixed(0)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {data.trades} trades • {data.wins}W/{data.losses}L
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trade History Table */}
          {filteredHistory.length > 0 ? (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Stock</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Entry</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Exit</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Units</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">P&L</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-slate-500">Result</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Exit Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(trade => (
                    <tr key={trade.id} className="border-b border-slate-100">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{trade.symbol}</p>
                      </td>
                      <td className="py-3 px-4 text-right">${trade.entryPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">${trade.exitPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">{trade.units}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </span>
                        <span className={`block text-xs ${trade.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {trade.result === 'win' ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-slate-500">{trade.exitDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card text-center py-12">
              <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500">No trade history yet</p>
              <p className="text-sm text-slate-400 mt-1">Closed trades will appear here</p>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="card bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">How It Works</h3>
        <div className="text-sm text-slate-600 space-y-1">
          <p><strong>RSI:</strong> &lt;30 = oversold (potential buy), &gt;70 = overbought (potential sell)</p>
          <p><strong>MACD:</strong> Bullish when histogram is positive and rising</p>
          <p><strong>Volume:</strong> High volume confirms the move</p>
          <p><strong>Strength Score:</strong> 0-100 combining all indicators (higher = stronger buy signal)</p>
        </div>
      </div>
    </div>
  )
}