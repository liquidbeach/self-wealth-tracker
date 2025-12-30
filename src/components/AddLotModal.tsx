'use client'

import { useState } from 'react'
import { X, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface AddLotModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  holding: {
    id: string
    ticker: string
    name: string
    currency: string
  } | null
}

export default function AddLotModal({ isOpen, onClose, onSuccess, holding }: AddLotModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [units, setUnits] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [purchasePrice, setPurchasePrice] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setUnits('')
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setPurchasePrice('')
    setNotes('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!holding) return
    
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: lotError } = await supabase
      .from('lots')
      .insert({
        holding_id: holding.id,
        units: parseFloat(units),
        purchase_date: purchaseDate,
        purchase_price: parseFloat(purchasePrice),
        notes: notes.trim() || null,
      })

    if (lotError) {
      setError(lotError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    resetForm()
    onSuccess()
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
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Add Lot</h2>
              <p className="text-sm text-slate-500">{holding.ticker} - {holding.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="label">Units *</label>
              <input
                type="number"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="input"
                placeholder="e.g., 100"
                step="any"
                min="0"
                required
              />
            </div>

            <div>
              <label className="label">Purchase Date *</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label className="label">Price per Unit ({holding.currency}) *</label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="input"
                placeholder="e.g., 105.50"
                step="any"
                min="0"
                required
              />
            </div>

            <div>
              <label className="label">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                placeholder="Optional note for this lot"
              />
            </div>

            {/* Summary */}
            {units && purchasePrice && (
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600">
                  Total Cost: <span className="font-semibold text-slate-900">
                    {holding.currency === 'INR' ? '₹' : '$'}
                    {(parseFloat(units) * parseFloat(purchasePrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
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
                    Add Lot
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
