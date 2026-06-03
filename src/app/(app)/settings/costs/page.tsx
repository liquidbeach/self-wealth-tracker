'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Settings,
  Server,
  Brain,
  DollarSign,
  Calendar,
  Save,
  CheckCircle,
  RefreshCw,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

const fmt = (n: number) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface MonthlyCost {
  id?: string
  month: string
  supabase: number
  vercel: number
  api_services: number
  claude_subscription: number
  other_ai_tools: number
  other_costs: number
  total_monthly?: number
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function OperatingCostsPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  const [costHistory, setCostHistory] = useState<MonthlyCost[]>([])
  const [showHistory, setShowHistory] = useState(false)
  
  // Current month form
  const [selectedMonth, setSelectedMonth] = useState('')
  const [costs, setCosts] = useState<MonthlyCost>({
    month: '',
    supabase: 25,
    vercel: 20,
    api_services: 0,
    claude_subscription: 169.99,
    other_ai_tools: 0,
    other_costs: 0,
  })

  useEffect(() => {
    setMounted(true)
    
    // Set current month
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    setSelectedMonth(monthKey)
    setCosts(prev => ({ ...prev, month: monthKey }))
    
    loadCosts()
  }, [])

  useEffect(() => {
    // Load costs for selected month
    const existing = costHistory.find(c => c.month === selectedMonth)
    if (existing) {
      setCosts(existing)
    } else {
      // Reset to defaults for new month
      setCosts({
        month: selectedMonth,
        supabase: 25,
        vercel: 20,
        api_services: 0,
        claude_subscription: 169.99,
        other_ai_tools: 0,
        other_costs: 0,
      })
    }
  }, [selectedMonth, costHistory])

  const loadCosts = async () => {
    try {
      const supabase = createClient()
      
      const { data } = await supabase
        .from('operating_costs')
        .select('*')
        .order('month', { ascending: false })
      
      setCostHistory(data || [])
      
      // Load current month if exists
      const now = new Date()
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const current = data?.find(c => c.month === monthKey)
      
      if (current) {
        setCosts(current)
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Failed to load costs:', err)
      setLoading(false)
    }
  }

  const saveCosts = async () => {
    setSaving(true)
    console.log('Starting save for month:', selectedMonth)
    console.log('Costs to save:', costs)
    
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        setSaving(false)
        return
      }
      
      if (!user) {
        console.error('No user found')
        setSaving(false)
        return
      }
      
      console.log('User ID:', user.id)
      
      const total = 
        costs.supabase + 
        costs.vercel + 
        costs.api_services + 
        costs.claude_subscription + 
        costs.other_ai_tools + 
        costs.other_costs

      // Check if record exists for this month (use maybeSingle to avoid 404)
      const { data: existing, error: selectError } = await supabase
        .from('operating_costs')
        .select('id')
        .eq('user_id', user.id)
        .eq('month', selectedMonth)
        .maybeSingle()

      if (selectError) {
        console.error('Select error:', selectError)
      }
      
      console.log('Existing record:', existing)

      const costData = {
        supabase: costs.supabase,
        vercel: costs.vercel,
        api_services: costs.api_services,
        claude_subscription: costs.claude_subscription,
        other_ai_tools: costs.other_ai_tools,
        other_costs: costs.other_costs,
        total_monthly: total,
      }

      if (existing) {
        // Update existing record
        console.log('Updating record ID:', existing.id)
        const { error: updateError } = await supabase
          .from('operating_costs')
          .update(costData)
          .eq('id', existing.id)
        
        if (updateError) {
          console.error('Update error:', updateError)
        } else {
          console.log('Update successful')
        }
      } else {
        // Insert new record
        console.log('Inserting new record')
        const { error: insertError } = await supabase
          .from('operating_costs')
          .insert({
            user_id: user.id,
            month: selectedMonth,
            ...costData,
          })
        
        if (insertError) {
          console.error('Insert error:', insertError)
        } else {
          console.log('Insert successful')
        }
      }
      
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      
      loadCosts()
    } catch (err) {
      console.error('Failed to save costs:', err)
    }
    setSaving(false)
  }

  const deleteCost = async (month: string) => {
    if (!confirm(`Delete costs for ${formatMonth(month)}?`)) return
    
    try {
      const supabase = createClient()
      await supabase
        .from('operating_costs')
        .delete()
        .eq('month', month)
      
      loadCosts()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr)
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  }

  const calculateTotal = () => {
    return (
      costs.supabase + 
      costs.vercel + 
      costs.api_services + 
      costs.claude_subscription + 
      costs.other_ai_tools + 
      costs.other_costs
    )
  }

  // Generate month options (last 24 months)
  const monthOptions = () => {
    const options = []
    const now = new Date()
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
      options.push({ key, label: formatMonth(key) })
    }
    return options
  }

  // Calculate FY totals
  const calculateFYTotals = () => {
    const now = new Date()
    const fyStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
    const fyStartDate = new Date(fyStart, 6, 1)
    const fyEndDate = new Date(fyStart + 1, 5, 30)
    
    const fyCosts = costHistory.filter(c => {
      const date = new Date(c.month)
      return date >= fyStartDate && date <= fyEndDate
    })
    
    const total = fyCosts.reduce((sum, c) => sum + (c.total_monthly || 0), 0)
    const months = fyCosts.length
    
    return {
      fyLabel: `FY ${fyStart}-${fyStart + 1}`,
      total,
      months,
      avgMonthly: months > 0 ? total / months : 0,
      projected: months > 0 ? (total / months) * 12 : calculateTotal() * 12,
    }
  }

  const fyTotals = calculateFYTotals()

  if (!mounted) {
    return (
      <div className="space-y-4 pb-20">
        <h1 className="text-xl font-bold text-gray-900">Operating Costs</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-600" />
          Operating Costs
        </h1>
        <p className="text-sm text-gray-500">Track monthly infrastructure & research costs</p>
      </div>

      {/* FY Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-4 text-white">
          <p className="text-xs text-slate-300 mb-1">{fyTotals.fyLabel} Total</p>
          <p className="text-xl font-bold">{fmt(fyTotals.total)}</p>
          <p className="text-xs text-slate-400">{fyTotals.months} months recorded</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Avg Monthly</p>
          <p className="text-xl font-bold text-gray-900">{fmt(fyTotals.avgMonthly)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Projected Annual</p>
          <p className="text-xl font-bold text-gray-900">{fmt(fyTotals.projected)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Current Month</p>
          <p className="text-xl font-bold text-gray-900">{fmt(calculateTotal())}</p>
        </div>
      </div>

      {/* Month Selector + Cost Entry */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            ENTER MONTHLY COSTS
          </h3>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
          >
            {monthOptions().map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Infrastructure Section */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1">
            <Server className="w-3 h-3" />
            INFRASTRUCTURE
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Supabase</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={costs.supabase}
                  onChange={(e) => setCosts(prev => ({ ...prev, supabase: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Database & Auth</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Vercel</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={costs.vercel}
                  onChange={(e) => setCosts(prev => ({ ...prev, vercel: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Hosting & CDN</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">API Services</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={costs.api_services}
                  onChange={(e) => setCosts(prev => ({ ...prev, api_services: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Stock APIs, FX, etc.</p>
            </div>
          </div>
        </div>

        {/* Research Section */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1">
            <Brain className="w-3 h-3" />
            RESEARCH & ANALYSIS
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Claude Max</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={costs.claude_subscription}
                  onChange={(e) => setCosts(prev => ({ ...prev, claude_subscription: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">AI Research Assistant</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Other AI Tools</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={costs.other_ai_tools}
                  onChange={(e) => setCosts(prev => ({ ...prev, other_ai_tools: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">ChatGPT, Perplexity, etc.</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Other Costs</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={costs.other_costs}
                  onChange={(e) => setCosts(prev => ({ ...prev, other_costs: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Miscellaneous</p>
            </div>
          </div>
        </div>

        {/* Total & Save */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div>
            <p className="text-lg font-bold text-gray-900">
              Monthly Total: <span className="font-mono">{fmt(calculateTotal())}</span>
            </p>
            <p className="text-sm text-gray-500">
              For {formatMonth(selectedMonth)}
            </p>
          </div>
          <button
            onClick={saveCosts}
            disabled={saving}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg flex items-center gap-2 ${
              saved 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            } disabled:opacity-50`}
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Costs'}
          </button>
        </div>
      </div>

      {/* Cost History */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <h3 className="text-sm font-semibold text-gray-900">COST HISTORY</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{costHistory.length} months</span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>
        
        {showHistory && (
          <div className="border-t border-gray-100">
            {costHistory.length === 0 ? (
              <div className="p-8 text-center">
                <DollarSign className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No cost history yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {costHistory.map(cost => (
                  <div key={cost.month} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{formatMonth(cost.month)}</p>
                      <div className="flex gap-4 mt-1 text-xs text-gray-500">
                        <span>Infra: {fmt(cost.supabase + cost.vercel + cost.api_services)}</span>
                        <span>Research: {fmt(cost.claude_subscription + cost.other_ai_tools)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-mono font-bold text-gray-900">{fmt(cost.total_monthly || 0)}</p>
                      <button
                        onClick={() => deleteCost(cost.month)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-sm text-slate-600">
          <strong>Note:</strong> These costs are used in the Performance Report to calculate your net profit after operating expenses. 
          The Performance page reads from this data to show annualized costs in the P&L waterfall.
        </p>
      </div>
    </div>
  )
}
