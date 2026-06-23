'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Calendar, DollarSign, PieChart,
  BarChart3, Target, Briefcase, Server, Brain, RefreshCw,
  Download, CheckCircle, ArrowUpRight, ArrowDownRight,
  Settings, ExternalLink, ChevronDown,
} from 'lucide-react'

const SECTORS: Record<string, { name: string; color: string; textColor: string; barColor: string }> = {
  'AI Infrastructure': { name: 'AI Infrastructure', color: 'bg-purple-500', textColor: 'text-purple-400', barColor: 'from-purple-500 to-violet-500' },
  'ETF': { name: 'ETFs (Base Returns)', color: 'bg-blue-500', textColor: 'text-blue-400', barColor: 'from-blue-500 to-cyan-500' },
  'Mining': { name: 'Mining', color: 'bg-orange-500', textColor: 'text-yellow-400', barColor: 'from-orange-500 to-amber-500' },
  'Physical Infrastructure': { name: 'Physical Infrastructure', color: 'bg-green-500', textColor: 'text-green-400', barColor: 'from-emerald-500 to-teal-500' },
  'Technology': { name: 'Technology', color: 'bg-cyan-500', textColor: 'text-cyan-400', barColor: 'from-cyan-500 to-blue-500' },
  'Financials': { name: 'Financials', color: 'bg-green-500', textColor: 'text-green-400', barColor: 'from-green-500 to-emerald-500' },
  'Materials': { name: 'Materials', color: 'bg-yellow-500', textColor: 'text-yellow-400', barColor: 'from-yellow-500 to-orange-500' },
  'Diversified': { name: 'Diversified', color: 'bg-indigo-500', textColor: 'text-indigo-400', barColor: 'from-indigo-500 to-purple-500' },
  'Other': { name: 'Other', color: 'bg-slate-400', textColor: 'text-gray-400', barColor: 'from-slate-400 to-gray-500' },
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
  id: string; ticker: string; name: string; currency: string; sector: string
  lots: { units: number; purchase_price: number; purchase_date: string }[]
}

interface SoldLot {
  id: string; ticker: string; units: number; proceeds: number; cost_base: number
  gross_gain: number; net_gain: number; sell_brokerage: number; buy_brokerage: number
  sale_date: string; purchase_date?: string; held_over_12_months?: boolean
}

interface OperatingCost {
  month: string; supabase: number; vercel: number; api_services: number
  claude_subscription: number; other_ai_tools: number; other_costs: number
  total_monthly: number
}

interface BenchmarkData {
  symbol: string; returnPct: number; startPrice: number; endPrice: number
}

// CGT rate — Australian marginal rate
const CGT_RATE = 0.37

export default function PerformanceReportPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedFY, setSelectedFY] = useState('')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [soldLots, setSoldLots] = useState<SoldLot[]>([])
  const [operatingCosts, setOperatingCosts] = useState<OperatingCost[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [exchangeRates, setExchangeRates] = useState<{ USD_AUD: number; INR_AUD: number }>({ USD_AUD: 1.55, INR_AUD: 0.019 })
  const [benchmarks, setBenchmarks] = useState<{ sp500?: BenchmarkData; asx200?: BenchmarkData }>({})
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [selectedHoldingId, setSelectedHoldingId] = useState('')
  const [selectedSector, setSelectedSector] = useState('')
  const [expandedSectors, setExpandedSectors] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)

  const toggleSector = (sector: string) => {
    setExpandedSectors(prev => prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector])
  }

  // Generate FY options dynamically
  const fyOptions = () => {
    const now = new Date()
    const currentFYStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
    const options = []
    for (let i = 0; i < 4; i++) {
      const y = currentFYStart - i
      options.push({ value: `${y}-${y + 1}`, label: `FY ${y}-${String(y + 1).slice(-2)}` })
    }
    return options
  }

  useEffect(() => {
    setMounted(true)
    const now = new Date()
    const fyStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
    setSelectedFY(`${fyStart}-${fyStart + 1}`)
    loadData()
  }, [])

  // Fetch benchmarks when FY changes
  useEffect(() => {
    if (selectedFY) fetchBenchmarks()
  }, [selectedFY])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: holdingsData } = await supabase.from('holdings').select('id, ticker, name, currency, sector, lots(units, purchase_price, purchase_date)')
      const { data: salesData } = await supabase.from('cgt_sales').select('*').order('sale_date', { ascending: false })
      const { data: costsData } = await supabase.from('operating_costs').select('*').order('month', { ascending: false })

      setHoldings(holdingsData || [])
      setSoldLots(salesData || [])
      setOperatingCosts(costsData || [])

      try {
        const fxRes = await fetch('/api/exchange-rates')
        if (fxRes.ok) setExchangeRates(await fxRes.json())
      } catch {}

      if (holdingsData && holdingsData.length > 0) {
        const priceMap: Record<string, number> = {}
        await Promise.all(holdingsData.map(async (h: any) => {
          try {
            const res = await fetch(`/api/quote?symbol=${encodeURIComponent(h.ticker)}`)
            if (res.ok) { const d = await res.json(); if (d.price) priceMap[h.ticker] = d.price }
          } catch {}
        }))
        setPrices(priceMap)
      }
      setLoading(false)
    } catch (err) {
      console.error('Failed to load data:', err)
      setLoading(false)
    }
  }

  const fetchBenchmarks = async () => {
    if (!selectedFY) return
    setBenchmarkLoading(true)
    const [startYear] = selectedFY.split('-').map(Number)
    const startDate = `${startYear}-07-01`

    try {
      const [sp500Res, asx200Res] = await Promise.all([
        fetch(`/api/benchmark?symbol=^GSPC&startDate=${startDate}`),
        fetch(`/api/benchmark?symbol=^AXJO&startDate=${startDate}`),
      ])

      const newBenchmarks: typeof benchmarks = {}
      if (sp500Res.ok) { const d = await sp500Res.json(); if (!d.error) newBenchmarks.sp500 = d }
      if (asx200Res.ok) { const d = await asx200Res.json(); if (!d.error) newBenchmarks.asx200 = d }
      setBenchmarks(newBenchmarks)
    } catch (err) {
      console.error('Benchmark fetch error:', err)
    } finally {
      setBenchmarkLoading(false)
    }
  }

  const assignSector = async () => {
    if (!selectedHoldingId || !selectedSector) return
    try {
      const supabase = createClient()
      await supabase.from('holdings').update({ sector: selectedSector }).eq('id', selectedHoldingId)
      setHoldings(prev => prev.map(h => h.id === selectedHoldingId ? { ...h, sector: selectedSector } : h))
      setSelectedHoldingId(''); setSelectedSector('')
    } catch {}
  }

  // FY date range
  const getFYDates = (fy: string) => {
    const [startYear] = fy.split('-').map(Number)
    return { start: new Date(startYear, 6, 1), end: new Date(startYear + 1, 5, 30) }
  }

  const fyDates = getFYDates(selectedFY)
  const fySales = soldLots.filter(s => { const d = new Date(s.sale_date); return d >= fyDates.start && d <= fyDates.end })
  const fyCosts = operatingCosts.filter(c => { const d = new Date(c.month); return d >= fyDates.start && d <= fyDates.end })

  // Portfolio value
  const calculatePortfolioValue = () => {
    let totalValue = 0, totalCost = 0
    const sectorValues: Record<string, number> = {}
    holdings.forEach(h => {
      const price = prices[h.ticker] || 0
      const units = h.lots?.reduce((s, l) => s + l.units, 0) || 0
      const cost = h.lots?.reduce((s, l) => s + (l.units * l.purchase_price), 0) || 0
      let value = units * price
      if (h.currency === 'USD') value *= exchangeRates.USD_AUD
      totalValue += value; totalCost += cost
      const sector = h.sector || 'Other'
      sectorValues[sector] = (sectorValues[sector] || 0) + value
    })
    return { totalValue, totalCost, sectorValues, unrealisedGain: totalValue - totalCost }
  }

  // Trading revenue
  const calculateTradingRevenue = () => {
    const grossGains = fySales.filter(s => s.gross_gain > 0).reduce((sum, s) => sum + s.gross_gain, 0)
    const grossLosses = fySales.filter(s => s.gross_gain < 0).reduce((sum, s) => sum + Math.abs(s.gross_gain), 0)
    return { grossGains, grossLosses, netGains: fySales.reduce((sum, s) => sum + s.gross_gain, 0) }
  }

  // Trading costs
  const calculateTradingCosts = () => {
    const brokerage = fySales.reduce((sum, s) => sum + (s.sell_brokerage || 0) + (s.buy_brokerage || 0), 0)
    return { brokerage, total: brokerage }
  }

  // Operating costs — ACTUAL YTD, no annualization, no defaults
  const calculateOperatingCosts = () => {
    const monthsRecorded = fyCosts.length
    if (monthsRecorded === 0) {
      return { infraTotal: 0, researchTotal: 0, otherTotal: 0, total: 0, monthsRecorded: 0, projectedAnnual: 0 }
    }

    const infraTotal = fyCosts.reduce((s, c) => s + (c.supabase || 0) + (c.vercel || 0) + (c.api_services || 0), 0)
    const researchTotal = fyCosts.reduce((s, c) => s + (c.claude_subscription || 0) + (c.other_ai_tools || 0), 0)
    const otherTotal = fyCosts.reduce((s, c) => s + (c.other_costs || 0), 0)
    const total = infraTotal + researchTotal + otherTotal
    const projectedAnnual = (total / monthsRecorded) * 12

    return { infraTotal, researchTotal, otherTotal, total, monthsRecorded, projectedAnnual }
  }

  // CGT calculation
  const calculateCGT = () => {
    let longTermGains = 0, shortTermGains = 0, longTermLosses = 0, shortTermLosses = 0

    fySales.forEach(sale => {
      let isLongTerm = false
      if (sale.held_over_12_months !== undefined) { isLongTerm = sale.held_over_12_months }
      else if (sale.purchase_date && sale.sale_date) {
        const days = Math.floor((new Date(sale.sale_date).getTime() - new Date(sale.purchase_date).getTime()) / (1000 * 60 * 60 * 24))
        isLongTerm = days >= 365
      }
      if (sale.gross_gain >= 0) { isLongTerm ? longTermGains += sale.gross_gain : shortTermGains += sale.gross_gain }
      else { isLongTerm ? longTermLosses += Math.abs(sale.gross_gain) : shortTermLosses += Math.abs(sale.gross_gain) }
    })

    const totalLosses = shortTermLosses + longTermLosses
    let netShortTerm = shortTermGains, remainingLosses = totalLosses
    if (remainingLosses > 0) { const offset = Math.min(netShortTerm, remainingLosses); netShortTerm -= offset; remainingLosses -= offset }
    let netLongTerm = longTermGains
    if (remainingLosses > 0) netLongTerm = Math.max(0, netLongTerm - remainingLosses)
    const discountApplied = netLongTerm * 0.5
    const taxableLongTerm = netLongTerm - discountApplied
    const totalTaxable = netShortTerm + taxableLongTerm
    const cgtPayable = totalTaxable * CGT_RATE

    return { shortTermGains, longTermGains, netShortTerm, netLongTerm, discountApplied, totalTaxable, cgtPayable, totalLosses }
  }

  // Excel export
  const exportToExcel = async () => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // Tab 1: CGT Schedule
      const cgtRows = fySales.map(s => ({
        'Ticker': s.ticker,
        'Purchase Date': s.purchase_date || '—',
        'Sale Date': s.sale_date,
        'Units': s.units,
        'Cost Base': Math.round(s.cost_base * 100) / 100,
        'Sale Proceeds': Math.round(s.proceeds * 100) / 100,
        'Gross Gain/Loss': Math.round(s.gross_gain * 100) / 100,
        'Buy Brokerage': Math.round((s.buy_brokerage || 0) * 100) / 100,
        'Sell Brokerage': Math.round((s.sell_brokerage || 0) * 100) / 100,
        'Held >12 Months': s.held_over_12_months ? 'Yes' : 'No',
        'CGT Discount Eligible': s.held_over_12_months ? 'Yes' : 'No',
      }))
      const cgtSheet = XLSX.utils.json_to_sheet(cgtRows)
      XLSX.utils.book_append_sheet(wb, cgtSheet, 'CGT Schedule')

      // Tab 2: Operating Costs
      const costRows = fyCosts.map(c => {
        const d = new Date(c.month)
        return {
          'Month': `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`,
          'Supabase': c.supabase || 0,
          'Vercel': c.vercel || 0,
          'API Services': c.api_services || 0,
          'AI Tools': c.claude_subscription || 0,
          'Other': c.other_costs || 0,
          'Total': c.total_monthly || 0,
        }
      })
      const costSheet = XLSX.utils.json_to_sheet(costRows)
      XLSX.utils.book_append_sheet(wb, costSheet, 'Operating Costs')

      // Tab 3: Portfolio Summary
      const portRows = holdings.map(h => {
        const units = h.lots?.reduce((s, l) => s + l.units, 0) || 0
        const cost = h.lots?.reduce((s, l) => s + (l.units * l.purchase_price), 0) || 0
        const price = prices[h.ticker] || 0
        let value = units * price
        if (h.currency === 'USD') value *= exchangeRates.USD_AUD
        return {
          'Ticker': h.ticker,
          'Name': h.name,
          'Sector': h.sector || 'Unassigned',
          'Currency': h.currency,
          'Units': units,
          'Avg Cost': units > 0 ? Math.round((cost / units) * 100) / 100 : 0,
          'Current Price': Math.round(price * 100) / 100,
          'Cost Base (AUD)': Math.round(cost * 100) / 100,
          'Market Value (AUD)': Math.round(value * 100) / 100,
          'Unrealised Gain': Math.round((value - cost) * 100) / 100,
        }
      })
      const portSheet = XLSX.utils.json_to_sheet(portRows)
      XLSX.utils.book_append_sheet(wb, portSheet, 'Portfolio Summary')

      // Tab 4: P&L Summary
      const trading = calculateTradingRevenue()
      const tradingCosts = calculateTradingCosts()
      const opCosts = calculateOperatingCosts()
      const cgt = calculateCGT()
      const grossProfit = trading.netGains - tradingCosts.total
      const operatingProfit = grossProfit - opCosts.total
      const netPnl = operatingProfit - cgt.cgtPayable

      const plRows = [
        { 'Item': 'REVENUE', 'Amount': '' },
        { 'Item': 'Trading Gains (Gross)', 'Amount': trading.grossGains },
        { 'Item': 'Trading Losses', 'Amount': -trading.grossLosses },
        { 'Item': 'Net Trading Revenue', 'Amount': trading.netGains },
        { 'Item': '', 'Amount': '' },
        { 'Item': 'TRADING COSTS', 'Amount': '' },
        { 'Item': 'Brokerage', 'Amount': -tradingCosts.brokerage },
        { 'Item': 'Gross Profit', 'Amount': grossProfit },
        { 'Item': '', 'Amount': '' },
        { 'Item': 'OPERATING COSTS (YTD)', 'Amount': '' },
        { 'Item': 'Infrastructure', 'Amount': -opCosts.infraTotal },
        { 'Item': 'Research & Analysis', 'Amount': -opCosts.researchTotal },
        { 'Item': 'Other Costs', 'Amount': -opCosts.otherTotal },
        { 'Item': 'Operating Profit (EBIT)', 'Amount': operatingProfit },
        { 'Item': '', 'Amount': '' },
        { 'Item': 'TAX (CGT)', 'Amount': '' },
        { 'Item': 'Short-term gains (<12m)', 'Amount': cgt.shortTermGains },
        { 'Item': 'Long-term gains (≥12m)', 'Amount': cgt.longTermGains },
        { 'Item': 'Capital losses applied', 'Amount': -cgt.totalLosses },
        { 'Item': '50% CGT Discount', 'Amount': -cgt.discountApplied },
        { 'Item': 'Net Taxable Gain', 'Amount': cgt.totalTaxable },
        { 'Item': `CGT Payable @ ${(CGT_RATE * 100).toFixed(0)}%`, 'Amount': -cgt.cgtPayable },
        { 'Item': '', 'Amount': '' },
        { 'Item': 'NET PROFIT AFTER TAX', 'Amount': netPnl },
      ]
      const plSheet = XLSX.utils.json_to_sheet(plRows)
      XLSX.utils.book_append_sheet(wb, plSheet, 'P&L Summary')

      XLSX.writeFile(wb, `SWT_FY${selectedFY}_Report.xlsx`)
    } catch (err: any) {
      console.error('Export failed:', err)
      alert('Export failed. Make sure xlsx is installed: npm install xlsx')
    } finally {
      setExporting(false)
    }
  }

  const portfolio = calculatePortfolioValue()
  const trading = calculateTradingRevenue()
  const tradingCosts = calculateTradingCosts()
  const opCosts = calculateOperatingCosts()
  const cgt = calculateCGT()
  const grossProfit = trading.netGains - tradingCosts.total
  const operatingProfit = grossProfit - opCosts.total
  const netProfit = operatingProfit - cgt.cgtPayable
  const capitalDeployed = portfolio.totalCost > 0 ? portfolio.totalCost : 1
  const netReturnPct = (netProfit / capitalDeployed) * 100
  const costRatio = (opCosts.total / (portfolio.totalValue > 0 ? portfolio.totalValue : 1)) * 100

  if (!mounted) return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl font-bold text-white">Performance Report</h1>
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-8 text-center"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
    </div>
  )

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-green-400" />
            Performance Report
          </h1>
          <p className="text-sm text-gray-500">Vueon Capital — Fund Performance</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedFY} onChange={(e) => setSelectedFY(e.target.value)}
            className="px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500">
            {fyOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={exportToExcel} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-50 transition-colors">
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export
          </button>
          <button onClick={loadData} className="p-2 bg-white/10 rounded-lg hover:bg-white/15 transition-colors">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Portfolio Value</p>
          <p className="text-xl font-bold text-white">{fmt(portfolio.totalValue)}</p>
          <p className={`text-xs ${portfolio.unrealisedGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtPct((portfolio.unrealisedGain / capitalDeployed) * 100)} unrealised
          </p>
        </div>
        <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Net Profit (FY)</p>
          <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {netProfit >= 0 ? '' : '-'}{fmt(netProfit)}
          </p>
          <p className="text-xs text-gray-500">After tax & costs</p>
        </div>
        <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Net Return</p>
          <p className={`text-xl font-bold ${netReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtPct(netReturnPct)}
          </p>
          <p className="text-xs text-gray-500">On deployed capital</p>
        </div>
        <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Cost Ratio</p>
          <p className="text-xl font-bold text-white">{costRatio.toFixed(2)}%</p>
          <p className="text-xs text-gray-500">Of AUM (YTD)</p>
        </div>
      </div>

      {/* Benchmark Comparison */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          BENCHMARK COMPARISON — FY {selectedFY}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">YOUR RETURN</p>
            <p className={`text-2xl font-bold font-mono ${netReturnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmtPct(netReturnPct)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Net after tax & costs</p>
          </div>
          <div className="text-center border-l border-r border-gray-800">
            <p className="text-xs text-gray-500 mb-1">vs S&P 500</p>
            {benchmarkLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin mx-auto text-gray-500 mt-2" />
            ) : benchmarks.sp500 ? (
              <>
                <p className={`text-2xl font-bold font-mono ${benchmarks.sp500.returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(benchmarks.sp500.returnPct)}
                </p>
                <p className={`text-xs font-mono mt-1 ${(netReturnPct - benchmarks.sp500.returnPct) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  Alpha: {fmtPct(netReturnPct - benchmarks.sp500.returnPct)}
                </p>
              </>
            ) : (
              <p className="text-lg font-mono text-gray-500 mt-1">—</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">vs ASX 200</p>
            {benchmarkLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin mx-auto text-gray-500 mt-2" />
            ) : benchmarks.asx200 ? (
              <>
                <p className={`text-2xl font-bold font-mono ${benchmarks.asx200.returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(benchmarks.asx200.returnPct)}
                </p>
                <p className={`text-xs font-mono mt-1 ${(netReturnPct - benchmarks.asx200.returnPct) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  Alpha: {fmtPct(netReturnPct - benchmarks.asx200.returnPct)}
                </p>
              </>
            ) : (
              <p className="text-lg font-mono text-gray-500 mt-1">—</p>
            )}
          </div>
        </div>
      </div>

      {/* P&L Waterfall */}
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          P&L WATERFALL — FY {selectedFY}
        </h3>

        <div className="space-y-2 text-sm">
          {/* Revenue */}
          <div className="pb-2 border-b border-gray-800/50">
            <p className="text-xs font-semibold text-gray-500 mb-2">REVENUE (REALISED)</p>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Trading Gains (Gross)</span>
              <span className="font-mono text-green-400">{fmt(trading.grossGains)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Trading Losses</span>
              <span className="font-mono text-red-400">({fmt(trading.grossLosses)})</span>
            </div>
            <div className="flex justify-between py-1 font-medium">
              <span>Net Trading Revenue</span>
              <span className={`font-mono ${trading.netGains >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(trading.netGains)}</span>
            </div>
          </div>

          {/* Trading Costs */}
          <div className="pb-2 border-b border-gray-800/50">
            <p className="text-xs font-semibold text-gray-500 mb-2">TRADING COSTS</p>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Brokerage</span>
              <span className="font-mono text-red-400">({fmt(tradingCosts.brokerage)})</span>
            </div>
            <div className="flex justify-between py-1 font-medium">
              <span>Gross Profit</span>
              <span className={`font-mono ${grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(grossProfit)}</span>
            </div>
          </div>

          {/* Operating Costs — YTD */}
          <div className="pb-2 border-b border-gray-800/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                <Server className="w-3 h-3" />
                OPERATING COSTS (YTD)
              </p>
              <Link href="/settings/costs" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                Edit <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            {opCosts.monthsRecorded > 0 ? (
              <>
                {opCosts.infraTotal > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-400">Infrastructure (Supabase, Vercel, APIs)</span>
                    <span className="font-mono text-red-400">({fmt(opCosts.infraTotal)})</span>
                  </div>
                )}
                {opCosts.researchTotal > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-400">Research & Analysis (AI Tools)</span>
                    <span className="font-mono text-red-400">({fmt(opCosts.researchTotal)})</span>
                  </div>
                )}
                {opCosts.otherTotal > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-400">Other Costs</span>
                    <span className="font-mono text-red-400">({fmt(opCosts.otherTotal)})</span>
                  </div>
                )}
                <p className="text-[10px] text-gray-500 mt-1">
                  {opCosts.monthsRecorded} month{opCosts.monthsRecorded > 1 ? 's' : ''} recorded • Projected annual: {fmt(opCosts.projectedAnnual)}
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 italic py-1">No operating costs recorded for this FY</p>
            )}
            <div className="flex justify-between py-1 font-medium mt-2">
              <span>Operating Profit (EBIT)</span>
              <span className={`font-mono ${operatingProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(operatingProfit)}</span>
            </div>
          </div>

          {/* Tax / CGT */}
          <div className="pb-2 border-b border-gray-800/50">
            <p className="text-xs font-semibold text-gray-500 mb-2">TAX (CGT)</p>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Short-term gains ({'<'}12 months)</span>
              <span className="font-mono text-gray-300">{fmt(cgt.shortTermGains)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Long-term gains ({'\u2265'}12 months)</span>
              <span className="font-mono text-gray-300">{fmt(cgt.longTermGains)}</span>
            </div>
            {cgt.totalLosses > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-400">Capital losses applied</span>
                <span className="font-mono text-red-400">({fmt(cgt.totalLosses)})</span>
              </div>
            )}
            {cgt.discountApplied > 0 ? (
              <div className="flex justify-between py-1">
                <span className="text-gray-400">50% CGT Discount (long-term only)</span>
                <span className="font-mono text-cyan-400">({fmt(cgt.discountApplied)})</span>
              </div>
            ) : (
              <div className="flex justify-between py-1">
                <span className="text-gray-500 italic">No 50% discount (no long-term gains)</span>
                <span className="font-mono text-gray-400">$0.00</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-t border-gray-800/50 mt-1 pt-1">
              <span className="text-gray-400">Net Taxable Gain</span>
              <span className="font-mono text-gray-300">{fmt(cgt.totalTaxable)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">CGT Payable @ {(CGT_RATE * 100).toFixed(0)}%</span>
              <span className="font-mono text-red-400">({fmt(cgt.cgtPayable)})</span>
            </div>
          </div>

          {/* Net Profit — dark mode gradient */}
          <div className="pt-2 bg-gradient-to-r from-green-500/10 to-cyan-500/10 -mx-4 px-4 py-3 rounded-b-xl">
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-white text-base">NET PROFIT AFTER TAX</span>
              <span className={`text-2xl font-bold font-mono ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {netProfit >= 0 ? '' : '-'}{fmt(netProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Sector */}
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-400" />
          ASSIGN SECTOR TO HOLDING
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Select Holding</label>
            <select value={selectedHoldingId} onChange={(e) => setSelectedHoldingId(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500">
              <option value="">Choose holding...</option>
              {holdings.map(h => <option key={h.id} value={h.id}>{h.ticker} — {h.name} ({h.sector || 'Unassigned'})</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Assign Sector</label>
            <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)} disabled={!selectedHoldingId}
              className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500">
              <option value="">Choose sector...</option>
              {SECTOR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={assignSector} disabled={!selectedHoldingId || !selectedSector}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500 disabled:opacity-50 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Assign
            </button>
          </div>
        </div>
      </div>

      {/* Sector Allocation */}
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-purple-400" />
          SECTOR ALLOCATION
        </h3>
        <div className="space-y-2">
          {Object.entries(portfolio.sectorValues).sort((a, b) => b[1] - a[1]).map(([sector, value]) => {
            const pct = portfolio.totalValue > 0 ? (value / portfolio.totalValue) * 100 : 0
            const si = SECTORS[sector] || SECTORS['Other']
            const sectorHoldings = holdings.filter(h => (h.sector || 'Other') === sector)
            const isExpanded = expandedSectors.includes(sector)
            return (
              <div key={sector} className="border border-gray-800/50 rounded-lg overflow-hidden">
                <button onClick={() => toggleSector(sector)} className="w-full p-3 hover:bg-white/5 transition-colors">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      <span className={`font-semibold ${si.textColor}`}>{si.name}</span>
                      <span className="text-xs text-gray-400">({sectorHoldings.length})</span>
                    </div>
                    <span className="font-mono font-medium">{fmt(value)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${si.barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
                {isExpanded && sectorHoldings.length > 0 && (
                  <div className="border-t border-gray-800/50 bg-white/5 p-3 space-y-2">
                    {sectorHoldings.map(h => {
                      const units = h.lots?.reduce((s, l) => s + l.units, 0) || 0
                      const price = prices[h.ticker] || 0
                      let hv = units * price
                      if (h.currency === 'USD') hv *= exchangeRates.USD_AUD
                      return (
                        <div key={h.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-gray-300">{h.ticker}</span>
                            <span className="text-xs text-gray-400">{units} units</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-sm text-white">{fmt(hv)}</span>
                            <span className="text-xs text-gray-400 ml-2">({(value > 0 ? (hv / value) * 100 : 0).toFixed(1)}%)</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {Object.keys(portfolio.sectorValues).length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No holdings found. Add holdings to see allocation.</p>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Vueon Capital Performance Report • FY {selectedFY} • Generated {new Date().toLocaleDateString('en-AU')}
      </p>
    </div>
  )
}
