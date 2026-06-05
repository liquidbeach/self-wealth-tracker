'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Plus, Bell, Globe, Loader2, RefreshCw, Search, ChevronDown, ChevronUp,
  Zap, Cpu, HardDrive, Network, Server, Building2, Flame, Wind, Battery, Home,
  Layers, Filter, TrendingUp, Settings, ExternalLink, ChevronRight
} from 'lucide-react'

// ============================================================================
// SUPPLY CHAIN LAYER CONFIGURATION
// Maps sector_id + ticker filters to 11 supply chain layers
// ============================================================================

interface SupplyChainLayer {
  id: number
  name: string
  shortName: string
  sectorIds: string[]  // Which sector_id values map to this layer
  filterTickers?: string[]  // Optional: specific tickers only (subset of sector)
  description: string
  icon: any
  color: string
  gradient: string
}

const SUPPLY_CHAIN_LAYERS: SupplyChainLayer[] = [
  {
    id: 1,
    name: 'Chip Design Tools',
    shortName: 'DESIGN',
    sectorIds: ['equipment'],
    filterTickers: ['SNPS', 'CDNS'],
    description: 'EDA software to design chips',
    icon: Zap,
    color: 'from-orange-500 to-orange-600',
    gradient: 'bg-gradient-to-r from-orange-500 to-orange-600',
  },
  {
    id: 2,
    name: 'Chip Manufacturing Equipment',
    shortName: 'EQUIP',
    sectorIds: ['equipment'],
    filterTickers: ['ASML', 'AMAT', 'LRCX', 'KLAC', 'TER'],
    description: 'Machines that build chips',
    icon: Settings,
    color: 'from-orange-400 to-amber-500',
    gradient: 'bg-gradient-to-r from-orange-400 to-amber-500',
  },
  {
    id: 3,
    name: 'Silicon & Compute',
    shortName: 'COMPUTE',
    sectorIds: ['silicon'],
    description: 'GPUs, CPUs, ASICs, foundries',
    icon: Cpu,
    color: 'from-amber-500 to-yellow-500',
    gradient: 'bg-gradient-to-r from-amber-500 to-yellow-500',
  },
  {
    id: 4,
    name: 'Memory & Storage',
    shortName: 'MEMORY',
    sectorIds: ['memory'],
    description: 'DRAM, HBM, NAND, SSDs',
    icon: HardDrive,
    color: 'from-yellow-500 to-lime-500',
    gradient: 'bg-gradient-to-r from-yellow-500 to-lime-500',
  },
  {
    id: 5,
    name: 'Networking & Interconnect',
    shortName: 'NETWORK',
    sectorIds: ['networking'],
    description: 'Switches, optical, cables, fabric',
    icon: Network,
    color: 'from-lime-500 to-green-500',
    gradient: 'bg-gradient-to-r from-lime-500 to-green-500',
  },
  {
    id: 6,
    name: 'Server & Rack Assembly',
    shortName: 'ASSEMBLE',
    sectorIds: ['infrastructure'],
    filterTickers: ['CLS', 'DELL', 'SMCI', 'HPE'],
    description: 'Physical AI server builds',
    icon: Server,
    color: 'from-green-500 to-teal-500',
    gradient: 'bg-gradient-to-r from-green-500 to-teal-500',
  },
  {
    id: 7,
    name: 'Data Centre Construction',
    shortName: 'BUILD',
    sectorIds: ['construction'],
    description: 'EPC, mechanical, electrical contractors',
    icon: Building2,
    color: 'from-teal-500 to-cyan-500',
    gradient: 'bg-gradient-to-r from-teal-500 to-cyan-500',
  },
  {
    id: 8,
    name: 'Power Generation & Grid',
    shortName: 'POWER',
    sectorIds: ['power'],
    filterTickers: ['VST', 'CEG', 'GEV', 'ETN', 'PWR', 'BWX', 'SMR', 'PRIM'],
    description: 'Electricity generation and distribution',
    icon: Flame,
    color: 'from-cyan-500 to-sky-500',
    gradient: 'bg-gradient-to-r from-cyan-500 to-sky-500',
  },
  {
    id: 9,
    name: 'Cooling & Thermal',
    shortName: 'COOL',
    sectorIds: ['power'],
    filterTickers: ['VRT', 'MOD', 'TT'],
    description: 'Thermal management and liquid cooling',
    icon: Wind,
    color: 'from-sky-500 to-blue-500',
    gradient: 'bg-gradient-to-r from-sky-500 to-blue-500',
  },
  {
    id: 10,
    name: 'Energy Storage & Backup',
    shortName: 'STORE',
    sectorIds: ['storage_backup'],
    description: 'Battery storage, UPS, backup power',
    icon: Battery,
    color: 'from-blue-500 to-indigo-500',
    gradient: 'bg-gradient-to-r from-blue-500 to-indigo-500',
  },
  {
    id: 11,
    name: 'Data Centre Facilities',
    shortName: 'HOUSE',
    sectorIds: ['infrastructure'],
    filterTickers: ['EQIX', 'DLR', 'ORCL'],
    description: 'REITs, cloud platforms, colocation',
    icon: Home,
    color: 'from-indigo-500 to-violet-500',
    gradient: 'bg-gradient-to-r from-indigo-500 to-violet-500',
  },
]

// ============================================================================
// INTERFACES
// ============================================================================

interface Sector {
  id: string
  name: string
  slug: string
  description: string
  color: string
}

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
  sector_id: string
  universe_sectors: Sector | null
}

interface Alert {
  id: string
  stock_id: string
  alert_type: string
  severity: 'red' | 'amber' | 'green'
  message: string
  source: string | null
  is_read: boolean
  created_at: string
  universe_stocks: {
    id: string
    ticker: string
    name: string
  } | null
}

// ============================================================================
// HELPER: Get layer for a stock
// ============================================================================

function getStockLayer(stock: UniverseStock): SupplyChainLayer | null {
  const sectorSlug = stock.universe_sectors?.slug
  if (!sectorSlug) return null
  
  // Find matching layer - check ticker-specific filters first
  for (const layer of SUPPLY_CHAIN_LAYERS) {
    if (layer.sectorIds.includes(sectorSlug)) {
      // If layer has ticker filter, check if stock matches
      if (layer.filterTickers) {
        if (layer.filterTickers.includes(stock.ticker)) {
          return layer
        }
      } else {
        // No ticker filter, sector match is enough
        return layer
      }
    }
  }
  
  // Fallback: find by sector only (for stocks not in ticker filter)
  for (const layer of SUPPLY_CHAIN_LAYERS) {
    if (layer.sectorIds.includes(sectorSlug) && !layer.filterTickers) {
      return layer
    }
  }
  
  return null
}

// ============================================================================
// COMPONENT: Supply Chain Flow Bar
// ============================================================================

interface SupplyChainFlowProps {
  stocks: UniverseStock[]
  activeLayer: number | null
  onLayerClick: (layerId: number | null) => void
}

function SupplyChainFlow({ stocks, activeLayer, onLayerClick }: SupplyChainFlowProps) {
  // Count stocks per layer
  const layerCounts: Record<number, number> = {}
  stocks.forEach(stock => {
    const layer = getStockLayer(stock)
    if (layer) {
      layerCounts[layer.id] = (layerCounts[layer.id] || 0) + 1
    }
  })
  
  return (
    <div className="bg-slate-900 rounded-2xl p-4 mb-6 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4" />
          AI Infrastructure Supply Chain
        </h3>
        <button
          onClick={() => onLayerClick(null)}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${
            activeLayer === null 
              ? 'bg-white text-slate-900 font-semibold' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          All Layers
        </button>
      </div>
      
      {/* Flow visualization */}
      <div className="relative">
        {/* Connection line */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-green-500 to-violet-500 opacity-30 -translate-y-1/2 rounded-full" />
        
        {/* Layer nodes - horizontally scrollable */}
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide relative">
          {SUPPLY_CHAIN_LAYERS.map((layer, index) => {
            const Icon = layer.icon
            const count = layerCounts[layer.id] || 0
            const isActive = activeLayer === layer.id
            
            return (
              <button
                key={layer.id}
                onClick={() => onLayerClick(isActive ? null : layer.id)}
                className={`flex-shrink-0 flex flex-col items-center p-2 rounded-xl transition-all ${
                  isActive 
                    ? `${layer.gradient} text-white shadow-lg scale-105` 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                style={{ minWidth: '72px' }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1 ${
                  isActive ? 'bg-white/20' : 'bg-slate-700'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold tracking-tight">{layer.shortName}</span>
                <span className={`text-[9px] mt-0.5 ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                  {count} stock{count !== 1 ? 's' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      
      {/* Active layer description */}
      {activeLayer !== null && (
        <div className="mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            {(() => {
              const layer = SUPPLY_CHAIN_LAYERS.find(l => l.id === activeLayer)
              if (!layer) return null
              const Icon = layer.icon
              return (
                <>
                  <div className={`w-6 h-6 rounded-md ${layer.gradient} flex items-center justify-center`}>
                    <Icon className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Layer {layer.id}: {layer.name}
                    </p>
                    <p className="text-xs text-slate-400">{layer.description}</p>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// COMPONENT: Stock Card with Layer Badge
// ============================================================================

interface StockCardProps {
  stock: UniverseStock
  onEdit: (stock: UniverseStock) => void
}

function StockCard({ stock, onEdit }: StockCardProps) {
  const [expanded, setExpanded] = useState(false)
  const layer = getStockLayer(stock)
  
  const statusColors = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }
  
  const tierBadge = stock.tier === 'heavyweight' 
    ? 'bg-slate-800 text-slate-200' 
    : 'bg-violet-600/20 text-violet-400 border border-violet-500/30'
  
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Main row */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Ticker, Name, Status */}
          <div className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-2 ${statusColors[stock.status_color]}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-gray-900 text-lg">{stock.ticker}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${tierBadge}`}>
                  {stock.tier === 'heavyweight' ? '⚓ HW' : '🚀 VEL'}
                </span>
              </div>
              <p className="text-sm text-gray-600">{stock.name}</p>
              
              {/* Layer Badge */}
              {layer && (
                <div className="flex items-center gap-1 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${layer.gradient}`}>
                    L{layer.id}: {layer.shortName}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Right: Sector, Market Cap, Expand */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">{stock.universe_sectors?.name}</p>
              {stock.market_cap && (
                <p className="text-sm font-medium text-gray-700">
                  ${(stock.market_cap / 1e9).toFixed(0)}B
                </p>
              )}
            </div>
            <div className={`p-1 rounded-full transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
        
        {/* Thesis preview */}
        {stock.thesis && !expanded && (
          <p className="text-sm text-gray-500 mt-2 line-clamp-1 ml-5">
            {stock.thesis}
          </p>
        )}
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
          {/* Thesis */}
          {stock.thesis && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Thesis</p>
              <p className="text-sm text-gray-700">{stock.thesis}</p>
            </div>
          )}
          
          {/* Catalysts */}
          {stock.catalysts && (
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase mb-1">✓ Catalysts</p>
              <p className="text-sm text-gray-700">{stock.catalysts}</p>
            </div>
          )}
          
          {/* Risks */}
          {stock.risks && (
            <div>
              <p className="text-xs font-semibold text-red-600 uppercase mb-1">⚠ Risks</p>
              <p className="text-sm text-gray-700">{stock.risks}</p>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
            <a
              href={`/assessor?ticker=${stock.ticker}`}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              Run Buffett Scanner
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(stock)
              }}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Edit
            </button>
            <a
              href={`https://finance.yahoo.com/quote/${stock.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700"
            >
              <ExternalLink className="w-4 h-4" />
              Yahoo
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// COMPONENT: Header Stats
// ============================================================================

interface HeaderStatsProps {
  totalStocks: number
  heavyweightCount: number
  velocityCount: number
  unreadAlerts: number
}

function HeaderStats({ totalStocks, heavyweightCount, velocityCount, unreadAlerts }: HeaderStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-slate-900 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-white">{totalStocks}</p>
        <p className="text-xs text-slate-400">Total Stocks</p>
      </div>
      <div className="bg-slate-800 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-orange-400">11</p>
        <p className="text-xs text-slate-400">Supply Chain Layers</p>
      </div>
      <div className="bg-slate-800 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-slate-200">{heavyweightCount}</p>
        <p className="text-xs text-slate-400">⚓ Heavyweights</p>
      </div>
      <div className="bg-slate-800 rounded-xl p-3 text-center">
        <p className="text-2xl font-bold text-violet-400">{velocityCount}</p>
        <p className="text-xs text-slate-400">🚀 Velocity</p>
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENT: Filters Bar
// ============================================================================

interface FiltersBarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  tier: string
  onTierChange: (t: string) => void
  viewMode: 'supply-chain' | 'sector'
  onViewModeChange: (mode: 'supply-chain' | 'sector') => void
  sectors: Sector[]
  activeSector: string
  onSectorChange: (s: string) => void
}

function FiltersBar({
  searchQuery, onSearchChange, tier, onTierChange,
  viewMode, onViewModeChange, sectors, activeSector, onSectorChange
}: FiltersBarProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search ticker, name, or thesis..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('supply-chain')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'supply-chain'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Supply Chain
          </button>
          <button
            onClick={() => onViewModeChange('sector')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'sector'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sector
          </button>
        </div>
        
        {/* Sector Filter (only in sector view) */}
        {viewMode === 'sector' && (
          <select
            value={activeSector}
            onChange={(e) => onSectorChange(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
          >
            <option value="all">All Sectors</option>
            {sectors.map(s => (
              <option key={s.id} value={s.slug}>{s.name}</option>
            ))}
          </select>
        )}
        
        {/* Tier Filter */}
        <select
          value={tier}
          onChange={(e) => onTierChange(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">All Tiers</option>
          <option value="heavyweight">⚓ Heavyweights</option>
          <option value="velocity">🚀 Velocity</option>
        </select>
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENT: Alerts Panel (Slide-out)
// ============================================================================

interface AlertsPanelProps {
  isOpen: boolean
  onClose: () => void
  alerts: Alert[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
}

function AlertsPanel({ isOpen, onClose, alerts, onMarkAsRead, onMarkAllAsRead }: AlertsPanelProps) {
  if (!isOpen) return null
  
  const severityOrder = { red: 0, amber: 1, green: 2 }
  const sortedAlerts = [...alerts].sort((a, b) => 
    severityOrder[a.severity] - severityOrder[b.severity]
  )
  
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Alerts</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-emerald-600 hover:text-emerald-700"
            >
              Mark all read
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-80px)]">
          {sortedAlerts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No alerts</p>
          ) : (
            sortedAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border-l-4 ${
                  alert.severity === 'red' ? 'bg-red-50 border-red-500' :
                  alert.severity === 'amber' ? 'bg-amber-50 border-amber-500' :
                  'bg-emerald-50 border-emerald-500'
                } ${alert.is_read ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-sm">{alert.universe_stocks?.ticker}</p>
                    <p className="text-sm text-gray-700 mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(alert.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {!alert.is_read && (
                    <button
                      onClick={() => onMarkAsRead(alert.id)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENT: Admin Modal
// ============================================================================

interface AdminModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  mode: 'add' | 'edit' | 'alert'
  stock: UniverseStock | null
  sectors: Sector[]
  allStocks: UniverseStock[]
}

function AdminModal({ isOpen, onClose, onSuccess, mode, stock, sectors, allStocks }: AdminModalProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    ticker: '',
    name: '',
    sector_id: '',
    tier: 'heavyweight',
    market_cap: '',
    thesis: '',
    catalysts: '',
    risks: '',
    status_color: 'green',
  })
  const [alertData, setAlertData] = useState({
    stock_id: '',
    severity: 'amber',
    message: '',
  })
  
  useEffect(() => {
    if (stock && mode === 'edit') {
      setFormData({
        ticker: stock.ticker,
        name: stock.name,
        sector_id: stock.sector_id,
        tier: stock.tier,
        market_cap: stock.market_cap?.toString() || '',
        thesis: stock.thesis || '',
        catalysts: stock.catalysts || '',
        risks: stock.risks || '',
        status_color: stock.status_color,
      })
    }
  }, [stock, mode])
  
  if (!isOpen) return null
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      if (mode === 'alert') {
        await fetch('/api/universe/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertData),
        })
      } else if (mode === 'edit' && stock) {
        await fetch(`/api/universe/stocks/${stock.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            market_cap: formData.market_cap ? parseFloat(formData.market_cap) : null,
          }),
        })
      } else {
        await fetch('/api/universe/stocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            market_cap: formData.market_cap ? parseFloat(formData.market_cap) : null,
          }),
        })
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error:', error)
    }
    
    setSaving(false)
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {mode === 'add' ? 'Add Stock' : mode === 'edit' ? 'Edit Stock' : 'Create Alert'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'alert' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <select
                    value={alertData.stock_id}
                    onChange={(e) => setAlertData({ ...alertData, stock_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select stock...</option>
                    {allStocks.map(s => (
                      <option key={s.id} value={s.id}>{s.ticker} - {s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <select
                    value={alertData.severity}
                    onChange={(e) => setAlertData({ ...alertData, severity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="red">🔴 Red (Critical)</option>
                    <option value="amber">🟡 Amber (Watch)</option>
                    <option value="green">🟢 Green (Positive)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={alertData.message}
                    onChange={(e) => setAlertData({ ...alertData, message: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ticker</label>
                    <input
                      type="text"
                      value={formData.ticker}
                      onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                      disabled={mode === 'edit'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                    <select
                      value={formData.sector_id}
                      onChange={(e) => setFormData({ ...formData, sector_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select...</option>
                      {sectors.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                    <select
                      value={formData.tier}
                      onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="heavyweight">Heavyweight</option>
                      <option value="velocity">Velocity</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status_color}
                      onChange={(e) => setFormData({ ...formData, status_color: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="green">🟢 Green</option>
                      <option value="amber">🟡 Amber</option>
                      <option value="red">🔴 Red</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market Cap ($)</label>
                  <input
                    type="number"
                    value={formData.market_cap}
                    onChange={(e) => setFormData({ ...formData, market_cap: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g. 500000000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thesis</label>
                  <textarea
                    value={formData.thesis}
                    onChange={(e) => setFormData({ ...formData, thesis: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catalysts</label>
                  <textarea
                    value={formData.catalysts}
                    onChange={(e) => setFormData({ ...formData, catalysts: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Risks</label>
                  <textarea
                    value={formData.risks}
                    onChange={(e) => setFormData({ ...formData, risks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>
              </>
            )}
            
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function UniversePage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stocks, setStocks] = useState<UniverseStock[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // View & Filters
  const [viewMode, setViewMode] = useState<'supply-chain' | 'sector'>('supply-chain')
  const [activeLayer, setActiveLayer] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSector, setActiveSector] = useState('all')
  const [tier, setTier] = useState('all')

  // Panels & Modals
  const [showAlerts, setShowAlerts] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminMode, setAdminMode] = useState<'add' | 'edit' | 'alert'>('add')
  const [selectedStock, setSelectedStock] = useState<UniverseStock | null>(null)

  // Fetch sectors
  const fetchSectors = useCallback(async () => {
    try {
      const response = await fetch('/api/universe/sectors')
      if (response.ok) {
        const data = await response.json()
        setSectors(data.sectors || [])
      }
    } catch (error) {
      console.error('Error fetching sectors:', error)
    }
  }, [])

  // Fetch stocks
  const fetchStocks = useCallback(async () => {
    try {
      const response = await fetch('/api/universe/stocks')
      if (response.ok) {
        const data = await response.json()
        setStocks(data.stocks || [])
      }
    } catch (error) {
      console.error('Error fetching stocks:', error)
    }
  }, [])

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/universe/alerts?includeRead=true')
      if (response.ok) {
        const data = await response.json()
        setAlerts(data.alerts || [])
        setUnreadCount(data.unreadCounts?.total || 0)
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
    }
  }, [])

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchSectors(), fetchStocks(), fetchAlerts()])
      setLoading(false)
    }
    loadData()
  }, [fetchSectors, fetchStocks, fetchAlerts])

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchStocks(), fetchAlerts()])
    setRefreshing(false)
  }

  // Mark alert as read
  const handleMarkAsRead = async (alertId: string) => {
    try {
      await fetch(`/api/universe/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true })
      })
      fetchAlerts()
    } catch (error) {
      console.error('Error marking alert as read:', error)
    }
  }

  // Mark all alerts as read
  const handleMarkAllAsRead = async () => {
    try {
      await Promise.all(
        alerts.filter(a => !a.is_read).map(a =>
          fetch(`/api/universe/alerts/${a.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_read: true })
          })
        )
      )
      fetchAlerts()
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  // Filter stocks
  const filteredStocks = stocks.filter(stock => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !stock.ticker.toLowerCase().includes(query) &&
        !stock.name.toLowerCase().includes(query) &&
        !stock.thesis?.toLowerCase().includes(query)
      ) return false
    }
    
    // Tier filter
    if (tier !== 'all' && stock.tier !== tier) return false
    
    // View mode filters
    if (viewMode === 'supply-chain') {
      if (activeLayer !== null) {
        const stockLayer = getStockLayer(stock)
        if (!stockLayer || stockLayer.id !== activeLayer) return false
      }
    } else {
      // Sector view
      if (activeSector !== 'all' && stock.universe_sectors?.slug !== activeSector) return false
    }
    
    return true
  })

  // Stats
  const heavyweightCount = stocks.filter(s => s.tier === 'heavyweight').length
  const velocityCount = stocks.filter(s => s.tier === 'velocity').length

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading universe...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-7 h-7 text-emerald-600" />
            AI Infrastructure Universe
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Own every layer, own the future
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAlerts(true)}
            className="relative p-2 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            <Bell className="w-5 h-5 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button 
            onClick={handleRefresh}
            className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <HeaderStats
        totalStocks={stocks.length}
        heavyweightCount={heavyweightCount}
        velocityCount={velocityCount}
        unreadAlerts={unreadCount}
      />

      {/* Supply Chain Flow (only in supply-chain view) */}
      {viewMode === 'supply-chain' && (
        <SupplyChainFlow
          stocks={stocks}
          activeLayer={activeLayer}
          onLayerClick={setActiveLayer}
        />
      )}

      {/* Filters */}
      <FiltersBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        tier={tier}
        onTierChange={setTier}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sectors={sectors}
        activeSector={activeSector}
        onSectorChange={setActiveSector}
      />

      {/* Admin Actions */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => {
            setSelectedStock(null)
            setAdminMode('add')
            setShowAdmin(true)
          }}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Stock
        </button>
        <button
          onClick={() => {
            setSelectedStock(null)
            setAdminMode('alert')
            setShowAdmin(true)
          }}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Bell className="w-4 h-4" />
          Create Alert
        </button>
        
        {/* Results count */}
        <span className="ml-auto text-sm text-gray-500">
          Showing {filteredStocks.length} of {stocks.length} stocks
        </span>
      </div>

      {/* Stock Cards */}
      {filteredStocks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
          <Globe className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No stocks found</p>
          <p className="text-sm mt-1">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStocks.map(stock => (
            <StockCard
              key={stock.id}
              stock={stock}
              onEdit={(s) => {
                setSelectedStock(s)
                setAdminMode('edit')
                setShowAdmin(true)
              }}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
        Next refresh: June 2026 • Not financial advice • "Own every layer, own the future"
      </div>

      {/* Alerts Panel */}
      <AlertsPanel
        isOpen={showAlerts}
        onClose={() => setShowAlerts(false)}
        alerts={alerts}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
      />

      {/* Admin Modal */}
      <AdminModal
        isOpen={showAdmin}
        onClose={() => setShowAdmin(false)}
        onSuccess={() => {
          fetchStocks()
          fetchAlerts()
        }}
        mode={adminMode}
        stock={selectedStock}
        sectors={sectors}
        allStocks={stocks}
      />
    </div>
  )
}
