'use client'

import { Search, Bell, RefreshCw } from 'lucide-react'

interface UniverseHeaderProps {
  totalStocks: number
  unreadAlerts: number
  searchQuery: string
  onSearchChange: (query: string) => void
  onRefresh: () => void
  refreshing: boolean
  onAlertsClick: () => void
}

export default function UniverseHeader({
  totalStocks,
  unreadAlerts,
  searchQuery,
  onSearchChange,
  onRefresh,
  refreshing,
  onAlertsClick
}: UniverseHeaderProps) {
  return (
    <div className="mb-6">
      {/* Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Infrastructure Universe</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalStocks} quality-filtered stocks • Quarterly refresh • Next: June 2026
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Alerts Button */}
          <button
            onClick={onAlertsClick}
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="View alerts"
          >
            <Bell className="w-5 h-5" />
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadAlerts > 9 ? '9+' : unreadAlerts}
              </span>
            )}
          </button>
          
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by ticker, name, or thesis..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
        />
      </div>
    </div>
  )
}
