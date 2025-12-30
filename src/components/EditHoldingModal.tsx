'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Save, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface EditHoldingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onDelete: () => void
  holding: any | null
}

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

export default function EditHoldingModal({ isOpen, onClose, onSuccess, onDelete, holding }: EditHoldingModalProps) {
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState('Equity')
  const [sector, setSector] = useState('')
  const [investmentStyle, setInvestmentStyle] = useState('Blend')
  const [currentPrice, setCurrentPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [thesis, setThesis] = useState('')

  useEffect(() => {
    if (holding) {
      setName(holding.name || '')
      setAssetType(holding.asset_type || 'Equity')
      setSector(holding.sector || '')
      setInvestmentStyle(holding.investment_style || 'Blend')
      setCurrentPrice(holding.current_price?.toString() || '')
      setNotes(holding.notes || '')
      setThesis(holding.thesis || '')
    }
  }, [holding])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!holding) return
    
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('holdings')
      .update({
        name: name.trim(),
        asset_type: assetType,
        sector: sector || null,
        investment_style: investmentStyle,
        current_price: currentPrice ? parseFloat(currentPrice) : null,
        notes: notes.trim() || null,
        thesis: thesis.trim() || null,
      })
      .eq('id', holding.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
    onClose()
  }

  const handleDelete = async () => {
    if (!holding) return
    
    setDeleteLoading(true)
    setError(null)

    const supabase = createClient()

    // Delete lots first (cascade should handle this, but being explicit)
    await supabase
      .from('lots')
      .delete()
      .eq('holding_id', holding.id)

    // Delete holding
    const { error: deleteError } = await supabase
      .from('holdings')
      .delete()
      .eq('id', holding.id)

    if (deleteError) {
      setError(deleteError.message)
      setDeleteLoading(false)
      return
    }

    setDeleteLoading(false)
    setShowDeleteConfirm(false)
    onDelete()
    onClose()
  }

  if (!isOpen || !holding) return null

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
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Edit Holding</h2>
              <p className="text-sm text-slate-500">{holding.ticker}</p>
            </div>
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
                <label className="label">Ticker</label>
                <input
                  type="text"
                  value={holding.ticker}
                  className="input bg-slate-50"
                  disabled
                />
              </div>
              <div>
                <label className="label">Company Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Market</label>
                <input
                  type="text"
                  value={holding.market}
                  className="input bg-slate-50"
                  disabled
                />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div>
                <label className="label">Current Price ({holding.currency})</label>
                <input
                  type="number"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  className="input"
                  placeholder="Manual price override"
                  step="any"
                  min="0"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <div>
                <label className="label">Investment Thesis</label>
                <textarea
                  value={thesis}
                  onChange={(e) => setThesis(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Why are you investing in this?"
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

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <div className="flex gap-3">
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
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 bg-white rounded-xl flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Holding?</h3>
                <p className="text-slate-600 mb-6">
                  This will permanently delete <strong>{holding.ticker}</strong> and all its purchase lots. This action cannot be undone.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {deleteLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
