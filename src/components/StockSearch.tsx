'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, TrendingUp, TrendingDown, Plus, Eye, Loader2, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface SearchResult {
  symbol: string
  name: string
  exchange: string
  type: string
  market: string
}

interface StockQuote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  previousClose: number
  currency: string
  exchange: string
}

interface StockSearchProps {
  onAddToPortfolio?: (stock: SearchResult & { price: number }) => void
  onAddToWatchlist?: (stock: SearchResult & { price: number }) => void
  placeholder?: string
  showActions?: boolean
}

export default function StockSearch({ 
  onAddToPortfolio, 
  onAddToWatchlist,
  placeholder = "Search any stock (e.g., AAPL, CBA.AX)",
  showActions = true,
}: StockSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<'portfolio' | 'watchlist' | null>(null)
  const [addSuccess, setAddSuccess] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Search as user types
  useEffect(() => {
    const searchStocks = async () => {
      if (query.length < 2) {
        setResults([])
        setShowResults(false)
        return
      }

      setSearching(true)
      setError(null)

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.error) {
          throw new Error(data.error)
        }
        
        setResults(data.results || [])
        setShowResults(true)
      } catch (err: any) {
        console.error('Search error:', err)
        setError(err.message || 'Search failed. Try again.')
        setResults([])
      } finally {
        setSearching(false)
      }
    }

    const debounce = setTimeout(searchStocks, 400)
    return () => clearTimeout(debounce)
  }, [query])

  // Fetch quote when stock is selected
  const fetchQuote = async (stock: SearchResult) => {
    setLoadingQuote(true)
    setSelectedStock(null)
    setShowResults(false)
    setError(null)
    setAddSuccess(null)

    try {
      const response = await fetch(`/api/quote?symbol=${encodeURIComponent(stock.symbol)}`)
      if (!response.ok) throw new Error('Failed to fetch quote')
      
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      
      setSelectedStock({
        symbol: data.symbol || stock.symbol,
        name: data.name || stock.name,
        price: data.price || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        high: data.high || 0,
        low: data.low || 0,
        previousClose: data.previousClose || 0,
        currency: data.currency || 'USD',
        exchange: data.exchange || stock.exchange,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stock data')
    } finally {
      setLoadingQuote(false)
    }
  }

  // Add to portfolio
  const handleAddToPortfolio = async () => {
    if (!selectedStock) return
    
    if (onAddToPortfolio) {
      onAddToPortfolio({
        symbol: selectedStock.symbol,
        name: selectedStock.name,
        exchange: selectedStock.exchange,
        type: 'EQUITY',
        market: getMarketFromSymbol(selectedStock.symbol),
        price: selectedStock.price,
      })
      return
    }

    setAddingTo('portfolio')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setError('Please log in to add holdings')
      setAddingTo(null)
      return
    }

    const market = getMarketFromSymbol(selectedStock.symbol)
    const currency = market === 'ASX' ? 'AUD' : market === 'BSE' ? 'INR' : 'USD'

    const { error: insertError } = await supabase.from('holdings').insert({
      user_id: user.id,
      ticker: selectedStock.symbol,
      name: selectedStock.name,
      market,
      currency,
      asset_type: 'Equity',
      current_price: selectedStock.price,
    })

    if (insertError) {
      if (insertError.code === '23505') setError('This stock is already in your portfolio')
      else setError(insertError.message)
    } else {
      setAddSuccess('Added to portfolio! Go to Portfolio to add purchase lots.')
    }
    setAddingTo(null)
  }

  // Add to watchlist
  const handleAddToWatchlist = async () => {
    if (!selectedStock) return
    
    if (onAddToWatchlist) {
      onAddToWatchlist({
        symbol: selectedStock.symbol,
        name: selectedStock.name,
        exchange: selectedStock.exchange,
        type: 'EQUITY',
        market: getMarketFromSymbol(selectedStock.symbol),
        price: selectedStock.price,
      })
      return
    }

    setAddingTo('watchlist')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setError('Please log in to add to watchlist')
      setAddingTo(null)
      return
    }

    const { error: insertError } = await supabase.from('watchlist').insert({
      user_id: user.id,
      ticker: selectedStock.symbol,
      name: selectedStock.name,
      current_price: selectedStock.price,
    })

    if (insertError) {
      if (insertError.code === '23505') setError('This stock is already in your watchlist')
      else setError(insertError.message)
    } else {
      setAddSuccess('Added to watchlist!')
    }
    setAddingTo(null)
  }

  const getMarketFromSymbol = (symbol: string): string => {
    if (symbol.endsWith('.AX')) return 'ASX'
    if (symbol.endsWith('.BO') || symbol.endsWith('.NS')) return 'BSE'
    return 'US'
  }

  const getMarketFlag = (market: string): string => {
    if (market === 'ASX') return '🇦🇺'
    if (market === 'BSE') return '🇮🇳'
    return '🇺🇸'
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setSelectedStock(null)
    setShowResults(false)
    setError(null)
    setAddSuccess(null)
    inputRef.current?.focus()
  }

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="w-full">
      {/* Search Input - FIXED PADDING */}
      <div className="relative" ref={resultsRef}>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {(query || selectedStock) && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Searching indicator */}
        {searching && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600" />
            <p className="text-sm text-gray-500 mt-1">Searching...</p>
          </div>
        )}

        {/* Search Results Dropdown */}
        {showResults && !searching && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.symbol}
                onClick={() => fetchQuote(result)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getMarketFlag(result.market)}</span>
                  <div>
                    <p className="font-medium text-gray-900">{result.symbol}</p>
                    <p className="text-sm text-gray-500 truncate max-w-[200px]">{result.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400">{result.exchange}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {showResults && !searching && query.length >= 2 && results.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
            <p className="text-sm">No stocks found for "{query}"</p>
            <p className="text-xs text-gray-400 mt-1">Try ticker symbols like AAPL, MSFT, CBA.AX</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && !showResults && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading Quote */}
      {loadingQuote && (
        <div className="mt-4 p-6 bg-gray-50 rounded-lg text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-gray-500">Loading stock data...</p>
        </div>
      )}

      {/* Stock Quote Card */}
      {selectedStock && !loadingQuote && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getMarketFlag(getMarketFromSymbol(selectedStock.symbol))}</span>
                <div>
                  <h3 className="text-xl font-bold">{selectedStock.symbol}</h3>
                  <p className="text-gray-300 text-sm">{selectedStock.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {selectedStock.currency === 'INR' ? '₹' : '$'}{selectedStock.price.toFixed(2)}
                </p>
                <p className={`flex items-center justify-end gap-1 text-sm ${
                  selectedStock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {selectedStock.changePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.change.toFixed(2)} 
                  ({selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.changePercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Prev Close</p>
                <p className="font-semibold text-gray-900">
                  {selectedStock.currency === 'INR' ? '₹' : '$'}{selectedStock.previousClose.toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Day High</p>
                <p className="font-semibold text-green-600">
                  {selectedStock.currency === 'INR' ? '₹' : '$'}{selectedStock.high.toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Day Low</p>
                <p className="font-semibold text-red-600">
                  {selectedStock.currency === 'INR' ? '₹' : '$'}{selectedStock.low.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Success */}
            {addSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                ✓ {addSuccess}
              </div>
            )}

            {/* Actions */}
            {showActions && (
              <div className="flex gap-3">
                <button
                  onClick={handleAddToPortfolio}
                  disabled={addingTo === 'portfolio'}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  {addingTo === 'portfolio' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add to Portfolio
                </button>
                <button
                  onClick={handleAddToWatchlist}
                  disabled={addingTo === 'watchlist'}
                  className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  {addingTo === 'watchlist' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  Add to Watchlist
                </button>
              </div>
            )}

            {/* External Links */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex gap-4 justify-center">
              <a
                href={`https://finance.yahoo.com/quote/${selectedStock.symbol}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Yahoo Finance <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://www.tradingview.com/symbols/${selectedStock.symbol.replace('.', '-')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                TradingView <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
