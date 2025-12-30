import { createServerSupabaseClient } from '@/lib/supabase-server'
import { TrendingUp, TrendingDown, DollarSign, Briefcase, Eye, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface Holding {
  id: string
  ticker: string
  name: string
  currency: string
  current_price: number | null
  lots: {
    units: number
    purchase_price: number
  }[]
}

interface FxRate {
  from_currency: string
  to_currency: string
  rate: number
}

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  
  // Get user's holdings with lots
  const { data: holdings } = await supabase
    .from('holdings')
    .select(`
      id,
      ticker,
      name,
      currency,
      current_price,
      lots (units, purchase_price)
    `)

  // Get cash balances
  const { data: cashBalances } = await supabase
    .from('cash_balances')
    .select('*')

  // Get FX rates
  const { data: fxRates } = await supabase
    .from('fx_rates')
    .select('*')

  // Get watchlist count
  const { count: watchlistCount } = await supabase
    .from('watchlist')
    .select('*', { count: 'exact', head: true })

  // Calculate portfolio values
  const calculateStats = () => {
    if (!holdings) return { 
      totalValueAUD: 0, 
      totalCostAUD: 0, 
      totalGain: 0, 
      totalGainPct: 0,
      holdingsCount: 0 
    }

    // Get FX rates for conversion
    const getRate = (from: string, to: string): number => {
      if (from === to) return 1
      const rate = fxRates?.find((r: FxRate) => r.from_currency === from && r.to_currency === to)
      return rate?.rate || 1
    }

    let totalValueAUD = 0
    let totalCostAUD = 0

    holdings.forEach((holding: Holding) => {
      const lots = holding.lots || []
      const totalUnits = lots.reduce((sum, lot) => sum + Number(lot.units), 0)
      const totalCost = lots.reduce((sum, lot) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
      
      // Use current price if available, otherwise use average purchase price
      const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0
      const currentPrice = holding.current_price || avgPrice
      const currentValue = totalUnits * currentPrice

      // Convert to AUD
      const rate = getRate(holding.currency, 'AUD')
      totalValueAUD += currentValue * rate
      totalCostAUD += totalCost * rate
    })

    // Add cash balances
    const cashAUD = cashBalances?.filter((c: any) => c.currency === 'AUD').reduce((sum: number, c: any) => sum + Number(c.balance), 0) || 0
    const cashUSD = cashBalances?.filter((c: any) => c.currency === 'USD').reduce((sum: number, c: any) => sum + Number(c.balance), 0) || 0
    const cashINR = cashBalances?.filter((c: any) => c.currency === 'INR').reduce((sum: number, c: any) => sum + Number(c.balance), 0) || 0

    const usdToAud = getRate('USD', 'AUD')
    const inrToAud = getRate('INR', 'AUD')

    const totalCashAUD = cashAUD + (cashUSD * usdToAud) + (cashINR * inrToAud)
    totalValueAUD += totalCashAUD

    const totalGain = totalValueAUD - totalCostAUD - totalCashAUD
    const investedAmount = totalCostAUD
    const totalGainPct = investedAmount > 0 ? (totalGain / investedAmount) * 100 : 0

    return {
      totalValueAUD,
      totalCostAUD,
      totalGain,
      totalGainPct,
      holdingsCount: holdings.length
    }
  }

  const stats = calculateStats()

  // Get top holdings by value
  const getTopHoldings = () => {
    if (!holdings) return []

    const getRate = (from: string, to: string): number => {
      if (from === to) return 1
      const rate = fxRates?.find((r: FxRate) => r.from_currency === from && r.to_currency === to)
      return rate?.rate || 1
    }

    return holdings
      .map((holding: Holding) => {
        const lots = holding.lots || []
        const totalUnits = lots.reduce((sum, lot) => sum + Number(lot.units), 0)
        const totalCost = lots.reduce((sum, lot) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
        const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0
        const currentPrice = holding.current_price || avgPrice
        const currentValue = totalUnits * currentPrice
        const rate = getRate(holding.currency, 'AUD')
        const valueAUD = currentValue * rate
        const gainLoss = currentValue - totalCost
        const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0

        return {
          ticker: holding.ticker,
          name: holding.name,
          valueAUD,
          gainLossPct,
          currency: holding.currency
        }
      })
      .sort((a, b) => b.valueAUD - a.valueAUD)
      .slice(0, 5)
  }

  const topHoldings = getTopHoldings()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Welcome back. Here's your portfolio overview.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Portfolio Value</p>
              <p className="text-2xl font-bold text-slate-900">
                ${stats.totalValueAUD.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-slate-400">AUD (incl. cash)</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        {/* Holdings */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Holdings</p>
              <p className="text-2xl font-bold text-slate-900">{stats.holdingsCount}</p>
              <p className="text-sm text-slate-400">positions</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Watchlist */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Watchlist</p>
              <p className="text-2xl font-bold text-slate-900">{watchlistCount || 0}</p>
              <p className="text-sm text-slate-400">stocks</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <Eye className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Total Gain/Loss */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Gain/Loss</p>
              <p className={`text-2xl font-bold ${stats.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.totalGain >= 0 ? '+' : ''}${Math.abs(stats.totalGain).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 0 })}
              </p>
              <p className={`text-sm ${stats.totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stats.totalGain >= 0 ? '+' : ''}{stats.totalGainPct.toFixed(2)}%
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stats.totalGain >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {stats.totalGain >= 0 ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Holdings */}
        <div className="lg:col-span-2 card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Top Holdings</h3>
            <Link href="/portfolio" className="text-sm text-primary-600 hover:text-primary-700">
              View all →
            </Link>
          </div>
          
          {topHoldings.length > 0 ? (
            <div className="space-y-3">
              {topHoldings.map((holding, index) => (
                <div key={holding.ticker} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{holding.ticker}</p>
                      <p className="text-sm text-slate-500">{holding.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">
                      ${holding.valueAUD.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className={`text-sm ${holding.gainLossPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {holding.gainLossPct >= 0 ? '+' : ''}{holding.gainLossPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No holdings yet</p>
              <p className="text-sm">Add your first holding in the Portfolio section</p>
            </div>
          )}
        </div>

        {/* Quick Actions & Alerts */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link 
              href="/portfolio"
              className="block w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-700 transition-colors"
            >
              📊 View Portfolio
            </Link>
            <Link 
              href="/watchlist"
              className="block w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-700 transition-colors"
            >
              👁️ Manage Watchlist
            </Link>
            <Link 
              href="/assessor"
              className="block w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-700 transition-colors"
            >
              🔍 Stock Assessor
            </Link>
            <Link 
              href="/risk"
              className="block w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-700 transition-colors"
            >
              🛡️ Risk Dashboard
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Alerts</h4>
            <div className="text-center py-4 text-slate-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No alerts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Screener highlights placeholder */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Screener Highlights</h3>
          <Link href="/assessor" className="text-sm text-primary-600 hover:text-primary-700">
            View screener →
          </Link>
        </div>
        <div className="text-center py-8 text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Weekly screener results will appear here</p>
          <p className="text-sm">Top 25 stocks ranked by quality + valuation</p>
        </div>
      </div>
    </div>
  )
}
