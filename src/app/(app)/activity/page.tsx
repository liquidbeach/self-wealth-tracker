'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

interface Transaction {
  id: string
  type: 'BUY' | 'SELL'
  ticker: string
  name: string
  date: string
  units: number
  price: number // purchase_price for BUY, proceeds/units for SELL
  total: number // units * price for BUY, proceeds for SELL
  brokerage?: number
  gain?: number // Only for SELL
  costBase?: number // Only for SELL
}

export default function ActivityPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  
  // Filters
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')
  const [filterTicker, setFilterTicker] = useState('')
  const [filterFY, setFilterFY] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  
  // Summary stats
  const [stats, setStats] = useState({
    totalBuys: 0,
    totalSells: 0,
    totalBuyValue: 0,
    totalSellValue: 0,
    netRealizedGain: 0,
  })

  useEffect(() => {
    setMounted(true)
    
    // Set current FY
    const now = new Date()
    const fyStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
    setFilterFY(`${fyStart}-${fyStart + 1}`)
    
    loadTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [transactions, filterType, filterTicker, filterFY, sortOrder])

  const loadTransactions = async () => {
    try {
      const supabase = createClient()
      
      // Load BUYs from lots (with holdings for ticker/name)
      const { data: lotsData } = await supabase
        .from('lots')
        .select(`
          id,
          units,
          purchase_price,
          purchase_date,
          brokerage,
          holdings (
            ticker,
            name
          )
        `)
        .order('purchase_date', { ascending: false })
      
      // Load SELLs from cgt_sales
      const { data: salesData } = await supabase
        .from('cgt_sales')
        .select('*')
        .order('sale_date', { ascending: false })
      
      // Transform BUYs
      const buys: Transaction[] = (lotsData || []).map((lot: any) => ({
        id: `buy-${lot.id}`,
        type: 'BUY' as const,
        ticker: lot.holdings?.ticker || 'Unknown',
        name: lot.holdings?.name || 'Unknown',
        date: lot.purchase_date,
        units: lot.units,
        price: lot.purchase_price,
        total: lot.units * lot.purchase_price,
        brokerage: lot.brokerage || 0,
      }))
      
      // Transform SELLs
      const sells: Transaction[] = (salesData || []).map((sale: any) => ({
        id: `sell-${sale.id}`,
        type: 'SELL' as const,
        ticker: sale.ticker,
        name: sale.name || sale.ticker,
        date: sale.sale_date,
        units: sale.units,
        price: sale.proceeds / sale.units,
        total: sale.proceeds,
        brokerage: (sale.sell_brokerage || 0) + (sale.buy_brokerage || 0),
        gain: sale.gross_gain,
        costBase: sale.cost_base,
      }))
      
      // Combine and sort
      const all = [...buys, ...sells].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      
      setTransactions(all)
      
      // Calculate stats
      const totalBuyValue = buys.reduce((sum, t) => sum + t.total, 0)
      const totalSellValue = sells.reduce((sum, t) => sum + t.total, 0)
      const netRealizedGain = sells.reduce((sum, t) => sum + (t.gain || 0), 0)
      
      setStats({
        totalBuys: buys.length,
        totalSells: sells.length,
        totalBuyValue,
        totalSellValue,
        netRealizedGain,
      })
      
      setLoading(false)
    } catch (err) {
      console.error('Failed to load transactions:', err)
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...transactions]
    
    // Filter by type
    if (filterType !== 'ALL') {
      filtered = filtered.filter(t => t.type === filterType)
    }
    
    // Filter by ticker
    if (filterTicker) {
      filtered = filtered.filter(t => 
        t.ticker.toLowerCase().includes(filterTicker.toLowerCase())
      )
    }
    
    // Filter by FY
    if (filterFY) {
      const [startYear] = filterFY.split('-').map(Number)
      const fyStart = new Date(startYear, 6, 1) // July 1
      const fyEnd = new Date(startYear + 1, 5, 30) // June 30
      
      filtered = filtered.filter(t => {
        const date = new Date(t.date)
        return date >= fyStart && date <= fyEnd
      })
    }
    
    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    })
    
    setFilteredTransactions(filtered)
  }

  // Get unique tickers for filter dropdown
  const uniqueTickers = Array.from(new Set(transactions.map(t => t.ticker))).sort()

  // Calculate filtered stats
  const filteredStats = {
    buys: filteredTransactions.filter(t => t.type === 'BUY').length,
    sells: filteredTransactions.filter(t => t.type === 'SELL').length,
    buyValue: filteredTransactions.filter(t => t.type === 'BUY').reduce((sum, t) => sum + t.total, 0),
    sellValue: filteredTransactions.filter(t => t.type === 'SELL').reduce((sum, t) => sum + t.total, 0),
    realizedGain: filteredTransactions.filter(t => t.type === 'SELL').reduce((sum, t) => sum + (t.gain || 0), 0),
  }

  if (!mounted) {
    return (
      <div className="space-y-4 pb-20">
        <h1 className="text-xl font-bold text-gray-900">Activity</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            Activity
          </h1>
          <p className="text-sm text-gray-500">Transaction history — BUYs & SELLs</p>
        </div>
        <button 
          onClick={loadTransactions}
          className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"
        >
          <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
            <p className="text-xs text-gray-500">Total BUYs</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{filteredStats.buys}</p>
          <p className="text-xs text-gray-500">{fmt(filteredStats.buyValue)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle className="w-4 h-4 text-red-500" />
            <p className="text-xs text-gray-500">Total SELLs</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{filteredStats.sells}</p>
          <p className="text-xs text-gray-500">{fmt(filteredStats.sellValue)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-cyan-500" />
            <p className="text-xs text-gray-500">Realised Gain/Loss</p>
          </div>
          <p className={`text-xl font-bold ${filteredStats.realizedGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {filteredStats.realizedGain >= 0 ? '+' : ''}{fmt(filteredStats.realizedGain)}
          </p>
          <p className="text-xs text-gray-500">From {filteredStats.sells} sales</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['ALL', 'BUY', 'SELL'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filterType === type
                    ? type === 'BUY' 
                      ? 'bg-emerald-500 text-white'
                      : type === 'SELL'
                        ? 'bg-red-500 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* FY Filter */}
          <select
            value={filterFY}
            onChange={(e) => setFilterFY(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
          >
            <option value="">All Time</option>
            <option value="2025-2026">FY 2025-26</option>
            <option value="2024-2025">FY 2024-25</option>
            <option value="2023-2024">FY 2023-24</option>
          </select>

          {/* Ticker Filter */}
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by ticker..."
              value={filterTicker}
              onChange={(e) => setFilterTicker(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            <Calendar className="w-4 h-4" />
            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            {sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
            <p className="text-sm text-gray-500 mt-2">Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No transactions found</p>
            <p className="text-xs text-gray-400 mt-1">
              {filterType !== 'ALL' || filterTicker || filterFY 
                ? 'Try adjusting your filters' 
                : 'Add holdings in Portfolio or record sales in CGT Tracker'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  tx.type === 'BUY' ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-red-400'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Type + Ticker */}
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      tx.type === 'BUY' ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                      {tx.type === 'BUY' ? (
                        <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <ArrowUpCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          tx.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.type}
                        </span>
                        <span className="font-mono font-bold text-gray-900">{tx.ticker}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{tx.name}</p>
                    </div>
                  </div>

                  {/* Center: Units & Price */}
                  <div className="text-center hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">
                      {tx.units.toLocaleString()} units
                    </p>
                    <p className="text-xs text-gray-500">
                      @ {fmt(tx.price)} each
                    </p>
                  </div>

                  {/* Right: Total & Date */}
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      tx.type === 'BUY' ? 'text-gray-900' : 'text-gray-900'
                    }`}>
                      {tx.type === 'BUY' ? '-' : '+'}{fmt(tx.total)}
                    </p>
                    {tx.type === 'SELL' && tx.gain !== undefined && (
                      <p className={`text-xs font-medium ${tx.gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.gain >= 0 ? 'Gain' : 'Loss'}: {tx.gain >= 0 ? '+' : ''}{fmt(tx.gain)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{fmtDate(tx.date)}</p>
                  </div>
                </div>

                {/* Mobile: Units display */}
                <div className="mt-2 sm:hidden">
                  <p className="text-xs text-gray-500">
                    {tx.units.toLocaleString()} units @ {fmt(tx.price)} each
                  </p>
                </div>

                {/* Brokerage if present */}
                {tx.brokerage && tx.brokerage > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Brokerage: {fmt(tx.brokerage)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {filteredTransactions.length > 0 && (
        <div className="text-center text-xs text-gray-400">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </div>
      )}
    </div>
  )
}
