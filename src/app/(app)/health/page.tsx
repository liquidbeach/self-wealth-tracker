'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { 
  PieChart, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Globe,
  Briefcase,
  Target,
  BarChart3,
  RefreshCw
} from 'lucide-react'

interface Holding {
  id: string
  ticker: string
  name: string
  market: string
  currency: string
  asset_type: string
  sector: string | null
  investment_style: string | null
  current_price: number | null
  lots: {
    units: number
    purchase_price: number
  }[]
}

interface FxRate {
  from_currency: string
  to_currency: string
  rate: number
}

interface HealthMetrics {
  // Concentration
  topHoldingPct: number
  top3Pct: number
  top5Pct: number
  positionsAboveLimit: { ticker: string; pct: number }[]
  
  // Sector
  sectorBreakdown: { sector: string; pct: number; value: number }[]
  sectorConcentration: { sector: string; pct: number }[]
  
  // Geographic
  geographicBreakdown: { region: string; pct: number; value: number }[]
  
  // Style
  styleBreakdown: { style: string; pct: number; value: number }[]
  
  // Asset Type
  assetTypeBreakdown: { type: string; pct: number; value: number }[]
  
  // Overall
  diversificationScore: number
  totalValueAUD: number
  holdingsCount: number
  suggestions: string[]
}

// Settings for risk limits
const RISK_LIMITS = {
  maxPositionPct: 10,      // Max 10% in single position
  maxSectorPct: 30,        // Max 30% in single sector
  maxRegionPct: 50,        // Max 50% in single region
  minPositions: 10,        // Minimum 10 positions for diversification
  minSectors: 4,           // Minimum 4 sectors
}

export default function PortfolioHealthPage() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [fxRates, setFxRates] = useState<FxRate[]>([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    
    const [holdingsRes, fxRes] = await Promise.all([
      supabase.from('holdings').select(`*, lots (*)`),
      supabase.from('fx_rates').select('*')
    ])

    setHoldings(holdingsRes.data || [])
    setFxRates(fxRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (holdings.length > 0) {
      calculateMetrics()
    }
  }, [holdings, fxRates])

  const getRate = (from: string, to: string): number => {
    if (from === to) return 1
    const rate = fxRates.find(r => r.from_currency === from && r.to_currency === to)
    return rate?.rate || 1
  }

  const calculateMetrics = () => {
    // Calculate value for each holding in AUD
    const holdingsWithValue = holdings.map(h => {
      const lots = h.lots || []
      const totalUnits = lots.reduce((sum, lot) => sum + Number(lot.units), 0)
      const totalCost = lots.reduce((sum, lot) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
      const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0
      const currentPrice = h.current_price || avgPrice
      const valueLocal = totalUnits * currentPrice
      const rate = getRate(h.currency, 'AUD')
      const valueAUD = valueLocal * rate

      return {
        ...h,
        totalUnits,
        valueLocal,
        valueAUD,
        sector: h.sector || 'Unknown',
        region: h.currency === 'AUD' ? 'Australia' : h.currency === 'USD' ? 'United States' : 'India',
        style: h.investment_style || 'Blend'
      }
    }).filter(h => h.valueAUD > 0)

    const totalValueAUD = holdingsWithValue.reduce((sum, h) => sum + h.valueAUD, 0)

    // Sort by value descending
    const sorted = [...holdingsWithValue].sort((a, b) => b.valueAUD - a.valueAUD)

    // Concentration metrics
    const topHoldingPct = totalValueAUD > 0 ? (sorted[0]?.valueAUD / totalValueAUD) * 100 : 0
    const top3Pct = totalValueAUD > 0 ? (sorted.slice(0, 3).reduce((sum, h) => sum + h.valueAUD, 0) / totalValueAUD) * 100 : 0
    const top5Pct = totalValueAUD > 0 ? (sorted.slice(0, 5).reduce((sum, h) => sum + h.valueAUD, 0) / totalValueAUD) * 100 : 0

    const positionsAboveLimit = sorted
      .map(h => ({ ticker: h.ticker, pct: (h.valueAUD / totalValueAUD) * 100 }))
      .filter(p => p.pct > RISK_LIMITS.maxPositionPct)

    // Sector breakdown
    const sectorMap = new Map<string, number>()
    holdingsWithValue.forEach(h => {
      const current = sectorMap.get(h.sector) || 0
      sectorMap.set(h.sector, current + h.valueAUD)
    })
    const sectorBreakdown = Array.from(sectorMap.entries())
      .map(([sector, value]) => ({
        sector,
        value,
        pct: totalValueAUD > 0 ? (value / totalValueAUD) * 100 : 0
      }))
      .sort((a, b) => b.pct - a.pct)

    const sectorConcentration = sectorBreakdown.filter(s => s.pct > RISK_LIMITS.maxSectorPct)

    // Geographic breakdown
    const geoMap = new Map<string, number>()
    holdingsWithValue.forEach(h => {
      const current = geoMap.get(h.region) || 0
      geoMap.set(h.region, current + h.valueAUD)
    })
    const geographicBreakdown = Array.from(geoMap.entries())
      .map(([region, value]) => ({
        region,
        value,
        pct: totalValueAUD > 0 ? (value / totalValueAUD) * 100 : 0
      }))
      .sort((a, b) => b.pct - a.pct)

    // Style breakdown
    const styleMap = new Map<string, number>()
    holdingsWithValue.forEach(h => {
      const current = styleMap.get(h.style) || 0
      styleMap.set(h.style, current + h.valueAUD)
    })
    const styleBreakdown = Array.from(styleMap.entries())
      .map(([style, value]) => ({
        style,
        value,
        pct: totalValueAUD > 0 ? (value / totalValueAUD) * 100 : 0
      }))
      .sort((a, b) => b.pct - a.pct)

    // Asset Type breakdown
    const typeMap = new Map<string, number>()
    holdingsWithValue.forEach(h => {
      const current = typeMap.get(h.asset_type) || 0
      typeMap.set(h.asset_type, current + h.valueAUD)
    })
    const assetTypeBreakdown = Array.from(typeMap.entries())
      .map(([type, value]) => ({
        type,
        value,
        pct: totalValueAUD > 0 ? (value / totalValueAUD) * 100 : 0
      }))
      .sort((a, b) => b.pct - a.pct)

    // Calculate diversification score (0-100)
    let score = 100
    const suggestions: string[] = []

    // Deduct for concentration
    if (topHoldingPct > RISK_LIMITS.maxPositionPct) {
      score -= Math.min(20, (topHoldingPct - RISK_LIMITS.maxPositionPct) * 2)
      suggestions.push(`Reduce ${sorted[0]?.ticker} position (${topHoldingPct.toFixed(1)}% > ${RISK_LIMITS.maxPositionPct}% limit)`)
    }

    // Deduct for too few positions
    if (holdingsWithValue.length < RISK_LIMITS.minPositions) {
      score -= (RISK_LIMITS.minPositions - holdingsWithValue.length) * 5
      suggestions.push(`Add more positions (${holdingsWithValue.length} < ${RISK_LIMITS.minPositions} minimum)`)
    }

    // Deduct for sector concentration
    sectorConcentration.forEach(s => {
      score -= Math.min(15, (s.pct - RISK_LIMITS.maxSectorPct))
      suggestions.push(`Reduce ${s.sector} exposure (${s.pct.toFixed(1)}% > ${RISK_LIMITS.maxSectorPct}% limit)`)
    })

    // Deduct for too few sectors
    if (sectorBreakdown.length < RISK_LIMITS.minSectors) {
      score -= (RISK_LIMITS.minSectors - sectorBreakdown.length) * 5
      suggestions.push(`Diversify into more sectors (${sectorBreakdown.length} < ${RISK_LIMITS.minSectors} minimum)`)
    }

    // Deduct for geographic concentration
    geographicBreakdown.forEach(g => {
      if (g.pct > RISK_LIMITS.maxRegionPct) {
        score -= Math.min(10, (g.pct - RISK_LIMITS.maxRegionPct) / 2)
        suggestions.push(`Consider diversifying outside ${g.region} (${g.pct.toFixed(1)}%)`)
      }
    })

    // Bonus for good diversification
    if (suggestions.length === 0) {
      suggestions.push('Portfolio is well diversified! 🎉')
    }

    score = Math.max(0, Math.min(100, score))

    setMetrics({
      topHoldingPct,
      top3Pct,
      top5Pct,
      positionsAboveLimit,
      sectorBreakdown,
      sectorConcentration,
      geographicBreakdown,
      styleBreakdown,
      assetTypeBreakdown,
      diversificationScore: Math.round(score),
      totalValueAUD,
      holdingsCount: holdingsWithValue.length,
      suggestions
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Needs Work'
  }

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const ProgressBar = ({ pct, limit, color = 'primary' }: { pct: number; limit?: number; color?: string }) => {
    const isOverLimit = limit && pct > limit
    const barColor = isOverLimit ? 'bg-red-500' : color === 'green' ? 'bg-green-500' : color === 'blue' ? 'bg-blue-500' : 'bg-primary-500'
    
    return (
      <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`absolute left-0 top-0 h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
        {limit && (
          <div 
            className="absolute top-0 h-full w-0.5 bg-slate-400"
            style={{ left: `${limit}%` }}
          />
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (holdings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portfolio Health</h1>
          <p className="text-slate-500">Analyze your portfolio's diversification and risk</p>
        </div>
        <div className="card text-center py-12">
          <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">No holdings yet</p>
          <p className="text-sm text-slate-400">Add holdings to see your portfolio health analysis</p>
        </div>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Portfolio Health</h1>
        <p className="text-slate-500">Analyze your portfolio's diversification and risk</p>
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Diversification Score */}
        <div className="card col-span-1 md:col-span-2">
          <div className="flex items-center gap-6">
            <div className={`w-24 h-24 rounded-full ${getScoreBg(metrics.diversificationScore)} flex items-center justify-center`}>
              <span className={`text-3xl font-bold ${getScoreColor(metrics.diversificationScore)}`}>
                {metrics.diversificationScore}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Diversification Score</p>
              <p className={`text-xl font-semibold ${getScoreColor(metrics.diversificationScore)}`}>
                {getScoreLabel(metrics.diversificationScore)}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {metrics.holdingsCount} positions • {formatCurrency(metrics.totalValueAUD)} AUD
              </p>
            </div>
          </div>
        </div>

        {/* Concentration */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-slate-400" />
            <p className="text-sm text-slate-500">Top Holding</p>
          </div>
          <p className={`text-2xl font-bold ${metrics.topHoldingPct > RISK_LIMITS.maxPositionPct ? 'text-red-600' : 'text-slate-900'}`}>
            {metrics.topHoldingPct.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400">Limit: {RISK_LIMITS.maxPositionPct}%</p>
        </div>

        {/* Top 3 */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <p className="text-sm text-slate-500">Top 3 Holdings</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{metrics.top3Pct.toFixed(1)}%</p>
          <p className="text-xs text-slate-400">of portfolio</p>
        </div>
      </div>

      {/* Suggestions */}
      {metrics.suggestions.length > 0 && (
        <div className={`card ${metrics.diversificationScore >= 80 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start gap-3">
            {metrics.diversificationScore >= 80 ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-medium ${metrics.diversificationScore >= 80 ? 'text-green-800' : 'text-amber-800'}`}>
                {metrics.diversificationScore >= 80 ? 'Looking Good!' : 'Suggestions'}
              </p>
              <ul className={`mt-1 text-sm ${metrics.diversificationScore >= 80 ? 'text-green-700' : 'text-amber-700'} space-y-1`}>
                {metrics.suggestions.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Position Concentration */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-slate-400" />
            Position Concentration
          </h3>
          <div className="space-y-3">
            {holdings
              .map(h => {
                const lots = h.lots || []
                const totalUnits = lots.reduce((sum, lot) => sum + Number(lot.units), 0)
                const totalCost = lots.reduce((sum, lot) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
                const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0
                const currentPrice = h.current_price || avgPrice
                const valueLocal = totalUnits * currentPrice
                const rate = getRate(h.currency, 'AUD')
                const valueAUD = valueLocal * rate
                const pct = metrics.totalValueAUD > 0 ? (valueAUD / metrics.totalValueAUD) * 100 : 0
                return { ticker: h.ticker, name: h.name, pct, valueAUD }
              })
              .filter(h => h.valueAUD > 0)
              .sort((a, b) => b.pct - a.pct)
              .slice(0, 10)
              .map(h => (
                <div key={h.ticker}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{h.ticker}</span>
                    <span className={h.pct > RISK_LIMITS.maxPositionPct ? 'text-red-600 font-medium' : 'text-slate-600'}>
                      {h.pct.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar pct={h.pct} limit={RISK_LIMITS.maxPositionPct} />
                </div>
              ))}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Red line indicates {RISK_LIMITS.maxPositionPct}% position limit
          </p>
        </div>

        {/* Sector Allocation */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-slate-400" />
            Sector Allocation
          </h3>
          <div className="space-y-3">
            {metrics.sectorBreakdown.map(s => (
              <div key={s.sector}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{s.sector}</span>
                  <span className={s.pct > RISK_LIMITS.maxSectorPct ? 'text-red-600 font-medium' : 'text-slate-600'}>
                    {s.pct.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar pct={s.pct} limit={RISK_LIMITS.maxSectorPct} color="blue" />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Red line indicates {RISK_LIMITS.maxSectorPct}% sector limit
          </p>
        </div>

        {/* Geographic Mix */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-slate-400" />
            Geographic Mix
          </h3>
          <div className="space-y-3">
            {metrics.geographicBreakdown.map(g => (
              <div key={g.region}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">
                    {g.region === 'Australia' ? '🇦🇺' : g.region === 'United States' ? '🇺🇸' : '🇮🇳'} {g.region}
                  </span>
                  <span className="text-slate-600">{g.pct.toFixed(1)}%</span>
                </div>
                <ProgressBar pct={g.pct} limit={RISK_LIMITS.maxRegionPct} color="green" />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Consider diversifying if any region exceeds {RISK_LIMITS.maxRegionPct}%
          </p>
        </div>

        {/* Style Mix */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            Investment Style Mix
          </h3>
          <div className="space-y-3">
            {metrics.styleBreakdown.map(s => (
              <div key={s.style}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">
                    {s.style === 'Growth' ? '📈' : s.style === 'Dividend' ? '💰' : '⚖️'} {s.style}
                  </span>
                  <span className="text-slate-600">{s.pct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      s.style === 'Growth' ? 'bg-purple-500' : 
                      s.style === 'Dividend' ? 'bg-green-500' : 
                      'bg-slate-400'
                    }`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Balance growth and dividend based on your goals
          </p>
        </div>

        {/* Asset Type */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-slate-400" />
            Asset Type Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.assetTypeBreakdown.map(t => (
              <div key={t.type} className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{t.pct.toFixed(1)}%</p>
                <p className="text-sm text-slate-500">{t.type}</p>
                <p className="text-xs text-slate-400">{formatCurrency(t.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Limits Reference */}
      <div className="card bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Current Risk Limits</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Max Position</p>
            <p className="font-medium text-slate-900">{RISK_LIMITS.maxPositionPct}%</p>
          </div>
          <div>
            <p className="text-slate-500">Max Sector</p>
            <p className="font-medium text-slate-900">{RISK_LIMITS.maxSectorPct}%</p>
          </div>
          <div>
            <p className="text-slate-500">Max Region</p>
            <p className="font-medium text-slate-900">{RISK_LIMITS.maxRegionPct}%</p>
          </div>
          <div>
            <p className="text-slate-500">Min Positions</p>
            <p className="font-medium text-slate-900">{RISK_LIMITS.minPositions}</p>
          </div>
          <div>
            <p className="text-slate-500">Min Sectors</p>
            <p className="font-medium text-slate-900">{RISK_LIMITS.minSectors}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Customize these limits in Settings → Risk Preferences
        </p>
      </div>
    </div>
  )
}
