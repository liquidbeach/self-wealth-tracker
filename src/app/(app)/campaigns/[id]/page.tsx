'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Target, Plus, Pencil, Trash2, Check, X, Loader2,
  ChevronDown, ChevronRight, Copy, ArrowLeft, Rocket, Save,
  RotateCcw,
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
  anchor:       { label: 'ANCHORS',         subtitle: 'Core Bedrock / Capital Preservers',           color: '#58a6ff', borderClass: 'border-l-[#58a6ff]', order: 1 },
  tier1_ripper: { label: 'TIER 1 RIPPERS',  subtitle: 'High-Velocity Physical Bottlenecks',          color: '#f0883e', borderClass: 'border-l-[#f0883e]', order: 2 },
  tier2_sneak:  { label: 'TIER 2 SNEAK INS', subtitle: 'Narrow-Entry Watchlist / Macro Flash-Crash', color: '#bc8cff', borderClass: 'border-l-[#bc8cff]', order: 3 },
  watchlist:    { label: 'WATCHLIST',         subtitle: 'Under observation',                           color: '#6b7280', borderClass: 'border-l-gray-500', order: 4 },
}

const FLAG_STYLES: Record<string, string> = {
  'CAVALRY-RISK': 'bg-red-500/15 text-red-400', 'PRE-REVENUE': 'bg-red-500/15 text-red-400',
  'HIGH-VAL': 'bg-orange-500/15 text-orange-400', 'EXTENDED': 'bg-orange-500/15 text-orange-400',
  'ABOVE-CONSENSUS': 'bg-orange-500/15 text-orange-400', 'DIVERSIFIER': 'bg-green-500/15 text-green-400',
  'DEMAND-SIDE': 'bg-blue-500/15 text-blue-400',
}

function fmt(n: number) { return '$' + Math.round(n).toLocaleString('en-AU') }
function fmtDec(n: number) { return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
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

// Column header component
function TH({ children, align = 'right' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-1.5 py-1.5 text-[9px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap text-${align}`}>{children}</th>
}

// Calc helper
function calcRow(entry: number, shares: number, target: number, stopPrice: number | null, cgtRate: number, cgtDiscount: number) {
  const invested = shares * entry
  const upside = entry > 0 ? (target - entry) / entry : 0
  const exitValue = shares * target
  const gross = exitValue - invested
  const cgtShort = gross > 0 ? gross * cgtRate : 0
  const netShort = gross - cgtShort
  const cgtLong = gross > 0 ? gross * cgtDiscount : 0
  const netLong = gross - cgtLong
  const stopPct = stopPrice && entry > 0 ? (stopPrice - entry) / entry : null
  return { invested, upside, exitValue, gross, cgtShort, netShort, cgtLong, netLong, stopPct }
}

// ═══════════════════════════════════════════════════════════
// DEPLOYMENT TABLE
// ═══════════════════════════════════════════════════════════

function DeploymentTable({
  positions, scenario, cgtRate, cgtDiscount, onEditDeploy, onUndeploy,
}: {
  positions: Position[]
  scenario: 'base' | 'bull'
  cgtRate: number; cgtDiscount: number
  onEditDeploy: (p: Position) => void
  onUndeploy: (p: Position) => void
}) {
  if (positions.length === 0) return null

  const rows = positions.map(pos => {
    const entry = pos.actual_entry_price || 0
    const shares = pos.actual_shares || 0
    const target = scenario === 'bull' ? (pos.exit_target_bull || 0) : (pos.exit_target_base || 0)
    const c = calcRow(entry, shares, target, pos.stop_price, cgtRate, cgtDiscount)
    return { pos, entry, shares, ...c }
  })

  const totals = rows.reduce((a, r) => ({
    invested: a.invested + r.invested, exitValue: a.exitValue + r.exitValue,
    cgtShort: a.cgtShort + r.cgtShort, netShort: a.netShort + r.netShort,
    cgtLong: a.cgtLong + r.cgtLong, netLong: a.netLong + r.netLong,
    gross: a.gross + r.gross,
  }), { invested: 0, exitValue: 0, cgtShort: 0, netShort: 0, cgtLong: 0, netLong: 0, gross: 0 })

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #238636' }}>
            <TH align="left">Stock</TH><TH>Entry</TH><TH>Shares</TH><TH>Invested</TH>
            <TH>Target</TH><TH>Exit Value</TH><TH>Upside</TH>
            <TH>CGT {'<'}12m</TH><TH>Net {'<'}12m</TH><TH>CGT {'>'}12m</TH><TH>Net {'>'}12m</TH><TH>Stop</TH><TH>Action</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ pos, entry, shares, invested, upside, exitValue, gross, cgtShort, netShort, cgtLong, netLong, stopPct }) => (
            <tr key={pos.id} className="border-b border-gray-800/30 hover:bg-green-500/5 transition-colors">
              <td className="px-1.5 py-2">
                <span className="font-mono font-bold text-white text-xs">{pos.ticker}</span>
                <span className="text-[9px] text-gray-500 ml-1">{pos.name}</span>
                {pos.actual_entry_date && <p className="text-[8px] text-gray-600">{new Date(pos.actual_entry_date).toLocaleDateString('en-AU')}</p>}
              </td>
              <td className="px-1.5 py-2 text-right font-mono text-white">{fmtDec(entry)}</td>
              <td className="px-1.5 py-2 text-right font-mono text-white">{shares}</td>
              <td className="px-1.5 py-2 text-right font-mono text-white font-medium">{fmt(invested)}</td>
              <td className="px-1.5 py-2 text-right font-mono text-white">{fmt(scenario === 'bull' ? (pos.exit_target_bull || 0) : (pos.exit_target_base || 0))}</td>
              <td className="px-1.5 py-2 text-right font-mono text-white font-medium">{fmt(exitValue)}</td>
              <td className={`px-1.5 py-2 text-right font-mono font-semibold ${upsideColor(upside)}`}>{pct(upside)}</td>
              <td className="px-1.5 py-2 text-right font-mono text-red-400">{gross > 0 ? `-${fmt(cgtShort)}` : '$0'}</td>
              <td className={`px-1.5 py-2 text-right font-mono font-medium ${netShort >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(netShort)}</td>
              <td className="px-1.5 py-2 text-right font-mono text-red-400">{gross > 0 ? `-${fmt(cgtLong)}` : '$0'}</td>
              <td className={`px-1.5 py-2 text-right font-mono font-bold ${netLong >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(netLong)}</td>
              <td className="px-1.5 py-2 text-right">
                {pos.stop_price ? <span className="font-mono text-red-400 text-[10px]">{fmt(pos.stop_price)}</span> : '—'}
                {stopPct != null && <span className="text-[8px] text-gray-600 ml-0.5">({pct(stopPct)})</span>}
              </td>
              <td className="px-1.5 py-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => onEditDeploy(pos)} className="text-[9px] text-gray-500 hover:text-blue-400 flex items-center gap-0.5"><Pencil className="w-2.5 h-2.5" /></button>
                  <button onClick={() => onUndeploy(pos)} className="text-[9px] text-gray-500 hover:text-yellow-400 flex items-center gap-0.5" title="Revert to planned"><RotateCcw className="w-2.5 h-2.5" /></button>
                </div>
              </td>
            </tr>
          ))}
          {/* Totals */}
          <tr style={{ borderTop: '2px solid #238636' }}>
            <td colSpan={3} className="px-1.5 py-2 text-xs font-bold text-green-400 uppercase">Deployment Totals</td>
            <td className="px-1.5 py-2 text-right font-mono font-bold text-white text-xs">{fmt(totals.invested)}</td>
            <td className="px-1.5 py-2" />
            <td className="px-1.5 py-2 text-right font-mono font-bold text-white text-xs">{fmt(totals.exitValue)}</td>
            <td className="px-1.5 py-2" />
            <td className="px-1.5 py-2 text-right font-mono font-bold text-red-400 text-xs">{totals.cgtShort > 0 ? `-${fmt(totals.cgtShort)}` : '$0'}</td>
            <td className={`px-1.5 py-2 text-right font-mono font-bold text-xs ${totals.netShort >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(totals.netShort)}</td>
            <td className="px-1.5 py-2 text-right font-mono font-bold text-red-400 text-xs">{totals.cgtLong > 0 ? `-${fmt(totals.cgtLong)}` : '$0'}</td>
            <td className={`px-1.5 py-2 text-right font-mono font-bold text-xs ${totals.netLong >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(totals.netLong)}</td>
            <td className="px-1.5 py-2" colSpan={2} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// TIER TABLE (Speculative / Planning)
// ═══════════════════════════════════════════════════════════

function TierTable({
  tier, positions, scenario, cgtRate, cgtDiscount, onEdit, onRemove, onAdd, onDeploy,
}: {
  tier: string; positions: Position[]; scenario: 'base' | 'bull'
  cgtRate: number; cgtDiscount: number
  onEdit: (p: Position) => void; onRemove: (p: Position) => void
  onAdd: (tier: string) => void; onDeploy: (p: Position) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const config = TIER_CONFIG[tier] || TIER_CONFIG.watchlist
  const plannedPositions = positions.filter(p => p.status === 'planned' || p.status === 'watchlist')

  if (plannedPositions.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center gap-2 px-3 py-2 border-l-4 ${config.borderClass} rounded-r-md hover:bg-white/5 transition-colors`}
          style={{ backgroundColor: `${config.color}08` }}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
          <span className="text-sm font-bold" style={{ color: config.color }}>{config.label}</span>
          <span className="text-[10px] text-gray-500 ml-1">{config.subtitle}</span>
          <span className="text-[10px] text-gray-600 ml-2">({plannedPositions.length})</span>
        </button>
        <button onClick={() => onAdd(tier)} className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-white bg-white/5 border border-gray-800 rounded-md hover:bg-white/10 transition-colors">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${config.color}40` }}>
                <TH align="left">Stock</TH><TH align="left">Layer</TH><TH>Entry</TH><TH>Shares</TH>
                <TH>Invested</TH><TH>Target</TH><TH>Upside</TH><TH>Exit Value</TH>
                <TH>CGT {'<'}12m</TH><TH>Net {'<'}12m</TH><TH>CGT {'>'}12m</TH><TH>Net {'>'}12m</TH><TH>Stop</TH>
              </tr>
            </thead>
            <tbody>
              {plannedPositions.sort((a, b) => a.sort_order - b.sort_order).map((pos, i) => {
                const entry = pos.entry_price || 0
                const shares = entry > 0 ? Math.floor(pos.planned_deploy / entry) : 0
                const target = scenario === 'bull' ? (pos.exit_target_bull || 0) : (pos.exit_target_base || 0)
                const c = calcRow(entry, shares, target, pos.stop_price, cgtRate, cgtDiscount)

                return (
                  <tr key={pos.id} className="border-b border-gray-800/30 hover:bg-white/[0.03] transition-colors" style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(13,17,23,0.3)' }}>
                    <td className="px-1.5 py-2">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-white text-xs">{pos.ticker}</span>
                        {pos.flag && <span className={`text-[7px] px-1 py-0.5 rounded font-medium ${FLAG_STYLES[pos.flag] || 'bg-white/10 text-gray-400'}`}>{pos.flag}</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <button onClick={() => onDeploy(pos)} className="flex items-center gap-0.5 text-[9px] text-green-500 hover:text-green-400 transition-colors"><Rocket className="w-2.5 h-2.5" /> Deploy</button>
                        <span className="text-gray-700">·</span>
                        <button onClick={() => onEdit(pos)} className="flex items-center gap-0.5 text-[9px] text-gray-500 hover:text-blue-400 transition-colors"><Pencil className="w-2.5 h-2.5" /> Edit</button>
                        <span className="text-gray-700">·</span>
                        <button onClick={() => onRemove(pos)} className="flex items-center gap-0.5 text-[9px] text-gray-500 hover:text-red-400 transition-colors"><Trash2 className="w-2.5 h-2.5" /> Remove</button>
                      </div>
                    </td>
                    <td className="px-1.5 py-2 text-[9px] text-gray-500">{pos.supply_chain_layer}</td>
                    <td className="px-1.5 py-2 text-right font-mono text-gray-400">{entry > 0 ? fmt(entry) : '—'}</td>
                    <td className="px-1.5 py-2 text-right font-mono text-gray-400">{shares > 0 ? shares : '—'}</td>
                    <td className="px-1.5 py-2 text-right font-mono text-gray-400">{c.invested > 0 ? fmt(c.invested) : '—'}</td>
                    <td className="px-1.5 py-2 text-right font-mono text-white">{target > 0 ? fmt(target) : '—'}</td>
                    <td className={`px-1.5 py-2 text-right font-mono font-semibold ${entry > 0 ? upsideColor(c.upside) : 'text-gray-600'}`}>{entry > 0 ? pct(c.upside) : '—'}</td>
                    <td className="px-1.5 py-2 text-right font-mono text-gray-400">{c.exitValue > 0 ? fmt(c.exitValue) : '—'}</td>
                    <td className="px-1.5 py-2 text-right font-mono text-gray-500">{c.gross > 0 ? `-${fmt(c.cgtShort)}` : '—'}</td>
                    <td className={`px-1.5 py-2 text-right font-mono ${c.invested > 0 ? (c.netShort >= 0 ? 'text-gray-400' : 'text-red-400') : 'text-gray-600'}`}>{c.invested > 0 ? fmt(c.netShort) : '—'}</td>
                    <td className="px-1.5 py-2 text-right font-mono text-gray-500">{c.gross > 0 ? `-${fmt(c.cgtLong)}` : '—'}</td>
                    <td className={`px-1.5 py-2 text-right font-mono ${c.invested > 0 ? (c.netLong >= 0 ? 'text-gray-400' : 'text-red-400') : 'text-gray-600'}`}>{c.invested > 0 ? fmt(c.netLong) : '—'}</td>
                    <td className="px-1.5 py-2 text-right">
                      {pos.stop_price ? <span className="font-mono text-red-400 text-[10px]">{fmt(pos.stop_price)}</span> : '—'}
                    </td>
                  </tr>
                )
              })}
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
  const [deployPos, setDeployPos] = useState<Position | null>(null)
  const [editDeployPos, setEditDeployPos] = useState<Position | null>(null)
  const [addTier, setAddTier] = useState<string | null>(null)

  // Deploy form
  const [df, setDf] = useState({ price: '', shares: '', date: new Date().toISOString().split('T')[0] })

  // Edit form
  const [ef, setEf] = useState({ tier: '', deploy: '', entry: '', entryLow: '', entryHigh: '', targetBase: '', targetBull: '', stop: '', notes: '', layer: '', flag: '' })

  // Add form
  const [af, setAf] = useState({ ticker: '', name: '', tier: 'watchlist', layer: '', deploy: '12500', entry: '', targetBase: '', targetBull: '', stop: '', notes: '' })

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const sb = createClient()
    const [{ data: allC }, { data: cData }, { data: pData }] = await Promise.all([
      sb.from('campaigns').select('id, name, start_date, end_date').order('start_date', { ascending: false }),
      sb.from('campaigns').select('*').eq('id', campaignId).single(),
      sb.from('campaign_positions').select('*').eq('campaign_id', campaignId).order('sort_order'),
    ])
    if (allC) setAllCampaigns(allC)
    if (cData) setCampaign(cData)
    if (pData) setPositions(pData)
    setLoading(false)
  }, [campaignId])

  useEffect(() => { fetchData() }, [fetchData])

  // Deployed positions only
  const deployedPositions = useMemo(() => positions.filter(p => p.status === 'deployed' || p.status === 'partial_exit'), [positions])

  // Summary from DEPLOYED only
  const summary = useMemo(() => {
    const cgtRate = campaign?.cgt_rate || 0.37
    const cgtDiscount = campaign?.cgt_discount_rate || 0.185
    let invested = 0, exitVal = 0, gross = 0, cgtLong = 0

    deployedPositions.forEach(pos => {
      const entry = pos.actual_entry_price || 0
      const shares = pos.actual_shares || 0
      const inv = entry * shares
      const target = scenario === 'bull' ? (pos.exit_target_bull || 0) : (pos.exit_target_base || 0)
      const ev = shares * target
      const g = ev - inv
      invested += inv
      exitVal += ev
      gross += g
      if (g > 0) cgtLong += g * cgtDiscount
    })

    return { invested, exitVal, gross, cgtLong, net: gross - cgtLong }
  }, [deployedPositions, scenario, campaign])

  // Grouped by tier (planning only)
  const tiers = useMemo(() => {
    const grouped: Record<string, Position[]> = {}
    positions.forEach(p => {
      const t = p.tier || 'watchlist'
      if (!grouped[t]) grouped[t] = []
      grouped[t].push(p)
    })
    return Object.entries(grouped).sort(([a], [b]) => (TIER_CONFIG[a]?.order || 99) - (TIER_CONFIG[b]?.order || 99))
  }, [positions])

  // ── Deploy action ──
  const openDeploy = (pos: Position) => {
    setDeployPos(pos)
    const price = pos.entry_price || 0
    const shares = price > 0 ? Math.floor(pos.planned_deploy / price) : 0
    setDf({ price: price.toString(), shares: shares.toString(), date: new Date().toISOString().split('T')[0] })
  }

  const saveDeploy = async () => {
    if (!deployPos) return
    const price = parseFloat(df.price) || 0
    const shares = parseInt(df.shares) || 0
    await supabase.from('campaign_positions').update({
      actual_entry_price: price, actual_shares: shares, actual_deployed: price * shares,
      actual_entry_date: df.date, status: 'deployed', updated_at: new Date().toISOString(),
    }).eq('id', deployPos.id)
    setDeployPos(null)
    fetchData()
  }

  // ── Edit deployed position ──
  const openEditDeploy = (pos: Position) => {
    setEditDeployPos(pos)
    setDf({
      price: pos.actual_entry_price?.toString() || '',
      shares: pos.actual_shares?.toString() || '',
      date: pos.actual_entry_date || new Date().toISOString().split('T')[0],
    })
  }

  const saveEditDeploy = async () => {
    if (!editDeployPos) return
    const price = parseFloat(df.price) || 0
    const shares = parseInt(df.shares) || 0
    await supabase.from('campaign_positions').update({
      actual_entry_price: price, actual_shares: shares, actual_deployed: price * shares,
      actual_entry_date: df.date, updated_at: new Date().toISOString(),
    }).eq('id', editDeployPos.id)
    setEditDeployPos(null)
    fetchData()
  }

  // ── Undeploy (revert to planned) ──
  const undeploy = async (pos: Position) => {
    if (!confirm(`Revert ${pos.ticker} to planned?`)) return
    await supabase.from('campaign_positions').update({
      actual_entry_price: null, actual_shares: null, actual_deployed: null,
      actual_entry_date: null, status: 'planned', updated_at: new Date().toISOString(),
    }).eq('id', pos.id)
    fetchData()
  }

  // ── Edit planning position ──
  const openEdit = (pos: Position) => {
    setEditPos(pos)
    setEf({
      tier: pos.tier, deploy: pos.planned_deploy.toString(), entry: pos.entry_price?.toString() || '',
      entryLow: pos.entry_target_low?.toString() || '', entryHigh: pos.entry_target_high?.toString() || '',
      targetBase: pos.exit_target_base?.toString() || '', targetBull: pos.exit_target_bull?.toString() || '',
      stop: pos.stop_price?.toString() || '', notes: pos.notes || '', layer: pos.supply_chain_layer || '', flag: pos.flag || '',
    })
  }

  const saveEdit = async () => {
    if (!editPos) return
    await supabase.from('campaign_positions').update({
      tier: ef.tier, planned_deploy: parseFloat(ef.deploy) || 12500, entry_price: parseFloat(ef.entry) || null,
      entry_target_low: parseFloat(ef.entryLow) || null, entry_target_high: parseFloat(ef.entryHigh) || null,
      exit_target_base: parseFloat(ef.targetBase) || null, exit_target_bull: parseFloat(ef.targetBull) || null,
      stop_price: parseFloat(ef.stop) || null, notes: ef.notes.trim() || null,
      supply_chain_layer: ef.layer.trim() || null, flag: ef.flag.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editPos.id)
    setEditPos(null)
    fetchData()
  }

  // ── Remove ──
  const handleRemove = async (pos: Position) => {
    if (!confirm(`Remove ${pos.ticker}?`)) return
    await supabase.from('campaign_positions').delete().eq('id', pos.id)
    fetchData()
  }

  // ── Add position ──
  const openAdd = (tier: string) => {
    setAddTier(tier)
    setAf({ ticker: '', name: '', tier, layer: '', deploy: '12500', entry: '', targetBase: '', targetBull: '', stop: '', notes: '' })
  }

  const saveAdd = async () => {
    if (!af.ticker.trim()) return
    await supabase.from('campaign_positions').insert({
      campaign_id: campaignId, ticker: af.ticker.trim().toUpperCase(), name: af.name.trim() || null,
      tier: af.tier, supply_chain_layer: af.layer.trim() || null,
      planned_deploy: parseFloat(af.deploy) || 12500, entry_price: parseFloat(af.entry) || null,
      exit_target_base: parseFloat(af.targetBase) || null, exit_target_bull: parseFloat(af.targetBull) || null,
      stop_price: parseFloat(af.stop) || null, notes: af.notes.trim() || null, sort_order: positions.length + 1,
    })
    setAddTier(null)
    fetchData()
  }

  // ── Clone ──
  const cloneCampaign = async () => {
    if (!campaign) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const newStart = new Date(campaign.start_date); newStart.setFullYear(newStart.getFullYear() + 1)
    const newEnd = new Date(campaign.end_date); newEnd.setFullYear(newEnd.getFullYear() + 1)
    const { data: nc } = await supabase.from('campaigns').insert({
      name: campaign.name + ' (Clone)', description: campaign.description,
      start_date: newStart.toISOString().split('T')[0], end_date: newEnd.toISOString().split('T')[0],
      total_budget: campaign.total_budget, status: 'planning',
      cgt_rate: campaign.cgt_rate, cgt_discount_rate: campaign.cgt_discount_rate, user_id: user.id,
    }).select().single()
    if (nc) {
      const cloned = positions.map(({ id, campaign_id, actual_entry_price, actual_shares, actual_deployed, actual_entry_date, actual_exit_price, actual_exit_date, status, ...rest }) => ({
        ...rest, campaign_id: nc.id, status: 'planned',
      }))
      await supabase.from('campaign_positions').insert(cloned)
      router.push(`/campaigns/${nc.id}`)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>
  }
  if (!campaign) {
    return <div className="text-center py-20"><p className="text-gray-400">Campaign not found</p></div>
  }

  const cgtRate = campaign.cgt_rate || 0.37
  const cgtDiscount = campaign.cgt_discount_rate || 0.185

  return (
    <div className="space-y-4 pb-20">
      {/* ════ TOP CONTROLS ════ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="text-gray-500 hover:text-gray-300"><ArrowLeft className="w-4 h-4" /></Link>
          <select value={campaignId} onChange={(e) => router.push(`/campaigns/${e.target.value}`)}
            className="px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500">
            {allCampaigns.map(c => <option key={c.id} value={c.id}>{getFY(c.start_date)} — {c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-black/30 rounded-lg p-0.5 border border-gray-800">
            <button onClick={() => setScenario('base')} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${scenario === 'base' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'}`}>Base Case</button>
            <button onClick={() => setScenario('bull')} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${scenario === 'bull' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-gray-500 hover:text-gray-300'}`}>Bull Case</button>
          </div>
          <button onClick={cloneCampaign} className="flex items-center gap-1 px-3 py-1.5 bg-white/5 border border-gray-800 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <Copy className="w-3 h-3" /> Clone
          </button>
        </div>
      </div>

      <p className="text-[10px] text-gray-600">
        {deployedPositions.length > 0
          ? `${deployedPositions.length} deployed position${deployedPositions.length !== 1 ? 's' : ''} • ${fmt(summary.invested)} invested`
          : 'No positions deployed yet'
        } • {scenario === 'bull' ? 'Bull' : 'Base'} case • CGT discount {(cgtDiscount * 100).toFixed(1)}% applied • {new Date(campaign.start_date).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })} → {new Date(campaign.end_date).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
      </p>

      {/* ════ SUMMARY BAR (from deployed only) ════ */}
      <div className="grid grid-cols-5 gap-px bg-gray-800 rounded-xl overflow-hidden">
        {[
          { label: 'TOTAL DEPLOYED', value: deployedPositions.length > 0 ? fmt(summary.invested) : '—', color: 'text-white' },
          { label: 'CAMPAIGN EXIT VALUE', value: deployedPositions.length > 0 ? fmt(summary.exitVal) : '—', color: 'text-blue-400' },
          { label: 'RAW PROFIT', value: deployedPositions.length > 0 ? fmt(summary.gross) : '—', color: summary.gross >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: `CGT (${(cgtDiscount * 100).toFixed(1)}%)`, value: deployedPositions.length > 0 ? (summary.cgtLong > 0 ? `-${fmt(summary.cgtLong)}` : '$0') : '—', color: 'text-red-400' },
          { label: 'TRUE NET POST-TAX', value: deployedPositions.length > 0 ? fmt(summary.net) : '—', color: summary.net >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map((item, i) => (
          <div key={i} className="bg-[#0d0d15] p-4 text-center">
            <p className="text-[9px] text-gray-600 font-semibold tracking-wider mb-1">{item.label}</p>
            <p className={`font-bold font-mono ${item.color} ${i === 4 ? 'text-xl' : 'text-base'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ════ DEPLOYMENT SECTION ════ */}
      <div className="bg-[#0d1117] border border-green-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-green-400" />
            <h2 className="text-sm font-bold text-green-400 uppercase tracking-wider">Deployed Positions</h2>
            <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-medium">{deployedPositions.length} active</span>
          </div>
          <p className="text-[10px] text-gray-600">These are real capital commitments. Totals feed the summary above.</p>
        </div>

        {deployedPositions.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-gray-800 rounded-lg">
            <Rocket className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-xs">No positions deployed yet</p>
            <p className="text-gray-600 text-[10px] mt-1">Click Deploy on any planned position below to commit capital</p>
          </div>
        ) : (
          <DeploymentTable
            positions={deployedPositions}
            scenario={scenario}
            cgtRate={cgtRate}
            cgtDiscount={cgtDiscount}
            onEditDeploy={openEditDeploy}
            onUndeploy={undeploy}
          />
        )}
      </div>

      {/* ════ PLANNING / TIER SECTIONS ════ */}
      <div className="flex items-center gap-2 mt-2">
        <Target className="w-4 h-4 text-gray-500" />
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Research & Planning</h2>
        <span className="text-[10px] text-gray-600">(speculative — does not affect totals above)</span>
      </div>

      {tiers.map(([tier, tierPositions]) => (
        <TierTable
          key={tier} tier={tier} positions={tierPositions} scenario={scenario}
          cgtRate={cgtRate} cgtDiscount={cgtDiscount}
          onEdit={openEdit} onRemove={handleRemove} onAdd={openAdd} onDeploy={openDeploy}
        />
      ))}

      {/* ════ DEPLOY MODAL ════ */}
      {(deployPos || editDeployPos) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => { setDeployPos(null); setEditDeployPos(null) }} />
          <div className="relative bg-[#1c1c28] border border-gray-700 rounded-xl w-full max-w-md p-5">
            <h3 className="text-base font-bold text-white mb-1">
              {editDeployPos ? `Edit Deployment — ${editDeployPos.ticker}` : `Deploy ${deployPos?.ticker}`}
            </h3>
            <p className="text-xs text-gray-500 mb-4">{editDeployPos ? 'Update actual values' : 'Enter actual entry details to commit capital'}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entry Price ($)</label>
                <input type="number" value={df.price} onChange={(e) => {
                  const p = e.target.value; setDf(prev => ({ ...prev, price: p }))
                  const price = parseFloat(p)
                  if (price > 0) {
                    const pos = deployPos || editDeployPos
                    const shares = Math.floor((pos?.planned_deploy || 12500) / price)
                    setDf(prev => ({ ...prev, price: p, shares: shares.toString() }))
                  }
                }} step="any" className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Shares</label>
                <input type="number" value={df.shares} onChange={(e) => setDf({ ...df, shares: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entry Date</label>
                <input type="date" value={df.date} onChange={(e) => setDf({ ...df, date: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
              {df.price && df.shares && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 text-xs text-gray-400">
                  Capital committed: <span className="text-green-400 font-mono font-bold">{fmt(parseFloat(df.price) * parseInt(df.shares))}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setDeployPos(null); setEditDeployPos(null) }} className="px-3 py-2 text-gray-400 text-sm">Cancel</button>
              <button onClick={editDeployPos ? saveEditDeploy : saveDeploy}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-colors flex items-center gap-1.5">
                <Check className="w-4 h-4" /> {editDeployPos ? 'Save' : 'Deploy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ EDIT PLANNING MODAL ════ */}
      {editPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setEditPos(null)} />
          <div className="relative bg-[#1c1c28] border border-gray-700 rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-4">Edit {editPos.ticker} <span className="text-gray-500 font-normal text-sm">{editPos.name}</span></h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Tier', value: ef.tier, key: 'tier', type: 'select', options: ['anchor', 'tier1_ripper', 'tier2_sneak', 'watchlist'] },
                { label: 'Planned Deploy ($)', value: ef.deploy, key: 'deploy' },
                { label: 'Entry Price ($)', value: ef.entry, key: 'entry' },
                { label: 'Supply Chain Layer', value: ef.layer, key: 'layer', text: true },
                { label: 'Entry Low ($)', value: ef.entryLow, key: 'entryLow' },
                { label: 'Entry High ($)', value: ef.entryHigh, key: 'entryHigh' },
                { label: 'Base Target ($)', value: ef.targetBase, key: 'targetBase' },
                { label: 'Bull Target ($)', value: ef.targetBull, key: 'targetBull' },
                { label: 'Stop Price ($)', value: ef.stop, key: 'stop' },
                { label: 'Flag', value: ef.flag, key: 'flag', text: true },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={field.value} onChange={(e) => setEf({ ...ef, [field.key]: e.target.value })} className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                      {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={field.text ? 'text' : 'number'} value={field.value} onChange={(e) => setEf({ ...ef, [field.key]: e.target.value })} step="any"
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
                  <input type={field.num ? 'number' : 'text'} value={field.value}
                    onChange={(e) => setAf({ ...af, [field.key]: field.upper ? e.target.value.toUpperCase() : e.target.value })} step="any"
                    className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
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
        Campaign Tracker • CGT {'<'}12m: {(cgtRate * 100).toFixed(0)}% • CGT {'>'}12m: {(cgtDiscount * 100).toFixed(1)}% • Not financial advice
      </p>
    </div>
  )
}
