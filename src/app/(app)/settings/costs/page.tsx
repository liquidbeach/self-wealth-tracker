'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Settings, Server, Brain, DollarSign, Calendar, Save,
  CheckCircle, RefreshCw, Trash2, Plus, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react'

const fmt = (n: number) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

interface LineItem { category: 'ai_tools' | 'other_costs'; name: string; amount: number }

interface MonthlyCost {
  id?: string; month: string; supabase: number; vercel: number; api_services: number
  claude_subscription: number; other_ai_tools: number; other_costs: number
  other_notes: string | null; total_monthly?: number
}

function parseLineItems(cost: MonthlyCost): LineItem[] {
  if (cost.other_notes) {
    try { const p = JSON.parse(cost.other_notes); if (Array.isArray(p)) return p } catch {}
  }
  const items: LineItem[] = []
  if (cost.claude_subscription > 0) items.push({ category: 'ai_tools', name: 'Claude Max', amount: cost.claude_subscription })
  if (cost.other_ai_tools > 0) items.push({ category: 'ai_tools', name: 'Other AI Tools', amount: cost.other_ai_tools })
  if (cost.other_costs > 0) items.push({ category: 'other_costs', name: 'Other', amount: cost.other_costs })
  return items
}

export default function OperatingCostsPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [costHistory, setCostHistory] = useState<MonthlyCost[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const monthKey = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-01`
  const monthLabel = `${MONTHS[currentMonth.month]} ${currentMonth.year}`

  const prevMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 }
      return { ...prev, month: prev.month - 1 }
    })
  }

  const nextMonth = () => {
    const now = new Date()
    const nextM = currentMonth.month === 11 ? 0 : currentMonth.month + 1
    const nextY = currentMonth.month === 11 ? currentMonth.year + 1 : currentMonth.year
    // Don't go beyond current month
    if (nextY > now.getFullYear() || (nextY === now.getFullYear() && nextM > now.getMonth())) return
    setCurrentMonth({ year: nextY, month: nextM })
  }

  // Infrastructure
  const [infra, setInfra] = useState({ supabase: 0, vercel: 0, api: 0 })

  // Dynamic line items
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [addCat, setAddCat] = useState<'ai_tools' | 'other_costs'>('ai_tools')
  const [addName, setAddName] = useState('')
  const [addAmt, setAddAmt] = useState('')

  useEffect(() => { setMounted(true); loadCosts() }, [])

  // When month changes, load that month's data
  useEffect(() => {
    const existing = costHistory.find(c => c.month === monthKey)
    if (existing) {
      setInfra({ supabase: existing.supabase || 0, vercel: existing.vercel || 0, api: existing.api_services || 0 })
      setLineItems(parseLineItems(existing))
    } else {
      setInfra({ supabase: 0, vercel: 0, api: 0 })
      setLineItems([])
    }
    setSaveError(null)
    setSaved(false)
  }, [monthKey, costHistory])

  const loadCosts = async () => {
    const sb = createClient()
    const { data, error } = await sb.from('operating_costs').select('*').order('month', { ascending: false })
    if (error) console.error('Load error:', error)
    setCostHistory(data || [])
    setLoading(false)
  }

  const addLineItem = () => {
    if (!addName.trim() || !addAmt) return
    setLineItems([...lineItems, { category: addCat, name: addName.trim(), amount: parseFloat(addAmt) || 0 }])
    setAddName(''); setAddAmt('')
  }

  const removeLineItem = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i))
  const updateLineItem = (i: number, field: keyof LineItem, value: any) => {
    const u = [...lineItems]; u[i] = { ...u[i], [field]: value }; setLineItems(u)
  }

  const aiTotal = lineItems.filter(i => i.category === 'ai_tools').reduce((s, i) => s + i.amount, 0)
  const otherTotal = lineItems.filter(i => i.category === 'other_costs').reduce((s, i) => s + i.amount, 0)
  const infraTotal = infra.supabase + infra.vercel + infra.api
  const grandTotal = infraTotal + aiTotal + otherTotal

  const saveCosts = async () => {
    setSaving(true)
    setSaveError(null)

    try {
      const sb = createClient()
      const { data: { user }, error: authErr } = await sb.auth.getUser()

      if (authErr || !user) {
        setSaveError('Authentication failed: ' + (authErr?.message || 'No user'))
        setSaving(false)
        return
      }

      console.log('Saving costs for month:', monthKey, 'user:', user.id)

      const costData = {
        supabase: infra.supabase,
        vercel: infra.vercel,
        api_services: infra.api,
        claude_subscription: aiTotal,
        other_ai_tools: 0,
        other_costs: otherTotal,
        other_notes: JSON.stringify(lineItems),
      }

      console.log('Cost data:', costData)

      // Check for existing record
      const { data: existing, error: selectErr } = await sb
        .from('operating_costs')
        .select('id')
        .eq('user_id', user.id)
        .eq('month', monthKey)
        .maybeSingle()

      if (selectErr) {
        console.error('Select error:', selectErr)
        setSaveError('Failed to check existing record: ' + selectErr.message)
        setSaving(false)
        return
      }

      console.log('Existing record:', existing)

      let result
      if (existing) {
        console.log('Updating record:', existing.id)
        result = await sb
          .from('operating_costs')
          .update(costData)
          .eq('id', existing.id)
          .select()
      } else {
        console.log('Inserting new record')
        result = await sb
          .from('operating_costs')
          .insert({
            ...costData,
            user_id: user.id,
            month: monthKey,
          })
          .select()
      }

      console.log('Save result:', result)

      if (result.error) {
        setSaveError('Save failed: ' + result.error.message + ' (Code: ' + result.error.code + ')')
        console.error('Save error:', result.error)
        setSaving(false)
        return
      }

      console.log('Save successful, reloading...')

      // Reload cost history
      const { data: freshData } = await sb.from('operating_costs').select('*').order('month', { ascending: false })
      if (freshData) setCostHistory(freshData)

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      console.error('Save exception:', err)
      setSaveError('Exception: ' + (err.message || String(err)))
    } finally {
      setSaving(false)
    }
  }

  const deleteMonth = async (id: string) => {
    if (!confirm('Delete this month?')) return
    const sb = createClient()
    const { error } = await sb.from('operating_costs').delete().eq('id', id)
    if (error) console.error('Delete error:', error)
    loadCosts()
  }

  // FY calculation for YTD display
  const now = new Date()
  const fyStart = now.getMonth() >= 6
    ? new Date(now.getFullYear(), 6, 1)
    : new Date(now.getFullYear() - 1, 6, 1)
  const fyCosts = costHistory.filter(c => new Date(c.month) >= fyStart)
  const fyYTD = fyCosts.reduce((s, c) => s + (c.total_monthly || 0), 0)
  const fyMonths = fyCosts.length
  const fyLabel = fyStart.getMonth() >= 6
    ? `FY${fyStart.getFullYear()}-${(fyStart.getFullYear() + 1).toString().slice(-2)}`
    : `FY${fyStart.getFullYear() - 1}-${fyStart.getFullYear().toString().slice(-2)}`

  if (!mounted) return <div className="space-y-4 pb-20"><div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-8 text-center"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div></div>

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><Settings className="w-6 h-6 text-purple-400" /> Operating Costs</h1>
        <p className="text-sm text-gray-500">Track monthly infrastructure and tool costs</p>
      </div>

      {/* Month Navigator */}
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
            <div className="text-center min-w-[160px]">
              <p className="text-base font-semibold text-white">{monthLabel}</p>
              <p className="text-[10px] text-gray-500">{costHistory.find(c => c.month === monthKey) ? 'Recorded' : 'Not recorded'}</p>
            </div>
            <button onClick={nextMonth} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <button onClick={saveCosts} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500 disabled:opacity-50 transition-colors">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Month'}
          </button>
        </div>
        {saveError && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{saveError}</p>
          </div>
        )}
      </div>

      {/* Infrastructure */}
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Server className="w-4 h-4 text-blue-400" /> Infrastructure</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Supabase', desc: 'Database & Auth', key: 'supabase' as const },
            { label: 'Vercel', desc: 'Hosting & CDN', key: 'vercel' as const },
            { label: 'API Services', desc: 'Stock APIs, FX, etc.', key: 'api' as const },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm text-gray-300 mb-1">{f.label}</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="number" value={infra[f.key]} onChange={(e) => setInfra({ ...infra, [f.key]: parseFloat(e.target.value) || 0 })} className="w-full pl-8 pr-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" step="any" min="0" />
              </div>
              <p className="text-[10px] text-gray-600 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-3 text-xs text-gray-500">Infrastructure: <span className="text-white font-mono ml-2">{fmt(infraTotal)}</span></div>
      </div>

      {/* Research & Analysis + Other */}
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-green-400" /> Research, Analysis & Other Costs</h3>

        {lineItems.length > 0 && (
          <div className="space-y-2 mb-4">
            {lineItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white/5 border border-gray-800 rounded-lg">
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${item.category === 'ai_tools' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
                  {item.category === 'ai_tools' ? 'AI TOOLS' : 'OTHER'}
                </span>
                <input type="text" value={item.name} onChange={(e) => updateLineItem(i, 'name', e.target.value)} className="flex-1 px-2 py-1 bg-transparent text-white text-sm border-b border-gray-700 focus:outline-none focus:border-green-500" />
                <div className="relative w-32">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input type="number" value={item.amount} onChange={(e) => updateLineItem(i, 'amount', parseFloat(e.target.value) || 0)} className="w-full pl-7 pr-2 py-1 bg-white/5 text-white text-sm font-mono border border-gray-700 rounded-lg focus:outline-none focus:border-green-500" step="any" min="0" />
                </div>
                <button onClick={() => removeLineItem(i)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 p-3 bg-white/[0.02] border border-dashed border-gray-700 rounded-lg">
          <select value={addCat} onChange={(e) => setAddCat(e.target.value as any)} className="px-2 py-1.5 bg-white/5 text-white border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-green-500">
            <option value="ai_tools">AI Tools</option>
            <option value="other_costs">Other Costs</option>
          </select>
          <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addLineItem() }} placeholder="Tool or cost name..." className="flex-1 px-3 py-1.5 bg-white/5 text-white border border-gray-700 rounded-lg text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500" />
          <div className="relative w-28">
            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input type="number" value={addAmt} onChange={(e) => setAddAmt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addLineItem() }} placeholder="0.00" className="w-full pl-7 pr-2 py-1.5 bg-white/5 text-white text-sm font-mono border border-gray-700 rounded-lg placeholder:text-gray-600 focus:outline-none focus:border-green-500" step="any" min="0" />
          </div>
          <button onClick={addLineItem} disabled={!addName.trim() || !addAmt} className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-500 disabled:opacity-40 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>

        <div className="flex justify-between mt-3 text-xs text-gray-500">
          <div className="flex gap-4">
            {aiTotal > 0 && <span>AI Tools: <span className="text-green-400 font-mono">{fmt(aiTotal)}</span></span>}
            {otherTotal > 0 && <span>Other: <span className="text-yellow-400 font-mono">{fmt(otherTotal)}</span></span>}
          </div>
          <span>Subtotal: <span className="text-white font-mono">{fmt(aiTotal + otherTotal)}</span></span>
        </div>
      </div>

      {/* Monthly Total + FY YTD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#0d1117] border border-purple-500/20 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">THIS MONTH</p>
          <p className="text-2xl font-bold text-white font-mono">{fmt(grandTotal)}</p>
          <div className="text-[10px] text-gray-500 mt-1 space-y-0.5">
            {infraTotal > 0 && <p>Infrastructure: <span className="text-blue-400 font-mono">{fmt(infraTotal)}</span></p>}
            {aiTotal > 0 && <p>AI Tools: <span className="text-green-400 font-mono">{fmt(aiTotal)}</span></p>}
            {otherTotal > 0 && <p>Other: <span className="text-yellow-400 font-mono">{fmt(otherTotal)}</span></p>}
          </div>
        </div>
        <div className="bg-[#0d1117] border border-blue-500/20 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">{fyLabel} — YTD COSTS</p>
          <p className="text-2xl font-bold text-white font-mono">{fmt(fyYTD)}</p>
          <p className="text-[10px] text-gray-500 mt-1">{fyMonths} month{fyMonths !== 1 ? 's' : ''} recorded this FY</p>
        </div>
      </div>

      {/* Cost History */}
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl">
        <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors rounded-xl">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Calendar className="w-4 h-4" /> Cost History ({costHistory.length} months)</h3>
          {showHistory ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {showHistory && (
          <div className="px-4 pb-4">
            {costHistory.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No costs recorded yet</p> : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-800">
                    {['Month','Infrastructure','AI Tools','Other','Total',''].map(h => <th key={h} className={`px-2 py-2 ${h === 'Month' ? 'text-left' : 'text-right'} text-gray-500 font-semibold`}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {costHistory.map(c => {
                      const items = parseLineItems(c)
                      const d = new Date(c.month)
                      const infraSum = (c.supabase || 0) + (c.vercel || 0) + (c.api_services || 0)
                      return (
                        <tr key={c.id} className="border-b border-gray-800/30 hover:bg-white/5">
                          <td className="px-2 py-2 text-gray-300">
                            {MONTHS[d.getMonth()]} {d.getFullYear()}
                            {items.length > 0 && <div className="flex flex-wrap gap-1 mt-0.5">{items.map((it, i) => <span key={i} className="text-[8px] text-gray-600">{it.name}: {fmt(it.amount)}</span>)}</div>}
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-blue-400">{fmt(infraSum)}</td>
                          <td className="px-2 py-2 text-right font-mono text-green-400">{fmt(c.claude_subscription || 0)}</td>
                          <td className="px-2 py-2 text-right font-mono text-yellow-400">{fmt(c.other_costs || 0)}</td>
                          <td className="px-2 py-2 text-right font-mono text-white font-medium">{fmt(c.total_monthly || 0)}</td>
                          <td className="px-2 py-2 text-right"><button onClick={() => c.id && deleteMonth(c.id)} className="text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 text-center">Operating Costs • Data stored in Supabase • Used by Performance Report</p>
    </div>
  )
}
