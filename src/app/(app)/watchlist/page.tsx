'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Eye, Plus, Trash2, RefreshCw, X, TrendingUp, TrendingDown } from 'lucide-react'
import StockSearch from '@/components/StockSearch'

interface WatchlistItem {
  id: string
  ticker: string
  name: string
  target_price: number | null
  notes: string | null
  current_price: number | null
  created_at: string
  // Live data
  live_price?: number
  live_change_percent?: number
}

async function fetchLivePrice(symbol: string): Promise<{ price: number; changePercent: number } | null> {
  try {
    const response = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`)
    if (!response.ok) return null
    const data = await response.json()
    if (data.error || !data.price) return null
    return { price: data.price, changePercent: data.changePercent || 0 }
  } catch {
    return null
  }
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const loadWatchlist = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('watchlist')
      .select('*')
      .order('created_at', { ascending: false })

    setWatchlist(data || [])
    setLoading(false)

    // Fetch live prices
    if (data && data.length > 0) {
      setRefreshing(true)
      const updated = await Promise.all(
        data.map(async (item) => {
          const liveData = await fetchLivePrice(item.ticker)
          if (liveData) {
            return { ...item, live_price: liveData.price, live_change_percent: liveData.changePercent }
          }
          return item
        })
      )
      setWatchlist(updated)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadWatchlist()
  }, [loadWatchlist])

  const handleDelete = async (id: string) => {
    if (!confirm('Remove from watchlist?')) return
    const supabase = createClient()
    await supabase.from('watchlist').delete().eq('id', id)
    loadWatchlist()
  }

  const handleAddFromSearch = async (stock: { symbol: string; name: string; price: number }) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    await supabase.from('watchlist').insert({
      user_id: user.id,
      ticker: stock.symbol,
      name: stock.name,
      current_price: stock.price,
    })
    
    setShowAddModal(false)
    loadWatchlist()
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Watchlist</h1>
          <p className="text-sm text-gray-500">Track stocks you're interested in</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Stock</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Watchlist */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Watching {watchlist.length} stocks</h3>
          {watchlist.length > 0 && (
            <button
              onClick={loadWatchlist}
              disabled={refreshing}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Loading...</p>
          </div>
        ) : watchlist.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {watchlist.map((item) => {
              const price = item.live_price || item.current_price || 0
              const changePercent = item.live_change_percent || 0

              return (
                <div key={item.id} className="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.ticker}</p>
                      <p className="text-sm text-gray-500 truncate max-w-[150px] sm:max-w-[250px]">{item.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium text-gray-900">${price.toFixed(2)}</p>
                      <p className={`text-sm flex items-center justify-end gap-1 ${changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <Eye className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-1">No stocks in watchlist</p>
            <p className="text-sm text-gray-400 mb-4">Add stocks to track their performance</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Stock
            </button>
          </div>
        )}
      </div>

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add to Watchlist</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <StockSearch
                placeholder="Search for a stock to add..."
                showActions={false}
                onAddToWatchlist={(stock) => handleAddFromSearch(stock)}
              />
              <p className="text-xs text-gray-500 mt-3">
                Search for a stock, then click on it to add to your watchlist.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
