'use client'

import { useState } from 'react'
import { Save, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your preferences and risk thresholds</p>
      </div>

      {/* Risk Settings */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Preferences</h3>
        
        <div className="space-y-4">
          <div>
            <label className="label">Max Single Position (%)</label>
            <input
              type="number"
              defaultValue={10}
              min={1}
              max={100}
              className="input w-32"
            />
            <p className="text-xs text-slate-500 mt-1">Alert when any holding exceeds this % of portfolio</p>
          </div>

          <div>
            <label className="label">Max Sector Allocation (%)</label>
            <input
              type="number"
              defaultValue={30}
              min={1}
              max={100}
              className="input w-32"
            />
            <p className="text-xs text-slate-500 mt-1">Alert when any sector exceeds this % of portfolio</p>
          </div>

          <div>
            <label className="label">Drawdown Alert Threshold (%)</label>
            <input
              type="number"
              defaultValue={15}
              min={1}
              max={100}
              className="input w-32"
            />
            <p className="text-xs text-slate-500 mt-1">Alert when any holding drops this % from 52-week high</p>
          </div>

          <div>
            <label className="label">Minimum Cash Buffer (%)</label>
            <input
              type="number"
              defaultValue={5}
              min={0}
              max={100}
              className="input w-32"
            />
            <p className="text-xs text-slate-500 mt-1">Recommended cash to keep available for opportunities</p>
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Display Preferences</h3>
        
        <div className="space-y-4">
          <div>
            <label className="label">Default Currency</label>
            <select className="input w-48">
              <option value="AUD">AUD - Australian Dollar</option>
              <option value="USD">USD - US Dollar</option>
              <option value="INR">INR - Indian Rupee</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        disabled={saving}
        className="btn-primary flex items-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Settings
          </>
        )}
      </button>
    </div>
  )
}
