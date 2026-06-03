'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  PieChart,
  BarChart3,
  Target,
  Briefcase,
  Server,
  Brain,
  RefreshCw,
  Download,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  ExternalLink,
  ChevronDown,
} from 'lucide-react'

// Sector definitions - consistent across Dashboard & Performance Report
const SECTORS: Record<string, { name: string; color: string; textColor: string; barColor: string }> = {
  'AI Infrastructure': { name: 'AI Infrastructure', color: 'bg-purple-500', textColor: 'text-purple-600', barColor: 'from-purple-500 to-violet-500' },
  'ETF': { name: 'ETFs (Base Returns)', color: 'bg-blue-500', textColor: 'text-blue-600', barColor: 'from-blue-500 to-cyan-500' },
  'Mining': { name: 'Mining', color: 'bg-orange-500', textColor: 'text-orange-600', barColor: 'from-orange-500 to-amber-500' },
  'Physical Infrastructure': { name: 'Physical Infrastructure', color: 'bg-emerald-500', textColor: 'text-emerald-600', barColor: 'from-emerald-500 to-teal-500' },
  'Technology': { name: 'Technology', color: 'bg-cyan-500', textColor: 'text-cyan-600', barColor: 'from-cyan-500 to-blue-500' },
  'Financials': { name: 'Financials', color: 'bg-green-500', textColor: 'text-green-600', barColor: 'from-green-500 to-emerald-500' },
  'Materials': { name: 'Materials', color: 'bg-yellow-500', textColor: 'text-yellow-600', barColor: 'from-yellow-500 to-orange-500' },
  'Diversified': { name: 'Diversified', color: 'bg-indigo-500', textColor: 'text-indigo-600', barColor: 'from-indigo-500 to-purple-500' },
  'Other': { name: 'Other', color: 'bg-slate-400', textColor: 'text-slate-600', barColor: 'from-slate-400 to-gray-500' },
}

const SECTOR_OPTIONS = [
  { value: 'AI Infrastructure', label: 'AI Infrastructure' },
  { value: 'ETF', label: 'ETFs (Base Returns)' },
  { value: 'Mining', label: 'Mining' },
  { value: 'Physical Infrastructure', label: 'Physical Infrastructure' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Financials', label: 'Financials' },
  { value: 'Materials', label: 'Materials' },
  { value: 'Diversified', label: 'Diversified' },
  { value: 'Other', label: 'Other' },
]

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

interface Holding {
  id: string
  ticker: string
  name: string
  currency: string
  sector: string
  lots: {
    units: number
    purchase_price: number
    purchase_date: string
  }[]
}

interface SoldLot {
  id: string
  ticker: string
  units: number
  proceeds: number
  cost_base: number
  gross_gain: number
  net_gain: number
  sell_brokerage: number
  buy_brokerage: number
  sale_date: string
  purchase_date?: string
  held_over_12_months?: boolean  // Field used by CGT Tracker
}

interface OperatingCost {
  month: string
  supabase: number
  vercel: number
  api_services: number
  claude_subscription: number
  other_ai_tools: number
  other_costs: number
  total_monthly: number
}

export default function PerformanceReportPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedFY, setSelectedFY] = useState('')
  
  // Data from database
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [soldLots, setSoldLots] = useState<SoldLot[]>([])
  const [operatingCosts, setOperatingCosts] = useState<OperatingCost[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [exchangeRates, setExchangeRates] = useState<{ USD_AUD: number; INR_AUD: number }>({ USD_AUD: 1.55, INR_AUD: 0.019 })
  
  // Sector assignment state
  const [selectedHoldingId, setSelectedHoldingId] = useState('')
  const [selectedSector, setSelectedSector] = useState('')
  const [expandedSectors, setExpandedSectors] = useState<string[]>([])

  // Toggle sector expansion
  const toggleSector = (sector: string) => {
    setExpandedSectors(prev => 
      prev.includes(sector) 
        ? prev.filter(s => s !== sector)
        : [...prev, sector]
    )
  }

  useEffect(() => {
    setMounted(true)
    loadData()
    
    // Set current FY
    const now = new Date()
    const fyStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
    setSelectedFY(`${fyStart}-${fyStart + 1}`)
  }, [])

  const loadData = async () => {
    try {
      const supabase = createClient()
      
      // Load holdings with lots
      const { data: holdingsData } = await supabase
        .from('holdings')
        .select('id, ticker, name, currency, sector, lots(units, purchase_price, purchase_date)')
      
      // Load sold lots
      const { data: salesData } = await supabase
        .from('cgt_sales')
        .select('*')
        .order('sale_date', { ascending: false })
      
      // Load ALL operating costs for FY calculation
      const { data: costsData } = await supabase
        .from('operating_costs')
        .select('*')
        .order('month', { ascending: false })
      
      setHoldings(holdingsData || [])
      setSoldLots(salesData || [])
      setOperatingCosts(costsData || [])
      
      // Fetch exchange rates
      try {
        const fxRes = await fetch('/api/exchange-rates')
        if (fxRes.ok) {
          const fxData = await fxRes.json()
          setExchangeRates(fxData)
        }
      } catch (err) {
        console.error('Failed to fetch exchange rates:', err)
      }
      
      // Fetch current prices for holdings (same method as Dashboard)
      if (holdingsData && holdingsData.length > 0) {
        const priceMap: Record<string, number> = {}
        
        await Promise.all(
          holdingsData.map(async (h: any) => {
            try {
              const res = await fetch(`/api/quote?symbol=${encodeURIComponent(h.ticker)}`)
              if (res.ok) {
                const data = await res.json()
                if (data.price) {
                  priceMap[h.ticker] = data.price
                }
              }
            } catch (err) {
              console.error(`Failed to fetch price for ${h.ticker}:`, err)
            }
          })
        )
        
        setPrices(priceMap)
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Failed to load data:', err)
      setLoading(false)
    }
  }

  // Assign sector to holding
  const assignSector = async () => {
    if (!selectedHoldingId || !selectedSector) return
    
    try {
      const supabase = createClient()
      await supabase
        .from('holdings')
        .update({ sector: selectedSector })
        .eq('id', selectedHoldingId)
      
      setHoldings(prev => prev.map(h => 
        h.id === selectedHoldingId ? { ...h, sector: selectedSector } : h
      ))
      
      setSelectedHoldingId('')
      setSelectedSector('')
    } catch (err) {
      console.error('Failed to assign sector:', err)
    }
  }

  // Get FY date range
  const getFYDates = (fy: string) => {
    const [startYear] = fy.split('-').map(Number)
    return {
      start: new Date(startYear, 6, 1), // July 1
      end: new Date(startYear + 1, 5, 30), // June 30
    }
  }

  // Filter sales by FY
  const fyDates = getFYDates(selectedFY)
  const fySales = soldLots.filter(sale => {
    const saleDate = new Date(sale.sale_date)
    return saleDate >= fyDates.start && saleDate <= fyDates.end
  })

  // Filter costs by FY
  const fyCosts = operatingCosts.filter(cost => {
    const costDate = new Date(cost.month)
    return costDate >= fyDates.start && costDate <= fyDates.end
  })

  // Calculate portfolio value with AUD conversion
  const calculatePortfolioValue = () => {
    let totalValue = 0
    let totalCost = 0
    const sectorValues: Record<string, number> = {}

    holdings.forEach(holding => {
      const price = prices[holding.ticker] || 0
      const totalUnits = holding.lots?.reduce((sum, lot) => sum + lot.units, 0) || 0
      const cost = holding.lots?.reduce((sum, lot) => sum + (lot.units * lot.purchase_price), 0) || 0
      let value = totalUnits * price

      // Convert USD to AUD
      if (holding.currency === 'USD') {
        value = value * exchangeRates.USD_AUD
      }

      totalValue += value
      totalCost += cost

      const sector = holding.sector || 'Other'
      sectorValues[sector] = (sectorValues[sector] || 0) + value
    })

    return { totalValue, totalCost, sectorValues, unrealisedGain: totalValue - totalCost }
  }

  // Calculate trading revenue from sales
  const calculateTradingRevenue = () => {
    const grossGains = fySales.filter(s => s.gross_gain > 0).reduce((sum, s) => sum + s.gross_gain, 0)
    const grossLosses = fySales.filter(s => s.gross_gain < 0).reduce((sum, s) => sum + Math.abs(s.gross_gain), 0)
    const netGains = fySales.reduce((sum, s) => sum + s.gross_gain, 0)
    return { grossGains, grossLosses, netGains }
  }

  // Calculate trading costs from sales
  const calculateTradingCosts = () => {
    const brokerage = fySales.reduce((sum, s) => sum + (s.sell_brokerage || 0) + (s.buy_brokerage || 0), 0)
    return { brokerage, regulatory: 0, fx: 0, total: brokerage }
  }

  // Calculate operating costs from database (annualized)
  const calculateOperatingCosts = () => {
    // Sum all FY costs
    const fyTotal = fyCosts.reduce((sum, c) => sum + (c.total_monthly || 0), 0)
    const monthsRecorded = fyCosts.length
    
    // If we have recorded months, use average * 12 for annualized
    // Otherwise use default estimates
    let annualized = 0
    let infraTotal = 0
    let researchTotal = 0
    
    if (monthsRecorded > 0) {
      const avgMonthly = fyTotal / monthsRecorded
      annualized = avgMonthly * 12
      
      // Sum up category totals
      infraTotal = fyCosts.reduce((sum, c) => sum + (c.supabase || 0) + (c.vercel || 0) + (c.api_services || 0), 0)
      researchTotal = fyCosts.reduce((sum, c) => sum + (c.claude_subscription || 0) + (c.other_ai_tools || 0) + (c.other_costs || 0), 0)
      
      // Annualize
      infraTotal = (infraTotal / monthsRecorded) * 12
      researchTotal = (researchTotal / monthsRecorded) * 12
    } else {
      // Default estimates if no costs recorded
      infraTotal = (25 + 20) * 12 // Supabase + Vercel
      researchTotal = 169.99 * 12 // Claude
      annualized = infraTotal + researchTotal
    }

    return {
      infraTotal,
      researchTotal,
      total: annualized,
      monthsRecorded,
    }
  }

  // Calculate CGT with proper long-term/short-term split
  const calculateCGT = () => {
    let longTermGains = 0
    let longTermLosses = 0
    let shortTermGains = 0
    let shortTermLosses = 0

    fySales.forEach(sale => {
      // Use held_over_12_months field from CGT Tracker
      // Falls back to calculating from dates if not available
      let isLongTerm = false
      
      if (sale.held_over_12_months !== undefined) {
        isLongTerm = sale.held_over_12_months
      } else if (sale.purchase_date && sale.sale_date) {
        const purchaseDate = new Date(sale.purchase_date)
        const saleDate = new Date(sale.sale_date)
        const daysHeld = Math.floor((saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
        isLongTerm = daysHeld >= 365
      }
      // If no data available, assume short-term (conservative)

      if (sale.gross_gain >= 0) {
        if (isLongTerm) {
          longTermGains += sale.gross_gain
        } else {
          shortTermGains += sale.gross_gain
        }
      } else {
        if (isLongTerm) {
          longTermLosses += Math.abs(sale.gross_gain)
        } else {
          shortTermLosses += Math.abs(sale.gross_gain)
        }
      }
    })

    // Apply losses (short-term losses offset short-term gains first, then long-term)
    const totalLosses = shortTermLosses + longTermLosses
    
    // Net short-term after losses
    let netShortTerm = shortTermGains
    let remainingLosses = totalLosses
    
    if (remainingLosses > 0) {
      const shortTermOffset = Math.min(netShortTerm, remainingLosses)
      netShortTerm -= shortTermOffset
      remainingLosses -= shortTermOffset
    }
    
    // Net long-term after remaining losses
    let netLongTerm = longTermGains
    if (remainingLosses > 0) {
      netLongTerm = Math.max(0, netLongTerm - remainingLosses)
    }
    
    // 50% discount ONLY on long-term gains
    const discountApplied = netLongTerm * 0.5
    const taxableLongTerm = netLongTerm - discountApplied
    
    // Total taxable = full short-term + discounted long-term
    const totalTaxable = netShortTerm + taxableLongTerm
    const cgtPayable = totalTaxable * 0.325 // 32.5% marginal rate

    return { 
      shortTermGains,
      shortTermLosses,
      longTermGains, 
      longTermLosses,
      netShortTerm,
      netLongTerm,
      discountApplied, 
      totalTaxable, 
      cgtPayable,
      totalLosses,
    }
  }

  const portfolio = calculatePortfolioValue()
  const trading = calculateTradingRevenue()
  const tradingCosts = calculateTradingCosts()
  const opCosts = calculateOperatingCosts()
  const cgt = calculateCGT()

  // P&L Summary
  const grossProfit = trading.netGains - tradingCosts.total
  const operatingProfit = grossProfit - opCosts.total
  const netProfit = operatingProfit - cgt.cgtPayable

  // Returns
  const capitalDeployed = portfolio.totalCost > 0 ? portfolio.totalCost : 1
  const netReturnPct = (netProfit / capitalDeployed) * 100
  const costRatio = (opCosts.total / (portfolio.totalValue > 0 ? portfolio.totalValue : 1)) * 100

  if (!mounted) {
    return (
      <div className="space-y-4 pb-20">
        <h1 className="text-xl font-bold text-gray-900">Performance Report</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-emerald-600" />
            Performance Report
          </h1>
          <p className="text-sm text-gray-500">Vueon Capital — Fund Performance</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
          >
            <option value="2025-2026">FY 2025-26</option>
            <option value="2024-2025">FY 2024-25</option>
          </select>
          <button 
            onClick={loadData}
            className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Portfolio Value</p>
          <p className="text-xl font-bold text-gray-900">{fmt(portfolio.totalValue)}</p>
          <p className={`text-xs ${portfolio.unrealisedGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmtPct((portfolio.unrealisedGain / capitalDeployed) * 100)} unrealised
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Net Profit (FY)</p>
          <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {netProfit >= 0 ? '' : '-'}{fmt(netProfit)}
          </p>
          <p className="text-xs text-gray-500">After tax & costs</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Net Return</p>
          <p className={`text-xl font-bold ${netReturnPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmtPct(netReturnPct)}
          </p>
          <p className="text-xs text-gray-500">On deployed capital</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Cost Ratio</p>
          <p className="text-xl font-bold text-gray-900">
            {costRatio.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500">Of AUM</p>
        </div>
      </div>

      {/* Benchmark Comparison */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          BENCHMARK COMPARISON — FY {selectedFY}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">YOUR RETURN</p>
            <p className={`text-2xl font-bold font-mono ${netReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtPct(netReturnPct)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Net after tax & costs</p>
          </div>
          <div className="text-center border-l border-r border-slate-700">
            <p className="text-xs text-slate-400 mb-1">vs S&P 500</p>
            <p className="text-lg font-mono text-slate-500">—</p>
            <p className="text-xs text-slate-500 mt-1">API pending</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">vs ASX 200</p>
            <p className="text-lg font-mono text-slate-500">—</p>
            <p className="text-xs text-slate-500 mt-1">API pending</p>
          </div>
        </div>
      </div>

      {/* P&L Waterfall */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          P&L WATERFALL — FY {selectedFY}
        </h3>
        
        <div className="space-y-2 text-sm">
          {/* Revenue */}
          <div className="pb-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">REVENUE (REALISED)</p>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Trading Gains (Gross)</span>
              <span className="font-mono text-emerald-600">{fmt(trading.grossGains)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Trading Losses</span>
              <span className="font-mono text-red-600">({fmt(trading.grossLosses)})</span>
            </div>
            <div className="flex justify-between py-1 font-medium">
              <span>Net Trading Revenue</span>
              <span className={`font-mono ${trading.netGains >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmt(trading.netGains)}
              </span>
            </div>
          </div>

          {/* Trading Costs */}
          <div className="pb-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">TRADING COSTS</p>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Brokerage</span>
              <span className="font-mono text-red-600">({fmt(tradingCosts.brokerage)})</span>
            </div>
            <div className="flex justify-between py-1 font-medium">
              <span>Gross Profit</span>
              <span className={`font-mono ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmt(grossProfit)}
              </span>
            </div>
          </div>

          {/* Operating Costs */}
          <div className="pb-2 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                <Server className="w-3 h-3" />
                OPERATING COSTS (Annualized)
              </p>
              <Link 
                href="/settings/costs" 
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                Edit <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Infrastructure (Supabase, Vercel, APIs)</span>
              <span className="font-mono text-red-600">({fmt(opCosts.infraTotal)})</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Research & Analysis (Claude, AI Tools)</span>
              <span className="font-mono text-red-600">({fmt(opCosts.researchTotal)})</span>
            </div>
            {opCosts.monthsRecorded > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Based on {opCosts.monthsRecorded} month{opCosts.monthsRecorded > 1 ? 's' : ''} of recorded costs
              </p>
            )}
            <div className="flex justify-between py-1 font-medium mt-2">
              <span>Operating Profit (EBIT)</span>
              <span className={`font-mono ${operatingProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmt(operatingProfit)}
              </span>
            </div>
          </div>

          {/* Tax */}
          <div className="pb-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">TAX (CGT)</p>
            
            {/* Short-term gains */}
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Short-term gains (&lt;12 months)</span>
              <span className="font-mono text-gray-700">{fmt(cgt.shortTermGains)}</span>
            </div>
            
            {/* Long-term gains */}
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Long-term gains (≥12 months)</span>
              <span className="font-mono text-gray-700">{fmt(cgt.longTermGains)}</span>
            </div>
            
            {/* Losses */}
            {cgt.totalLosses > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-600">Capital losses applied</span>
                <span className="font-mono text-red-600">({fmt(cgt.totalLosses)})</span>
              </div>
            )}
            
            {/* 50% Discount - only if there are long-term gains */}
            {cgt.discountApplied > 0 ? (
              <div className="flex justify-between py-1">
                <span className="text-gray-600">50% CGT Discount (long-term only)</span>
                <span className="font-mono text-cyan-600">({fmt(cgt.discountApplied)})</span>
              </div>
            ) : (
              <div className="flex justify-between py-1">
                <span className="text-gray-500 italic">No 50% discount (no long-term gains)</span>
                <span className="font-mono text-gray-400">$0.00</span>
              </div>
            )}
            
            {/* Taxable amount */}
            <div className="flex justify-between py-1 border-t border-gray-100 mt-1 pt-1">
              <span className="text-gray-600">Net Taxable Gain</span>
              <span className="font-mono text-gray-700">{fmt(cgt.totalTaxable)}</span>
            </div>
            
            {/* CGT Payable */}
            <div className="flex justify-between py-1">
              <span className="text-gray-600">CGT Payable @ 32.5%</span>
              <span className="font-mono text-red-600">({fmt(cgt.cgtPayable)})</span>
            </div>
          </div>

          {/* Net Profit */}
          <div className="pt-2 bg-gradient-to-r from-emerald-50 to-cyan-50 -mx-4 px-4 py-3 rounded-b-xl">
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-gray-900 text-base">NET PROFIT AFTER TAX</span>
              <span className={`text-2xl font-bold font-mono ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {netProfit >= 0 ? '' : '-'}{fmt(netProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Sector */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-600" />
          ASSIGN SECTOR TO HOLDING
        </h3>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Select Holding</label>
            <select
              value={selectedHoldingId}
              onChange={(e) => setSelectedHoldingId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Choose holding...</option>
              {holdings.map(h => (
                <option key={h.id} value={h.id}>
                  {h.ticker} — {h.name} ({h.sector || 'Unassigned'})
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Assign Sector</label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              disabled={!selectedHoldingId}
            >
              <option value="">Choose sector...</option>
              {SECTOR_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={assignSector}
              disabled={!selectedHoldingId || !selectedSector}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <CheckCircle className="w-4 h-4" />
              Assign
            </button>
          </div>
        </div>
      </div>

      {/* Sector Allocation Chart - Expandable */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-purple-600" />
          SECTOR ALLOCATION
        </h3>
        
        <div className="space-y-2">
          {Object.entries(portfolio.sectorValues)
            .sort((a, b) => b[1] - a[1])
            .map(([sector, value]) => {
              const pct = portfolio.totalValue > 0 ? (value / portfolio.totalValue) * 100 : 0
              const sectorInfo = SECTORS[sector] || SECTORS['Other']
              const sectorHoldings = holdings.filter(h => (h.sector || 'Other') === sector)
              const isExpanded = expandedSectors.includes(sector)
              
              return (
                <div key={sector} className="border border-gray-100 rounded-lg overflow-hidden">
                  {/* Sector Header - Clickable */}
                  <button
                    onClick={() => toggleSector(sector)}
                    className="w-full p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-center text-sm mb-2">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        <span className={`font-semibold ${sectorInfo.textColor}`}>{sectorInfo.name}</span>
                        <span className="text-xs text-gray-400">({sectorHoldings.length} holdings)</span>
                      </div>
                      <span className="font-mono font-medium">{fmt(value)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${sectorInfo.barColor} rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                  
                  {/* Expanded Holdings */}
                  {isExpanded && sectorHoldings.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 p-3">
                      <div className="space-y-2">
                        {sectorHoldings.map(h => {
                          const holdingUnits = h.lots?.reduce((sum, lot) => sum + lot.units, 0) || 0
                          const holdingPrice = prices[h.ticker] || 0
                          let holdingValue = holdingUnits * holdingPrice
                          if (h.currency === 'USD') {
                            holdingValue *= exchangeRates.USD_AUD
                          }
                          const holdingPct = value > 0 ? (holdingValue / value) * 100 : 0
                          
                          return (
                            <div key={h.id} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-gray-700">{h.ticker}</span>
                                <span className="text-xs text-gray-400">{holdingUnits} units</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono text-sm text-gray-900">{fmt(holdingValue)}</span>
                                <span className="text-xs text-gray-400 ml-2">({holdingPct.toFixed(1)}%)</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
        </div>

        {Object.keys(portfolio.sectorValues).length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No holdings found. Add holdings to see allocation.
          </p>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 text-center">
        Vueon Capital Performance Report • FY {selectedFY} • Generated {new Date().toLocaleDateString('en-AU')}
      </p>
    </div>
  )
}
