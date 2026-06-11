'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Target, Plus, Pencil, Trash2, Check, X, Loader2,
  ChevronDown, ChevronRight, Copy, ArrowLeft,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface Campaign {
  id: string; name: string; description: string | null
  start_date: string; end_date: string; total_budget: number | null
  status: string; cgt_rate: number; cgt_discount_rate: number
}

interface Position {
  id: string; campaign_id: string; ticker: string; name: string | null
  tier: string; supply_chain_layer: string | null; flag: string | null
  planned_deploy: number; entry_price: number | null
  entry_target_low: number | null; entry_target_high: number | null
  exit_target_base: number | null; exit_target_bull: number | null
  stop_price: number | null; notes: string | null
  actual_entry_price: number | null; actual_shares: number | null
  actual_deployed: number | null; actual_entry_date: string | null
  actual_exit_price: number | null; actual_exit_date: string | null
  status: string; sort_order: number
}

interface CampaignSummary { id: string; name: string; start_date: string; end_date: string }

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const TIER_CONFIG: Record<string, { label: string; subtitle: string; color: string; borderClass: string; order: number }> = {
  anchor:       { label: '⚓ ANCHORS',         subtitle: 'Core Bedrock / Capital Preservers',              color: '#58a6ff', borderClass: 'border-l-[#58a6ff]', order: 1 },
  tier1_ripper: { label: '🚀 TIER 1 RIPPERS',  subtitle: 'High-Velocity Physical Bottlenecks',             color: '#f0883e', borderClass: 'border-l-[#f0883e]', order: 2 },
  tier2_sneak:  { label: '🔍 TIER 2 SNEAK INS', subtitle: 'Narrow-Entry Watchlist / Macro Flash-Crash',    color: '#bc8cff', borderClass: 'border-l-[#bc8cff]', order: 3 },
  watchlist:    { label: '👁 WATCHLIST',         subtitle: 'Under observation',                              color: '#6b7280', borderClass: 'border-l-gray-500', order: 4 },
}

const FLAG_STYLES: Record<string, string> = {
  'CAVALRY-RISK': 'bg-red-500/15 text-red-400', 'PRE-REVENUE': 'bg-red-500/15 text-red-400',
  'HIGH-VAL': 'bg-orange-500/15 text-orange-400', 'EXTENDED': 'bg-orange-500/15 text-orange-400',
  'ABOVE-CONSENSUS': 'bg-orange-500/15 text-orange-400', 'DIVERSIFIER': 'bg-green-500/15 text-green-400',
  'DEMAND-SIDE': 'bg-blue-500/15 text-blue-400',
}

function fmt(n: number) { return '$' + Math.round(n).toLocaleString('en-AU') }
function pct(n: number) { return (n * 100).toFixed(1) + '%' }

function upsideColor(u: number): string {
  if (u >= 0.5) return 'text-purple-400'
  if (u >= 0.2) return 'text-green-400'
  if (u >= 0.15) return 'text-yellow-400'
  return 'text-red-400'
}

function getFY(startDate: string): string {
  const d = new Date(startDate)
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
  return `FY${y}-${(y + 1).toString().slice(-2)}`
}

// ═══════════════════════════════════════════════════════════
// TIER SECTION
// ═══════════════════════════════════════════════════════════

function TierTable({
  tier, positions, scenario, cgtRate, cgtDiscount, onEdit, onRemove, onAdd,
}: {
  tier: string; positions: Position[]; scenario: 'base' | 'bull'
  cgtRate: number; cgtDiscount: number
  onEdit: (p: Position) => void; onRemove: (p: Position) => void; onAdd: (tier: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const config = TIER_CONFIG[tier] || TIER_CONFIG.watchlist

  const rows = positions.sort((a, b) => a.sort_order - b.sort_order).map(pos => {
    const entry = pos.actual_entry_price || pos.entry_price || 0
    const shares = entry > 0 ? Math.floor(pos.planned_deploy / entry) : 0
    const invested = shares * entry
    const target = scenario === 'bull' ? (pos.exit_target_bull || 0) : (pos.exit_target_base || 0)
    const upside = entry > 0 ? (target - entry) / entry : 0
    const exitValue = shares * target
    const gross = exitValue - invested
    const cgtShort = gross > 0 ? gross * cgtRate : 0
    const netShort = gross - cgtShort
    const cgtLong = gross > 0 ? gross * cgtDiscount : 0
    const netLong = gross - cgtLong
    const stopPct = pos.stop_price && entry > 0 ? (pos.stop_price - entry) / entry : 0
    return { pos, entry, shares, invested, target, upside, exitValue, gross, cgtShort, netShort, cgtLong, netLong, stopPct }
  })

  const totals = rows.reduce((acc, r) => ({
    invested: acc.invested + r.invested,
    exitValue: acc.exitValue + r.exitValue,
    cgtShort: acc.cgtShort + r.cgtShort,
    netShort: acc.netShort + r.netShort,
    cgtLong: acc.cgtLong + r.cgtLong,
    netLong: acc.netLong + r.netLong,
  }), { invested: 0, exitValue: 0, cgtShort: 0, netShort: 0, cgtLong: 0, netLong: 0 })

  return (
    <div className="mb-5">
      {/* Tier Header */}
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center gap-2 px-3 py-2 border-l-4 ${config.borderClass} rounded-r-md hover:bg-white/5 transition-colors`}
          style={{ backgroundColor: `${config.color}08` }}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
          <span className="text-sm font-bold" style={{ color: config.color }}>{config.label}</span>
          <span className="text-[10px] text-gray-500">{config.subtitle}</span>
        </button>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">Deployed: <span className="text-white font-mono font-medium">{fmt(totals.invested)}</span></span>
          <button
            onClick={() => onAdd(tier)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-white bg-white/5 border border-gray-800 rounded-md hover:bg-white/10 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #21262d' }}>
                {['Stock', 'Layer', 'Entry', 'Shares', 'Invested', 'Target', 'Upside', 'Exit Value', 'CGT <12m', 'Net <12m', 'CGT >12m', 'Net >12m', 'Stop'].map(h => (
                  <th key={h} className="px-1.5 py-1.5 text-[9px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap" style={{ textAlign: h === 'Stock' || h === 'Layer' ? 'left' : 'right' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ pos, entry, shares, invested, target, upside, exitValue, gross, cgtShort, netShort, cgtLong, netLong, stopPct }, i) => (
                <tr key={pos.id} className="group border-b border-gray-800/30 hover:bg-white/[0.03] transition-colors" style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(13,17,23,0.3)' }}>
                  <td className="px-1.5 py-2 relative">
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold text-white text-xs">{pos.ticker}</span>
                      {pos.flag && (
                        <span className={`text-[7px] px-1 py-0.5 rounded font-medium ${FLAG_STYLES[pos.flag] || 'bg-white/10 text-gray-400'}`}>{pos.flag}</span>
                      )}
                      {/* Edit/Remove on hover */}
                      <span className="hidden group-hover:inline-flex items-center gap-0.5 ml-1">
                        <button onClick={() => onEdit(pos)} className="p-0.5 text-gray-600 hover:text-blue-400"><Pencil className="w-2.5 h-2.5" /></button>
                        <button onClick={() => onRemove(pos)} className="p-0.5 text-gray-600 hover:text-red-400"><Trash2 className="w-2.5 h-2.5" /></button>
                      </span>
                    </div>
                  </td>
                  <td className="px-1.5 py-2 text-[9px] text-gray-500">{pos.supply_chain_layer}</td>
                  <td className="px-1.5 py-2 text-right font-mono text-gray-400">{fmt(entry)}</td>
                  <td className="px-1.5 py-2 text-right font-mono text-white">{shares}</td>
                  <td className="px-1.5 py-2 text-right font-mono text-white">{fmt(invested)}</td>
                  <td className="px-1.5 py-2 text-right font-mono text-white font-semibold">{fmt(target)}</td>
                  <td className={`px-1.5 py-2 text-right font-mono font-semibold ${upsideColor(upside)}`}>{pct(upside)}</td>
                  <td className="px-1.5 py-2 text-right font-mono text-white">{fmt(exitValue)}</td>
                  <td className="px-1.5 py-2 text-right font-mono text-red-400">{gross > 0 ? `-${fmt(cgtShort)}` : '$0'}</td>
                  <td className={`px-1.5 py-2 text-right font-mono font-medium ${netShort >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(netShort)}</td>
                  <td className="px-1.5 py-2 text-right font-mono text-red-400">{gross > 0 ? `-${fmt(cgtLong)}` : '$0'}</td>
                  <td className={`px-1.5 py-2 text-right font-mono font-bold ${netLong >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(netLong)}</td>
                  <td className="px-1.5 py-2 text-right">
                    <span className="font-mono text-red-400 text-[10px]">{pos.stop_price ? fmt(pos.stop_price) : '—'}</span>
                    {stopPct ? <span className="text-[8px] text-gray-600 ml-0.5">({pct(stopPct)})</span> : null}
                  </td>
                </tr>
              ))}
              {/* Tier Totals */}
              <tr style={{ borderTop: '2px solid #21262d' }}>
                <td colSpan={4} className="px-1.5 py-2 text-[10px] font-bold uppercase" style={{ color: config.color }}>
                  {config.label.replace(/[⚓🚀🔍👁]\s?/, '')} TOTALS
                </td>
                <td className="px-1.5 py-2 text-right font-mono font-bold text-white text-xs">{fmt(totals.invested)}</td>
                <td className="px-1.5 py-2" />
                <td className="px-1.5 py-2" />
                <td className="px-1.5 py-2 text-right font-mono font-bold text-white text-xs">{fmt(totals.exitValue)}</td>
                <td className="px-1.5 py-2 text-right font-mono font-bold text-red-400 text-xs">{totals.cgtShort > 0 ? `-${fmt(totals.cgtShort)}` : '$0'}</td>
                <td className={`px-1.5 py-2 text-right font-mono font-bold text-xs ${totals.netShort >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(totals.netShort)}</td>
                <td className="px-1.5 py-2 text-right font-mono font-bold text-red-400 text-xs">{totals.cgtLong > 0 ? `-${fmt(totals.cgtLong)}` : '$0'}</td>
                <td className={`px-1.5 py-2 text-right font-mono font-bold text-xs ${totals.netLong >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(totals.netLong)}</td>
                <td className="px-1.5 py-2" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [allCampaigns, setAllCampaigns] = useState<CampaignSummary[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [scenario, setScenario] = useState<'base' | 'bull'>('base')

  // Modal states
  const [editPos, setEditPos] = useState<Position | null>(null)
  const [addTier, setAddTier] = useState<string | null>(null)

  // Edit form
  const [ef, setEf] = useState({ tier: '', deploy: '', entry: '', entryLow: '', entryHigh: '', targetBase: '', targetBull: '', stop: '', notes: '', layer: '', flag: '' })

  // Add form
  const [af, setAf] = useState({ ticker: '', name: '', tier: 'watchlist', layer: '', deploy: '12500', entry: '', targetBase: '', targetBull: '', stop: '', notes: '' })

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: allC }, { data: cData }, { data: pData }] = await Promise.all([
      supabase.from('campaigns').select('id, name, start_date, end_date').order('start_date', { ascending: false }),
      supabase.from('campaigns').select('*').eq('id', campaignId).single(),
      supabase.from('campaign_positions').select('*').eq('campaign_id', campaignId).order('sort_order'),
    ])
    if (allC) setAllCampaigns(allC)
    if (cData) setCampaign(cData)
    if (pData) setPositions(pData)
    setLoading(false)
  }, [campaignId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Grand Totals ──
  const grandTotals = useMemo(() => {
    const cgtRate = campaign?.cgt_rate || 0.37
    const cgtDiscount = campaign?.cgt_discount_rate || 0.185
    let invested = 0, exitVal = 0, gross = 0, cgtLong = 0

    positions.forEach(pos => {
      const entry = pos.actual_entry_price || pos.entry_price || 0
      const shares = entry > 0 ? Math.floor(pos.planned_deploy / entry) : 0
      const inv = shares * entry
      const target = scenario === 'bull' ? (pos.exit_target_bull || 0) : (pos.exit_target_base || 0)
      const ev = shares * target
      const g = ev - inv
      invested += inv
      exitVal += ev
      gross += g
      if (g > 0) cgtLong += g * cgtDiscount
    })

    return { invested, exitVal, gross, cgtLong, net: gross - cgtLong }
  }, [positions, scenario, campaign])

  // ── Grouped by tier ──
  const tiers = useMemo(() => {
    const grouped: Record<string, Position[]> = {}
    positions.forEach(p => {
      const t = p.tier || 'watchlist'
      if (!grouped[t]) grouped[t] = []
      grouped[t].push(p)
    })
    return Object.entries(grouped).sort(([a], [b]) => (TIER_CONFIG[a]?.order || 99) - (TIER_CONFIG[b]?.order || 99))
  }, [positions])

  // ── Action handlers ──
  const handleRemove = async (pos: Position) => {
    if (!confirm(`Remove ${pos.ticker}?`)) return
    const supabase = createClient()
    await supabase.from('campaign_positions').delete().eq('id', pos.id)
    fetchData()
  }

  const openEdit = (pos: Position) => {
    setEditPos(pos)
    setEf({
      tier: pos.tier, deploy: pos.planned_deploy.toString(),
      entry: pos.entry_price?.toString() || '', entryLow: pos.entry_target_low?.toString() || '',
      entryHigh: pos.entry_target_high?.toString() || '',
      targetBase: pos.exit_target_base?.toString() || '', targetBull: pos.exit_target_bull?.toString() || '',
      stop: pos.stop_price?.toString() || '', notes: pos.notes || '',
      layer: pos.supply_chain_layer || '', flag: pos.flag || '',
    })
  }

  const saveEdit = async () => {
    if (!editPos) return
    const supabase = createClient()
    await supabase.from('campaign_positions').update({
      tier: ef.tier, planned_deploy: parseFloat(ef.deploy) || 12500,
      entry_price: parseFloat(ef.entry) || null,
      entry_target_low: parseFloat(ef.entryLow) || null, entry_target_high: parseFloat(ef.entryHigh) || null,
      exit_target_base: parseFloat(ef.targetBase) || null, exit_target_bull: parseFloat(ef.targetBull) || null,
      stop_price: parseFloat(ef.stop) || null, notes: ef.notes.trim() || null,
      supply_chain_layer: ef.layer.trim() || null, flag: ef.flag.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editPos.id)
    setEditPos(null)
    fetchData()
  }

  const openAdd = (tier: string) => {
    setAddTier(tier)
    setAf({ ticker: '', name: '', tier, layer: '', deploy: '12500', entry: '', targetBase: '', targetBull: '', stop: '', notes: '' })
  }

  const saveAdd = async () => {
    if (!af.ticker.trim()) return
    const supabase = createClient()
    await supabase.from('campaign_positions').insert({
      campaign_id: campaignId, ticker: af.ticker.trim().toUpperCase(), name: af.name.trim() || null,
      tier: af.tier, supply_chain_layer: af.layer.trim() || null,
      planned_deploy: parseFloat(af.deploy) || 12500, entry_price: parseFloat(af.entry) || null,
      exit_target_base: parseFloat(af.targetBase) || null, exit_target_bull: parseFloat(af.targetBull) || null,
      stop_price: parseFloat(af.stop) || null, notes: af.notes.trim() || null,
      sort_order: positions.length + 1,
    })
    setAddTier(null)
    fetchData()
  }

  const cloneCampaign = async () => {
    if (!campaign) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const newStart = new Date(campaign.start_date)
    newStart.setFullYear(newStart.getFullYear() + 1)
    const newEnd = new Date(campaign.end_date)
    newEnd.setFullYear(newEnd.getFullYear() + 1)

    const { data: newCampaign } = await supabase.from('campaigns').insert({
      name: campaign.name.replace(/\d{4}/g, (m) => String(Number(m) + 1)),
      description: campaign.description, start_date: newStart.toISOString().split('T')[0],
      end_date: newEnd.toISOString().split('T')[0], total_budget: campaign.total_budget,
      status: 'planning', cgt_rate: campaign.cgt_rate, cgt_discount_rate: campaign.cgt_discount_rate,
      user_id: user.id,
    }).select().single()

    if (newCampaign) {
      const newPositions = positions.map(({ id, campaign_id, actual_entry_price, actual_shares, actual_deployed, actual_entry_date, actual_exit_price, actual_exit_date, status, ...rest }) => ({
        ...rest, campaign_id: newCampaign.id, status: 'planned',
      }))
      await supabase.from('campaign_positions').insert(newPositions)
      router.push(`/campaigns/${newCampaign.id}`)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>
  if (!campaign) return <div className="text-center py-20"><p className="text-gray-400">Campaign not found</p></div>

  const cgtRate = campaign.cgt_rate || 0.37
  const cgtDiscount = campaign.cgt_discount_rate || 0.185

  return (
    <div className="space-y-4 pb-20">
      {/* ════ TOP CONTROLS BAR ════ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="text-gray-500 hover:text-gray-300"><ArrowLeft className="w-4 h-4" /></Link>
          <select
            value={campaignId}
            onChange={(e) => router.push(`/campaigns/${e.target.value}`)}
            className="px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500"
          >
            {allCampaigns.map(c => (
              <option key={c.id} value={c.id}>{getFY(c.start_date)} — {c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-black/30 rounded-lg p-0.5 border border-gray-800">
            <button
              onClick={() => setScenario('base')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                scenario === 'base' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'
              }`}
            >📊 Base Case</button>
            <button
              onClick={() => setScenario('bull')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                scenario === 'bull' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-gray-500 hover:text-gray-300'
              }`}
            >🚀 Bull Case</button>
          </div>
          <button onClick={cloneCampaign} className="flex items-center gap-1 px-3 py-1.5 bg-white/5 border border-gray-800 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <Copy className="w-3 h-3" /> Clone
          </button>
        </div>
      </div>

      {/* Description */}
      {campaign.description && <p className="text-xs text-gray-500">{campaign.description}</p>}
      <p className="text-[10px] text-gray-600">{positions.length} positions × {fmt(positions[0]?.planned_deploy || 12500)} per tranche • {scenario === 'bull' ? 'Bull' : 'Base'} case • CGT discount {(cgtDiscount * 100).toFixed(1)}% applied • {new Date(campaign.start_date).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })} → {new Date(campaign.end_date).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}</p>

      {/* ════ SUMMARY BAR ════ */}
      <div className="grid grid-cols-5 gap-px bg-gray-800 rounded-xl overflow-hidden">
        {[
          { label: 'TOTAL DEPLOYED', value: fmt(grandTotals.invested), color: 'text-white' },
          { label: 'CAMPAIGN EXIT VALUE', value: fmt(grandTotals.exitVal), color: 'text-blue-400' },
          { label: 'RAW PROFIT', value: fmt(grandTotals.gross), color: grandTotals.gross >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: `CGT (${(cgtDiscount * 100).toFixed(1)}%)`, value: grandTotals.cgtLong > 0 ? `-${fmt(grandTotals.cgtLong)}` : '$0', color: 'text-red-400' },
          { label: 'TRUE NET POST-TAX', value: fmt(grandTotals.net), color: grandTotals.net >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map((item, i) => (
          <div key={i} className="bg-[#0d0d15] p-4 text-center">
            <p className="text-[9px] text-gray-600 font-semibold tracking-wider mb-1">{item.label}</p>
            <p className={`font-bold font-mono ${item.color} ${i === 4 ? 'text-xl' : 'text-base'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ════ TIER SECTIONS ════ */}
      {tiers.map(([tier, tierPositions]) => (
        <TierTable
          key={tier}
          tier={tier}
          positions={tierPositions}
          scenario={scenario}
          cgtRate={cgtRate}
          cgtDiscount={cgtDiscount}
          onEdit={openEdit}
          onRemove={handleRemove}
          onAdd={openAdd}
        />
      ))}

      {/* ════ EDIT MODAL ════ */}
      {editPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setEditPos(null)} />
          <div className="relative bg-[#1c1c28] border border-gray-700 rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-4">Edit {editPos.ticker} <span className="text-gray-500 font-normal text-sm">— {editPos.name}</span></h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Tier', value: ef.tier, key: 'tier', type: 'select', options: ['anchor', 'tier1_ripper', 'tier2_sneak', 'watchlist'] },
                { label: 'Planned Deploy ($)', value: ef.deploy, key: 'deploy' },
                { label: 'Entry Price ($)', value: ef.entry, key: 'entry' },
                { label: 'Supply Chain Layer', value: ef.layer, key: 'layer' },
                { label: 'Entry Low ($)', value: ef.entryLow, key: 'entryLow' },
                { label: 'Entry High ($)', value: ef.entryHigh, key: 'entryHigh' },
                { label: 'Base Target ($)', value: ef.targetBase, key: 'targetBase' },
                { label: 'Bull Target ($)', value: ef.targetBull, key: 'targetBull' },
                { label: 'Stop Price ($)', value: ef.stop, key: 'stop' },
                { label: 'Flag', value: ef.flag, key: 'flag' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={field.value} onChange={(e) => setEf({ ...ef, [field.key]: e.target.value })} className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                      {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={field.key === 'layer' || field.key === 'flag' ? 'text' : 'number'} value={field.value} onChange={(e) => setEf({ ...ef, [field.key]: e.target.value })} step="any"
                      className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
                  )}
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea value={ef.notes} onChange={(e) => setEf({ ...ef, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => handleRemove(editPos)} className="text-red-400 text-sm hover:text-red-300 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
              <div className="flex gap-2">
                <button onClick={() => setEditPos(null)} className="px-3 py-2 text-gray-400 text-sm">Cancel</button>
                <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ ADD POSITION MODAL ════ */}
      {addTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setAddTier(null)} />
          <div className="relative bg-[#1c1c28] border border-gray-700 rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-4">Add Position to {TIER_CONFIG[addTier]?.label || addTier}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Ticker *', value: af.ticker, key: 'ticker', upper: true },
                { label: 'Company Name', value: af.name, key: 'name' },
                { label: 'Supply Chain Layer', value: af.layer, key: 'layer' },
                { label: 'Planned Deploy ($)', value: af.deploy, key: 'deploy', num: true },
                { label: 'Entry Price ($)', value: af.entry, key: 'entry', num: true },
                { label: 'Base Target ($)', value: af.targetBase, key: 'targetBase', num: true },
                { label: 'Bull Target ($)', value: af.targetBull, key: 'targetBull', num: true },
                { label: 'Stop Price ($)', value: af.stop, key: 'stop', num: true },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                  <input
                    type={field.num ? 'number' : 'text'}
                    value={field.value}
                    onChange={(e) => setAf({ ...af, [field.key]: field.upper ? e.target.value.toUpperCase() : e.target.value })}
                    step="any"
                    className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea value={af.notes} onChange={(e) => setAf({ ...af, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAddTier(null)} className="px-3 py-2 text-gray-400 text-sm">Cancel</button>
              <button onClick={saveAdd} disabled={!af.ticker.trim()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-600 text-center">
        Campaign Model • CGT <12m: {(cgtRate * 100).toFixed(0)}% • CGT >12m: {(cgtDiscount * 100).toFixed(1)}% • Not financial advice
      </p>
    </div>
  )
}
