'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Eye,
  RefreshCw,
  DollarSign,
  PieChart,
  Activity,
  Search,
  BookOpen,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  totalCost: number
  totalValue: number
  totalPnL: number
  totalPnLPercent: number
  holdingsCount: number
  watchlistCount: number
  topGainers: { ticker: string; name: string; pnlPercent: number }[]
  topLosers: { ticker: string; name: string; pnlPercent: number }[]
  sectorBreakdown: { sector: string; value: number; percent: number }[]
}

async function fetchLivePrice(symbol: string): Promise<{ price: number } | null> {
  try {
    const response = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`)
    if (!response.ok) return null
    const data = await response.json()
    if (data.error || !data.price) return null
    return { price: data.price }
  } catch {
    return null
  }
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [priceErrors, setPriceErrors] = useState(0)
  const [stats, setStats] = useState<DashboardStats>({
    totalCost: 0,
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    holdingsCount: 0,
    watchlistCount: 0,
    topGainers: [],
    topLosers: [],
    sectorBreakdown: [],
  })
  const [cashBalances, setCashBalances] = useState({ AUD: 0, USD: 0, INR: 0 })

  const loadDashboard = useCallback(async () => {
    const supabase = createClient()
    
    // Load holdings with lots
    const { data: holdingsData } = await supabase
      .from('holdings')
      .select(`*, lots (units, purchase_price)`)

    // Load watchlist count
    const { count: watchlistCount } = await supabase
      .from('watchlist')
      .select('*', { count: 'exact', head: true })

    // Load cash balances
    const { data: cashData } = await supabase
      .from('cash_balances')
      .select('*')

    const cash = { AUD: 0, USD: 0, INR: 0 }
    cashData?.forEach(c => {
      if (c.currency in cash) {
        cash[c.currency as keyof typeof cash] += Number(c.balance)
      }
    })
    setCashBalances(cash)

    if (!holdingsData || holdingsData.length === 0) {
      setStats({
        totalCost: 0, totalValue: 0, totalPnL: 0, totalPnLPercent: 0,
        holdingsCount: 0, watchlistCount: watchlistCount || 0,
        topGainers: [], topLosers: [], sectorBreakdown: [],
      })
      setLoading(false)
      return
    }

    setRefreshing(true)
    let errorCount = 0

    // Fetch prices and calculate stats
    const holdingsWithPrices = await Promise.all(
      holdingsData.map(async (holding: any) => {
        const lots = holding.lots || []
        const units = lots.reduce((sum: number, lot: any) => sum + Number(lot.units), 0)
        const cost = lots.reduce((sum: number, lot: any) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
        
        if (units === 0) return { ...holding, pnl: 0, pnlPercent: 0, value: 0, cost: 0 }

        // Use manual price if set, otherwise fetch live
        let price = holding.current_price
        if (!price || price <= 0) {
          const liveData = await fetchLivePrice(holding.ticker)
          if (liveData) {
            price = liveData.price
          } else {
            errorCount++
            price = cost / units // fallback to avg cost
          }
        }

        const value = units * price
        const pnl = value - cost
        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0

        return { ...holding, pnl, pnlPercent, value, cost }
      })
    )

    setPriceErrors(errorCount)

    // Calculate totals
    const totalCost = holdingsWithPrices.reduce((sum, h) => sum + h.cost, 0)
    const totalValue = holdingsWithPrices.reduce((sum, h) => sum + h.value, 0)
    const totalPnL = totalValue - totalCost
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

    // Top gainers/losers
    const sorted = [...holdingsWithPrices]
      .filter(h => h.cost > 0)
      .sort((a, b) => b.pnlPercent - a.pnlPercent)
    
    const topGainers = sorted.filter(h => h.pnlPercent > 0).slice(0, 3)
      .map(h => ({ ticker: h.ticker, name: h.name, pnlPercent: h.pnlPercent }))
    
    const topLosers = sorted.filter(h => h.pnlPercent < 0).slice(-3).reverse()
      .map(h => ({ ticker: h.ticker, name: h.name, pnlPercent: h.pnlPercent }))

    // Sector breakdown
    const sectorMap = new Map<string, number>()
    holdingsWithPrices.forEach(h => {
      const sector = h.sector || 'Other'
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + h.value)
    })
    const sectorBreakdown = Array.from(sectorMap.entries())
      .map(([sector, value]) => ({
        sector,
        value,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    setStats({
      totalCost, totalValue, totalPnL, totalPnLPercent,
      holdingsCount: holdingsWithPrices.filter(h => h.cost > 0).length,
      watchlistCount: watchlistCount || 0,
      topGainers, topLosers, sectorBreakdown,
    })

    setLastUpdate(new Date())
    setRefreshing(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const formatCompact = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`
    return `$${value.toFixed(0)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-primary-600" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Your investment overview</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-slate-400 hidden sm:inline">
              {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={loadDashboard}
            disabled={refreshing}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Portfolio Value */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl p-3 sm:p-4 text-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs opacity-75">Portfolio Value</span>
            <DollarSign className="w-4 h-4 opacity-50" />
          </div>
          <p className="text-xl sm:text-2xl font-bold">{formatCompact(stats.totalValue)}</p>
          <p className="text-xs opacity-75 mt-0.5">Cost: {formatCompact(stats.totalCost)}</p>
        </div>

        {/* Total P&L */}
        <div className={`rounded-xl p-3 sm:p-4 ${stats.totalPnL >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-600">Gain/Loss</span>
            {stats.totalPnL >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
          </div>
          <p className={`text-xl sm:text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {stats.totalPnL >= 0 ? '+' : ''}{formatCompact(stats.totalPnL)}
          </p>
          <p className={`text-xs mt-0.5 ${stats.totalPnLPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(1)}%
          </p>
        </div>

        {/* Holdings Count */}
        <Link href="/portfolio" className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 hover:border-primary-300 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Holdings</span>
            <Briefcase className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.holdingsCount}</p>
          <p className="text-xs text-primary-600 mt-0.5">View portfolio →</p>
        </Link>

        {/* Watchlist Count */}
        <Link href="/watchlist" className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 hover:border-primary-300 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Watchlist</span>
            <Eye className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.watchlistCount}</p>
          <p className="text-xs text-primary-600 mt-0.5">View watchlist →</p>
        </Link>
      </div>

      {priceErrors > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4" />
          <span>{priceErrors} stock(s) couldn't fetch live prices. Using fallback values.</span>
        </div>
      )}

      {/* Cash Balances */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-slate-400" />
          Cash Balances
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-slate-50 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-xs text-slate-500">🇦🇺 AUD</p>
            <p className="text-sm sm:text-base font-bold text-slate-900">${cashBalances.AUD.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-xs text-slate-500">🇺🇸 USD</p>
            <p className="text-sm sm:text-base font-bold text-slate-900">${cashBalances.USD.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-xs text-slate-500">🇮🇳 INR</p>
            <p className="text-sm sm:text-base font-bold text-slate-900">₹{cashBalances.INR.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Performance & Sectors Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Gainers/Losers */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            Performance
          </h3>
          
          {stats.topGainers.length > 0 || stats.topLosers.length > 0 ? (
            <div className="space-y-3">
              {stats.topGainers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-emerald-600 uppercase mb-1.5">Top Gainers</p>
                  <div className="space-y-1.5">
                    {stats.topGainers.map(h => (
                      <div key={h.ticker} className="flex items-center justify-between bg-emerald-50 rounded px-2 py-1.5">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{h.ticker}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[120px]">{h.name}</p>
                        </div>
                        <p className="text-sm font-semibold text-emerald-600">+{h.pnlPercent.toFixed(1)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stats.topLosers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 uppercase mb-1.5">Top Losers</p>
                  <div className="space-y-1.5">
                    {stats.topLosers.map(h => (
                      <div key={h.ticker} className="flex items-center justify-between bg-red-50 rounded px-2 py-1.5">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{h.ticker}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[120px]">{h.name}</p>
                        </div>
                        <p className="text-sm font-semibold text-red-600">{h.pnlPercent.toFixed(1)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <Activity className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">Add holdings to see performance</p>
            </div>
          )}
        </div>

        {/* Sector Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-slate-400" />
            Sector Allocation
          </h3>
          
          {stats.sectorBreakdown.length > 0 ? (
            <div className="space-y-2">
              {stats.sectorBreakdown.map(s => (
                <div key={s.sector}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-700 truncate max-w-[150px]">{s.sector}</span>
                    <span className="text-xs font-medium text-slate-900">{s.percent.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${Math.min(s.percent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <PieChart className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">Add holdings to see allocation</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Link href="/search" className="bg-slate-50 hover:bg-slate-100 rounded-lg p-3 text-center transition-colors">
            <Search className="w-5 h-5 mx-auto mb-1 text-primary-600" />
            <p className="text-xs font-medium text-slate-900">Search</p>
          </Link>
          <Link href="/momentum" className="bg-slate-50 hover:bg-slate-100 rounded-lg p-3 text-center transition-colors">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary-600" />
            <p className="text-xs font-medium text-slate-900">Momentum</p>
          </Link>
          <Link href="/assessor" className="bg-slate-50 hover:bg-slate-100 rounded-lg p-3 text-center transition-colors">
            <Eye className="w-5 h-5 mx-auto mb-1 text-primary-600" />
            <p className="text-xs font-medium text-slate-900">Assessor</p>
          </Link>
          <Link href="/journal" className="bg-slate-50 hover:bg-slate-100 rounded-lg p-3 text-center transition-colors">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary-600" />
            <p className="text-xs font-medium text-slate-900">Journal</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
