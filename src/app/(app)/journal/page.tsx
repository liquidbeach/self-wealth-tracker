'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  BookOpen,
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Filter,
  Download,
  Flag,
  Globe,
  Calendar,
  ClipboardCheck,
  Award,
  BarChart3,
  X,
} from 'lucide-react'

interface Trade {
  id: string
  symbol: string
  name: string
  market: 'US' | 'ASX'
  trade_type: 'momentum' | 'swing' | 'position' | 'paper'
  entry_price: number
  entry_date: string
  exit_price: number | null
  exit_date: string | null
  units: number
  target_price: number
  stop_loss: number
  status: 'open' | 'closed'
  entry_reason: string | null
  exit_reason: string | null
  lessons_learned: string | null
  signal_strength: number | null
  checklist_completed: boolean
  pnl?: number
  pnl_percent?: number
}

interface PerformanceStats {
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalInvested: number
  totalReturned: number
  totalPnL: number
  totalPnLPercent: number
  avgWinPercent: number
  avgLossPercent: number
  bestTrade: { symbol: string; pnl: number; percent: number } | null
  worstTrade: { symbol: string; pnl: number; percent: number } | null
}

interface MarketStats {
  market: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalInvested: number
  totalPnL: number
  totalPnLPercent: number
}

const PERIOD_FILTERS = [
  { id: 'all', name: 'All Time' },
  { id: 'month', name: 'This Month' },
  { id: 'quarter', name: 'This Quarter' },
  { id: 'year', name: 'This Year' },
]

const TRADE_TYPES = [
  { id: 'all', name: 'All Types' },
  { id: 'paper', name: 'Paper Trades' },
  { id: 'momentum', name: 'Momentum' },
  { id: 'swing', name: 'Swing' },
  { id: 'position', name: 'Position' },
]

const PRE_TRADE_CHECKLIST = [
  { id: 'signal', label: 'Signal strength ≥ 65?' },
  { id: 'rsi', label: 'RSI shows opportunity?' },
  { id: 'volume', label: 'Volume confirms move?' },
  { id: 'stoploss', label: 'Stop-loss set at -8%?' },
  { id: 'target', label: 'Target set at +15-20%?' },
  { id: 'position', label: 'Position size ≤ 5% of capital?' },
  { id: 'conviction', label: 'Would I buy this fresh today?' },
]

export default function TradingJournalPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewTradeModal, setShowNewTradeModal] = useState(false)
  const [showCloseTradeModal, setShowCloseTradeModal] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null)
  const [periodFilter, setPeriodFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [marketFilter, setMarketFilter] = useState('all')
  
  // New trade form state
  const [newTrade, setNewTrade] = useState({
    symbol: '',
    name: '',
    market: 'US' as 'US' | 'ASX',
    trade_type: 'paper' as 'momentum' | 'swing' | 'position' | 'paper',
    entry_price: '',
    units: '',
    target_price: '',
    stop_loss: '',
    entry_reason: '',
    signal_strength: '',
  })
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  
  // Close trade form state
  const [closeTrade, setCloseTrade] = useState({
    exit_price: '',
    exit_reason: '',
    lessons_learned: '',
  })

  useEffect(() => {
    loadTrades()
  }, [])

  const loadTrades = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('momentum_trades')
      .select('*')
      .order('entry_date', { ascending: false })
    
    if (data) {
      const tradesWithPnL = data.map(t => {
        const pnl = t.status === 'closed' && t.exit_price 
          ? (t.exit_price - t.entry_price) * t.units 
          : null
        const pnl_percent = t.status === 'closed' && t.exit_price
          ? ((t.exit_price - t.entry_price) / t.entry_price) * 100
          : null
        return { ...t, pnl, pnl_percent }
      })
      setTrades(tradesWithPnL)
    }
    setLoading(false)
  }

  // Filter trades by period
  const getFilteredTrades = () => {
    let filtered = trades

    // Period filter
    if (periodFilter !== 'all') {
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
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
        default:
          startDate = new Date(0)
      }
      
      filtered = filtered.filter(t => new Date(t.entry_date) >= startDate)
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.trade_type === typeFilter)
    }

    // Market filter
    if (marketFilter !== 'all') {
      filtered = filtered.filter(t => t.market === marketFilter)
    }

    return filtered
  }

  const filteredTrades = getFilteredTrades()
  const openTrades = filteredTrades.filter(t => t.status === 'open')
  const closedTrades = filteredTrades.filter(t => t.status === 'closed')

  // Calculate performance stats
  const calculateStats = (trades: Trade[]): PerformanceStats => {
    const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null)
    
    if (closed.length === 0) {
      return {
        totalTrades: 0, wins: 0, losses: 0, winRate: 0,
        totalInvested: 0, totalReturned: 0, totalPnL: 0, totalPnLPercent: 0,
        avgWinPercent: 0, avgLossPercent: 0, bestTrade: null, worstTrade: null,
      }
    }

    const wins = closed.filter(t => (t.pnl || 0) > 0)
    const losses = closed.filter(t => (t.pnl || 0) <= 0)
    
    const totalInvested = closed.reduce((sum, t) => sum + (t.entry_price * t.units), 0)
    const totalReturned = closed.reduce((sum, t) => sum + ((t.exit_price || 0) * t.units), 0)
    const totalPnL = closed.reduce((sum, t) => sum + (t.pnl || 0), 0)
    
    const avgWinPercent = wins.length > 0
      ? wins.reduce((sum, t) => sum + (t.pnl_percent || 0), 0) / wins.length
      : 0
    const avgLossPercent = losses.length > 0
      ? losses.reduce((sum, t) => sum + (t.pnl_percent || 0), 0) / losses.length
      : 0

    const sortedByPnL = [...closed].sort((a, b) => (b.pnl || 0) - (a.pnl || 0))
    const bestTrade = sortedByPnL[0] 
      ? { symbol: sortedByPnL[0].symbol, pnl: sortedByPnL[0].pnl || 0, percent: sortedByPnL[0].pnl_percent || 0 }
      : null
    const worstTrade = sortedByPnL[sortedByPnL.length - 1]
      ? { symbol: sortedByPnL[sortedByPnL.length - 1].symbol, pnl: sortedByPnL[sortedByPnL.length - 1].pnl || 0, percent: sortedByPnL[sortedByPnL.length - 1].pnl_percent || 0 }
      : null

    return {
      totalTrades: closed.length,
      wins: wins.length,
      losses: losses.length,
      winRate: (wins.length / closed.length) * 100,
      totalInvested,
      totalReturned,
      totalPnL,
      totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
      avgWinPercent,
      avgLossPercent,
      bestTrade,
      worstTrade,
    }
  }

  // Calculate market-specific stats
  const calculateMarketStats = (trades: Trade[]): MarketStats[] => {
    const markets = ['US', 'ASX']
    return markets.map(market => {
      const marketTrades = trades.filter(t => t.market === market && t.status === 'closed')
      const wins = marketTrades.filter(t => (t.pnl || 0) > 0)
      const totalInvested = marketTrades.reduce((sum, t) => sum + (t.entry_price * t.units), 0)
      const totalPnL = marketTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
      
      return {
        market,
        totalTrades: marketTrades.length,
        wins: wins.length,
        losses: marketTrades.length - wins.length,
        winRate: marketTrades.length > 0 ? (wins.length / marketTrades.length) * 100 : 0,
        totalInvested,
        totalPnL,
        totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
      }
    }).filter(m => m.totalTrades > 0)
  }

  const stats = calculateStats(filteredTrades)
  const marketStats = calculateMarketStats(filteredTrades)

  const handleCreateTrade = async () => {
    // Validate checklist
    const allChecked = PRE_TRADE_CHECKLIST.every(item => checklist[item.id])
    if (!allChecked && newTrade.trade_type !== 'paper') {
      alert('Please complete the pre-trade checklist before entering a trade.')
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const entryPrice = parseFloat(newTrade.entry_price)
    const targetPrice = parseFloat(newTrade.target_price) || entryPrice * 1.15
    const stopLoss = parseFloat(newTrade.stop_loss) || entryPrice * 0.92

    const { error } = await supabase.from('momentum_trades').insert({
      user_id: user.id,
      symbol: newTrade.symbol.toUpperCase(),
      name: newTrade.name,
      market: newTrade.market,
      trade_type: newTrade.trade_type,
      entry_price: entryPrice,
      entry_date: new Date().toISOString().split('T')[0],
      units: parseFloat(newTrade.units),
      target_price: targetPrice,
      stop_loss: stopLoss,
      entry_reason: newTrade.entry_reason,
      signal_strength: newTrade.signal_strength ? parseInt(newTrade.signal_strength) : null,
      checklist_completed: allChecked,
      status: 'open',
    })

    if (!error) {
      setShowNewTradeModal(false)
      setNewTrade({
        symbol: '', name: '', market: 'US', trade_type: 'paper',
        entry_price: '', units: '', target_price: '', stop_loss: '',
        entry_reason: '', signal_strength: '',
      })
      setChecklist({})
      loadTrades()
    }
  }

  const handleCloseTrade = async () => {
    if (!selectedTrade) return

    const supabase = createClient()
    
    const { error } = await supabase
      .from('momentum_trades')
      .update({
        status: 'closed',
        exit_price: parseFloat(closeTrade.exit_price),
        exit_date: new Date().toISOString().split('T')[0],
        exit_reason: closeTrade.exit_reason,
        lessons_learned: closeTrade.lessons_learned,
      })
      .eq('id', selectedTrade.id)

    if (!error) {
      setShowCloseTradeModal(false)
      setSelectedTrade(null)
      setCloseTrade({ exit_price: '', exit_reason: '', lessons_learned: '' })
      loadTrades()
    }
  }

  const handleDeleteTrade = async (tradeId: string) => {
    if (!confirm('Are you sure you want to delete this trade?')) return
    
    const supabase = createClient()
    await supabase.from('momentum_trades').delete().eq('id', tradeId)
    loadTrades()
  }

  const exportToCSV = () => {
    const headers = [
      'Symbol', 'Name', 'Market', 'Type', 'Entry Date', 'Entry Price',
      'Exit Date', 'Exit Price', 'Units', 'P&L ($)', 'P&L (%)',
      'Entry Reason', 'Exit Reason', 'Lessons Learned'
    ]
    
    const rows = closedTrades.map(t => [
      t.symbol, t.name, t.market, t.trade_type, t.entry_date, t.entry_price,
      t.exit_date, t.exit_price, t.units, t.pnl?.toFixed(2), t.pnl_percent?.toFixed(2),
      `"${t.entry_reason || ''}"`, `"${t.exit_reason || ''}"`, `"${t.lessons_learned || ''}"`
    ].join(','))
    
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trading Journal</h1>
          <p className="text-slate-500">Track, analyze, and learn from every trade</p>
        </div>
        <button
          onClick={() => setShowNewTradeModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Trade
        </button>
      </div>

      {/* Performance Dashboard */}
      <div className="card bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Performance Overview
          </h2>
          <div className="flex gap-2">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="text-sm bg-slate-700 border-slate-600 rounded px-2 py-1"
            >
              {PERIOD_FILTERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-slate-400 text-sm">Total Invested</p>
            <p className="text-2xl font-bold">${stats.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total Returned</p>
            <p className="text-2xl font-bold">${stats.totalReturned.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Net P&L</p>
            <p className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Return %</p>
            <p className={`text-2xl font-bold ${stats.totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700">
          <div>
            <p className="text-slate-400 text-sm">Win Rate</p>
            <p className={`text-xl font-semibold ${stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.winRate.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500">{stats.wins}W / {stats.losses}L</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Avg Win</p>
            <p className="text-xl font-semibold text-green-400">+{stats.avgWinPercent.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Avg Loss</p>
            <p className="text-xl font-semibold text-red-400">{stats.avgLossPercent.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total Trades</p>
            <p className="text-xl font-semibold">{stats.totalTrades}</p>
          </div>
        </div>

        {/* Best/Worst */}
        {(stats.bestTrade || stats.worstTrade) && (
          <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-slate-700">
            {stats.bestTrade && (
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-xs text-slate-400">Best Trade</p>
                  <p className="text-sm font-medium">
                    {stats.bestTrade.symbol}: +${stats.bestTrade.pnl.toFixed(0)} ({stats.bestTrade.percent.toFixed(1)}%)
                  </p>
                </div>
              </div>
            )}
            {stats.worstTrade && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-xs text-slate-400">Worst Trade</p>
                  <p className="text-sm font-medium">
                    {stats.worstTrade.symbol}: ${stats.worstTrade.pnl.toFixed(0)} ({stats.worstTrade.percent.toFixed(1)}%)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Market Breakdown */}
      {marketStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {marketStats.map(m => (
            <div key={m.market} className="card">
              <div className="flex items-center gap-2 mb-3">
                {m.market === 'US' ? (
                  <span className="text-2xl">🇺🇸</span>
                ) : (
                  <span className="text-2xl">🇦🇺</span>
                )}
                <h3 className="font-semibold text-slate-900">
                  {m.market === 'US' ? 'US Markets' : 'ASX (Domestic)'}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Invested</p>
                  <p className="font-semibold">${m.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">P&L</p>
                  <p className={`font-semibold ${m.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {m.totalPnL >= 0 ? '+' : ''}${m.totalPnL.toFixed(0)} ({m.totalPnLPercent.toFixed(1)}%)
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Trades</p>
                  <p className="font-semibold">{m.totalTrades}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Win Rate</p>
                  <p className={`font-semibold ${m.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {m.winRate.toFixed(0)}% ({m.wins}W/{m.losses}L)
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Filter:</span>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input text-sm py-1"
          >
            {TRADE_TYPES.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
            className="input text-sm py-1"
          >
            <option value="all">All Markets</option>
            <option value="US">🇺🇸 US</option>
            <option value="ASX">🇦🇺 ASX</option>
          </select>
          <div className="ml-auto">
            <button
              onClick={exportToCSV}
              disabled={closedTrades.length === 0}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Open Trades */}
      {openTrades.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-600" />
            Open Positions ({openTrades.length})
          </h3>
          <div className="space-y-3">
            {openTrades.map(trade => (
              <div key={trade.id} className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{trade.market === 'US' ? '🇺🇸' : '🇦🇺'}</span>
                    <div>
                      <p className="font-semibold text-slate-900">{trade.symbol}</p>
                      <p className="text-xs text-slate-500">{trade.name}</p>
                    </div>
                    {trade.trade_type === 'paper' && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">PAPER</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Entry: ${trade.entry_price.toFixed(2)}</p>
                    <p className="text-sm">
                      <span className="text-green-600">↑${trade.target_price.toFixed(2)}</span>
                      {' / '}
                      <span className="text-red-600">↓${trade.stop_loss.toFixed(2)}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">{trade.units} units</p>
                    <p className="text-sm text-slate-500">{trade.entry_date}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTrade(trade)
                      setCloseTrade({ exit_price: trade.entry_price.toString(), exit_reason: '', lessons_learned: '' })
                      setShowCloseTradeModal(true)
                    }}
                    className="btn-primary text-sm"
                  >
                    Close Trade
                  </button>
                </div>
                {trade.entry_reason && (
                  <p className="text-sm text-slate-600 mt-2 pt-2 border-t border-slate-200">
                    <strong>Entry reason:</strong> {trade.entry_reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Closed Trades */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-slate-600" />
          Trade History ({closedTrades.length})
        </h3>
        
        {closedTrades.length > 0 ? (
          <div className="space-y-2">
            {closedTrades.map(trade => (
              <div key={trade.id} className="border border-slate-200 rounded-lg">
                <div 
                  className="p-4 cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(trade.pnl || 0) >= 0 ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className="text-lg">{trade.market === 'US' ? '🇺🇸' : '🇦🇺'}</span>
                      <div>
                        <p className="font-semibold text-slate-900">{trade.symbol}</p>
                        <p className="text-xs text-slate-500">{trade.name}</p>
                      </div>
                      {trade.trade_type === 'paper' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">PAPER</span>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-slate-500">
                          ${trade.entry_price.toFixed(2)} → ${trade.exit_price?.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-400">{trade.units} units</p>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className={`font-semibold ${(trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(trade.pnl || 0) >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                        </p>
                        <p className={`text-sm ${(trade.pnl_percent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(trade.pnl_percent || 0) >= 0 ? '+' : ''}{trade.pnl_percent?.toFixed(1)}%
                        </p>
                      </div>
                      <div className="text-right text-sm text-slate-500">
                        {trade.exit_date}
                      </div>
                      {expandedTrade === trade.id ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {expandedTrade === trade.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-200 bg-slate-50">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-slate-500">Entry Date</p>
                        <p className="text-sm font-medium">{trade.entry_date}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Exit Date</p>
                        <p className="text-sm font-medium">{trade.exit_date}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Signal Strength</p>
                        <p className="text-sm font-medium">{trade.signal_strength || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Checklist</p>
                        <p className="text-sm font-medium">
                          {trade.checklist_completed ? (
                            <span className="text-green-600">✓ Completed</span>
                          ) : (
                            <span className="text-slate-400">Not completed</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {trade.entry_reason && (
                      <div className="mb-2">
                        <p className="text-xs text-slate-500">Entry Reason</p>
                        <p className="text-sm">{trade.entry_reason}</p>
                      </div>
                    )}
                    {trade.exit_reason && (
                      <div className="mb-2">
                        <p className="text-xs text-slate-500">Exit Reason</p>
                        <p className="text-sm">{trade.exit_reason}</p>
                      </div>
                    )}
                    {trade.lessons_learned && (
                      <div className="mb-2 p-2 bg-amber-50 rounded">
                        <p className="text-xs text-amber-700 font-medium">📝 Lessons Learned</p>
                        <p className="text-sm text-amber-900">{trade.lessons_learned}</p>
                      </div>
                    )}
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => handleDeleteTrade(trade.id)}
                        className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No closed trades yet</p>
            <p className="text-sm text-slate-400 mt-1">Start by adding a paper trade to practice</p>
          </div>
        )}
      </div>

      {/* New Trade Modal */}
      {showNewTradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">New Trade Entry</h2>
                <button onClick={() => setShowNewTradeModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Trade Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Trade Type</label>
                  <select
                    value={newTrade.trade_type}
                    onChange={(e) => setNewTrade({ ...newTrade, trade_type: e.target.value as any })}
                    className="input mt-1"
                  >
                    <option value="paper">📝 Paper Trade (Practice)</option>
                    <option value="momentum">⚡ Momentum</option>
                    <option value="swing">🔄 Swing</option>
                    <option value="position">📈 Position</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Market</label>
                  <select
                    value={newTrade.market}
                    onChange={(e) => setNewTrade({ ...newTrade, market: e.target.value as any })}
                    className="input mt-1"
                  >
                    <option value="US">🇺🇸 US (NYSE/NASDAQ)</option>
                    <option value="ASX">🇦🇺 ASX (Australia)</option>
                  </select>
                </div>
              </div>

              {/* Stock Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Symbol</label>
                  <input
                    type="text"
                    value={newTrade.symbol}
                    onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value.toUpperCase() })}
                    placeholder="AAPL"
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Company Name</label>
                  <input
                    type="text"
                    value={newTrade.name}
                    onChange={(e) => setNewTrade({ ...newTrade, name: e.target.value })}
                    placeholder="Apple Inc"
                    className="input mt-1"
                  />
                </div>
              </div>

              {/* Trade Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Entry Price ($)</label>
                  <input
                    type="number"
                    value={newTrade.entry_price}
                    onChange={(e) => setNewTrade({ ...newTrade, entry_price: e.target.value })}
                    placeholder="150.00"
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Units</label>
                  <input
                    type="number"
                    value={newTrade.units}
                    onChange={(e) => setNewTrade({ ...newTrade, units: e.target.value })}
                    placeholder="10"
                    className="input mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Target Price (+15-20%)</label>
                  <input
                    type="number"
                    value={newTrade.target_price}
                    onChange={(e) => setNewTrade({ ...newTrade, target_price: e.target.value })}
                    placeholder={newTrade.entry_price ? (parseFloat(newTrade.entry_price) * 1.15).toFixed(2) : '172.50'}
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Stop Loss (-8%)</label>
                  <input
                    type="number"
                    value={newTrade.stop_loss}
                    onChange={(e) => setNewTrade({ ...newTrade, stop_loss: e.target.value })}
                    placeholder={newTrade.entry_price ? (parseFloat(newTrade.entry_price) * 0.92).toFixed(2) : '138.00'}
                    className="input mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Signal Strength (from Scanner)</label>
                <input
                  type="number"
                  value={newTrade.signal_strength}
                  onChange={(e) => setNewTrade({ ...newTrade, signal_strength: e.target.value })}
                  placeholder="75"
                  className="input mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Entry Reason</label>
                <textarea
                  value={newTrade.entry_reason}
                  onChange={(e) => setNewTrade({ ...newTrade, entry_reason: e.target.value })}
                  placeholder="Why are you entering this trade? (RSI oversold, MACD crossover, etc.)"
                  className="input mt-1 h-20"
                />
              </div>

              {/* Pre-Trade Checklist */}
              {newTrade.trade_type !== 'paper' && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <h3 className="font-medium text-amber-900 flex items-center gap-2 mb-3">
                    <ClipboardCheck className="w-5 h-5" />
                    Pre-Trade Checklist
                  </h3>
                  <div className="space-y-2">
                    {PRE_TRADE_CHECKLIST.map(item => (
                      <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checklist[item.id] || false}
                          onChange={(e) => setChecklist({ ...checklist, [item.id]: e.target.checked })}
                          className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-sm text-amber-900">{item.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-amber-700 mt-3">
                    ⚠️ All items must be checked before entering a real trade
                  </p>
                </div>
              )}

              {newTrade.trade_type === 'paper' && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    📝 <strong>Paper Trade:</strong> This is a practice trade with no real money. 
                    Use this to test your strategy before risking capital.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNewTradeModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTrade}
                disabled={!newTrade.symbol || !newTrade.entry_price || !newTrade.units}
                className="btn-primary"
              >
                Enter Trade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Trade Modal */}
      {showCloseTradeModal && selectedTrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Close Trade: {selectedTrade.symbol}</h2>
                <button onClick={() => setShowCloseTradeModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Entry Price</p>
                    <p className="font-semibold">${selectedTrade.entry_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Target</p>
                    <p className="font-semibold text-green-600">${selectedTrade.target_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Stop Loss</p>
                    <p className="font-semibold text-red-600">${selectedTrade.stop_loss.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Exit Price ($)</label>
                <input
                  type="number"
                  value={closeTrade.exit_price}
                  onChange={(e) => setCloseTrade({ ...closeTrade, exit_price: e.target.value })}
                  className="input mt-1"
                />
                {closeTrade.exit_price && (
                  <p className={`text-sm mt-1 ${
                    parseFloat(closeTrade.exit_price) >= selectedTrade.entry_price ? 'text-green-600' : 'text-red-600'
                  }`}>
                    P&L: {parseFloat(closeTrade.exit_price) >= selectedTrade.entry_price ? '+' : ''}
                    ${((parseFloat(closeTrade.exit_price) - selectedTrade.entry_price) * selectedTrade.units).toFixed(2)}
                    {' '}
                    ({(((parseFloat(closeTrade.exit_price) - selectedTrade.entry_price) / selectedTrade.entry_price) * 100).toFixed(1)}%)
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Exit Reason</label>
                <select
                  value={closeTrade.exit_reason}
                  onChange={(e) => setCloseTrade({ ...closeTrade, exit_reason: e.target.value })}
                  className="input mt-1"
                >
                  <option value="">Select reason...</option>
                  <option value="Hit target price">✅ Hit target price</option>
                  <option value="Hit stop loss">🛑 Hit stop loss</option>
                  <option value="Signal turned bearish">📉 Signal turned bearish</option>
                  <option value="Better opportunity">🔄 Better opportunity</option>
                  <option value="Risk management">⚠️ Risk management</option>
                  <option value="Time-based exit">⏰ Time-based exit</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Lessons Learned</label>
                <textarea
                  value={closeTrade.lessons_learned}
                  onChange={(e) => setCloseTrade({ ...closeTrade, lessons_learned: e.target.value })}
                  placeholder="What did you learn from this trade?"
                  className="input mt-1 h-20"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCloseTradeModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseTrade}
                disabled={!closeTrade.exit_price}
                className="btn-primary"
              >
                Close Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
