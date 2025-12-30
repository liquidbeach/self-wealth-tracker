'use client'

import { useState } from 'react'
import { X, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface AddHoldingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const MARKETS = [
  { value: 'ASX', label: 'ASX (Australia)', currency: 'AUD' },
  { value: 'US', label: 'US (NYSE/NASDAQ)', currency: 'USD' },
  { value: 'BSE', label: 'BSE (India)', currency: 'INR' },
]

const ASSET_TYPES = [
  { value: 'Equity', label: 'Equity' },
  { value: 'ETF', label: 'ETF' },
  { value: 'REIT', label: 'REIT' },
  { value: 'Gold', label: 'Gold' },
]

const INVESTMENT_STYLES = [
  { value: 'Growth', label: 'Growth' },
  { value: 'Dividend', label: 'Dividend' },
  { value: 'Blend', label: 'Blend' },
]

const SECTORS = [
  'Technology',
  'Financials',
  'Healthcare',
  'Consumer Discretionary',
  'Consumer Staples',
  'Industrials',
  'Energy',
  'Materials',
  'Utilities',
  'Real Estate',
  'Communication Services',
  'Diversified',
  'Other',
]

export default function AddHoldingModal({ isOpen, onClose, onSuccess }: AddHoldingModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [market, setMarket] = useState('ASX')
  const [assetType, setAssetType] = useState('Equity')
  const [sector, setSector] = useState('')
  const [investmentStyle, setInvestmentStyle] = useState('Blend')
  const [notes, setNotes] = useState('')
  const [thesis, setThesis] = useState('')
  
  // First lot
  const [units, setUnits] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [purchasePrice, setPurchasePrice] = useState('')

  const getCurrency = () => {
    return MARKETS.find(m => m.value === market)?.currency || 'AUD'
  }

  const resetForm = () => {
    setTicker('')
    setName('')
    setMarket('ASX')
    setAssetType('Equity')
    setSector('')
    setInvestmentStyle('Blend')
    setNotes('')
    setThesis('')
    setUnits('')
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setPurchasePrice('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    // Format ticker based on market
    let formattedTicker = ticker.toUpperCase().trim()
    if (market === 'ASX' && !formattedTicker.endsWith('.AX')) {
      formattedTicker = `${formattedTicker}.AX`
    } else if (market === 'BSE' && !formattedTicker.endsWith('.BSE')) {
      formattedTicker = `${formattedTicker}.BSE`
    }

    // Create holding
    const { data: holding, error: holdingError } = await supabase
      .from('holdings')
      .insert({
        user_id: user.id,
        ticker: formattedTicker,
        name: name.trim(),
        market,
        currency: getCurrency(),
        asset_type: assetType,
        sector: sector || null,
        investment_style: investmentStyle,
        notes: notes.trim() || null,
        thesis: thesis.trim() || null,
      })
      .select()
      .single()

    if (holdingError) {
      if (holdingError.code === '23505') {
        setError('You already have a holding with this ticker')
      } else {
        setError(holdingError.message)
      }
      setLoading(false)
      return
    }

    // Create first lot if units provided
    if (units && purchasePrice) {
      const { error: lotError } = await supabase
        .from('lots')
        .insert({
          holding_id: holding.id,
          units: parseFloat(units),
          purchase_date: purchaseDate,
          purchase_price: parseFloat(purchasePrice),
        })

      if (lotError) {
        setError('Holding created but failed to add lot: ' + lotError.message)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    resetForm()
    onSuccess()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Add Holding</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Ticker *</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="input"
                  placeholder="e.g., CBA or AAPL"
                  required
                />
              </div>
              <div>
                <label className="label">Company Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="e.g., Commonwealth Bank"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Market *</label>
                <select
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  className="input"
                >
                  {MARKETS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Type *</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="input"
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Style</label>
                <select
                  value={investmentStyle}
                  onChange={(e) => setInvestmentStyle(e.target.value)}
                  className="input"
                >
                  {INVESTMENT_STYLES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Sector</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="input"
              >
                <option value="">Select sector...</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* First Purchase Lot */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-sm font-medium text-slate-700 mb-4">
                First Purchase (Optional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Units</label>
                  <input
                    type="number"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="input"
                    placeholder="e.g., 100"
                    step="any"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Price ({getCurrency()})</label>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="input"
                    placeholder="e.g., 105.50"
                    step="any"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t border-slate-200 pt-6">
              <div className="space-y-4">
                <div>
                  <label className="label">Investment Thesis</label>
                  <textarea
                    value={thesis}
                    onChange={(e) => setThesis(e.target.value)}
                    className="input min-h-[80px]"
                    placeholder="Why are you investing in this? What's the moat?"
                  />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input min-h-[60px]"
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Holding
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
