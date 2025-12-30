'use client'

import { useState } from 'react'
import { X, Loader2, Upload, FileJson, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface ImportDataModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ImportedHolding {
  ticker: string
  name: string
  market: string
  type: string
  sector: string
  notes: string
  lots: {
    units: number
    purchaseDate: string
    purchasePrice: number
    notes?: string
  }[]
}

interface ImportedData {
  exportDate: string
  holdings: ImportedHolding[]
  cdia: number
  wallet: number
  exchangeRate: number
}

export default function ImportDataModal({ isOpen, onClose, onSuccess }: ImportDataModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importData, setImportData] = useState<ImportedData | null>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'preview' | 'importing' | 'complete'>('idle')
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: []
  })

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      // Validate structure
      if (!data.holdings || !Array.isArray(data.holdings)) {
        throw new Error('Invalid file format: missing holdings array')
      }

      setImportData(data)
      setImportStatus('preview')
    } catch (err: any) {
      setError(err.message || 'Failed to parse JSON file')
    }
  }

  const mapMarket = (market: string): string => {
    const m = market?.toUpperCase() || 'ASX'
    if (m === 'ASX' || m === 'AUS' || m === 'AUSTRALIA') return 'ASX'
    if (m === 'US' || m === 'USA' || m === 'NYSE' || m === 'NASDAQ' || m === 'INTL') return 'US'
    if (m === 'BSE' || m === 'INDIA' || m === 'NSE') return 'BSE'
    return 'ASX'
  }

  const mapAssetType = (type: string): string => {
    const t = type?.toLowerCase() || 'equity'
    if (t.includes('etf')) return 'ETF'
    if (t.includes('gold')) return 'Gold'
    if (t.includes('reit')) return 'REIT'
    return 'Equity'
  }

  const getCurrency = (market: string): string => {
    if (market === 'US') return 'USD'
    if (market === 'BSE') return 'INR'
    return 'AUD'
  }

  const handleImport = async () => {
    if (!importData) return
    
    setLoading(true)
    setImportStatus('importing')
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    const results = { success: 0, failed: 0, errors: [] as string[] }

    // Import holdings
    for (const holding of importData.holdings) {
      try {
        const market = mapMarket(holding.market)
        const assetType = mapAssetType(holding.type)
        const currency = getCurrency(market)

        // Format ticker
        let ticker = holding.ticker.toUpperCase()
        if (market === 'ASX' && !ticker.endsWith('.AX')) {
          ticker = `${ticker}.AX`
        } else if (market === 'BSE' && !ticker.endsWith('.BSE')) {
          ticker = `${ticker}.BSE`
        }

        // Insert holding
        const { data: newHolding, error: holdingError } = await supabase
          .from('holdings')
          .insert({
            user_id: user.id,
            ticker,
            name: holding.name,
            market,
            currency,
            asset_type: assetType,
            sector: holding.sector || null,
            notes: holding.notes || null,
          })
          .select()
          .single()

        if (holdingError) {
          if (holdingError.code === '23505') {
            results.errors.push(`${holding.ticker}: Already exists (skipped)`)
          } else {
            results.errors.push(`${holding.ticker}: ${holdingError.message}`)
          }
          results.failed++
          continue
        }

        // Insert lots
        if (holding.lots && holding.lots.length > 0) {
          for (const lot of holding.lots) {
            await supabase
              .from('lots')
              .insert({
                holding_id: newHolding.id,
                units: lot.units,
                purchase_date: lot.purchaseDate,
                purchase_price: lot.purchasePrice,
                notes: lot.notes || null,
              })
          }
        }

        results.success++
      } catch (err: any) {
        results.errors.push(`${holding.ticker}: ${err.message}`)
        results.failed++
      }
    }

    // Import cash balances
    if (importData.cdia && importData.cdia > 0) {
      await supabase
        .from('cash_balances')
        .upsert({
          user_id: user.id,
          account_name: 'CDIA',
          currency: 'AUD',
          balance: importData.cdia,
        }, { onConflict: 'user_id,account_name,currency' })
    }

    if (importData.wallet && importData.wallet > 0) {
      await supabase
        .from('cash_balances')
        .upsert({
          user_id: user.id,
          account_name: 'Wallet',
          currency: 'AUD',
          balance: importData.wallet,
        }, { onConflict: 'user_id,account_name,currency' })
    }

    setImportResults(results)
    setImportStatus('complete')
    setLoading(false)
  }

  const handleClose = () => {
    setImportData(null)
    setImportStatus('idle')
    setError(null)
    setImportResults({ success: 0, failed: 0, errors: [] })
    if (importStatus === 'complete') {
      onSuccess()
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Import Data</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {importStatus === 'idle' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Import your holdings from the HTML tracker's JSON export.
                </p>
                
                <label className="block">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-primary-500 hover:bg-primary-50 transition-colors cursor-pointer">
                    <FileJson className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                    <p className="text-sm text-slate-600 mb-1">
                      Click to select JSON file
                    </p>
                    <p className="text-xs text-slate-400">
                      Or drag and drop
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {importStatus === 'preview' && importData && (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Import Preview</h3>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>Export Date: {importData.exportDate || 'Unknown'}</p>
                    <p>Holdings: {importData.holdings.length}</p>
                    <p>Total Lots: {importData.holdings.reduce((sum, h) => sum + (h.lots?.length || 0), 0)}</p>
                    {importData.cdia > 0 && <p>CDIA: ${importData.cdia.toLocaleString()}</p>}
                    {importData.wallet > 0 && <p>Wallet: ${importData.wallet.toLocaleString()}</p>}
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Note:</strong> Existing holdings with the same ticker will be skipped. 
                    Cash balances will be updated if they already exist.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setImportData(null)
                      setImportStatus('idle')
                    }}
                    className="btn-secondary"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={loading}
                    className="btn-primary flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Import
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {importStatus === 'complete' && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Import Complete</h3>
                
                <div className="bg-slate-50 rounded-lg p-4 text-left">
                  <div className="text-sm space-y-1">
                    <p className="text-green-600">✓ {importResults.success} holdings imported</p>
                    {importResults.failed > 0 && (
                      <p className="text-amber-600">⚠ {importResults.failed} skipped/failed</p>
                    )}
                  </div>
                  
                  {importResults.errors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-2">Details:</p>
                      <div className="text-xs text-slate-600 space-y-1 max-h-32 overflow-y-auto">
                        {importResults.errors.map((err, i) => (
                          <p key={i}>{err}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleClose}
                  className="btn-primary"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
