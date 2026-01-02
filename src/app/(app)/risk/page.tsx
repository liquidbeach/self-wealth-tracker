'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { 
  Shield, 
  AlertTriangle, 
  TrendingDown,
  TrendingUp,
  DollarSign,
  Target,
  Activity,
  AlertCircle,
  CheckCircle,
  Calculator,
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
    purchase_date: string
  }[]
}

interface FxRate {
  from_currency: string
  to_currency: string
  rate: number
}

interface RiskMetrics {
  overallScore: number
  riskLevel: 'Low' | 'Medium' | 'High' | 'Very High'
  
  // Concentration Risk
  concentrationScore: number
  topHoldingPct: number
  
  // Drawdown Analysis
  drawdowns: {
    ticker: string
    name: string
    currentPrice: number
    avgCost: number
    drawdownPct: number
    valueAUD: number
  }[]
  
  // Portfolio Volatility (based on asset types)
  volatilityScore: number
  highVolatilityPct: number
  
  // Position Sizing
  suggestedPositionSize: number
  maxPositionValue: number
  
  // Alerts
  alerts: {
    type: 'danger' | 'warning' | 'info'
    title: string
    message: string
  }[]
  
  // Summary
  totalValueAUD: number
  totalCostAUD: number
  totalGainLoss: number
  totalGainLossPct: number
}

// Risk settings
const RISK_SETTINGS = {
  maxPositionPct: 10,
  maxSectorPct: 30,
  drawdownAlertPct: -15,
  drawdownDangerPct: -30,
  concentrationDangerPct: 25,
}

// Volatility classification by asset type
const VOLATILITY_MAP: Record<string, number> = {
  'Equity': 3,      // High volatility
  'ETF': 2,         // Medium volatility
  'REIT': 2,        // Medium volatility
  'Gold': 1,        // Low volatility
}

export default function RiskDashboardPage() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [fxRates, setFxRates] = useState<FxRate[]>([])
  const [cashBalances, setCashBalances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null)
  
  // Position calculator state
  const [calcPortfolioValue, setCalcPortfolioValue] = useState('')
  const [calcRiskPct, setCalcRiskPct] = useState('2')
  const [calcStopLossPct, setCalcStopLossPct] = useState('10')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    
    const [holdingsRes, fxRes, cashRes] = await Promise.all([
      supabase.from('holdings').select(`*, lots (*)`),
      supabase.from('fx_rates').select('*'),
      supabase.from('cash_balances').select('*')
    ])

    setHoldings(holdingsRes.data || [])
    setFxRates(fxRes.data || [])
    setCashBalances(cashRes.data || [])
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
    const alerts: RiskMetrics['alerts'] = []
    
    // Calculate holding values
    const holdingsWithValue = holdings.map(h => {
      const lots = h.lots || []
      const totalUnits = lots.reduce((sum, lot) => sum + Number(lot.units), 0)
      const totalCost = lots.reduce((sum, lot) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
      const avgCost = totalUnits > 0 ? totalCost / totalUnits : 0
      const currentPrice = h.current_price || avgCost
      const valueLocal = totalUnits * currentPrice
      const costLocal = totalCost
      const rate = getRate(h.currency, 'AUD')
      const valueAUD = valueLocal * rate
      const costAUD = costLocal * rate
      const drawdownPct = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0
      const volatility = VOLATILITY_MAP[h.asset_type] || 2

      return {
        ...h,
        totalUnits,
        avgCost,
        currentPrice,
        valueAUD,
        costAUD,
        drawdownPct,
        volatility
      }
    }).filter(h => h.valueAUD > 0)

    const totalValueAUD = holdingsWithValue.reduce((sum, h) => sum + h.valueAUD, 0)
    const totalCostAUD = holdingsWithValue.reduce((sum, h) => sum + h.costAUD, 0)
    const totalGainLoss = totalValueAUD - totalCostAUD
    const totalGainLossPct = totalCostAUD > 0 ? (totalGainLoss / totalCostAUD) * 100 : 0

    // Set portfolio value for calculator
    if (!calcPortfolioValue) {
      setCalcPortfolioValue(Math.round(totalValueAUD).toString())
    }

    // Concentration Analysis
    const sorted = [...holdingsWithValue].sort((a, b) => b.valueAUD - a.valueAUD)
    const topHoldingPct = totalValueAUD > 0 ? (sorted[0]?.valueAUD / totalValueAUD) * 100 : 0
    
    let concentrationScore = 100
    if (topHoldingPct > RISK_SETTINGS.concentrationDangerPct) {
      concentrationScore -= 40
      alerts.push({
        type: 'danger',
        title: 'Extreme Concentration',
        message: `${sorted[0]?.ticker} is ${topHoldingPct.toFixed(1)}% of your portfolio`
      })
    } else if (topHoldingPct > RISK_SETTINGS.maxPositionPct) {
      concentrationScore -= 20
      alerts.push({
        type: 'warning',
        title: 'High Concentration',
        message: `${sorted[0]?.ticker} exceeds ${RISK_SETTINGS.maxPositionPct}% position limit`
      })
    }

    // Drawdown Analysis
    const drawdowns = holdingsWithValue
      .map(h => ({
        ticker: h.ticker,
        name: h.name,
        currentPrice: h.currentPrice,
        avgCost: h.avgCost,
        drawdownPct: h.drawdownPct,
        valueAUD: h.valueAUD
      }))
      .sort((a, b) => a.drawdownPct - b.drawdownPct)

    // Check for significant drawdowns
    const dangerDrawdowns = drawdowns.filter(d => d.drawdownPct <= RISK_SETTINGS.drawdownDangerPct)
    const warningDrawdowns = drawdowns.filter(d => 
      d.drawdownPct > RISK_SETTINGS.drawdownDangerPct && 
      d.drawdownPct <= RISK_SETTINGS.drawdownAlertPct
    )

    if (dangerDrawdowns.length > 0) {
      alerts.push({
        type: 'danger',
        title: 'Severe Drawdown',
        message: `${dangerDrawdowns.length} position(s) down more than ${Math.abs(RISK_SETTINGS.drawdownDangerPct)}%`
      })
    }

    if (warningDrawdowns.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Drawdown Alert',
        message: `${warningDrawdowns.length} position(s) down more than ${Math.abs(RISK_SETTINGS.drawdownAlertPct)}%`
      })
    }

    // Volatility Score
    const weightedVolatility = holdingsWithValue.reduce((sum, h) => {
      const weight = h.valueAUD / totalValueAUD
      return sum + (h.volatility * weight)
    }, 0)
    
    const volatilityScore = Math.round((3 - weightedVolatility) / 2 * 100) // Convert to 0-100 (lower volatility = higher score)
    const highVolatilityHoldings = holdingsWithValue.filter(h => h.volatility >= 3)
    const highVolatilityPct = totalValueAUD > 0 
      ? (highVolatilityHoldings.reduce((sum, h) => sum + h.valueAUD, 0) / totalValueAUD) * 100 
      : 0

    if (highVolatilityPct > 70) {
      alerts.push({
        type: 'warning',
        title: 'High Volatility Portfolio',
        message: `${highVolatilityPct.toFixed(0)}% in high-volatility assets`
      })
    }

    // Overall Risk Score (0-100, higher = safer)
    const drawdownScore = Math.max(0, 100 - (dangerDrawdowns.length * 20) - (warningDrawdowns.length * 10))
    const overallScore = Math.round((concentrationScore + volatilityScore + drawdownScore) / 3)
    
    let riskLevel: RiskMetrics['riskLevel'] = 'Low'
    if (overallScore < 40) riskLevel = 'Very High'
    else if (overallScore < 60) riskLevel = 'High'
    else if (overallScore < 80) riskLevel = 'Medium'

    // Position Sizing
    const suggestedPositionSize = RISK_SETTINGS.maxPositionPct
    const maxPositionValue = totalValueAUD * (suggestedPositionSize / 100)

    // Add positive alerts if everything is good
    if (alerts.length === 0) {
      alerts.push({
        type: 'info',
        title: 'Portfolio Looks Healthy',
        message: 'No significant risk alerts at this time'
      })
    }

    setMetrics({
      overallScore,
      riskLevel,
      concentrationScore,
      topHoldingPct,
      drawdowns,
      volatilityScore,
      highVolatilityPct,
      suggestedPositionSize,
      maxPositionValue,
      alerts,
      totalValueAUD,
      totalCostAUD,
      totalGainLoss,
      totalGainLossPct
    })
  }

  const calculatePositionSize = () => {
    const portfolioValue = parseFloat(calcPortfolioValue) || 0
    const riskPct = parseFloat(calcRiskPct) || 2
    const stopLossPct = parseFloat(calcStopLossPct) || 10
    
    if (stopLossPct === 0) return { positionSize: 0, shares: 0 }
    
    const riskAmount = portfolioValue * (riskPct / 100)
    const positionSize = riskAmount / (stopLossPct / 100)
    
    return {
      riskAmount,
      positionSize: Math.min(positionSize, portfolioValue * (RISK_SETTINGS.maxPositionPct / 100))
    }
  }

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getRiskBg = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    if (score >= 40) return 'bg-orange-100'
    return 'bg-red-100'
  }

  const getDrawdownColor = (pct: number) => {
    if (pct >= 0) return 'text-green-600'
    if (pct > RISK_SETTINGS.drawdownAlertPct) return 'text-slate-600'
    if (pct > RISK_SETTINGS.drawdownDangerPct) return 'text-orange-600'
    return 'text-red-600'
  }

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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
          <h1 className="text-2xl font-bold text-slate-900">Risk Dashboard</h1>
          <p className="text-slate-500">Monitor and manage your portfolio risk</p>
        </div>
        <div className="card text-center py-12">
          <Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">No holdings yet</p>
          <p className="text-sm text-slate-400">Add holdings to see risk analysis</p>
        </div>
      </div>
    )
  }

  if (!metrics) return null

  const positionCalc = calculatePositionSize()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Risk Dashboard</h1>
        <p className="text-slate-500">Monitor and manage your portfolio risk</p>
      </div>

      {/* Risk Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Risk Score */}
        <div className="card col-span-1 md:col-span-2">
          <div className="flex items-center gap-6">
            <div className={`w-24 h-24 rounded-full ${getRiskBg(metrics.overallScore)} flex items-center justify-center`}>
              <span className={`text-3xl font-bold ${getRiskColor(metrics.overallScore)}`}>
                {metrics.overallScore}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Risk Score</p>
              <p className={`text-xl font-semibold ${getRiskColor(metrics.overallScore)}`}>
                {metrics.riskLevel} Risk
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Higher score = Lower risk
              </p>
            </div>
          </div>
        </div>

        {/* Portfolio Value */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <p className="text-sm text-slate-500">Portfolio Value</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatCurrency(metrics.totalValueAUD)}
          </p>
          <p className={`text-sm ${metrics.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {metrics.totalGainLoss >= 0 ? '+' : ''}{metrics.totalGainLossPct.toFixed(2)}%
          </p>
        </div>

        {/* Max Position */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-slate-400" />
            <p className="text-sm text-slate-500">Max Position Size</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatCurrency(metrics.maxPositionValue)}
          </p>
          <p className="text-sm text-slate-400">
            {metrics.suggestedPositionSize}% of portfolio
          </p>
        </div>
      </div>

      {/* Alerts */}
      {metrics.alerts.length > 0 && (
        <div className="space-y-2">
          {metrics.alerts.map((alert, i) => (
            <div 
              key={i}
              className={`card flex items-start gap-3 ${
                alert.type === 'danger' ? 'bg-red-50 border-red-200' :
                alert.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                'bg-blue-50 border-blue-200'
              }`}
            >
              {alert.type === 'danger' ? (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              ) : alert.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  alert.type === 'danger' ? 'text-red-800' :
                  alert.type === 'warning' ? 'text-amber-800' :
                  'text-blue-800'
                }`}>
                  {alert.title}
                </p>
                <p className={`text-sm ${
                  alert.type === 'danger' ? 'text-red-700' :
                  alert.type === 'warning' ? 'text-amber-700' :
                  'text-blue-700'
                }`}>
                  {alert.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drawdown Monitor */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-slate-400" />
            Drawdown Monitor
          </h3>
          <div className="space-y-3">
            {metrics.drawdowns.slice(0, 10).map(d => (
              <div key={d.ticker} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{d.ticker}</p>
                  <p className="text-xs text-slate-500">{d.name}</p>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${getDrawdownColor(d.drawdownPct)}`}>
                    {d.drawdownPct >= 0 ? '+' : ''}{d.drawdownPct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-400">
                    vs ${d.avgCost.toFixed(2)} avg
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-400">
            <p>🟢 Above cost | 🟡 Down &lt;{Math.abs(RISK_SETTINGS.drawdownAlertPct)}% | 🟠 Down &lt;{Math.abs(RISK_SETTINGS.drawdownDangerPct)}% | 🔴 Down &gt;{Math.abs(RISK_SETTINGS.drawdownDangerPct)}%</p>
          </div>
        </div>

        {/* Risk Breakdown */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-400" />
            Risk Breakdown
          </h3>
          <div className="space-y-4">
            {/* Concentration */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Concentration Risk</span>
                <span className={getRiskColor(metrics.concentrationScore)}>
                  {metrics.concentrationScore}/100
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    metrics.concentrationScore >= 80 ? 'bg-green-500' :
                    metrics.concentrationScore >= 60 ? 'bg-yellow-500' :
                    metrics.concentrationScore >= 40 ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${metrics.concentrationScore}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Top holding: {metrics.topHoldingPct.toFixed(1)}%
              </p>
            </div>

            {/* Volatility */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Volatility Score</span>
                <span className={getRiskColor(metrics.volatilityScore)}>
                  {metrics.volatilityScore}/100
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    metrics.volatilityScore >= 80 ? 'bg-green-500' :
                    metrics.volatilityScore >= 60 ? 'bg-yellow-500' :
                    metrics.volatilityScore >= 40 ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${metrics.volatilityScore}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                High volatility assets: {metrics.highVolatilityPct.toFixed(0)}%
              </p>
            </div>

            {/* Portfolio Performance */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Portfolio Performance</span>
                <span className={metrics.totalGainLossPct >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {metrics.totalGainLossPct >= 0 ? '+' : ''}{metrics.totalGainLossPct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${metrics.totalGainLossPct >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.abs(metrics.totalGainLossPct) + 50)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {metrics.totalGainLoss >= 0 ? '+' : ''}{formatCurrency(metrics.totalGainLoss)} AUD
              </p>
            </div>
          </div>
        </div>

        {/* Position Size Calculator */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-slate-400" />
            Position Size Calculator
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-slate-600">Portfolio Value (AUD)</label>
              <input
                type="number"
                value={calcPortfolioValue}
                onChange={(e) => setCalcPortfolioValue(e.target.value)}
                className="input mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Risk per Trade (%)</label>
              <input
                type="number"
                value={calcRiskPct}
                onChange={(e) => setCalcRiskPct(e.target.value)}
                className="input mt-1"
                step="0.5"
                min="0.5"
                max="5"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Stop Loss (%)</label>
              <input
                type="number"
                value={calcStopLossPct}
                onChange={(e) => setCalcStopLossPct(e.target.value)}
                className="input mt-1"
                step="1"
                min="1"
                max="50"
              />
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-500">Suggested Position Size</p>
              <p className="text-2xl font-bold text-primary-600">
                {formatCurrency(positionCalc.positionSize)}
              </p>
              <p className="text-xs text-slate-400">
                Risk: {formatCurrency(positionCalc.riskAmount || 0)}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            This calculator uses the fixed fractional position sizing method. Risk per trade is the maximum you're willing to lose if your stop loss is hit.
          </p>
        </div>
      </div>

      {/* Risk Settings Reference */}
      <div className="card bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Current Risk Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Max Position</p>
            <p className="font-medium text-slate-900">{RISK_SETTINGS.maxPositionPct}%</p>
          </div>
          <div>
            <p className="text-slate-500">Max Sector</p>
            <p className="font-medium text-slate-900">{RISK_SETTINGS.maxSectorPct}%</p>
          </div>
          <div>
            <p className="text-slate-500">Drawdown Alert</p>
            <p className="font-medium text-slate-900">{RISK_SETTINGS.drawdownAlertPct}%</p>
          </div>
          <div>
            <p className="text-slate-500">Drawdown Danger</p>
            <p className="font-medium text-slate-900">{RISK_SETTINGS.drawdownDangerPct}%</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Customize these limits in Settings → Risk Preferences
        </p>
      </div>
    </div>
  )
}
