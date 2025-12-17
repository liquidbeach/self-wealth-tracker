import { createServerSupabaseClient } from '@/lib/supabase-server'
import { TrendingUp, TrendingDown, DollarSign, Briefcase, Eye, AlertTriangle } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  
  // Get user's holdings count
  const { count: holdingsCount } = await supabase
    .from('holdings')
    .select('*', { count: 'exact', head: true })

  // Get user's watchlist count
  const { count: watchlistCount } = await supabase
    .from('watchlist')
    .select('*', { count: 'exact', head: true })

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
              <p className="text-2xl font-bold text-slate-900">$0.00</p>
              <p className="text-sm text-slate-400">AUD</p>
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
              <p className="text-2xl font-bold text-slate-900">{holdingsCount || 0}</p>
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
              <p className="text-2xl font-bold text-slate-900">$0.00</p>
              <p className="text-sm text-green-500">+0.00%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent activity / Holdings preview */}
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Holdings Overview</h3>
          <div className="text-center py-12 text-slate-400">
            <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No holdings yet</p>
            <p className="text-sm">Add your first holding in the Portfolio section</p>
          </div>
        </div>

        {/* Alerts / Watchlist */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Alerts</h3>
          <div className="text-center py-12 text-slate-400">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No alerts</p>
            <p className="text-sm">Watchlist alerts will appear here</p>
          </div>
        </div>
      </div>

      {/* Screener highlights placeholder */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Screener Highlights</h3>
        <div className="text-center py-8 text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Weekly screener results will appear here</p>
          <p className="text-sm">Top 25 stocks ranked by quality + valuation</p>
        </div>
      </div>
    </div>
  )
}
