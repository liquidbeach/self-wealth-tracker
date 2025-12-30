'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Save, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface CashBalanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface CashBalance {
  id?: string
  account_name: string
  currency: string
  balance: number
  notes: string
  isNew?: boolean
}

const CURRENCIES = ['AUD', 'USD', 'INR']
const DEFAULT_ACCOUNTS = ['CDIA', 'Wallet', 'Savings', 'Trading']

export default function CashBalanceModal({ isOpen, onClose, onSuccess }: CashBalanceModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balances, setBalances] = useState<CashBalance[]>([])
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadBalances()
    }
  }, [isOpen])

  const loadBalances = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('cash_balances')
      .select('*')
      .order('currency', { ascending: true })
      .order('account_name', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setBalances(data || [])
    }
    setInitialLoad(false)
  }

  const addNewBalance = () => {
    setBalances([
      ...balances,
      {
        account_name: '',
        currency: 'AUD',
        balance: 0,
        notes: '',
        isNew: true,
      }
    ])
  }

  const updateBalance = (index: number, field: keyof CashBalance, value: any) => {
    const updated = [...balances]
    updated[index] = { ...updated[index], [field]: value }
    setBalances(updated)
  }

  const removeBalance = async (index: number) => {
    const balance = balances[index]
    
    if (balance.id) {
      const supabase = createClient()
      await supabase.from('cash_balances').delete().eq('id', balance.id)
    }
    
    setBalances(balances.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    // Validate
    for (const balance of balances) {
      if (!balance.account_name.trim()) {
        setError('All accounts must have a name')
        setLoading(false)
        return
      }
    }

    // Upsert all balances
    for (const balance of balances) {
      if (balance.id) {
        // Update existing
        const { error } = await supabase
          .from('cash_balances')
          .update({
            account_name: balance.account_name.trim(),
            currency: balance.currency,
            balance: balance.balance,
            notes: balance.notes?.trim() || null,
          })
          .eq('id', balance.id)

        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from('cash_balances')
          .insert({
            user_id: user.id,
            account_name: balance.account_name.trim(),
            currency: balance.currency,
            balance: balance.balance,
            notes: balance.notes?.trim() || null,
          })

        if (error) {
          if (error.code === '23505') {
            setError(`Account "${balance.account_name}" with ${balance.currency} already exists`)
          } else {
            setError(error.message)
          }
          setLoading(false)
          return
        }
      }
    }

    setLoading(false)
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
            <h2 className="text-xl font-semibold text-slate-900">Manage Cash Balances</h2>
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

            {initialLoad ? (
              <div className="text-center py-8 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : (
              <>
                {/* Balances List */}
                <div className="space-y-3">
                  {balances.map((balance, index) => (
                    <div key={balance.id || `new-${index}`} className="flex gap-3 items-start p-4 bg-slate-50 rounded-lg">
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-slate-500">Account Name</label>
                          {balance.isNew ? (
                            <select
                              value={balance.account_name}
                              onChange={(e) => updateBalance(index, 'account_name', e.target.value)}
                              className="input text-sm"
                            >
                              <option value="">Select or type...</option>
                              {DEFAULT_ACCOUNTS.map(acc => (
                                <option key={acc} value={acc}>{acc}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={balance.account_name}
                              onChange={(e) => updateBalance(index, 'account_name', e.target.value)}
                              className="input text-sm"
                              placeholder="Account name"
                            />
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Currency</label>
                          <select
                            value={balance.currency}
                            onChange={(e) => updateBalance(index, 'currency', e.target.value)}
                            className="input text-sm"
                            disabled={!balance.isNew}
                          >
                            {CURRENCIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Balance</label>
                          <input
                            type="number"
                            value={balance.balance}
                            onChange={(e) => updateBalance(index, 'balance', parseFloat(e.target.value) || 0)}
                            className="input text-sm"
                            step="any"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Notes</label>
                          <input
                            type="text"
                            value={balance.notes || ''}
                            onChange={(e) => updateBalance(index, 'notes', e.target.value)}
                            className="input text-sm"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBalance(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {balances.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    No cash balances yet. Add your first one below.
                  </div>
                )}

                {/* Add Button */}
                <button
                  type="button"
                  onClick={addNewBalance}
                  className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Cash Account
                </button>
              </>
            )}

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
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save All
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
