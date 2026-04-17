'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { X, Save, Loader2 } from 'lucide-react'

interface Lot {
  id: string
  units: number
  purchase_date: string
  purchase_price: number
  notes: string | null
}

interface Holding {
  id: string
  ticker: string
  name: string
  currency: string
}

interface EditLotModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  lot: Lot | null
  holding: Holding | null
}

export default function EditLotModal({ isOpen, onClose, onSuccess, lot, holding }: EditLotModalProps) {
  const [units, setUnits] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Populate form when lot changes
  useEffect(() => {
    if (lot) {
      setUnits(lot.units.toString())
      setPurchasePrice(lot.purchase_price.toString())
      setPurchaseDate(lot.purchase_date)
      setNotes(lot.notes || '')
      setError('')
    }
  }, [lot])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lot) return

    const unitsNum = parseFloat(units)
    const priceNum = parseFloat(purchasePrice)

    if (isNaN(unitsNum) || unitsNum <= 0) {
      setError('Please enter a valid number of units')
      return
    }

    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid purchase price')
      return
    }

    if (!purchaseDate) {
      setError('Please enter a purchase date')
      return
    }

    setSaving(true)
    setError('')

    try {
      const supabase = createClient()
      
      const { error: updateError } = await supabase
        .from('lots')
        .update({
          units: unitsNum,
          purchase_price: priceNum,
          purchase_date: purchaseDate,
          notes: notes || null,
        })
        .eq('id', lot.id)

      if (updateError) throw updateError

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error updating lot:', err)
      setError(err.message || 'Failed to update lot')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setError('')
    onClose()
  }

  if (!isOpen || !lot || !holding) return null

  const currencySymbol = holding.currency === 'USD' ? '$' : holding.currency === 'INR' ? '₹' : '$'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Edit Lot</h2>
              <p className="text-sm text-gray-500">{holding.ticker} - {holding.name}</p>
            </div>
            <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Units
              </label>
              <input
                type="number"
                step="any"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Number of units"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Price ({holding.currency})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="any"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Price per unit"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Any notes about this purchase..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
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
          </form>
        </div>
      </div>
    </div>
  )
}
