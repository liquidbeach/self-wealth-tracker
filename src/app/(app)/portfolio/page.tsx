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
  current_price: number | null // from database (manual override)
  notes: string | null
  thesis: string | null
  lots: Lot[]
  // Live data
  live_price?: number
  live_change?: number
  live_change_percent?: number
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

// Fetch live price from Yahoo Finance
async function fetchLivePrice(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
  try {
    const response = await fetch(`/api/quote?symbol=${symbol}`)
    if (!response.ok) return null
    const data = await response.json()
    return {
      price: data.price || 0,
      change: data.change || 0,
      changePercent: data.changePercent || 0,
    }
  } catch {
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

  // Refresh live prices for all holdings
  const refreshLivePrices = useCallback(async (holdingsToUpdate: Holding[]) => {
    if (holdingsToUpdate.length === 0) return holdingsToUpdate

    setRefreshingPrices(true)
    
    const updatedHoldings = await Promise.all(
      holdingsToUpdate.map(async (holding) => {
        // Skip if no lots (no units to value)
        const lots = holding.lots || []
        if (lots.length === 0) return holding
        
        const liveData = await fetchLivePrice(holding.ticker)
        if (!liveData) return holding
        
        return {
          ...holding,
          live_price: liveData.price,
          live_change: liveData.change,
          live_change_percent: liveData.changePercent,
        }
      })
    )

    // Calculate portfolio summary
    let totalCost = 0
    let totalValue = 0
    let holdingsWithValue = 0

    updatedHoldings.forEach(holding => {
      const lots = holding.lots || []
      const units = lots.reduce((sum, lot) => sum + Number(lot.units), 0)
      const cost = lots.reduce((sum, lot) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
      const price = holding.live_price || holding.current_price || 0
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

    setLastPriceUpdate(new Date())
    setRefreshingPrices(false)
    
    return updatedHoldings
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    
    // Load holdings with lots
    const { data: holdingsData } = await supabase
      .from('holdings')
      .select(`
        *,
        lots (*)
      `)
      .order('ticker', { ascending: true })

    // Load cash balances
    const { data: cashData } = await supabase
      .from('cash_balances')
      .select('*')
      .order('currency', { ascending: true })

    setCashBalances(cashData || [])
    
    // Fetch live prices
    const holdingsWithPrices = await refreshLivePrices(holdingsData || [])
    setHoldings(holdingsWithPrices)
    
    setLoading(false)
  }, [refreshLivePrices])

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

  // Calculate totals
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
    
    // Use live price if available, otherwise fall back to database price
    const currentPrice = holding.live_price || holding.current_price || 0
    const currentValue = totalUnits * currentPrice
    const gainLoss = currentValue - totalCost
    const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0
    const firstBuyDate = lots.length > 0 
      ? lots.reduce((earliest, lot) => lot.purchase_date < earliest ? lot.purchase_date : earliest, lots[0].purchase_date)
      : null

    return { totalUnits, totalCost, avgPrice, currentPrice, currentValue, gainLoss, gainLossPct, firstBuyDate }
  }

  const getCurrencySymbol = (currency: string) => {
    if (currency === 'INR') return '₹'
    return '$'
  }

  const formatCurrency = (value: number, currency: string) => {
    const symbol = getCurrencySymbol(currency)
    return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }

  // Group holdings by currency
  const holdingsByCurrency = holdings.reduce((acc, holding) => {
    const currency = holding.currency
    if (!acc[currency]) acc[currency] = []
    acc[currency].push(holding)
    return acc
  }, {} as Record<string, Holding[]>)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portfolio</h1>
          <p className="text-slate-500">Track your holdings and performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="btn-secondary flex items-center gap-2"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowCashBalance(true)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Wallet className="w-4 h-4" />
                    Manage Cash
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowImport(true)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Upload className="w-4 h-4" />
                    Import Data
                  </button>
                </div>
              </>
            )}
          </div>
          <button 
            onClick={() => setShowAddHolding(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Holding
          </button>
        </div>
      </div>

      {/* Portfolio Summary - Live */}
      {summary.holdingsCount > 0 && (
        <div className="card bg-gradient-to-r from-primary-600 to-primary-700 text-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {summary.totalPnL >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              Portfolio Summary — Live
            </h2>
            <div className="flex items-center gap-3">
              {lastPriceUpdate && (
                <span className="text-xs text-primary-200">
                  Updated {lastPriceUpdate.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handleRefreshPrices}
                disabled={refreshingPrices}
                className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${refreshingPrices ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-primary-200 text-sm">Total Cost</p>
              <p className="text-xl font-bold">${summary.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm">Current Value</p>
              <p className="text-xl font-bold">${summary.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-primary-200 text-sm">Total P&L</p>
              <p className={`text-xl font-bold ${summary.totalPnL >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {summary.totalPnL >= 0 ? '+' : ''}${summary.totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-primary-200 text-sm">Return</p>
              <p className={`text-xl font-bold ${summary.totalPnLPercent >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {summary.totalPnLPercent >= 0 ? '+' : ''}{summary.totalPnLPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cash balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          className="card cursor-pointer hover:border-primary-300 transition-colors"
          onClick={() => setShowCashBalance(true)}
        >
          <p className="text-sm text-slate-500 mb-1">Cash (AUD)</p>
          <p className="text-xl font-bold text-slate-900">
            ${getCashByCurrency('AUD').toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div 
          className="card cursor-pointer hover:border-primary-300 transition-colors"
          onClick={() => setShowCashBalance(true)}
        >
          <p className="text-sm text-slate-500 mb-1">Cash (USD)</p>
          <p className="text-xl font-bold text-slate-900">
            ${getCashByCurrency('USD').toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div 
          className="card cursor-pointer hover:border-primary-300 transition-colors"
          onClick={() => setShowCashBalance(true)}
        >
          <p className="text-sm text-slate-500 mb-1">Cash (INR)</p>
          <p className="text-xl font-bold text-slate-900">
            ₹{getCashByCurrency('INR').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Holdings */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Holdings</h3>
          {holdings.length > 0 && (
            <button
              onClick={handleRefreshPrices}
              disabled={refreshingPrices}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingPrices ? 'animate-spin' : ''}`} />
              {refreshingPrices ? 'Refreshing...' : 'Refresh Prices'}
            </button>
          )}
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-slate-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
            Loading holdings & prices...
          </div>
        ) : holdings.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(holdingsByCurrency).map(([currency, currencyHoldings]) => (
              <div key={currency}>
                <h4 className="text-sm font-medium text-slate-500 mb-3 uppercase tracking-wide">
                  {currency === 'AUD' ? '🇦🇺 Australian (AUD)' : 
                   currency === 'USD' ? '🇺🇸 US (USD)' : 
                   '🇮🇳 Indian (INR)'}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 w-8"></th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Holding</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Type</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Units</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Avg Cost</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Current</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Today</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Value</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Gain/Loss</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500 w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currencyHoldings.map((holding) => {
                        const stats = calculateHoldingStats(holding)
                        const isExpanded = expandedHoldings.has(holding.id)
                        const lots = holding.lots || []

                        return (
                          <>
                            <tr 
                              key={holding.id} 
                              className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                              onClick={() => lots.length > 0 && toggleExpanded(holding.id)}
                            >
                              <td className="py-3 px-4">
                                {lots.length > 0 && (
                                  isExpanded ? 
                                    <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div>
                                  <p className="font-medium text-slate-900">{holding.ticker}</p>
                                  <p className="text-sm text-slate-500">{holding.name}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm text-slate-600">{holding.asset_type}</span>
                                {holding.investment_style && (
                                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                    holding.investment_style === 'Growth' ? 'bg-purple-100 text-purple-700' :
                                    holding.investment_style === 'Dividend' ? 'bg-green-100 text-green-700' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {holding.investment_style}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-900 text-right">
                                {stats.totalUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-900 text-right">
                                {formatCurrency(stats.avgPrice, currency)}
                              </td>
                              <td className="py-3 px-4 text-sm text-right">
                                {holding.live_price ? (
                                  <span className="font-medium text-slate-900">
                                    {formatCurrency(holding.live_price, currency)}
                                  </span>
                                ) : holding.current_price ? (
                                  <span className="text-slate-500">
                                    {formatCurrency(holding.current_price, currency)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-sm text-right">
                                {holding.live_change_percent !== undefined ? (
                                  <span className={`${holding.live_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {holding.live_change_percent >= 0 ? '+' : ''}{holding.live_change_percent.toFixed(2)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-900 text-right font-medium">
                                {stats.currentPrice > 0 ? formatCurrency(stats.currentValue, currency) : '—'}
                              </td>
                              <td className={`py-3 px-4 text-sm text-right font-medium ${
                                stats.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {stats.totalCost > 0 && stats.currentPrice > 0 ? (
                                  <>
                                    {stats.gainLoss >= 0 ? '+' : ''}{stats.gainLossPct.toFixed(2)}%
                                    <br />
                                    <span className="text-xs font-normal">
                                      {stats.gainLoss >= 0 ? '+' : ''}{formatCurrency(stats.gainLoss, currency)}
                                    </span>
                                  </>
                                ) : '—'}
                              </td>
                              <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleAddLot(holding)}
                                    className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                                    title="Add lot"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleEditHolding(holding)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
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
                                <td colSpan={10} className="bg-slate-50 px-4 py-3">
                                  <div className="ml-8">
                                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">Purchase Lots</p>
                                    <table className="w-full">
                                      <thead>
                                        <tr className="text-xs text-slate-500">
                                          <th className="text-left py-1 pr-4">Date</th>
                                          <th className="text-right py-1 pr-4">Units</th>
                                          <th className="text-right py-1 pr-4">Price</th>
                                          <th className="text-right py-1 pr-4">Cost</th>
                                          <th className="text-right py-1 pr-4">Value</th>
                                          <th className="text-right py-1 pr-4">Gain/Loss</th>
                                          <th className="text-left py-1 pr-4">Notes</th>
                                          <th className="w-8"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lots.map((lot) => {
                                          const lotCost = Number(lot.units) * Number(lot.purchase_price)
                                          const currentPrice = holding.live_price || holding.current_price || Number(lot.purchase_price)
                                          const lotValue = Number(lot.units) * currentPrice
                                          const lotGain = lotValue - lotCost
                                          const lotGainPct = lotCost > 0 ? (lotGain / lotCost) * 100 : 0

                                          return (
                                            <tr key={lot.id} className="text-sm border-t border-slate-200">
                                              <td className="py-2 pr-4 text-slate-600">
                                                {formatDate(lot.purchase_date)}
                                              </td>
                                              <td className="py-2 pr-4 text-right text-slate-900">
                                                {Number(lot.units).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                              </td>
                                              <td className="py-2 pr-4 text-right text-slate-900">
                                                {formatCurrency(Number(lot.purchase_price), currency)}
                                              </td>
                                              <td className="py-2 pr-4 text-right text-slate-900">
                                                {formatCurrency(lotCost, currency)}
                                              </td>
                                              <td className="py-2 pr-4 text-right text-slate-900">
                                                {holding.live_price || holding.current_price 
                                                  ? formatCurrency(lotValue, currency)
                                                  : '—'
                                                }
                                              </td>
                                              <td className={`py-2 pr-4 text-right font-medium ${
                                                lotGain >= 0 ? 'text-green-600' : 'text-red-600'
                                              }`}>
                                                {holding.live_price || holding.current_price ? (
                                                  <>
                                                    {lotGain >= 0 ? '+' : ''}{lotGainPct.toFixed(1)}%
                                                  </>
                                                ) : '—'}
                                              </td>
                                              <td className="py-2 pr-4 text-slate-500 text-sm">
                                                {lot.notes || '—'}
                                              </td>
                                              <td className="py-2">
                                                <button
                                                  onClick={() => handleDeleteLot(lot.id)}
                                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                  title="Delete lot"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                    {holding.thesis && (
                                      <div className="mt-3 pt-3 border-t border-slate-200">
                                        <p className="text-xs font-medium text-slate-500 uppercase mb-1">Thesis</p>
                                        <p className="text-sm text-slate-600">{holding.thesis}</p>
                                      </div>
                                    )}
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
          <div className="text-center py-12 text-slate-400">
            <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No holdings yet</p>
            <p className="text-sm mb-4">Add your first holding or import from your HTML tracker</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setShowImport(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import Data
              </button>
              <button 
                onClick={() => setShowAddHolding(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Holding
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddHoldingModal
        isOpen={showAddHolding}
        onClose={() => setShowAddHolding(false)}
        onSuccess={loadData}
      />
      <AddLotModal
        isOpen={showAddLot}
        onClose={() => {
          setShowAddLot(false)
          setSelectedHolding(null)
        }}
        onSuccess={loadData}
        holding={selectedHolding}
      />
      <EditHoldingModal
        isOpen={showEditHolding}
        onClose={() => {
          setShowEditHolding(false)
          setSelectedHolding(null)
        }}
        onSuccess={loadData}
        onDelete={loadData}
        holding={selectedHolding}
      />
      <CashBalanceModal
        isOpen={showCashBalance}
        onClose={() => setShowCashBalance(false)}
        onSuccess={loadData}
      />
      <ImportDataModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
