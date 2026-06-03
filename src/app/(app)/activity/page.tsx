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
  wasSold?: boolean // For BUYs that have been sold
}

export default function ActivityPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set())
  
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

  const toggleTicker = (ticker: string) => {
    setExpandedTickers(prev => {
      const next = new Set(prev)
      if (next.has(ticker)) {
        next.delete(ticker)
      } else {
        next.add(ticker)
      }
      return next
    })
  }

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
      
      // Load REMAINING lots with holdings relationship
      const { data: lotsData, error: lotsError } = await supabase
        .from('lots')
        .select('id, holding_id, units, purchase_price, purchase_date, holdings(ticker, name)')
        .order('purchase_date', { ascending: false })
      
      if (lotsError) {
        console.error('Lots fetch error:', lotsError)
      }
      
      // Load SELLs from cgt_sales (also contains original purchase info for SOLD lots)
      const { data: salesData, error: salesError } = await supabase
        .from('cgt_sales')
        .select('*')
        .order('sale_date', { ascending: false })
      
      if (salesError) {
        console.error('Sales fetch error:', salesError)
      }
      
      console.log('Lots data:', lotsData)
      console.log('Sales data:', salesData)
      
      // Transform REMAINING lots as BUYs
      const remainingBuys: Transaction[] = (lotsData || []).map((lot: any) => ({
        id: `buy-${lot.id}`,
        type: 'BUY' as const,
        ticker: lot.holdings?.ticker || 'Unknown',
        name: lot.holdings?.name || 'Unknown',
        date: lot.purchase_date,
        units: lot.units,
        price: lot.purchase_price,
        total: lot.units * lot.purchase_price,
        brokerage: 0,
      }))
      
      // Reconstruct SOLD lots as BUYs from cgt_sales
      // Each sale record contains the original purchase info
      const soldBuys: Transaction[] = (salesData || []).map((sale: any) => ({
        id: `sold-buy-${sale.id}`,
        type: 'BUY' as const,
        ticker: sale.ticker,
        name: sale.name || sale.ticker,
        date: sale.purchase_date || sale.sale_date, // Use purchase_date if available
        units: sale.units,
        price: sale.purchase_price || (sale.cost_base / sale.units), // Calculate from cost_base if no purchase_price
        total: sale.cost_base || (sale.units * sale.purchase_price),
        brokerage: sale.buy_brokerage || 0,
        wasSold: true, // Mark as sold
      }))
      
      // Combine all BUYs (remaining + sold)
      const allBuys = [...remainingBuys, ...soldBuys]
      
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
      const all = [...allBuys, ...sells].sort((a, b) => 
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

      {/* Transaction List - Grouped by Ticker */}
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
            {/* Group transactions by ticker */}
            {(() => {
              // Get unique tickers in order of most recent transaction
              const tickerOrder: string[] = []
              const tickerMap = new Map<string, Transaction[]>()
              
              filteredTransactions.forEach(tx => {
                if (!tickerMap.has(tx.ticker)) {
                  tickerMap.set(tx.ticker, [])
                  tickerOrder.push(tx.ticker)
                }
                tickerMap.get(tx.ticker)!.push(tx)
              })
              
              return tickerOrder.map(ticker => {
                const txs = tickerMap.get(ticker)!
                const isExpanded = expandedTickers.has(ticker)
                const buys = txs.filter(t => t.type === 'BUY')
                const sells = txs.filter(t => t.type === 'SELL')
                const totalBuyValue = buys.reduce((sum, t) => sum + t.total, 0)
                const totalSellValue = sells.reduce((sum, t) => sum + t.total, 0)
                const totalGain = sells.reduce((sum, t) => sum + (t.gain || 0), 0)
                const firstName = txs[0]?.name || ticker
                
                return (
                  <div key={ticker}>
                    {/* Ticker Header - Clickable */}
                    <button
                      onClick={() => toggleTicker(ticker)}
                      className="w-full p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                        <div className="text-left">
                          <span className="font-mono font-bold text-gray-900 text-lg">{ticker}</span>
                          <p className="text-sm text-gray-500">{firstName}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-right">
                        {/* Transaction counts */}
                        <div className="flex items-center gap-2">
                          {buys.length > 0 && (
                            <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                              {buys.length} BUY{buys.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {sells.length > 0 && (
                            <span className="text-xs font-medium px-2 py-1 rounded bg-red-100 text-red-700">
                              {sells.length} SELL{sells.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        
                        {/* Total values */}
                        <div className="hidden sm:block">
                          {totalBuyValue > 0 && (
                            <p className="text-sm text-gray-600">Bought: {fmt(totalBuyValue)}</p>
                          )}
                          {totalSellValue > 0 && (
                            <p className="text-sm text-gray-600">Sold: {fmt(totalSellValue)}</p>
                          )}
                          {sells.length > 0 && (
                            <p className={`text-xs font-medium ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {totalGain >= 0 ? '+' : ''}{fmt(totalGain)}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                    
                    {/* Expanded Transactions */}
                    {isExpanded && (
                      <div className="bg-gray-50 border-t border-gray-100">
                        {txs.map((tx) => (
                          <div
                            key={tx.id}
                            className={`p-4 pl-12 border-b border-gray-100 last:border-b-0 ${
                              tx.type === 'BUY' ? 'border-l-4 border-l-emerald-400' : 'border-l-4 border-l-red-400'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              {/* Left: Type badge */}
                              <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-full ${
                                  tx.type === 'BUY' ? 'bg-emerald-100' : 'bg-red-100'
                                }`}>
                                  {tx.type === 'BUY' ? (
                                    <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <ArrowUpCircle className="w-4 h-4 text-red-600" />
                                  )}
                                </div>
                                <div>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                    tx.type === 'BUY' 
                                      ? tx.wasSold 
                                        ? 'bg-gray-200 text-gray-600' 
                                        : 'bg-emerald-100 text-emerald-700' 
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {tx.type}{tx.wasSold ? ' (Sold)' : ''}
                                  </span>
                                  <span className="text-sm text-gray-600 ml-2">
                                    {tx.units.toLocaleString()} @ {fmt(tx.price)}
                                  </span>
                                </div>
                              </div>

                              {/* Right: Total & Date */}
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">
                                  {tx.type === 'BUY' ? '-' : '+'}{fmt(tx.total)}
                                </p>
                                {tx.type === 'SELL' && tx.gain !== undefined && (
                                  <p className={`text-xs ${tx.gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {tx.gain >= 0 ? '+' : ''}{fmt(tx.gain)}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400">{fmtDate(tx.date)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            })()}
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
