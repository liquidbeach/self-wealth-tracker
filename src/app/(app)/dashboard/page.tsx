'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Eye,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  PieChart,
  BarChart3,
  Activity,
} from 'lucide-react'
import Link from 'next/link'

interface Holding {
  id: string
  ticker: string
  name: string
  market: string
  currency: string
  asset_type: string
  sector: string | null
  lots: {
    units: number
    purchase_price: number
  }[]
  live_price?: number
  live_change_percent?: number
}

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

// Fetch live price from Yahoo Finance
async function fetchLivePrice(symbol: string): Promise<{ price: number; changePercent: number } | null> {
  try {
    const response = await fetch(`/api/quote?symbol=${symbol}`)
    if (!response.ok) return null
    const data = await response.json()
    return {
      price: data.price || 0,
      changePercent: data.changePercent || 0,
    }
  } catch {
    return null
  }
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
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
  const [cashBalances, setCashBalances] = useState<{ AUD: number; USD: number; INR: number }>({
    AUD: 0,
    USD: 0,
    INR: 0,
  })

  const loadDashboard = useCallback(async () => {
    const supabase = createClient()
    
    // Load holdings with lots
    const { data: holdingsData } = await supabase
      .from('holdings')
      .select(`
        *,
        lots (units, purchase_price)
      `)

    // Load watchlist count
    const { count: watchlistCount } = await supabase
      .from('watchlist')
      .select('*', { count: 'exact', head: true })

    // Load cash balances
    const { data: cashData } = await supabase
      .from('cash_balances')
      .select('*')

    // Calculate cash by currency
    const cash = { AUD: 0, USD: 0, INR: 0 }
    cashData?.forEach(c => {
      if (c.currency in cash) {
        cash[c.currency as keyof typeof cash] += Number(c.balance)
      }
    })
    setCashBalances(cash)

    if (!holdingsData || holdingsData.length === 0) {
      setStats({
        totalCost: 0,
        totalValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        holdingsCount: 0,
        watchlistCount: watchlistCount || 0,
        topGainers: [],
        topLosers: [],
        sectorBreakdown: [],
      })
      setLoading(false)
      return
    }

    setRefreshing(true)

    // Fetch live prices for all holdings
    const holdingsWithPrices: (Holding & { pnl: number; pnlPercent: number; value: number; cost: number })[] = await Promise.all(
      holdingsData.map(async (holding) => {
        const lots = holding.lots || []
        const units = lots.reduce((sum: number, lot: { units: number }) => sum + Number(lot.units), 0)
        const cost = lots.reduce((sum: number, lot: { units: number; purchase_price: number }) => 
          sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
        
        if (units === 0) {
          return { ...holding, live_price: 0, live_change_percent: 0, pnl: 0, pnlPercent: 0, value: 0, cost: 0 }
        }

        const liveData = await fetchLivePrice(holding.ticker)
        const price = liveData?.price || 0
        const value = units * price
        const pnl = value - cost
        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0

        return {
          ...holding,
          live_price: price,
          live_change_percent: liveData?.changePercent || 0,
          pnl,
          pnlPercent,
          value,
          cost,
        }
      })
    )

    // Calculate totals
    const totalCost = holdingsWithPrices.reduce((sum, h) => sum + h.cost, 0)
    const totalValue = holdingsWithPrices.reduce((sum, h) => sum + h.value, 0)
    const totalPnL = totalValue - totalCost
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

    // Get top gainers/losers
    const sorted = [...holdingsWithPrices]
      .filter(h => h.cost > 0 && h.live_price && h.live_price > 0)
      .sort((a, b) => b.pnlPercent - a.pnlPercent)
    
    const topGainers = sorted
      .filter(h => h.pnlPercent > 0)
      .slice(0, 3)
      .map(h => ({ ticker: h.ticker, name: h.name, pnlPercent: h.pnlPercent }))
    
    const topLosers = sorted
      .filter(h => h.pnlPercent < 0)
      .slice(-3)
      .reverse()
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
      totalCost,
      totalValue,
      totalPnL,
      totalPnLPercent,
      holdingsCount: holdingsWithPrices.filter(h => h.cost > 0).length,
      watchlistCount: watchlistCount || 0,
      topGainers,
      topLosers,
      sectorBreakdown,
    })

    setLastUpdate(new Date())
    setRefreshing(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const handleRefresh = () => {
    loadDashboard()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-primary-600" />
          <p className="text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Your investment overview</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-slate-400">
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Portfolio Value */}
        <div className="card bg-gradient-to-br from-primary-600 to-primary-700 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-primary-100 text-sm">Portfolio Value</p>
            <DollarSign className="w-5 h-5 text-primary-200" />
          </div>
          <p className="text-2xl font-bold">
            ${stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-primary-200 mt-1">
            Cost: ${stats.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Total P&L */}
        <div className={`card ${stats.totalPnL >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-600 text-sm">Total Gain/Loss</p>
            {stats.totalPnL >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
          </div>
          <p className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className={`text-sm mt-1 ${stats.totalPnLPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(2)}%
          </p>
        </div>

        {/* Holdings Count */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm">Holdings</p>
            <Briefcase className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.holdingsCount}</p>
          <Link href="/portfolio" className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-block">
            View portfolio →
          </Link>
        </div>

        {/* Watchlist Count */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm">Watchlist</p>
            <Eye className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.watchlistCount}</p>
          <Link href="/watchlist" className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-block">
            View watchlist →
          </Link>
        </div>
      </div>

      {/* Cash Balances */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-slate-400" />
          Cash Balances
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-500 mb-1">🇦🇺 AUD</p>
            <p className="text-xl font-bold text-slate-900">
              ${cashBalances.AUD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-500 mb-1">🇺🇸 USD</p>
            <p className="text-xl font-bold text-slate-900">
              ${cashBalances.USD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-500 mb-1">🇮🇳 INR</p>
            <p className="text-xl font-bold text-slate-900">
              ₹{cashBalances.INR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Performance & Sectors Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Gainers/Losers */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-400" />
            Performance
          </h3>
          
          {stats.topGainers.length > 0 || stats.topLosers.length > 0 ? (
            <div className="space-y-4">
              {/* Top Gainers */}
              {stats.topGainers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-green-600 uppercase mb-2">Top Gainers</p>
                  <div className="space-y-2">
                    {stats.topGainers.map(h => (
                      <div key={h.ticker} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-medium text-slate-900">{h.ticker}</p>
                          <p className="text-xs text-slate-500">{h.name}</p>
                        </div>
                        <p className="font-semibold text-green-600">
                          +{h.pnlPercent.toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Losers */}
              {stats.topLosers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 uppercase mb-2">Top Losers</p>
                  <div className="space-y-2">
                    {stats.topLosers.map(h => (
                      <div key={h.ticker} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-medium text-slate-900">{h.ticker}</p>
                          <p className="text-xs text-slate-500">{h.name}</p>
                        </div>
                        <p className="font-semibold text-red-600">
                          {h.pnlPercent.toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No performance data yet</p>
              <p className="text-sm">Add holdings to see gainers/losers</p>
            </div>
          )}
        </div>

        {/* Sector Breakdown */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-slate-400" />
            Sector Allocation
          </h3>
          
          {stats.sectorBreakdown.length > 0 ? (
            <div className="space-y-3">
              {stats.sectorBreakdown.map(s => (
                <div key={s.sector}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{s.sector}</span>
                    <span className="text-sm font-medium text-slate-900">{s.percent.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${Math.min(s.percent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <PieChart className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No sector data yet</p>
              <p className="text-sm">Add holdings with sectors to see allocation</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-slate-400" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/momentum"
            className="bg-slate-50 hover:bg-slate-100 rounded-lg p-4 text-center transition-colors"
          >
            <Activity className="w-6 h-6 mx-auto mb-2 text-primary-600" />
            <p className="text-sm font-medium text-slate-900">Momentum Scanner</p>
            <p className="text-xs text-slate-500">Find trading signals</p>
          </Link>
          <Link
            href="/assessor"
            className="bg-slate-50 hover:bg-slate-100 rounded-lg p-4 text-center transition-colors"
          >
            <Eye className="w-6 h-6 mx-auto mb-2 text-primary-600" />
            <p className="text-sm font-medium text-slate-900">Stock Assessor</p>
            <p className="text-xs text-slate-500">Analyze quality stocks</p>
          </Link>
          <Link
            href="/journal"
            className="bg-slate-50 hover:bg-slate-100 rounded-lg p-4 text-center transition-colors"
          >
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-primary-600" />
            <p className="text-sm font-medium text-slate-900">Trading Journal</p>
            <p className="text-xs text-slate-500">Track your trades</p>
          </Link>
          <Link
            href="/risk"
            className="bg-slate-50 hover:bg-slate-100 rounded-lg p-4 text-center transition-colors"
          >
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-primary-600" />
            <p className="text-sm font-medium text-slate-900">Risk Dashboard</p>
            <p className="text-xs text-slate-500">Monitor portfolio risk</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
