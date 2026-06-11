'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  Shield,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  Crosshair,
  Calculator,
  Globe,
  Zap,
  AlertTriangle,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════

interface Campaign {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  total_budget: number | null
  status: string
  cgt_rate: number
  cgt_discount_rate: number
}

interface Position {
  id: string
  campaign_id: string
  ticker: string
  name: string | null
  tier: string
  supply_chain_layer: string | null
  flag: string | null
  planned_deploy: number
  entry_target_low: number | null
  entry_target_high: number | null
  exit_target_base: number | null
  exit_target_bull: number | null
  stop_price: number | null
  notes: string | null
  actual_entry_price: number | null
  actual_shares: number | null
  actual_deployed: number | null
  actual_entry_date: string | null
  actual_exit_price: number | null
  actual_exit_date: string | null
  status: string
  current_price: number | null
  sort_order: number
}

interface LivePrice {
  symbol: string
  currentPrice: number
  change: number
  changePercent: number
}

const TIER_CONFIG: Record<string, { label: string; subtitle: string; color: string; border: string; bg: string; order: number }> = {
  anchor: { label: 'ANCHORS', subtitle: 'Core Bedrock / Capital Preservers', color: '#58a6ff', border: 'border-l-blue-400', bg: 'bg-blue-500/5', order: 1 },
  tier1_ripper: { label: 'TIER 1 RIPPERS', subtitle: 'High-Velocity Physical Bottlenecks', color: '#f0883e', border: 'border-l-orange-400', bg: 'bg-orange-500/5', order: 2 },
  tier2_sneak: { label: 'TIER 2 SNEAK INS', subtitle: 'Narrow-Entry Watchlist / Macro Flash-Crash', color: '#bc8cff', border: 'border-l-purple-400', bg: 'bg-purple-500/5', order: 3 },
  watchlist: { label: 'WATCHLIST', subtitle: 'Under observation', color: '#6b7280', border: 'border-l-gray-500', bg: 'bg-white/5', order: 4 },
}

const STATUS_STYLES: Record<string, string> = {
  planned: 'bg-white/10 text-gray-400',
  deployed: 'bg-blue-500/15 text-blue-400',
  partial_exit: 'bg-yellow-500/15 text-yellow-400',
  exited: 'bg-green-500/15 text-green-400',
  stopped_out: 'bg-red-500/15 text-red-400',
  watchlist: 'bg-white/5 text-gray-500',
}

const FLAG_STYLES: Record<string, string> = {
  'CAVALRY-RISK': 'bg-red-500/15 text-red-400',
  'PRE-REVENUE': 'bg-red-500/15 text-red-400',
  'HIGH-VAL': 'bg-orange-500/15 text-orange-400',
  'EXTENDED': 'bg-orange-500/15 text-orange-400',
  'ABOVE-CONSENSUS': 'bg-orange-500/15 text-orange-400',
  'DIVERSIFIER': 'bg-green-500/15 text-green-400',
  'DEMAND-SIDE': 'bg-blue-500/15 text-blue-400',
}

function fmt(n: number): string { return '$' + Math.round(n).toLocaleString('en-AU') }
function fmtDec(n: number): string { return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function pct(n: number): string { return (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%' }

// ═══════════════════════════════════════════════════════════════
// TIER SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════

function TierSection({
  tier,
  positions,
  livePrices,
  scenario,
  cgtRate,
  cgtDiscount,
  onDeploy,
  onExit,
  onRemove,
  onEdit,
}: {
  tier: string
  positions: Position[]
  livePrices: Map<string, LivePrice>
  scenario: 'base' | 'bull'
  cgtRate: number
  cgtDiscount: number
  onDeploy: (pos: Position) => void
  onExit: (pos: Position) => void
  onRemove: (pos: Position) => void
  onEdit: (pos: Position) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const config = TIER_CONFIG[tier] || TIER_CONFIG.watchlist

  if (positions.length === 0) return null

  const tierTotals = positions.reduce((acc, pos) => {
    const price = livePrices.get(pos.ticker)?.currentPrice || pos.current_price || 0
    const entryPrice = pos.actual_entry_price || price
    const shares = pos.actual_shares || Math.floor(pos.planned_deploy / (entryPrice || 1))
    const invested = pos.actual_deployed || pos.planned_deploy
    const target = scenario === 'bull' ? (pos.exit_target_bull || 0) : (pos.exit_target_base || 0)
    const currentValue = shares * price
    const targetValue = shares * target
    const unrealised = currentValue - invested

    acc.invested += invested
    acc.currentValue += currentValue
    acc.targetValue += targetValue
    acc.unrealised += unrealised
    return acc
  }, { invested: 0, currentValue: 0, targetValue: 0, unrealised: 0 })

  return (
    <div className="mb-4">
      {/* Tier Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between p-3 ${config.bg} border-l-4 ${config.border} rounded-r-lg hover:bg-white/5 transition-colors`}
      >
        <div className="flex items-center gap-3">
          {collapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          <div className="text-left">
            <span className="text-sm font-bold" style={{ color: config.color }}>{config.label}</span>
            <span className="text-xs text-gray-500 ml-2">{config.subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div className="text-right">
            <span className="text-gray-500">Deployed: </span>
            <span className="text-white font-mono font-medium">{fmt(tierTotals.invested)}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-500">Current: </span>
            <span className="text-white font-mono font-medium">{fmt(tierTotals.currentValue)}</span>
          </div>
          <div className="text-right">
            <span className={`font-mono font-medium ${tierTotals.unrealised >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(tierTotals.unrealised)}
            </span>
          </div>
        </div>
      </button>

      {/* Position Table */}
      {!collapsed && (
        <div className="overflow-x-auto mt-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800/50">
                {['Stock', 'Layer', 'Status', 'Entry', 'Current', 'P&L', 'Base Target', 'Bull Target', 'Upside', 'Stop', 'Actions'].map(h => (
                  <th key={h} className="px-2 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.sort((a, b) => a.sort_order - b.sort_order).map((pos) => {
                const live = livePrices.get(pos.ticker)
                const price = live?.currentPrice || pos.current_price || 0
                const entryPrice = pos.actual_entry_price || price
                const shares = pos.actual_shares || Math.floor(pos.planned_deploy / (entryPrice || 1))
                const invested = pos.actual_deployed || pos.planned_deploy
                const currentValue = shares * price
                const unrealised = currentValue - invested
                const unrealisedPct = invested > 0 ? unrealised / invested : 0
                const target = scenario === 'bull' ? pos.exit_target_bull : pos.exit_target_base
                const upsideToTarget = target && price > 0 ? (target - price) / price : 0
                const stopRisk = pos.stop_price && price > 0 ? (pos.stop_price - price) / price : 0
                const isDeployed = pos.status === 'deployed' || pos.status === 'partial_exit'

                return (
                  <tr key={pos.id} className="border-b border-gray-800/30 hover:bg-white/5 transition-colors">
                    {/* Stock */}
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-white text-sm">{pos.ticker}</span>
                        {pos.flag && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${FLAG_STYLES[pos.flag] || 'bg-white/10 text-gray-400'}`}>
                            {pos.flag}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{pos.name}</p>
                    </td>

                    {/* Layer */}
                    <td className="px-2 py-2.5 text-[10px] text-gray-500">{pos.supply_chain_layer}</td>

                    {/* Status */}
                    <td className="px-2 py-2.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[pos.status] || STATUS_STYLES.planned}`}>
                        {pos.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>

                    {/* Entry */}
                    <td className="px-2 py-2.5 text-right">
                      {isDeployed ? (
                        <div>
                          <span className="font-mono text-white">{fmtDec(pos.actual_entry_price || 0)}</span>
                          <p className="text-[9px] text-gray-600">{pos.actual_shares} shares</p>
                        </div>
                      ) : (
                        <div>
                          <span className="font-mono text-gray-400">
                            {pos.entry_target_low && pos.entry_target_high
                              ? `${fmt(pos.entry_target_low)}–${fmt(pos.entry_target_high)}`
                              : fmt(pos.planned_deploy)}
                          </span>
                          <p className="text-[9px] text-gray-600">target range</p>
                        </div>
                      )}
                    </td>

                    {/* Current Price */}
                    <td className="px-2 py-2.5 text-right">
                      <span className="font-mono text-white">{price > 0 ? fmtDec(price) : '—'}</span>
                      {live && (
                        <p className={`text-[9px] font-mono ${live.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {live.changePercent >= 0 ? '+' : ''}{live.changePercent.toFixed(1)}%
                        </p>
                      )}
                    </td>

                    {/* P&L */}
                    <td className="px-2 py-2.5 text-right">
                      {isDeployed && price > 0 ? (
                        <div>
                          <span className={`font-mono font-bold ${unrealised >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {fmt(unrealised)}
                          </span>
                          <p className={`text-[9px] font-mono ${unrealisedPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pct(unrealisedPct)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    {/* Base Target */}
                    <td className="px-2 py-2.5 text-right font-mono text-gray-300">
                      {pos.exit_target_base ? fmt(pos.exit_target_base) : '—'}
                    </td>

                    {/* Bull Target */}
                    <td className="px-2 py-2.5 text-right font-mono text-gray-300">
                      {pos.exit_target_bull ? fmt(pos.exit_target_bull) : '—'}
                    </td>

                    {/* Upside to target */}
                    <td className="px-2 py-2.5 text-right">
                      {upsideToTarget ? (
                        <span className={`font-mono font-bold ${
                          upsideToTarget >= 0.5 ? 'text-purple-400' : upsideToTarget >= 0.2 ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                          {pct(upsideToTarget)}
                        </span>
                      ) : '—'}
                    </td>

                    {/* Stop */}
                    <td className="px-2 py-2.5 text-right">
                      {pos.stop_price ? (
                        <div>
                          <span className="font-mono text-red-400">{fmt(pos.stop_price)}</span>
                          <p className="text-[9px] font-mono text-gray-600">{stopRisk ? pct(stopRisk) : ''}</p>
                        </div>
                      ) : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1">
                        {pos.status === 'planned' && (
                          <button
                            onClick={() => onDeploy(pos)}
                            className="px-1.5 py-0.5 bg-green-500/15 text-green-400 text-[9px] rounded font-medium hover:bg-green-500/25 transition-colors"
                            title="Mark as Deployed"
                          >
                            Deploy
                          </button>
                        )}
                        {isDeployed && (
                          <button
                            onClick={() => onExit(pos)}
                            className="px-1.5 py-0.5 bg-blue-500/15 text-blue-400 text-[9px] rounded font-medium hover:bg-blue-500/25 transition-colors"
                            title="Mark as Exited"
                          >
                            Exit
                          </button>
                        )}
                        <button
                          onClick={() => onEdit(pos)}
                          className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <Link
                          href={`/trade-simulator?tab=pullback&ticker=${pos.ticker}`}
                          className="p-1 text-gray-600 hover:text-blue-400 transition-colors"
                          title="Pullback Calculator"
                        >
                          <Crosshair className="w-3 h-3" />
                        </Link>
                      </div>
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

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map())
  const [loading, setLoading] = useState(true)
  const [pricesLoading, setPricesLoading] = useState(false)
  const [scenario, setScenario] = useState<'base' | 'bull'>('base')

  // Modal state
  const [editingPos, setEditingPos] = useState<Position | null>(null)
  const [deployingPos, setDeployingPos] = useState<Position | null>(null)
  const [exitingPos, setExitingPos] = useState<Position | null>(null)
  const [showAddPosition, setShowAddPosition] = useState(false)

  // Deploy form
  const [deployPrice, setDeployPrice] = useState('')
  const [deployShares, setDeployShares] = useState('')
  const [deployDate, setDeployDate] = useState(new Date().toISOString().split('T')[0])

  // Exit form
  const [exitPrice, setExitPrice] = useState('')
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0])

  // Add position form
  const [addTicker, setAddTicker] = useState('')
  const [addName, setAddName] = useState('')
  const [addTier, setAddTier] = useState('watchlist')
  const [addLayer, setAddLayer] = useState('')
  const [addDeploy, setAddDeploy] = useState('12500')
  const [addEntryLow, setAddEntryLow] = useState('')
  const [addEntryHigh, setAddEntryHigh] = useState('')
  const [addTargetBase, setAddTargetBase] = useState('')
  const [addTargetBull, setAddTargetBull] = useState('')
  const [addStop, setAddStop] = useState('')
  const [addNotes, setAddNotes] = useState('')

  // Edit form
  const [editEntryLow, setEditEntryLow] = useState('')
  const [editEntryHigh, setEditEntryHigh] = useState('')
  const [editTargetBase, setEditTargetBase] = useState('')
  const [editTargetBull, setEditTargetBull] = useState('')
  const [editStop, setEditStop] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editTier, setEditTier] = useState('')
  const [editDeploy, setEditDeploy] = useState('')

  const fetchData = useCallback(async () => {
    const supabase = createClient()

    const { data: cData } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (cData) setCampaign(cData)

    const { data: pData } = await supabase
      .from('campaign_positions')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true })

    if (pData) setPositions(pData)
    setLoading(false)
  }, [campaignId])

  const fetchPrices = useCallback(async () => {
    if (positions.length === 0) return
    setPricesLoading(true)

    try {
      const tickers = positions.map(p => p.ticker)
      const res = await fetch('/api/signal-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: tickers }),
      })

      if (res.ok) {
        const data = await res.json()
        const priceMap = new Map<string, LivePrice>()
        for (const s of data.stocks || []) {
          priceMap.set(s.symbol, {
            symbol: s.symbol,
            currentPrice: s.currentPrice,
            change: s.change,
            changePercent: s.changePercent,
          })
        }
        setLivePrices(priceMap)
      }
    } catch (err) {
      console.error('Price fetch error:', err)
    } finally {
      setPricesLoading(false)
    }
  }, [positions])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (positions.length > 0) fetchPrices() }, [positions.length]) // eslint-disable-line

  // ── Calculations ──
  const totals = useMemo(() => {
    let totalPlanned = 0, totalDeployed = 0, currentValue = 0, grossProfit = 0, cgtPayable = 0
    const cgtRate = campaign?.cgt_rate || 0.325
    const cgtDiscount = campaign?.cgt_discount_rate || 0.1625

    positions.forEach(pos => {
      const price = livePrices.get(pos.ticker)?.currentPrice || pos.current_price || 0
      const isDeployed = pos.status === 'deployed' || pos.status === 'partial_exit'
      const entryPrice = pos.actual_entry_price || price
      const shares = pos.actual_shares || Math.floor(pos.planned_deploy / (entryPrice || 1))
      const invested = pos.actual_deployed || pos.planned_deploy
      const target = scenario === 'bull' ? (pos.exit_target_bull || 0) : (pos.exit_target_base || 0)

      totalPlanned += pos.planned_deploy
      totalDeployed += isDeployed ? invested : 0
      currentValue += isDeployed ? shares * price : 0

      // Projected net uses target price
      const projGross = shares * target - invested
      if (projGross > 0) {
        cgtPayable += projGross * cgtDiscount
      }
      grossProfit += projGross
    })

    const netAfterCgt = grossProfit - cgtPayable
    const unrealised = currentValue - totalDeployed

    return { totalPlanned, totalDeployed, currentValue, unrealised, grossProfit, cgtPayable, netAfterCgt }
  }, [positions, livePrices, scenario, campaign])

  // ── Group positions by tier ──
  const tiers = useMemo(() => {
    const grouped: Record<string, Position[]> = {}
    positions.forEach(pos => {
      const tier = pos.tier || 'watchlist'
      if (!grouped[tier]) grouped[tier] = []
      grouped[tier].push(pos)
    })

    return Object.entries(grouped)
      .sort(([a], [b]) => (TIER_CONFIG[a]?.order || 99) - (TIER_CONFIG[b]?.order || 99))
  }, [positions])

  // ── Action handlers ──
  const handleDeploy = async () => {
    if (!deployingPos) return
    const supabase = createClient()
    const price = parseFloat(deployPrice) || 0
    const shares = parseInt(deployShares) || 0

    await supabase
      .from('campaign_positions')
      .update({
        actual_entry_price: price,
        actual_shares: shares,
        actual_deployed: price * shares,
        actual_entry_date: deployDate,
        status: 'deployed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', deployingPos.id)

    setDeployingPos(null)
    setDeployPrice('')
    setDeployShares('')
    fetchData()
  }

  const handleExit = async () => {
    if (!exitingPos) return
    const supabase = createClient()

    await supabase
      .from('campaign_positions')
      .update({
        actual_exit_price: parseFloat(exitPrice) || 0,
        actual_exit_date: exitDate,
        status: 'exited',
        updated_at: new Date().toISOString(),
      })
      .eq('id', exitingPos.id)

    setExitingPos(null)
    setExitPrice('')
    fetchData()
  }

  const handleRemove = async (pos: Position) => {
    if (!confirm(`Remove ${pos.ticker} from this campaign?`)) return
    const supabase = createClient()
    await supabase.from('campaign_positions').delete().eq('id', pos.id)
    fetchData()
  }

  const handleAddPosition = async () => {
    if (!addTicker.trim()) return
    const supabase = createClient()

    await supabase.from('campaign_positions').insert({
      campaign_id: campaignId,
      ticker: addTicker.trim().toUpperCase(),
      name: addName.trim() || null,
      tier: addTier,
      supply_chain_layer: addLayer.trim() || null,
      planned_deploy: parseFloat(addDeploy) || 12500,
      entry_target_low: parseFloat(addEntryLow) || null,
      entry_target_high: parseFloat(addEntryHigh) || null,
      exit_target_base: parseFloat(addTargetBase) || null,
      exit_target_bull: parseFloat(addTargetBull) || null,
      stop_price: parseFloat(addStop) || null,
      notes: addNotes.trim() || null,
      sort_order: positions.length + 1,
    })

    setShowAddPosition(false)
    setAddTicker(''); setAddName(''); setAddTier('watchlist'); setAddLayer('')
    setAddDeploy('12500'); setAddEntryLow(''); setAddEntryHigh('')
    setAddTargetBase(''); setAddTargetBull(''); setAddStop(''); setAddNotes('')
    fetchData()
  }

  const handleSaveEdit = async () => {
    if (!editingPos) return
    const supabase = createClient()

    await supabase
      .from('campaign_positions')
      .update({
        tier: editTier || editingPos.tier,
        planned_deploy: parseFloat(editDeploy) || editingPos.planned_deploy,
        entry_target_low: parseFloat(editEntryLow) || null,
        entry_target_high: parseFloat(editEntryHigh) || null,
        exit_target_base: parseFloat(editTargetBase) || null,
        exit_target_bull: parseFloat(editTargetBull) || null,
        stop_price: parseFloat(editStop) || null,
        notes: editNotes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingPos.id)

    setEditingPos(null)
    fetchData()
  }

  const openEdit = (pos: Position) => {
    setEditingPos(pos)
    setEditTier(pos.tier)
    setEditDeploy(pos.planned_deploy.toString())
    setEditEntryLow(pos.entry_target_low?.toString() || '')
    setEditEntryHigh(pos.entry_target_high?.toString() || '')
    setEditTargetBase(pos.exit_target_base?.toString() || '')
    setEditTargetBull(pos.exit_target_bull?.toString() || '')
    setEditStop(pos.stop_price?.toString() || '')
    setEditNotes(pos.notes || '')
  }

  const openDeploy = (pos: Position) => {
    setDeployingPos(pos)
    const price = livePrices.get(pos.ticker)?.currentPrice || 0
    setDeployPrice(price.toString())
    const shares = price > 0 ? Math.floor(pos.planned_deploy / price) : 0
    setDeployShares(shares.toString())
    setDeployDate(new Date().toISOString().split('T')[0])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Campaign not found</p>
        <Link href="/campaigns" className="text-blue-400 text-sm mt-2 inline-block">Back to campaigns</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/campaigns" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to campaigns
          </Link>
          <h1 className="text-xl font-bold text-white">{campaign.name}</h1>
          {campaign.description && <p className="text-xs text-gray-500 mt-0.5">{campaign.description}</p>}
          <p className="text-xs text-gray-600 font-mono mt-1">
            {new Date(campaign.start_date).toLocaleDateString('en-AU')} → {new Date(campaign.end_date).toLocaleDateString('en-AU')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scenario Toggle */}
          <div className="flex items-center bg-black/30 rounded-lg p-0.5 border border-gray-800">
            <button
              onClick={() => setScenario('base')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                scenario === 'base' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Base Case
            </button>
            <button
              onClick={() => setScenario('bull')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                scenario === 'bull' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Bull Case
            </button>
          </div>
          <button
            onClick={fetchPrices}
            disabled={pricesLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-gray-700 text-gray-300 text-xs rounded-lg hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${pricesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddPosition(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Position
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-5 gap-px bg-gray-800 rounded-xl overflow-hidden">
        {[
          { label: 'TOTAL PLANNED', value: fmt(totals.totalPlanned), color: 'text-white' },
          { label: 'ACTUAL DEPLOYED', value: fmt(totals.totalDeployed), color: 'text-blue-400' },
          { label: 'CURRENT VALUE', value: fmt(totals.currentValue), color: 'text-white' },
          { label: 'UNREALISED P&L', value: fmt(totals.unrealised), color: totals.unrealised >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: `NET AFTER CGT (${scenario.toUpperCase()})`, value: fmt(totals.netAfterCgt), color: totals.netAfterCgt >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map((item, i) => (
          <div key={i} className="bg-[#0d0d15] p-4 text-center">
            <p className="text-[9px] text-gray-600 font-medium tracking-wider mb-1">{item.label}</p>
            <p className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Tier Sections */}
      {tiers.map(([tier, tierPositions]) => (
        <TierSection
          key={tier}
          tier={tier}
          positions={tierPositions}
          livePrices={livePrices}
          scenario={scenario}
          cgtRate={campaign.cgt_rate}
          cgtDiscount={campaign.cgt_discount_rate}
          onDeploy={openDeploy}
          onExit={(pos) => { setExitingPos(pos); setExitDate(new Date().toISOString().split('T')[0]); setExitPrice('') }}
          onRemove={handleRemove}
          onEdit={openEdit}
        />
      ))}

      {/* ═══ DEPLOY MODAL ═══ */}
      {deployingPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setDeployingPos(null)} />
          <div className="relative bg-[#1c1c28] border border-gray-700 rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="text-base font-bold text-white mb-1">Deploy {deployingPos.ticker}</h3>
            <p className="text-xs text-gray-500 mb-4">Record actual entry details</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entry Price ($)</label>
                <input type="number" value={deployPrice} onChange={(e) => setDeployPrice(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Shares</label>
                <input type="number" value={deployShares} onChange={(e) => setDeployShares(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entry Date</label>
                <input type="date" value={deployDate} onChange={(e) => setDeployDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
              {deployPrice && deployShares && (
                <div className="bg-white/5 rounded-lg p-3 text-xs text-gray-400">
                  Total deployed: <span className="text-white font-mono font-medium">{fmt(parseFloat(deployPrice) * parseInt(deployShares))}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setDeployingPos(null)} className="px-3 py-2 text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={handleDeploy} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-colors flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Deploy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EXIT MODAL ═══ */}
      {exitingPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setExitingPos(null)} />
          <div className="relative bg-[#1c1c28] border border-gray-700 rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="text-base font-bold text-white mb-1">Exit {exitingPos.ticker}</h3>
            <p className="text-xs text-gray-500 mb-4">Record sale details</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Exit Price ($)</label>
                <input type="number" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Exit Date</label>
                <input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setExitingPos(null)} className="px-3 py-2 text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={handleExit} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Confirm Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT MODAL ═══ */}
      {editingPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setEditingPos(null)} />
          <div className="relative bg-[#1c1c28] border border-gray-700 rounded-xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-1">Edit {editingPos.ticker}</h3>
            <p className="text-xs text-gray-500 mb-4">{editingPos.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tier</label>
                <select value={editTier} onChange={(e) => setEditTier(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                  <option value="anchor">Anchor</option>
                  <option value="tier1_ripper">Tier 1 Ripper</option>
                  <option value="tier2_sneak">Tier 2 Sneak In</option>
                  <option value="watchlist">Watchlist</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Planned Deploy ($)</label>
                <input type="number" value={editDeploy} onChange={(e) => setEditDeploy(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entry Low ($)</label>
                <input type="number" value={editEntryLow} onChange={(e) => setEditEntryLow(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entry High ($)</label>
                <input type="number" value={editEntryHigh} onChange={(e) => setEditEntryHigh(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Base Target ($)</label>
                <input type="number" value={editTargetBase} onChange={(e) => setEditTargetBase(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bull Target ($)</label>
                <input type="number" value={editTargetBull} onChange={(e) => setEditTargetBull(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stop Price ($)</label>
                <input type="number" value={editStop} onChange={(e) => setEditStop(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => handleRemove(editingPos)} className="px-3 py-2 text-red-400 text-sm hover:text-red-300 transition-colors flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingPos(null)} className="px-3 py-2 text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
                <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD POSITION MODAL ═══ */}
      {showAddPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setShowAddPosition(false)} />
          <div className="relative bg-[#1c1c28] border border-gray-700 rounded-xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-4">Add Position</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ticker *</label>
                <input type="text" value={addTicker} onChange={(e) => setAddTicker(e.target.value.toUpperCase())} placeholder="e.g. AAPL"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Company Name</label>
                <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tier</label>
                <select value={addTier} onChange={(e) => setAddTier(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                  <option value="anchor">Anchor</option>
                  <option value="tier1_ripper">Tier 1 Ripper</option>
                  <option value="tier2_sneak">Tier 2 Sneak In</option>
                  <option value="watchlist">Watchlist</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Supply Chain Layer</label>
                <input type="text" value={addLayer} onChange={(e) => setAddLayer(e.target.value)} placeholder="e.g. Silicon"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Planned Deploy ($)</label>
                <input type="number" value={addDeploy} onChange={(e) => setAddDeploy(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stop Price ($)</label>
                <input type="number" value={addStop} onChange={(e) => setAddStop(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entry Low ($)</label>
                <input type="number" value={addEntryLow} onChange={(e) => setAddEntryLow(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entry High ($)</label>
                <input type="number" value={addEntryHigh} onChange={(e) => setAddEntryHigh(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Base Target ($)</label>
                <input type="number" value={addTargetBase} onChange={(e) => setAddTargetBase(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bull Target ($)</label>
                <input type="number" value={addTargetBull} onChange={(e) => setAddTargetBull(e.target.value)} step="any"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea value={addNotes} onChange={(e) => setAddNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddPosition(false)} className="px-3 py-2 text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={handleAddPosition} disabled={!addTicker.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add Position
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Campaign Tracker • CGT Rate: {((campaign.cgt_rate || 0.325) * 100).toFixed(1)}% • Discount: {((campaign.cgt_discount_rate || 0.1625) * 100).toFixed(2)}% • Not financial advice
      </p>
    </div>
  )
}
