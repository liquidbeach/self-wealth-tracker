'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Zap, TrendingUp, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface UniverseStock {
  id: string
  ticker: string
  name: string
  tier: 'heavyweight' | 'velocity'
  exchange: string
  market_cap: number | null
  thesis: string | null
  catalysts: string | null
  risks: string | null
  status: 'active' | 'watch' | 'review' | 'removed'
  status_color: 'green' | 'amber' | 'red'
  universe_sectors: {
    id: string
    name: string
    slug: string
    color: string
  } | null
}

interface StockCardProps {
  stock: UniverseStock
  onEdit?: (stock: UniverseStock) => void
}

function formatMarketCap(cap: number | null): string {
  if (!cap) return '—'
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`
  return `$${cap.toLocaleString()}`
}

function getStatusDot(color: string) {
  const colors = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500'
  }
  return colors[color as keyof typeof colors] || colors.green
}

export default function StockCard({ stock, onEdit }: StockCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {/* Main Card Row */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Ticker, Name, Badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Status Dot */}
              <span className={`w-2 h-2 rounded-full ${getStatusDot(stock.status_color)}`} />
              
              {/* Ticker */}
              <span className="font-mono font-bold text-lg text-gray-900">{stock.ticker}</span>
              
              {/* Tier Badge */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                stock.tier === 'heavyweight' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {stock.tier === 'heavyweight' ? 'Heavyweight' : 'Velocity'}
              </span>
              
              {/* Exchange Badge */}
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                {stock.exchange}
              </span>
            </div>
            
            {/* Company Name */}
            <p className="text-sm text-gray-600 truncate">{stock.name}</p>
            
            {/* Thesis (one line) */}
            {stock.thesis && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">{stock.thesis}</p>
            )}
          </div>

          {/* Right: Market Cap & Expand Icon */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              {formatMarketCap(stock.market_cap)}
            </span>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {/* Sector Tag */}
          {stock.universe_sectors && (
            <div className="mb-3">
              <span className="text-xs text-gray-500">Sector: </span>
              <span className="text-xs font-medium text-gray-700">{stock.universe_sectors.name}</span>
            </div>
          )}

          {/* Full Thesis */}
          {stock.thesis && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Investment Thesis</h4>
              <p className="text-sm text-gray-700">{stock.thesis}</p>
            </div>
          )}

          {/* Catalysts */}
          {stock.catalysts && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-semibold text-emerald-700 uppercase">Catalysts</h4>
              </div>
              <p className="text-sm text-emerald-800">{stock.catalysts}</p>
            </div>
          )}

          {/* Risks */}
          {stock.risks && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h4 className="text-xs font-semibold text-red-700 uppercase">Key Risks</h4>
              </div>
              <p className="text-sm text-red-800">{stock.risks}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
            <Link
              href={`/assessor?ticker=${stock.ticker}`}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Run Buffett Scanner
            </Link>
            
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(stock) }}
                className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Edit
              </button>
            )}
            
            <a
              href={`https://finance.yahoo.com/quote/${stock.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-gray-900 text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              Yahoo Finance
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
