'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Bell, Settings, Globe, Loader2 } from 'lucide-react'
import UniverseHeader from './components/UniverseHeader'
import SectorTabs from './components/SectorTabs'
import StockCard from './components/StockCard'
import AlertsPanel from './components/AlertsPanel'
import AdminModal from './components/AdminModal'

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

export default function UniversePage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stocks, setStocks] = useState<UniverseStock[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Filters
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
      // Fallback sectors if API doesn't exist yet
      setSectors([
        { id: '1', name: 'Silicon & Compute', slug: 'silicon', description: '', color: 'blue' },
        { id: '2', name: 'Networking & Interconnect', slug: 'networking', description: '', color: 'purple' },
        { id: '3', name: 'Semiconductor Equipment', slug: 'equipment', description: '', color: 'orange' },
        { id: '4', name: 'Memory & Storage', slug: 'memory', description: '', color: 'cyan' },
        { id: '5', name: 'Power & Cooling', slug: 'power', description: '', color: 'green' },
        { id: '6', name: 'Cloud & Data Centre Infra', slug: 'cloud', description: '', color: 'indigo' },
      ])
    }
  }, [])

  // Fetch stocks
  const fetchStocks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (activeSector !== 'all') params.set('sector', activeSector)
      if (tier !== 'all') params.set('tier', tier)
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/universe/stocks?${params}`)
      if (response.ok) {
        const data = await response.json()
        setStocks(data.stocks || [])
      }
    } catch (error) {
      console.error('Error fetching stocks:', error)
    }
  }, [activeSector, tier, searchQuery])

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

  // Refresh when filters change
  useEffect(() => {
    if (!loading) {
      fetchStocks()
    }
  }, [activeSector, tier, searchQuery, fetchStocks, loading])

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

  // Edit stock
  const handleEditStock = (stock: UniverseStock) => {
    setSelectedStock(stock)
    setAdminMode('edit')
    setShowAdmin(true)
  }

  // Admin actions
  const openAddStock = () => {
    setSelectedStock(null)
    setAdminMode('add')
    setShowAdmin(true)
  }

  const openCreateAlert = () => {
    setSelectedStock(null)
    setAdminMode('alert')
    setShowAdmin(true)
  }

  // Calculate stock counts per sector
  const stockCounts: Record<string, number> = {}
  stocks.forEach(stock => {
    const slug = stock.universe_sectors?.slug || 'unknown'
    stockCounts[slug] = (stockCounts[slug] || 0) + 1
  })

  // Filter stocks client-side for immediate response
  const filteredStocks = stocks.filter(stock => {
    if (activeSector !== 'all' && stock.universe_sectors?.slug !== activeSector) return false
    if (tier !== 'all' && stock.tier !== tier) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        stock.ticker.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query) ||
        stock.thesis?.toLowerCase().includes(query)
      )
    }
    return true
  })

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <UniverseHeader
        totalStocks={stocks.length}
        unreadAlerts={unreadCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onAlertsClick={() => setShowAlerts(true)}
      />

      {/* Admin Actions */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={openAddStock}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Stock
        </button>
        <button
          onClick={openCreateAlert}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Bell className="w-4 h-4" />
          Create Alert
        </button>
      </div>

      {/* Sector Tabs & Tier Filter */}
      <SectorTabs
        sectors={sectors}
        activeSector={activeSector}
        onSectorChange={setActiveSector}
        stockCounts={stockCounts}
        tier={tier}
        onTierChange={setTier}
      />

      {/* Stock Cards */}
      {filteredStocks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
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
              onEdit={handleEditStock}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
        Next refresh: June 2026 • Not financial advice
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

/*
 * INCLUSION/EXCLUSION CRITERIA (for quarterly reviews):
 * 
 * INCLUSION:
 * - NYSE/NASDAQ listed
 * - Market cap >$5B
 * - Profitable (2+ consecutive quarters)
 * - Direct/indirect AI infrastructure exposure
 * - 50%+ institutional ownership
 * - 3+ analyst coverage
 * 
 * EXCLUSION TRIGGERS:
 * - Market cap drops below $3B
 * - Two consecutive revenue decline quarters without catalyst
 * - Fundamental thesis broken
 * - Delisting/governance red flags
 */
