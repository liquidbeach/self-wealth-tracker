'use client'

import StockSearch from '@/components/StockSearch'
import { Search, TrendingUp, Briefcase, Eye } from 'lucide-react'

export default function SearchPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Search className="w-6 h-6 text-primary-600" />
          Stock Search
        </h1>
        <p className="text-slate-500">Search any stock worldwide and get live prices</p>
      </div>

      {/* Search Component */}
      <div className="card">
        <StockSearch 
          placeholder="Search by ticker or company name (e.g., AAPL, Microsoft, CBA.AX)"
          showActions={true}
        />
      </div>

      {/* Tips */}
      <div className="card bg-slate-50">
        <h3 className="font-semibold text-slate-900 mb-3">Search Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🇺🇸</span>
            <div>
              <p className="font-medium text-slate-700">US Stocks</p>
              <p className="text-sm text-slate-500">Just type the ticker: AAPL, MSFT, GOOGL</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🇦🇺</span>
            <div>
              <p className="font-medium text-slate-700">ASX Stocks</p>
              <p className="text-sm text-slate-500">Add .AX suffix: CBA.AX, BHP.AX, CSL.AX</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🇮🇳</span>
            <div>
              <p className="font-medium text-slate-700">Indian Stocks</p>
              <p className="text-sm text-slate-500">Add .NS or .BO: RELIANCE.NS, TCS.BO</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/momentum" className="card hover:border-primary-300 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
              <TrendingUp className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Momentum Scanner</p>
              <p className="text-sm text-slate-500">Find trading signals</p>
            </div>
          </div>
        </a>
        <a href="/portfolio" className="card hover:border-primary-300 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <Briefcase className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Portfolio</p>
              <p className="text-sm text-slate-500">Manage your holdings</p>
            </div>
          </div>
        </a>
        <a href="/watchlist" className="card hover:border-primary-300 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-200 transition-colors">
              <Eye className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Watchlist</p>
              <p className="text-sm text-slate-500">Track stocks you're watching</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  )
}
