'use client'

import { useState } from 'react'
import { RefreshCw, Check, AlertCircle } from 'lucide-react'

interface RefreshPricesButtonProps {
  onSuccess?: () => void
  className?: string
}

export default function RefreshPricesButton({ onSuccess, className = '' }: RefreshPricesButtonProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleRefresh = async () => {
    setLoading(true)
    setStatus('idle')
    setMessage('')

    try {
      const response = await fetch('/api/prices', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update prices')
      }

      setStatus('success')
      setMessage(`Updated ${data.updated} prices`)
      
      if (onSuccess) {
        onSuccess()
      }

      // Reset status after 3 seconds
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 3000)

    } catch (error: any) {
      setStatus('error')
      setMessage(error.message)
      
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 5000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={handleRefresh}
        disabled={loading}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          status === 'success' 
            ? 'bg-green-100 text-green-700' 
            : status === 'error'
            ? 'bg-red-100 text-red-700'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
        }`}
      >
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : status === 'success' ? (
          <Check className="w-4 h-4" />
        ) : status === 'error' ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        {loading ? 'Updating...' : status === 'success' ? message : status === 'error' ? 'Error' : 'Refresh Prices'}
      </button>
      {status === 'error' && message && (
        <span className="text-xs text-red-600">{message}</span>
      )}
    </div>
  )
}
