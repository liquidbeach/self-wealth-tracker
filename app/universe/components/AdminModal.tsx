'use client'

import { useState, useEffect } from 'react'
import { X, Save, Trash2, Plus, Bell, Loader2 } from 'lucide-react'

interface Sector {
  id: string
  name: string
  slug: string
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
}

interface AdminModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  mode: 'add' | 'edit' | 'alert'
  stock?: UniverseStock | null
  sectors: Sector[]
  allStocks?: UniverseStock[]
}

export default function AdminModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  stock,
  sectors,
  allStocks = []
}: AdminModalProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Stock form state
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [tier, setTier] = useState<'heavyweight' | 'velocity'>('heavyweight')
  const [exchange, setExchange] = useState('NASDAQ')
  const [marketCap, setMarketCap] = useState('')
  const [thesis, setThesis] = useState('')
  const [catalysts, setCatalysts] = useState('')
  const [risks, setRisks] = useState('')
  const [status, setStatus] = useState<'active' | 'watch' | 'review' | 'removed'>('active')
  const [statusColor, setStatusColor] = useState<'green' | 'amber' | 'red'>('green')
  const [removalReason, setRemovalReason] = useState('')

  // Alert form state
  const [alertStockId, setAlertStockId] = useState('')
  const [alertType, setAlertType] = useState('news')
  const [alertSeverity, setAlertSeverity] = useState<'red' | 'amber' | 'green'>('amber')
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSource, setAlertSource] = useState('')

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && stock) {
      setTicker(stock.ticker)
      setName(stock.name)
      setSectorId(stock.sector_id)
      setTier(stock.tier)
      setExchange(stock.exchange)
      setMarketCap(stock.market_cap?.toString() || '')
      setThesis(stock.thesis || '')
      setCatalysts(stock.catalysts || '')
      setRisks(stock.risks || '')
      setStatus(stock.status)
      setStatusColor(stock.status_color)
    } else if (mode === 'add') {
      resetForm()
    }
  }, [mode, stock])

  const resetForm = () => {
    setTicker('')
    setName('')
    setSectorId(sectors[0]?.id || '')
    setTier('heavyweight')
    setExchange('NASDAQ')
    setMarketCap('')
    setThesis('')
    setCatalysts('')
    setRisks('')
    setStatus('active')
    setStatusColor('green')
    setRemovalReason('')
    setAlertStockId('')
    setAlertType('news')
    setAlertSeverity('amber')
    setAlertMessage('')
    setAlertSource('')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (mode === 'alert') {
        // Create alert
        const response = await fetch('/api/universe/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stock_id: alertStockId,
            alert_type: alertType,
            severity: alertSeverity,
            message: alertMessage,
            source: alertSource || null
          })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to create alert')
        }
      } else if (mode === 'add') {
        // Add new stock
        const response = await fetch('/api/universe/stocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: ticker.toUpperCase(),
            name,
            sector_id: sectorId,
            tier,
            exchange,
            market_cap: marketCap ? parseFloat(marketCap) * 1e9 : null, // Convert B to raw
            thesis,
            catalysts,
            risks,
            status,
            status_color: statusColor
          })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to add stock')
        }
      } else if (mode === 'edit' && stock) {
        // Update stock
        const response = await fetch(`/api/universe/stocks/${stock.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            sector_id: sectorId,
            tier,
            exchange,
            market_cap: marketCap ? parseFloat(marketCap) * 1e9 : null,
            thesis,
            catalysts,
            risks,
            status,
            status_color: statusColor,
            removal_reason: status === 'removed' ? removalReason : null
          })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update stock')
        }
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === 'add' && 'Add Stock to Universe'}
              {mode === 'edit' && `Edit ${stock?.ticker}`}
              {mode === 'alert' && 'Create Alert'}
            </h2>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
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

            {mode === 'alert' ? (
              /* Alert Form */
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <select
                    value={alertStockId}
                    onChange={(e) => setAlertStockId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="">Select stock...</option>
                    {allStocks.map(s => (
                      <option key={s.id} value={s.id}>{s.ticker} - {s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alert Type</label>
                    <select
                      value={alertType}
                      onChange={(e) => setAlertType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="price_movement">Price Movement</option>
                      <option value="earnings">Earnings</option>
                      <option value="analyst_change">Analyst Change</option>
                      <option value="news">News</option>
                      <option value="thesis_review">Thesis Review</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                    <select
                      value={alertSeverity}
                      onChange={(e) => setAlertSeverity(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="green">Green (Info)</option>
                      <option value="amber">Amber (Attention)</option>
                      <option value="red">Red (Urgent)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source (optional)</label>
                  <input
                    type="text"
                    value={alertSource}
                    onChange={(e) => setAlertSource(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., Bloomberg, Company PR"
                  />
                </div>
              </>
            ) : (
              /* Stock Form */
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ticker</label>
                    <input
                      type="text"
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                      disabled={mode === 'edit'}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exchange</label>
                    <select
                      value={exchange}
                      onChange={(e) => setExchange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="NASDAQ">NASDAQ</option>
                      <option value="NYSE">NYSE</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                    <select
                      value={sectorId}
                      onChange={(e) => setSectorId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      <option value="">Select sector...</option>
                      {sectors.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="heavyweight">Heavyweight</option>
                      <option value="velocity">Velocity</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Market Cap ($B)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={marketCap}
                      onChange={(e) => setMarketCap(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g., 150.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="active">Active</option>
                      <option value="watch">Watch</option>
                      <option value="review">Review</option>
                      <option value="removed">Removed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status Color</label>
                    <select
                      value={statusColor}
                      onChange={(e) => setStatusColor(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="green">🟢 Green</option>
                      <option value="amber">🟡 Amber</option>
                      <option value="red">🔴 Red</option>
                    </select>
                  </div>
                </div>

                {status === 'removed' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Removal Reason</label>
                    <input
                      type="text"
                      value={removalReason}
                      onChange={(e) => setRemovalReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g., Market cap dropped below threshold"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Investment Thesis</label>
                  <textarea
                    value={thesis}
                    onChange={(e) => setThesis(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catalysts</label>
                  <textarea
                    value={catalysts}
                    onChange={(e) => setCatalysts(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key Risks</label>
                  <textarea
                    value={risks}
                    onChange={(e) => setRisks(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
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
                    {mode === 'alert' ? <Bell className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {mode === 'add' && 'Add Stock'}
                    {mode === 'edit' && 'Save Changes'}
                    {mode === 'alert' && 'Create Alert'}
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
