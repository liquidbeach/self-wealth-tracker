'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Layers, AlertTriangle, RefreshCw, Check, X, Pencil,
  History, ChevronDown, ChevronUp, Info, Shuffle,
} from 'lucide-react'

// ---------- constants ----------
const PILLARS = ['bedrock', 'momentum', 'annuity'] as const
type Pillar = typeof PILLARS[number]

const META: Record<Pillar, { label: string; color: string; job: string }> = {
  bedrock:  { label: 'Bedrock',  color: '#58a6ff', job: 'Compound quietly, survive drawdowns' },
  momentum: { label: 'Momentum', color: '#f0883e', job: 'Capital velocity' },
  annuity:  { label: 'Annuity',  color: '#238636', job: 'Income, ballast, franking credits' },
}

const fmtAUD = (n: number) =>
  'A$' + Math.round(n).toLocaleString('en-AU')
const fmtK = (n: number) =>
  n >= 1000 ? 'A$' + (n / 1000).toFixed(0) + 'K' : 'A$' + Math.round(n)
const pts = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1)

// ---------- types ----------
interface Lot { units: number; purchase_price: number }
interface Holding {
  id: string; ticker: string; name: string; currency: string
  pillar: string | null; current_price: number | null; lots: Lot[]
}
interface Target {
  id: string; pillar: Pillar; target_pct: number
  band_lower_pct: number; band_upper_pct: number
}
interface Regime {
  id: string; name: string
  bedrock_pct: number; momentum_pct: number; annuity_pct: number
  trigger_portfolio_value: number | null; is_active: boolean
}
interface AuditRow {
  id: string; action: string; reason: string
  old_values: any; new_values: any; created_at: string
}

export default function PillarPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [holdings, setHoldings] = useState<Holding[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [rates, setRates] = useState<Record<string, number>>({ AUD: 1 })
  const [targets, setTargets] = useState<Target[]>([])
  const [regimes, setRegimes] = useState<Regime[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])

  const [showAudit, setShowAudit] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showRegime, setShowRegime] = useState(false)
  const [showEditTargets, setShowEditTargets] = useState(false)

  // ---------- load ----------
  const load = useCallback(async () => {
    setError(null)
    try {
      const sb = createClient()

      const [hRes, tRes, rRes, aRes] = await Promise.all([
        sb.from('holdings').select('id, ticker, name, currency, pillar, current_price, lots(units, purchase_price)'),
        sb.from('pillar_targets').select('*'),
        sb.from('pillar_regime').select('*').order('created_at', { ascending: true }),
        sb.from('pillar_audit').select('*').order('created_at', { ascending: false }).limit(20),
      ])

      if (hRes.error) throw new Error('Holdings: ' + hRes.error.message)
      if (tRes.error) throw new Error('Targets: ' + tRes.error.message)

      const hs = (hRes.data || []) as any as Holding[]
      setHoldings(hs)
      setTargets((tRes.data || []) as Target[])
      setRegimes((rRes.data || []) as Regime[])
      setAudit((aRes.data || []) as AuditRow[])

      // FX — normalise /api/exchange-rates ({USD_AUD, INR_AUD}) into a currency-keyed map
      try {
        const fx = await fetch('/api/exchange-rates')
        if (fx.ok) {
          const d = await fx.json()
          setRates({ AUD: 1, USD: d.USD_AUD ?? 1.55, INR: d.INR_AUD ?? 0.019 })
        }
      } catch { /* fall back to AUD:1 */ }

      // Live prices
      const priceMap: Record<string, number> = {}
      await Promise.all(hs.map(async h => {
        try {
          const r = await fetch(`/api/quote?symbol=${encodeURIComponent(h.ticker)}`)
          if (r.ok) { const d = await r.json(); if (d.price) priceMap[h.ticker] = d.price }
        } catch { /* leave to fallback */ }
      }))
      setPrices(priceMap)
    } catch (e: any) {
      setError(e.message || 'Failed to load pillar data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ---------- compute ----------
  // Value each holding in AUD using the same rule as the Portfolio page:
  // units x (live price -> current_price -> avg cost) x fx rate
  const valueOf = (h: Holding): number => {
    const lots = h.lots || []
    const units = lots.reduce((s, l) => s + Number(l.units), 0)
    if (units <= 0) return 0
    const cost = lots.reduce((s, l) => s + Number(l.units) * Number(l.purchase_price), 0)
    const avg = cost / units
    const price = prices[h.ticker] ?? h.current_price ?? avg
    const rate = rates[h.currency || 'AUD'] ?? 1
    return units * price * rate
  }

  const buckets: Record<string, number> = { bedrock: 0, momentum: 0, annuity: 0, reserve: 0, unassigned: 0 }
  const unassignedHoldings: Holding[] = []

  holdings.forEach(h => {
    const v = valueOf(h)
    if (v <= 0) return
    const key = h.pillar && ['bedrock', 'momentum', 'annuity', 'reserve'].includes(h.pillar)
      ? h.pillar : 'unassigned'
    buckets[key] += v
    if (key === 'unassigned') unassignedHoldings.push(h)
  })

  // Portfolio value = sum of pillar holdings, EXCLUDING reserve (and excluding
  // unassigned, which is surfaced as a data-quality warning instead).
  const portfolioValue = buckets.bedrock + buckets.momentum + buckets.annuity
  const reserve = buckets.reserve
  const unassigned = buckets.unassigned

  const targetFor = (p: Pillar) => targets.find(t => t.pillar === p)
  const activeRegime = regimes.find(r => r.is_active) || null
  const nextRegime = regimes.find(r => !r.is_active && r.trigger_portfolio_value) || null

  const rows = PILLARS.map(p => {
    const t = targetFor(p)
    const actual = portfolioValue > 0 ? (buckets[p] / portfolioValue) * 100 : 0
    const target = t?.target_pct ?? 0
    const lower = t?.band_lower_pct ?? 0
    const upper = t?.band_upper_pct ?? 100
    const drift = actual - target
    const breach = portfolioValue > 0 && (actual < lower || actual > upper)
    return { pillar: p, actual, target, lower, upper, drift, breach, value: buckets[p] }
  })

  // Cumulative target boundaries for the marker overlay (skip the final 100% edge)
  const targetMarkers = (() => {
    const out: { pillar: string; at: number }[] = []
    let acc = 0
    rows.forEach((r, i) => {
      acc += r.target
      if (i < rows.length - 1) out.push({ pillar: r.pillar, at: acc })
    })
    return out
  })()

  // ---------- steering line ----------
  const steering = (() => {
    if (portfolioValue <= 0) return null
    const breached = rows.filter(r => r.breach)
    if (breached.length > 0) {
      const b = breached.sort((x, y) => Math.abs(y.drift) - Math.abs(x.drift))[0]
      const dir = b.actual > b.upper ? `breached ${b.upper}%` : `fallen below ${b.lower}%`
      return {
        tone: 'breach' as const,
        text: `${META[b.pillar].label} has ${dir}. Rebalance required — check 12-month CGT status before trimming; prefer redirecting new contributions if the gap can close within 1-2 quarters.`,
      }
    }
    const under = rows.filter(r => r.drift < -0.5).sort((x, y) => x.drift - y.drift)[0]
    if (under) {
      return {
        tone: 'under' as const,
        text: `${META[under.pillar].label} is ${Math.abs(under.drift).toFixed(1)} points underweight. Direct next contributions here until the gap closes.`,
      }
    }
    return { tone: 'ok' as const, text: 'All pillars in band. No action required — deploy per plan.' }
  })()

  if (loading) {
    return (
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-8 text-center">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">Run pillar-schema.sql in Supabase if the tables don&apos;t exist yet.</p>
      </div>
    )
  }

  if (targets.length === 0) {
    return (
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-6 text-center">
        <Layers className="w-8 h-8 text-gray-700 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Pillar targets not set up yet.</p>
        <p className="text-xs text-gray-600 mt-1">Run pillar-schema.sql (with your user id) to seed targets and regimes.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Pillars</h3>
          {activeRegime && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">
              {activeRegime.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowRegime(true)} title="Switch regime"
            className="p-1.5 text-gray-500 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors">
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowEditTargets(true)} title="Edit targets"
            className="p-1.5 text-gray-500 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={load} title="Refresh"
            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Unassigned warning — the cold-start guard */}
      {unassigned > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-300 font-medium">
                  {unassignedHoldings.length} holding{unassignedHoldings.length !== 1 ? 's' : ''} ({fmtAUD(unassigned)}) not assigned to a pillar
                </p>
                <p className="text-[10px] text-amber-400/70 mt-0.5">
                  Excluded from the weights below — assign them or the percentages understate your portfolio.
                </p>
              </div>
            </div>
            <button onClick={() => setShowAssign(true)}
              className="px-2.5 py-1 bg-amber-500/20 text-amber-300 text-[11px] font-medium rounded-md hover:bg-amber-500/30 whitespace-nowrap">
              Assign
            </button>
          </div>
        </div>
      )}

      {/* Composition bar + reserve */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
            <span>Allocation ({fmtAUD(portfolioValue)})</span>
            <span>Target markers ▾</span>
          </div>
          <div className="relative h-7 bg-white/5 rounded-md overflow-hidden flex">
            {rows.map(r => (
              <div key={r.pillar}
                className="h-full transition-all flex items-center justify-center"
                style={{ width: `${r.actual}%`, backgroundColor: META[r.pillar].color }}>
                {r.actual >= 8 && (
                  <span className="text-[10px] font-bold text-black/70">{r.actual.toFixed(0)}%</span>
                )}
              </div>
            ))}
            {/* Target markers overlaid — cumulative target boundaries */}
            {targetMarkers.map(m => (
              <div key={m.pillar} className="absolute top-0 bottom-0 w-0.5 bg-white/70"
                style={{ left: `${m.at}%` }} title={`Target boundary ${m.at}%`} />
            ))}
          </div>
          <div className="flex gap-3 mt-1.5">
            {rows.map(r => (
              <div key={r.pillar} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: META[r.pillar].color }} />
                <span className="text-[10px] text-gray-500">{META[r.pillar].label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reserve — outside the weights, always */}
        <div className="text-right border-l border-gray-800 pl-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Reserve</p>
          <p className="text-lg font-bold text-white font-mono">{fmtK(reserve)}</p>
          <p className="text-[9px] text-gray-600">Ammunition — not an allocation</p>
        </div>
      </div>

      {/* Drift table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left py-1.5 font-semibold">Pillar</th>
              <th className="text-right py-1.5 font-semibold">Target</th>
              <th className="text-right py-1.5 font-semibold">Actual</th>
              <th className="text-right py-1.5 font-semibold">Drift</th>
              <th className="text-center py-1.5 font-semibold">Band</th>
              <th className="text-left py-1.5 font-semibold pl-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.pillar} className="border-b border-gray-800/30">
                <td className="py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: META[r.pillar].color }} />
                    <span className="text-gray-300 font-medium">{META[r.pillar].label}</span>
                  </div>
                </td>
                <td className="text-right font-mono text-gray-400">{r.target}%</td>
                <td className="text-right font-mono text-white font-medium">{r.actual.toFixed(1)}%</td>
                <td className={`text-right font-mono ${Math.abs(r.drift) < 0.5 ? 'text-gray-500' : r.drift > 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                  {pts(r.drift)}
                </td>
                <td className="py-2 px-2">
                  {/* Band visual: band range with actual marker */}
                  <div className="relative h-1.5 bg-white/5 rounded-full mx-auto" style={{ width: 64 }}>
                    <div className="absolute h-full bg-white/15 rounded-full"
                      style={{ left: `${r.lower}%`, width: `${r.upper - r.lower}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-2.5 rounded-sm"
                      style={{
                        left: `calc(${Math.min(100, Math.max(0, r.actual))}% - 3px)`,
                        backgroundColor: r.breach ? '#da3633' : META[r.pillar].color,
                      }} />
                  </div>
                  <p className="text-[9px] text-gray-600 text-center mt-0.5">{r.lower}-{r.upper}%</p>
                </td>
                <td className="pl-3">
                  {r.breach ? (
                    <span className="text-[10px] font-semibold" style={{ color: '#da3633' }}>BREACH — action required</span>
                  ) : (
                    <span className="text-[10px]" style={{ color: '#238636' }}>
                      In band{r.drift < -0.5 ? ' — underweight' : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Steering line — the output that matters */}
      {steering && (
        <div className="rounded-lg p-3 border" style={{
          backgroundColor: steering.tone === 'breach' ? '#da363310' : steering.tone === 'under' ? '#f0883e10' : '#23863610',
          borderColor: steering.tone === 'breach' ? '#da363340' : steering.tone === 'under' ? '#f0883e40' : '#23863640',
        }}>
          <p className="text-sm leading-relaxed" style={{
            color: steering.tone === 'breach' ? '#ff7b72' : steering.tone === 'under' ? '#f0883e' : '#3fb950',
          }}>
            {steering.text}
          </p>
        </div>
      )}

      {/* Regime progress */}
      {activeRegime && nextRegime && nextRegime.trigger_portfolio_value && (
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>{activeRegime.name}</span>
            <span>{fmtK(portfolioValue)} of {fmtK(nextRegime.trigger_portfolio_value)} to {nextRegime.name}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
              style={{ width: `${Math.min(100, (portfolioValue / nextRegime.trigger_portfolio_value) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Audit history */}
      <div className="border-t border-gray-800 pt-2">
        <button onClick={() => setShowAudit(!showAudit)}
          className="w-full flex items-center justify-between text-[10px] text-gray-500 hover:text-gray-400">
          <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> Target change history ({audit.length})</span>
          {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showAudit && (
          <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
            {audit.length === 0 ? (
              <p className="text-[10px] text-gray-600 text-center py-2">No changes recorded</p>
            ) : audit.map(a => (
              <div key={a.id} className="bg-white/[0.02] rounded-md p-2">
                <div className="flex justify-between">
                  <span className="text-[10px] text-gray-400 font-medium">{a.action.replace('_', ' ')}</span>
                  <span className="text-[9px] text-gray-600">{new Date(a.created_at).toLocaleDateString('en-AU')}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">{a.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Modals ---------- */}
      {showAssign && (
        <AssignModal
          holdings={unassignedHoldings}
          valueOf={valueOf}
          onClose={() => setShowAssign(false)}
          onSaved={() => { setShowAssign(false); load() }}
        />
      )}
      {showRegime && (
        <RegimeModal
          regimes={regimes}
          activeRegime={activeRegime}
          portfolioValue={portfolioValue}
          onClose={() => setShowRegime(false)}
          onSaved={() => { setShowRegime(false); load() }}
        />
      )}
      {showEditTargets && (
        <EditTargetsModal
          targets={targets}
          onClose={() => setShowEditTargets(false)}
          onSaved={() => { setShowEditTargets(false); load() }}
        />
      )}
    </div>
  )
}

// ============================================================
// Assign pillars to unassigned holdings
// ============================================================
function AssignModal({ holdings, valueOf, onClose, onSaved }: {
  holdings: Holding[]; valueOf: (h: Holding) => number
  onClose: () => void; onSaved: () => void
}) {
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setErr(null)
    try {
      const sb = createClient()
      const entries = Object.entries(assignments).filter(([, v]) => v)
      for (const [id, pillar] of entries) {
        const { error } = await sb.from('holdings').update({ pillar }).eq('id', id)
        if (error) throw new Error(error.message)
      }
      onSaved()
    } catch (e: any) {
      setErr(e.message); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-white">Assign pillars</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Every holding belongs to exactly one pillar. Reserve sits outside the weights.</p>

        <div className="space-y-2">
          {holdings.map(h => (
            <div key={h.id} className="flex items-center gap-3 p-2.5 bg-white/5 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-bold text-white">{h.ticker}</p>
                <p className="text-[10px] text-gray-500 truncate">{h.name}</p>
              </div>
              <span className="text-xs font-mono text-gray-400">{fmtAUD(valueOf(h))}</span>
              <select
                value={assignments[h.id] || ''}
                onChange={e => setAssignments({ ...assignments, [h.id]: e.target.value })}
                className="px-2 py-1.5 bg-white/5 text-white border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="">Choose...</option>
                <option value="bedrock">Bedrock</option>
                <option value="momentum">Momentum</option>
                <option value="annuity">Annuity</option>
                <option value="reserve">Reserve</option>
              </select>
            </div>
          ))}
        </div>

        {err && <p className="text-xs text-red-400 mt-3">{err}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 text-gray-300 text-sm rounded-lg hover:bg-white/10">Cancel</button>
          <button onClick={save} disabled={saving || Object.values(assignments).filter(Boolean).length === 0}
            className="flex-1 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500 disabled:opacity-40">
            {saving ? 'Saving...' : 'Save assignments'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Switch active regime — with confirmation + glide-path warning
// ============================================================
function RegimeModal({ regimes, activeRegime, portfolioValue, onClose, onSaved }: {
  regimes: Regime[]; activeRegime: Regime | null; portfolioValue: number
  onClose: () => void; onSaved: () => void
}) {
  const [selectedId, setSelectedId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const selected = regimes.find(r => r.id === selectedId) || null

  // Reallocation size = half the sum of absolute target changes
  const shiftPct = (() => {
    if (!selected || !activeRegime) return 0
    const d =
      Math.abs(selected.bedrock_pct - activeRegime.bedrock_pct) +
      Math.abs(selected.momentum_pct - activeRegime.momentum_pct) +
      Math.abs(selected.annuity_pct - activeRegime.annuity_pct)
    return d / 2
  })()

  const switchRegime = async () => {
    if (!selected || !reason.trim()) return
    setSaving(true); setErr(null)
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // 1. Deactivate all, activate selected
      await sb.from('pillar_regime').update({ is_active: false }).eq('user_id', user.id)
      const { error: actErr } = await sb.from('pillar_regime').update({ is_active: true }).eq('id', selected.id)
      if (actErr) throw new Error(actErr.message)

      // 2. Copy regime percentages into pillar_targets (the live read source).
      //    Bands travel with the target, keeping the original band width.
      const map: Record<Pillar, number> = {
        bedrock: selected.bedrock_pct,
        momentum: selected.momentum_pct,
        annuity: selected.annuity_pct,
      }
      for (const p of PILLARS) {
        const { data: existing } = await sb.from('pillar_targets')
          .select('band_lower_pct, band_upper_pct, target_pct')
          .eq('user_id', user.id).eq('pillar', p).maybeSingle()

        const width = existing
          ? (existing.band_upper_pct - existing.band_lower_pct) / 2
          : 10
        const newTarget = map[p]
        const { error: tErr } = await sb.from('pillar_targets').update({
          target_pct: newTarget,
          band_lower_pct: Math.max(0, newTarget - width),
          band_upper_pct: Math.min(100, newTarget + width),
          active_from: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id).eq('pillar', p)
        if (tErr) throw new Error(tErr.message)
      }

      // 3. Audit
      await sb.from('pillar_audit').insert({
        user_id: user.id,
        action: 'regime_switch',
        old_values: activeRegime ? {
          name: activeRegime.name, bedrock: activeRegime.bedrock_pct,
          momentum: activeRegime.momentum_pct, annuity: activeRegime.annuity_pct,
        } : null,
        new_values: {
          name: selected.name, bedrock: selected.bedrock_pct,
          momentum: selected.momentum_pct, annuity: selected.annuity_pct,
        },
        reason: reason.trim(),
      })

      onSaved()
    } catch (e: any) {
      setErr(e.message); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Switch regime</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-2 mb-4">
          {regimes.map(r => (
            <button key={r.id} onClick={() => setSelectedId(r.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedId === r.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-800 bg-white/[0.02] hover:bg-white/5'
              }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{r.name}</span>
                {r.is_active && <span className="text-[9px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-full">ACTIVE</span>}
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                Bedrock {r.bedrock_pct} / Momentum {r.momentum_pct} / Annuity {r.annuity_pct}
              </p>
            </button>
          ))}
        </div>

        {selected && !selected.is_active && activeRegime && (
          <>
            {/* Confirmation prompt */}
            <div className="bg-blue-500/10 border border-blue-500/25 rounded-lg p-3 mb-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                You are changing the fund&apos;s target weights from{' '}
                <span className="font-mono">{activeRegime.bedrock_pct}/{activeRegime.momentum_pct}/{activeRegime.annuity_pct}</span>{' '}
                to <span className="font-mono">{selected.bedrock_pct}/{selected.momentum_pct}/{selected.annuity_pct}</span>.
                Target weights should change because the fund&apos;s life stage has changed — not because current drift is uncomfortable.
                Confirm the reason.
              </p>
            </div>

            {/* Glide-path warning */}
            {shiftPct > 10 && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3 mb-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  This regime change implies a large reallocation ({shiftPct.toFixed(0)}% of portfolio ≈ {fmtAUD(portfolioValue * shiftPct / 100)}).
                  Prefer funding the shift with new contributions over several quarters rather than selling — check 12-month CGT status
                  on any position you&apos;d need to trim.
                </p>
              </div>
            )}

            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1">Reason (required)</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                placeholder="e.g. Portfolio crossed $150K — shifting toward income per plan"
                className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
            </div>
          </>
        )}

        {err && <p className="text-xs text-red-400 mb-3">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 text-gray-300 text-sm rounded-lg hover:bg-white/10">Cancel</button>
          <button onClick={switchRegime}
            disabled={saving || !selected || selected.is_active || !reason.trim()}
            className="flex-1 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Switching...' : 'Confirm switch'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Edit live targets + bands
// ============================================================
function EditTargetsModal({ targets, onClose, onSaved }: {
  targets: Target[]; onClose: () => void; onSaved: () => void
}) {
  const [vals, setVals] = useState<Record<string, { t: string; l: string; u: string }>>(
    Object.fromEntries(targets.map(t => [t.pillar, {
      t: String(t.target_pct), l: String(t.band_lower_pct), u: String(t.band_upper_pct),
    }]))
  )
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const sum = PILLARS.reduce((s, p) => s + (parseFloat(vals[p]?.t) || 0), 0)
  const sumOk = Math.abs(sum - 100) < 0.01

  const save = async () => {
    if (!sumOk || !reason.trim()) return
    setSaving(true); setErr(null)
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const oldVals = Object.fromEntries(targets.map(t => [t.pillar, t.target_pct]))

      for (const p of PILLARS) {
        const v = vals[p]
        if (!v) continue
        const target = parseFloat(v.t) || 0
        const lower = parseFloat(v.l) || 0
        const upper = parseFloat(v.u) || 100
        if (lower > target || target > upper) {
          throw new Error(`${META[p].label}: band must satisfy lower ≤ target ≤ upper`)
        }
        const { error } = await sb.from('pillar_targets').update({
          target_pct: target, band_lower_pct: lower, band_upper_pct: upper,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id).eq('pillar', p)
        if (error) throw new Error(error.message)
      }

      await sb.from('pillar_audit').insert({
        user_id: user.id,
        action: 'target_edit',
        old_values: oldVals,
        new_values: Object.fromEntries(PILLARS.map(p => [p, parseFloat(vals[p]?.t) || 0])),
        reason: reason.trim(),
      })

      onSaved()
    } catch (e: any) {
      setErr(e.message); setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Edit targets</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          {PILLARS.map(p => (
            <div key={p} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 w-24">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: META[p].color }} />
                <span className="text-xs text-gray-300">{META[p].label}</span>
              </div>
              {(['t', 'l', 'u'] as const).map(k => (
                <div key={k} className="flex-1">
                  <label className="block text-[9px] text-gray-600 mb-0.5">
                    {k === 't' ? 'Target' : k === 'l' ? 'Band low' : 'Band high'}
                  </label>
                  <input type="number" value={vals[p]?.[k] ?? ''}
                    onChange={e => setVals({ ...vals, [p]: { ...vals[p], [k]: e.target.value } })}
                    className="w-full px-2 py-1.5 bg-white/5 text-white border border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500" />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className={`mt-3 text-xs flex items-center gap-1.5 ${sumOk ? 'text-green-400' : 'text-red-400'}`}>
          {sumOk ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          Targets sum to {sum.toFixed(1)}%{sumOk ? '' : ' — must equal 100%'}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/25 rounded-lg p-3 my-3">
          <p className="text-[11px] text-blue-300 leading-relaxed">
            Target weights should change because the fund&apos;s life stage has changed — not because current drift is uncomfortable.
            Confirm the reason.
          </p>
        </div>

        <div className="mb-3">
          <label className="block text-xs text-gray-400 mb-1">Reason (required)</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            placeholder="Why are the fund's targets changing?"
            className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
        </div>

        {err && <p className="text-xs text-red-400 mb-3">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 text-gray-300 text-sm rounded-lg hover:bg-white/10">Cancel</button>
          <button onClick={save} disabled={saving || !sumOk || !reason.trim()}
            className="flex-1 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500 disabled:opacity-40">
            {saving ? 'Saving...' : 'Save targets'}
          </button>
        </div>
      </div>
    </div>
  )
}
