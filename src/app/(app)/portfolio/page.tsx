'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { 
  Plus, 
  Briefcase, 
  ChevronDown, 
  ChevronRight, 
  Edit2, 
  Trash2,
  Upload,
  Wallet,
  MoreHorizontal,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react'
import AddHoldingModal from '@/components/AddHoldingModal'
import AddLotModal from '@/components/AddLotModal'
import EditHoldingModal from '@/components/EditHoldingModal'
import CashBalanceModal from '@/components/CashBalanceModal'
import ImportDataModal from '@/components/ImportDataModal'

interface Lot {
  id: string
  units: number
  purchase_date: string
  purchase_price: number
  notes: string | null
}

interface Holding {
  id: string
  ticker: string
  name: string
  market: string
  currency: string
  asset_type: string
  sector: string | null
  investment_style: string | null
  current_price: number | null
  notes: string | null
  thesis: string | null
  lots: Lot[]
  live_price?: number
  live_change?: number
  live_change_percent?: number
  price_error?: boolean
}

interface CashBalance {
  id: string
  account_name: string
  currency: string
  balance: number
}

interface PortfolioSummary {
  totalCost: number
  totalValue: number
  totalPnL: number
  totalPnLPercent: number
  holdingsCount: number
}

// Fetch live price with better error handling
async function fetchLivePrice(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
  try {
    const response = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, {
      cache: 'no-store',
    })
    if (!response.ok) {
      console.warn(`Quote fetch failed for ${symbol}: ${response.status}`)
      return null
    }
    const data = await response.json()
    if (data.error || !data.price) return null
    return {
      price: data.price || 0,
      change: data.change || 0,
      changePercent: data.changePercent || 0,
    }
  } catch (err) {
    console.warn(`Quote fetch error for ${symbol}:`, err)
    return null
  }
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingPrices, setRefreshingPrices] = useState(false)
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null)
  const [expandedHoldings, setExpandedHoldings] = useState<Set<string>>(new Set())
  const [priceErrors, setPriceErrors] = useState(0)
  
  // Modal states
  const [showAddHolding, setShowAddHolding] = useState(false)
  const [showAddLot, setShowAddLot] = useState(false)
  const [showEditHolding, setShowEditHolding] = useState(false)
  const [showCashBalance, setShowCashBalance] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  // Portfolio summary
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalCost: 0,
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    holdingsCount: 0,
  })

  // Calculate summary from holdings (without needing live prices)
  const calculateSummary = useCallback((holdingsData: Holding[]) => {
    let totalCost = 0
    let totalValue = 0
    let holdingsWithValue = 0

    holdingsData.forEach(holding => {
      const lots = holding.lots || []
      const units = lots.reduce((sum, lot) => sum + Number(lot.units), 0)
      const cost = lots.reduce((sum, lot) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
      
      // Priority: live_price > current_price (database) > avg cost
      const avgPrice = units > 0 ? cost / units : 0
      const price = holding.live_price || holding.current_price || avgPrice
      const value = units * price

      if (units > 0) {
        totalCost += cost
        totalValue += value
        holdingsWithValue++
      }
    })

    const totalPnL = totalValue - totalCost
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

    setSummary({
      totalCost,
      totalValue,
      totalPnL,
      totalPnLPercent,
      holdingsCount: holdingsWithValue,
    })
  }, [])

  // Refresh live prices for holdings WITHOUT manual override
  const refreshLivePrices = useCallback(async (holdingsToUpdate: Holding[]) => {
    if (holdingsToUpdate.length === 0) return holdingsToUpdate

    setRefreshingPrices(true)
    let errorCount = 0
    
    const updatedHoldings = await Promise.all(
      holdingsToUpdate.map(async (holding) => {
        const lots = holding.lots || []
        if (lots.length === 0) return holding
        
        // If user has set a manual price, use that (skip live fetch)
        if (holding.current_price && holding.current_price > 0) {
          return {
            ...holding,
            live_price: undefined,
            live_change: undefined,
            live_change_percent: undefined,
            price_error: false,
          }
        }
        
        // Fetch live price
        const liveData = await fetchLivePrice(holding.ticker)
        if (!liveData) {
          errorCount++
          return { ...holding, price_error: true }
        }
        
        return {
          ...holding,
          live_price: liveData.price,
          live_change: liveData.change,
          live_change_percent: liveData.changePercent,
          price_error: false,
        }
      })
    )

    setPriceErrors(errorCount)
    setLastPriceUpdate(new Date())
    setRefreshingPrices(false)
    
    // Recalculate summary
    calculateSummary(updatedHoldings)
    
    return updatedHoldings
  }, [calculateSummary])

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    
    const { data: holdingsData } = await supabase
      .from('holdings')
      .select(`*, lots (*)`)
      .order('ticker', { ascending: true })

    const { data: cashData } = await supabase
      .from('cash_balances')
      .select('*')
      .order('currency', { ascending: true })

    setCashBalances(cashData || [])
    
    // Calculate initial summary without live prices
    const initialHoldings = holdingsData || []
    calculateSummary(initialHoldings)
    setHoldings(initialHoldings)
    setLoading(false)
    
    // Then fetch live prices in background
    const holdingsWithPrices = await refreshLivePrices(initialHoldings)
    setHoldings(holdingsWithPrices)
  }, [refreshLivePrices, calculateSummary])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefreshPrices = async () => {
    const updated = await refreshLivePrices(holdings)
    setHoldings(updated)
  }

  const toggleExpanded = (holdingId: string) => {
    const newExpanded = new Set(expandedHoldings)
    if (newExpanded.has(holdingId)) {
      newExpanded.delete(holdingId)
    } else {
      newExpanded.add(holdingId)
    }
    setExpandedHoldings(newExpanded)
  }

  const handleAddLot = (holding: Holding) => {
    setSelectedHolding(holding)
    setShowAddLot(true)
  }

  const handleEditHolding = (holding: Holding) => {
    setSelectedHolding(holding)
    setShowEditHolding(true)
  }

  const handleDeleteLot = async (lotId: string) => {
    if (!confirm('Delete this lot?')) return
    const supabase = createClient()
    await supabase.from('lots').delete().eq('id', lotId)
    loadData()
  }

  const getCashByCurrency = (currency: string): number => {
    return cashBalances
      .filter(c => c.currency === currency)
      .reduce((sum, c) => sum + Number(c.balance), 0)
  }

  const calculateHoldingStats = (holding: Holding) => {
    const lots = holding.lots || []
    const totalUnits = lots.reduce((sum, lot) => sum + Number(lot.units), 0)
    const totalCost = lots.reduce((sum, lot) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
    const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0
    const currentPrice = holding.live_price || holding.current_price || avgPrice
    const currentValue = totalUnits * currentPrice
    const gainLoss = currentValue - totalCost
    const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0

    return { totalUnits, totalCost, avgPrice, currentPrice, currentValue, gainLoss, gainLossPct }
  }

  const getCurrencySymbol = (currency: string) => currency === 'INR' ? '₹' : '$'

  const formatCurrency = (value: number, currency: string) => {
    const symbol = getCurrencySymbol(currency)
    return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatCompact = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`
    }
    return `$${value.toFixed(0)}`
  }

  // Group holdings by currency
  const holdingsByCurrency = holdings.reduce((acc, holding) => {
    const currency = holding.currency
    if (!acc[currency]) acc[currency] = []
    acc[currency].push(holding)
    return acc
  }, {} as Record<string, Holding[]>)

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Portfolio</h1>
          <p className="text-sm text-slate-500">Track your holdings and performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <MoreHorizontal className="w-4 h-4 text-slate-600" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                  <button
                    onClick={() => { setShowMenu(false); setShowCashBalance(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Wallet className="w-4 h-4" /> Manage Cash
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); setShowImport(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Upload className="w-4 h-4" /> Import Data
                  </button>
                </div>
              </>
            )}
          </div>
          <button 
            onClick={() => setShowAddHolding(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Holding</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Portfolio Summary Card */}
      {summary.holdingsCount > 0 && (
        <div className={`rounded-xl p-4 ${summary.totalPnL >= 0 ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' : 'bg-gradient-to-r from-red-600 to-red-700'} text-white`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {summary.totalPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm font-medium opacity-90">Portfolio Summary</span>
            </div>
            <div className="flex items-center gap-2">
              {lastPriceUpdate && (
                <span className="text-xs opacity-75 hidden sm:inline">
                  {lastPriceUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                onClick={handleRefreshPrices}
                disabled={refreshingPrices}
                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${refreshingPrices ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <p className="text-xs opacity-75">Cost</p>
              <p className="text-lg sm:text-xl font-bold">{formatCompact(summary.totalCost)}</p>
            </div>
            <div>
              <p className="text-xs opacity-75">Value</p>
              <p className="text-lg sm:text-xl font-bold">{formatCompact(summary.totalValue)}</p>
            </div>
            <div>
              <p className="text-xs opacity-75">P&L</p>
              <p className="text-lg sm:text-xl font-bold">
                {summary.totalPnL >= 0 ? '+' : ''}{formatCompact(summary.totalPnL)}
              </p>
            </div>
            <div>
              <p className="text-xs opacity-75">Return</p>
              <p className="text-lg sm:text-xl font-bold">
                {summary.totalPnLPercent >= 0 ? '+' : ''}{summary.totalPnLPercent.toFixed(1)}%
              </p>
            </div>
          </div>

          {priceErrors > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs bg-white/10 px-2 py-1 rounded">
              <AlertCircle className="w-3 h-3" />
              <span>{priceErrors} stock(s) couldn't fetch live prices. Using last known values.</span>
            </div>
          )}
        </div>
      )}

      {/* Cash Balances */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div 
          className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-primary-300 transition-colors"
          onClick={() => setShowCashBalance(true)}
        >
          <p className="text-xs text-slate-500 mb-0.5">Cash (AUD)</p>
          <p className="text-base sm:text-lg font-bold text-slate-900">
            ${getCashByCurrency('AUD').toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
        <div 
          className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-primary-300 transition-colors"
          onClick={() => setShowCashBalance(true)}
        >
          <p className="text-xs text-slate-500 mb-0.5">Cash (USD)</p>
          <p className="text-base sm:text-lg font-bold text-slate-900">
            ${getCashByCurrency('USD').toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
        <div 
          className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-primary-300 transition-colors"
          onClick={() => setShowCashBalance(true)}
        >
          <p className="text-xs text-slate-500 mb-0.5">Cash (INR)</p>
          <p className="text-base sm:text-lg font-bold text-slate-900">
            ₹{getCashByCurrency('INR').toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Holdings */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Holdings</h3>
          {holdings.length > 0 && (
            <button
              onClick={handleRefreshPrices}
              disabled={refreshingPrices}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${refreshingPrices ? 'animate-spin' : ''}`} />
              {refreshingPrices ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-slate-400">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Loading...</p>
          </div>
        ) : holdings.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {Object.entries(holdingsByCurrency).map(([currency, currencyHoldings]) => (
              <div key={currency}>
                <div className="px-3 sm:px-4 py-2 bg-slate-50">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {currency === 'AUD' ? '🇦🇺 AUD' : currency === 'USD' ? '🇺🇸 USD' : '🇮🇳 INR'}
                  </span>
                </div>
                
                {/* Mobile Card View */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {currencyHoldings.map((holding) => {
                    const stats = calculateHoldingStats(holding)
                    const lots = holding.lots || []
                    const isExpanded = expandedHoldings.has(holding.id)

                    return (
                      <div key={holding.id} className="p-3">
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => lots.length > 0 && toggleExpanded(holding.id)}
                        >
                          <div className="flex items-center gap-2">
                            {lots.length > 0 && (
                              isExpanded ? 
                                <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <div>
                              <p className="font-medium text-slate-900 text-sm">{holding.ticker}</p>
                              <p className="text-xs text-slate-500 truncate max-w-[120px]">{holding.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-slate-900 text-sm">
                              {formatCurrency(stats.currentValue, currency)}
                            </p>
                            <p className={`text-xs font-medium ${stats.gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {stats.gainLoss >= 0 ? '+' : ''}{stats.gainLossPct.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        
                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                              <div>
                                <p className="text-slate-500">Units</p>
                                <p className="font-medium">{stats.totalUnits.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Avg Cost</p>
                                <p className="font-medium">{formatCurrency(stats.avgPrice, currency)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Current</p>
                                <p className="font-medium">{formatCurrency(stats.currentPrice, currency)}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAddLot(holding) }}
                                className="flex-1 text-xs py-1.5 border border-slate-200 rounded text-slate-700 hover:bg-slate-50"
                              >
                                + Add Lot
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditHolding(holding) }}
                                className="flex-1 text-xs py-1.5 border border-slate-200 rounded text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs text-slate-500">
                        <th className="text-left py-2 px-4 font-medium w-8"></th>
                        <th className="text-left py-2 px-4 font-medium">Stock</th>
                        <th className="text-right py-2 px-4 font-medium">Units</th>
                        <th className="text-right py-2 px-4 font-medium">Avg Cost</th>
                        <th className="text-right py-2 px-4 font-medium">Current</th>
                        <th className="text-right py-2 px-4 font-medium">Value</th>
                        <th className="text-right py-2 px-4 font-medium">P&L</th>
                        <th className="text-right py-2 px-4 font-medium w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {currencyHoldings.map((holding) => {
                        const stats = calculateHoldingStats(holding)
                        const lots = holding.lots || []
                        const isExpanded = expandedHoldings.has(holding.id)

                        return (
                          <>
                            <tr 
                              key={holding.id}
                              className="hover:bg-slate-50 cursor-pointer"
                              onClick={() => lots.length > 0 && toggleExpanded(holding.id)}
                            >
                              <td className="py-2.5 px-4">
                                {lots.length > 0 && (
                                  isExpanded ? 
                                    <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </td>
                              <td className="py-2.5 px-4">
                                <p className="font-medium text-slate-900">{holding.ticker}</p>
                                <p className="text-xs text-slate-500 truncate max-w-[150px]">{holding.name}</p>
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-700">
                                {stats.totalUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-700">
                                {formatCurrency(stats.avgPrice, currency)}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {holding.price_error ? (
                                  <span className="text-slate-400" title="Failed to fetch">—</span>
                                ) : (
                                  <span className="text-slate-900">{formatCurrency(stats.currentPrice, currency)}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right font-medium text-slate-900">
                                {formatCurrency(stats.currentValue, currency)}
                              </td>
                              <td className={`py-2.5 px-4 text-right font-medium ${stats.gainLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {stats.gainLoss >= 0 ? '+' : ''}{stats.gainLossPct.toFixed(1)}%
                              </td>
                              <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleAddLot(holding)}
                                    className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                                    title="Add lot"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleEditHolding(holding)}
                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {/* Expanded lots */}
                            {isExpanded && lots.length > 0 && (
                              <tr key={`${holding.id}-lots`}>
                                <td colSpan={8} className="bg-slate-50/50 px-4 py-3">
                                  <div className="ml-6 text-xs">
                                    <p className="font-medium text-slate-500 uppercase mb-2">Purchase Lots</p>
                                    <div className="space-y-1">
                                      {lots.map((lot) => {
                                        const lotCost = Number(lot.units) * Number(lot.purchase_price)
                                        const lotValue = Number(lot.units) * stats.currentPrice
                                        const lotGainPct = lotCost > 0 ? ((lotValue - lotCost) / lotCost) * 100 : 0
                                        
                                        return (
                                          <div key={lot.id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                                            <span className="text-slate-600">
                                              {new Date(lot.purchase_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })}
                                            </span>
                                            <span className="text-slate-700">{Number(lot.units).toLocaleString()} @ {formatCurrency(Number(lot.purchase_price), currency)}</span>
                                            <span className={`font-medium ${lotGainPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                              {lotGainPct >= 0 ? '+' : ''}{lotGainPct.toFixed(1)}%
                                            </span>
                                            <button
                                              onClick={() => handleDeleteLot(lot.id)}
                                              className="p-1 text-slate-400 hover:text-red-600"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <Briefcase className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 mb-1">No holdings yet</p>
            <p className="text-sm text-slate-400 mb-4">Add your first holding to get started</p>
            <div className="flex justify-center gap-2">
              <button 
                onClick={() => setShowImport(true)}
                className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Import Data
              </button>
              <button 
                onClick={() => setShowAddHolding(true)}
                className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Add Holding
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddHoldingModal isOpen={showAddHolding} onClose={() => setShowAddHolding(false)} onSuccess={loadData} />
      <AddLotModal isOpen={showAddLot} onClose={() => { setShowAddLot(false); setSelectedHolding(null) }} onSuccess={loadData} holding={selectedHolding} />
      <EditHoldingModal isOpen={showEditHolding} onClose={() => { setShowEditHolding(false); setSelectedHolding(null) }} onSuccess={loadData} onDelete={loadData} holding={selectedHolding} />
      <CashBalanceModal isOpen={showCashBalance} onClose={() => setShowCashBalance(false)} onSuccess={loadData} />
      <ImportDataModal isOpen={showImport} onClose={() => setShowImport(false)} onSuccess={loadData} />
    </div>
  )
}
