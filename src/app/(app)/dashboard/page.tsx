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
  Calculator,
  ChevronDown,
  Check,
  X,
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

interface HoldingWithSector {
  id: string
  ticker: string
  name: string
  sector: string | null
}

// Sector definitions - consistent across Dashboard & Performance Report
const SECTORS: Record<string, { name: string; color: string }> = {
  'AI Infrastructure': { name: 'AI Infrastructure', color: 'from-purple-500 to-violet-500' },
  'ETF': { name: 'ETFs (Base Returns)', color: 'from-blue-500 to-cyan-500' },
  'Mining': { name: 'Mining', color: 'from-orange-500 to-amber-500' },
  'Physical Infrastructure': { name: 'Physical Infrastructure', color: 'from-emerald-500 to-teal-500' },
  'Technology': { name: 'Technology', color: 'from-cyan-500 to-blue-500' },
  'Financials': { name: 'Financials', color: 'from-green-500 to-emerald-500' },
  'Materials': { name: 'Materials', color: 'from-yellow-500 to-orange-500' },
  'Diversified': { name: 'Diversified', color: 'from-indigo-500 to-purple-500' },
  'Other': { name: 'Other', color: 'from-slate-400 to-gray-500' },
}

const SECTOR_OPTIONS = [
  'AI Infrastructure',
  'ETF',
  'Mining',
  'Physical Infrastructure',
  'Technology',
  'Financials',
  'Materials',
  'Diversified',
  'Other',
]

// Exchange rates to AUD (fallback values, will be fetched live)
const DEFAULT_RATES: Record<string, number> = {
  AUD: 1,
  USD: 1.55,  // 1 USD = 1.55 AUD approx
  INR: 0.019, // 1 INR = 0.019 AUD approx
}

async function fetchExchangeRates(): Promise<Record<string, number>> {
  try {
    const response = await fetch('/api/exchange-rates')
    if (response.ok) {
      const data = await response.json()
      return { AUD: 1, USD: data.USD_AUD || DEFAULT_RATES.USD, INR: data.INR_AUD || DEFAULT_RATES.INR }
    }
  } catch {
    // Fall back to defaults
  }
  return DEFAULT_RATES
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
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(DEFAULT_RATES)
  const [stats, setStats] = useState<DashboardStats>({
    totalCost: 0, totalValue: 0, totalPnL: 0, totalPnLPercent: 0,
    holdingsCount: 0, watchlistCount: 0, topGainers: [], topLosers: [], sectorBreakdown: [],
  })
  const [cashBalances, setCashBalances] = useState({ AUD: 0, USD: 0, INR: 0 })
  
  // Sector editing state
  const [showSectorEdit, setShowSectorEdit] = useState(false)
  const [holdingsForSector, setHoldingsForSector] = useState<HoldingWithSector[]>([])
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    const supabase = createClient()
    
    // Fetch exchange rates first
    const rates = await fetchExchangeRates()
    setExchangeRates(rates)
    
    const { data: holdingsData } = await supabase.from('holdings').select(`*, lots (units, purchase_price)`)
    const { count: watchlistCount } = await supabase.from('watchlist').select('*', { count: 'exact', head: true })
    const { data: cashData } = await supabase.from('cash_balances').select('*')

    const cash = { AUD: 0, USD: 0, INR: 0 }
    cashData?.forEach(c => {
      if (c.currency in cash) cash[c.currency as keyof typeof cash] += Number(c.balance)
    })
    setCashBalances(cash)
    
    // Store holdings for sector editing
    if (holdingsData) {
      setHoldingsForSector(holdingsData.map((h: any) => ({
        id: h.id,
        ticker: h.ticker,
        name: h.name,
        sector: h.sector,
      })))
    }

    if (!holdingsData || holdingsData.length === 0) {
      setStats({ totalCost: 0, totalValue: 0, totalPnL: 0, totalPnLPercent: 0, holdingsCount: 0, watchlistCount: watchlistCount || 0, topGainers: [], topLosers: [], sectorBreakdown: [] })
      setLoading(false)
      return
    }

    setRefreshing(true)
    let errorCount = 0

    const holdingsWithPrices = await Promise.all(
      holdingsData.map(async (holding: any) => {
        const lots = holding.lots || []
        const units = lots.reduce((sum: number, lot: any) => sum + Number(lot.units), 0)
        const cost = lots.reduce((sum: number, lot: any) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
        const currency = holding.currency || 'AUD'
        
        if (units === 0) return { ...holding, pnl: 0, pnlPercent: 0, value: 0, cost: 0, valueAUD: 0, costAUD: 0 }

        let price = holding.current_price
        if (!price || price <= 0) {
          const liveData = await fetchLivePrice(holding.ticker)
          if (liveData) price = liveData.price
          else { errorCount++; price = cost / units }
        }

        const value = units * price
        const pnl = value - cost
        const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0
        
        // Convert to AUD for totals
        const rate = rates[currency] || 1
        const valueAUD = value * rate
        const costAUD = cost * rate
        
        return { ...holding, pnl, pnlPercent, value, cost, valueAUD, costAUD, currency }
      })
    )

    setPriceErrors(errorCount)

    // Calculate totals in AUD
    const totalCost = holdingsWithPrices.reduce((sum, h) => sum + (h.costAUD || 0), 0)
    const totalValue = holdingsWithPrices.reduce((sum, h) => sum + (h.valueAUD || 0), 0)
    const totalPnL = totalValue - totalCost
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

    const sorted = [...holdingsWithPrices].filter(h => h.cost > 0).sort((a, b) => b.pnlPercent - a.pnlPercent)
    const topGainers = sorted.filter(h => h.pnlPercent > 0).slice(0, 3).map(h => ({ ticker: h.ticker, name: h.name, pnlPercent: h.pnlPercent }))
    const topLosers = sorted.filter(h => h.pnlPercent < 0).slice(-3).reverse().map(h => ({ ticker: h.ticker, name: h.name, pnlPercent: h.pnlPercent }))

    const sectorMap = new Map<string, number>()
    holdingsWithPrices.forEach(h => {
      const sector = h.sector || 'Other'
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + (h.valueAUD || 0))
    })
    const sectorBreakdown = Array.from(sectorMap.entries())
      .map(([sector, value]) => ({ sector, value, percent: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value).slice(0, 6)

    setStats({ totalCost, totalValue, totalPnL, totalPnLPercent, holdingsCount: holdingsWithPrices.filter(h => h.cost > 0).length, watchlistCount: watchlistCount || 0, topGainers, topLosers, sectorBreakdown })
    setLastUpdate(new Date())
    setRefreshing(false)
    setLoading(false)
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // Update holding sector
  const updateSector = async (holdingId: string, newSector: string) => {
    const supabase = createClient()
    await supabase.from('holdings').update({ sector: newSector }).eq('id', holdingId)
    
    // Update local state
    setHoldingsForSector(prev => prev.map(h => 
      h.id === holdingId ? { ...h, sector: newSector } : h
    ))
    setEditingSectorId(null)
    
    // Refresh dashboard to update sector breakdown
    loadDashboard()
  }

  const formatCompact = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`
    return `$${value.toFixed(0)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-green-400" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500">Your investment overview</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && <span className="text-xs text-gray-400 hidden sm:inline">{lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          <button onClick={loadDashboard} disabled={refreshing} className="p-2 border border-gray-800 rounded-lg hover:bg-white/5">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Stats Grid - ALL SLATE-800 CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Portfolio Value - Dark Slate */}
        <div className="bg-slate-800 rounded-xl p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Portfolio Value <span className="text-cyan-400">(AUD)</span></span>
            <DollarSign className="w-4 h-4 text-gray-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">${stats.totalValue.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-400 mt-0.5">Cost: ${stats.totalCost.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>

        {/* Gain/Loss - Dark Slate with colored text */}
        <div className="bg-slate-800 rounded-xl p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Gain/Loss <span className="text-cyan-400">(AUD)</span></span>
            {stats.totalPnL >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
          </div>
          <p className={`text-xl sm:text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {stats.totalPnL >= 0 ? '+' : ''}${Math.abs(stats.totalPnL).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className={`text-xs mt-0.5 font-semibold ${stats.totalPnLPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(1)}%
          </p>
        </div>

        {/* Holdings Count - Dark */}
        <Link href="/portfolio" className="bg-slate-800 rounded-xl p-3 sm:p-4 hover:bg-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Holdings</span>
            <Briefcase className="w-4 h-4 text-gray-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.holdingsCount}</p>
          <p className="text-xs text-cyan-400 mt-0.5">View portfolio →</p>
        </Link>

        {/* Watchlist Count - Dark */}
        <Link href="/watchlist" className="bg-slate-800 rounded-xl p-3 sm:p-4 hover:bg-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Watchlist</span>
            <Eye className="w-4 h-4 text-gray-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{stats.watchlistCount}</p>
          <p className="text-xs text-cyan-400 mt-0.5">View watchlist →</p>
        </Link>
      </div>

      {priceErrors > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4" />
          <span>{priceErrors} stock(s) couldn't fetch live prices.</span>
        </div>
      )}

      {/* Cash Balances - Dark */}
      <div className="bg-slate-800 rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-gray-400" />
          Cash Balances
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-slate-700 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-xs text-gray-400">AUD</p>
            <p className="text-sm sm:text-base font-bold text-white">${cashBalances.AUD.toLocaleString()}</p>
          </div>
          <div className="bg-slate-700 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-xs text-gray-400">USD</p>
            <p className="text-sm sm:text-base font-bold text-white">${cashBalances.USD.toLocaleString()}</p>
          </div>
          <div className="bg-slate-700 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-xs text-gray-400">INR</p>
            <p className="text-sm sm:text-base font-bold text-white">₹{cashBalances.INR.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Performance & Sectors Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Gainers/Losers - BRIGHT COLORS */}
        <div className="bg-slate-800 rounded-xl p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            Performance
          </h3>
          
          {stats.topGainers.length > 0 || stats.topLosers.length > 0 ? (
            <div className="space-y-3">
              {stats.topGainers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-400 uppercase mb-1.5">Top Gainers</p>
                  <div className="space-y-1.5">
                    {stats.topGainers.map(h => (
                      <div key={h.ticker} className="flex items-center justify-between bg-green-500/100/100/20 border border-emerald-500/30 rounded px-2 py-1.5">
                        <div>
                          <p className="text-sm font-medium text-white">{h.ticker}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[120px]">{h.name}</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-400">+{h.pnlPercent.toFixed(1)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stats.topLosers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase mb-1.5">Top Losers</p>
                  <div className="space-y-1.5">
                    {stats.topLosers.map(h => (
                      <div key={h.ticker} className="flex items-center justify-between bg-slate-700 border border-slate-600 rounded px-2 py-1.5">
                        <div>
                          <p className="text-sm font-medium text-white">{h.ticker}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[120px]">{h.name}</p>
                        </div>
                        <p className="text-sm font-bold text-red-400">{h.pnlPercent.toFixed(1)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Activity className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">Add holdings to see performance</p>
            </div>
          )}
        </div>

        {/* Sector Breakdown - Dark with Edit */}
        <div className="bg-slate-800 rounded-xl p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-gray-400" />
              Sector Allocation
            </h3>
            <button
              onClick={() => setShowSectorEdit(!showSectorEdit)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              {showSectorEdit ? 'Done' : 'Edit'}
            </button>
          </div>
          
          {showSectorEdit ? (
            /* Sector Edit Mode */
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {holdingsForSector.map(h => (
                <div key={h.id} className="flex items-center justify-between bg-slate-700 rounded-lg px-3 py-2">
                  <span className="text-sm font-mono text-white">{h.ticker}</span>
                  
                  {editingSectorId === h.id ? (
                    <div className="flex items-center gap-1">
                      <select
                        value={h.sector || 'Other'}
                        onChange={(e) => updateSector(h.id, e.target.value)}
                        className="text-xs bg-slate-600 text-white border border-slate-500 rounded px-2 py-1"
                        autoFocus
                      >
                        {SECTOR_OPTIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button onClick={() => setEditingSectorId(null)} className="p-1 text-gray-400 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingSectorId(h.id)}
                      className="text-xs px-2 py-1 bg-slate-600 text-gray-300 rounded hover:bg-white/50"
                    >
                      {h.sector || 'Other'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Sector Display Mode */
            stats.sectorBreakdown.length > 0 ? (
              <div className="space-y-2">
                {stats.sectorBreakdown.map(s => {
                  const sectorInfo = SECTORS[s.sector] || SECTORS['Other']
                  return (
                    <div key={s.sector}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-gray-300 truncate max-w-[150px]">{sectorInfo.name}</span>
                        <span className="text-xs font-semibold text-white">{s.percent.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${sectorInfo.color} rounded-full transition-all`} 
                          style={{ width: `${Math.min(s.percent, 100)}%` }} 
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <PieChart className="w-6 h-6 mx-auto mb-1 opacity-50" />
                <p className="text-xs">Add holdings to see allocation</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Quick Actions - Dark */}
      <div className="bg-slate-800 rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-3">
          <Link href="/search" className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-center transition-colors">
            <Search className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
            <p className="text-xs font-medium text-white">Search</p>
          </Link>
          <Link href="/momentum" className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-center transition-colors">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
            <p className="text-xs font-medium text-white">Momentum</p>
          </Link>
          <Link href="/assessor" className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-center transition-colors">
            <Eye className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
            <p className="text-xs font-medium text-white">Assessor</p>
          </Link>
          <Link href="/journal" className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-center transition-colors">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
            <p className="text-xs font-medium text-white">Journal</p>
          </Link>
          <Link href="/cgt" className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-center transition-colors">
            <Calculator className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
            <p className="text-xs font-medium text-white">CGT</p>
          </Link>
          <Link href="/performance" className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 text-center transition-colors">
            <Briefcase className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
            <p className="text-xs font-medium text-white">Performance</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
