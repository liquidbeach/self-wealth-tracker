'use client'

import { X, Bell, TrendingUp, TrendingDown, FileText, AlertTriangle, CheckCircle, Newspaper } from 'lucide-react'

interface Alert {
  id: string
  stock_id: string
  alert_type: 'price_movement' | 'earnings' | 'analyst_change' | 'news' | 'thesis_review' | 'other'
  severity: 'red' | 'amber' | 'green'
  message: string
  source: string | null
  is_read: boolean
  created_at: string
  universe_stocks: {
    id: string
    ticker: string
    name: string
  } | null
}

interface AlertsPanelProps {
  isOpen: boolean
  onClose: () => void
  alerts: Alert[]
  onMarkAsRead: (alertId: string) => void
  onMarkAllAsRead: () => void
}

function getAlertIcon(type: string) {
  switch (type) {
    case 'price_movement':
      return <TrendingUp className="w-4 h-4" />
    case 'earnings':
      return <FileText className="w-4 h-4" />
    case 'analyst_change':
      return <TrendingDown className="w-4 h-4" />
    case 'news':
      return <Newspaper className="w-4 h-4" />
    case 'thesis_review':
      return <AlertTriangle className="w-4 h-4" />
    default:
      return <Bell className="w-4 h-4" />
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'red':
      return 'bg-red-50 border-red-200 text-red-700'
    case 'amber':
      return 'bg-amber-50 border-amber-200 text-amber-700'
    case 'green':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    default:
      return 'bg-gray-50 border-gray-200 text-gray-700'
  }
}

function getSeverityIconColor(severity: string) {
  switch (severity) {
    case 'red':
      return 'text-red-500'
    case 'amber':
      return 'text-amber-500'
    case 'green':
      return 'text-emerald-500'
    default:
      return 'text-gray-500'
  }
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function AlertsPanel({
  isOpen,
  onClose,
  alerts,
  onMarkAsRead,
  onMarkAllAsRead
}: AlertsPanelProps) {
  if (!isOpen) return null

  const unreadAlerts = alerts.filter(a => !a.is_read)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
            {unreadAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                {unreadAlerts.length} unread
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mark All as Read */}
        {unreadAlerts.length > 0 && (
          <div className="p-3 border-b border-gray-100">
            <button
              onClick={onMarkAllAsRead}
              className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              <CheckCircle className="w-4 h-4" />
              Mark all as read
            </button>
          </div>
        )}

        {/* Alerts List */}
        <div className="overflow-y-auto h-[calc(100vh-120px)]">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No alerts yet</p>
              <p className="text-sm mt-1">Alerts will appear here when there are updates to your universe stocks</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 ${!alert.is_read ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`mt-0.5 ${getSeverityIconColor(alert.severity)}`}>
                      {getAlertIcon(alert.alert_type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm text-gray-900">
                          {alert.universe_stocks?.ticker || 'Unknown'}
                        </span>
                        <span className={`px-1.5 py-0.5 text-xs rounded border ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs text-gray-400">{formatTime(alert.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700">{alert.message}</p>
                      {alert.source && (
                        <p className="text-xs text-gray-400 mt-1">Source: {alert.source}</p>
                      )}
                    </div>

                    {/* Dismiss */}
                    {!alert.is_read && (
                      <button
                        onClick={() => onMarkAsRead(alert.id)}
                        className="p-1 text-gray-400 hover:text-emerald-600 rounded"
                        title="Mark as read"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
