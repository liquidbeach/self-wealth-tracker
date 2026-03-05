'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Eye, Plus, Trash2, RefreshCw, X, TrendingUp, TrendingDown, Check, Search, Loader2 } from 'lucide-react'

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

interface SearchResult {
  symbol: string
  name: string
  exchange: string
  type: string
  market: string
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
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null)
  const [addingStock, setAddingStock] = useState(false)

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

  // Search stocks as user types
  useEffect(() => {
    const searchStocks = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      setSearching(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.results || [])
        }
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }

    const debounce = setTimeout(searchStocks, 400)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const handleDelete = async (id: string) => {
    if (!confirm('Remove from watchlist?')) return
    const supabase = createClient()
    await supabase.from('watchlist').delete().eq('id', id)
    loadWatchlist()
  }

  const handleSelectStock = (stock: SearchResult) => {
    setSelectedStock(stock)
    setSearchResults([])
    setSearchQuery(stock.symbol)
  }

  const handleAddStock = async () => {
    if (!selectedStock) return
    
    setAddingStock(true)
    
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setAddingStock(false)
      return
    }

    // Fetch current price
    const liveData = await fetchLivePrice(selectedStock.symbol)

    const { error } = await supabase.from('watchlist').insert({
      user_id: user.id,
      ticker: selectedStock.symbol,
      name: selectedStock.name,
      current_price: liveData?.price || null,
    })

    if (!error) {
      setShowAddModal(false)
      setSearchQuery('')
      setSelectedStock(null)
      loadWatchlist()
    }
    
    setAddingStock(false)
  }

  const closeModal = () => {
    setShowAddModal(false)
    setSearchQuery('')
    setSelectedStock(null)
    setSearchResults([])
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
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
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
              className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
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
                      <p className={`text-sm flex items-center justify-end gap-1 ${changePercent >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
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
              className="text-sm px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Add Stock
            </button>
          </div>
        )}
      </div>

      {/* Add Stock Modal - WIDER DROPDOWN + CONFIRMATION BUTTON */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-visible">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add to Watchlist</h2>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {/* Search Input - WIDER */}
              <div className="relative">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setSelectedStock(null)
                    }}
                    placeholder="Search stocks (e.g., AAPL, MSFT, CBA.AX)"
                    className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* Search Results Dropdown - WIDER */}
                {searching && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-emerald-600" />
                    <p className="text-sm text-gray-500 mt-1">Searching...</p>
                  </div>
                )}

                {!searching && searchResults.length > 0 && !selectedStock && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.symbol}
                        onClick={() => handleSelectStock(result)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-left"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{result.symbol}</p>
                          <p className="text-sm text-gray-500 truncate max-w-[280px]">{result.name}</p>
                        </div>
                        <span className="text-xs text-gray-400 ml-2">{result.exchange}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && !selectedStock && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                    <p className="text-sm">No stocks found for "{searchQuery}"</p>
                  </div>
                )}
              </div>

              {/* Selected Stock Preview */}
              {selectedStock && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{selectedStock.symbol}</p>
                      <p className="text-sm text-gray-600">{selectedStock.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedStock.exchange}</p>
                    </div>
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              )}

              {/* ADD BUTTON - CONFIRMATION */}
              <button
                onClick={handleAddStock}
                disabled={!selectedStock || addingStock}
                className="w-full mt-4 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {addingStock ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add to Watchlist
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 mt-3 text-center">
                Search for a stock, then click "Add to Watchlist" to confirm.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
