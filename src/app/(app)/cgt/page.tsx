'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { 
  Calculator, 
  Plus, 
  Trash2, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
} from 'lucide-react'

// Australian Tax Brackets 2024-25
const TAX_BRACKETS = [
  { min: 0, max: 18200, rate: 0, base: 0 },
  { min: 18201, max: 45000, rate: 0.16, base: 0 },
  { min: 45001, max: 135000, rate: 0.30, base: 4288 },
  { min: 135001, max: 190000, rate: 0.37, base: 31288 },
  { min: 190001, max: Infinity, rate: 0.45, base: 51638 },
]

const MEDICARE_LEVY_RATE = 0.02

interface SoldLot {
  id: string
  holding_id: string
  ticker: string
  name: string
  units: number
  purchase_date: string
  purchase_price: number
  sale_date: string
  sale_price: number
  sale_price_aud: number
  purchase_price_aud: number
  currency: string
  exchange_rate: number
  cost_base: number
  proceeds: number
  gross_gain: number
  held_over_12_months: boolean
  discount_applied: boolean
  net_gain: number
  created_at: string
}

interface Holding {
  id: string
  ticker: string
  name: string
  currency: string
  lots: {
    id: string
    units: number
    purchase_date: string
    purchase_price: number
  }[]
}

interface TaxSummary {
  totalGrossGains: number
  totalDiscounts: number
  totalNetGains: number
  totalLosses: number
  netCapitalGain: number
}

export default function CGTPage() {
  const [soldLots, setSoldLots] = useState<SoldLot[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddSale, setShowAddSale] = useState(false)
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const [showTaxEstimator, setShowTaxEstimator] = useState(false)
  
  // Add Sale Form State
  const [selectedHolding, setSelectedHolding] = useState<string>('')
  const [saleUnits, setSaleUnits] = useState<string>('')
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [salePrice, setSalePrice] = useState<string>('')
  const [exchangeRate, setExchangeRate] = useState<string>('1.55') // Default AUD/USD
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Tax Estimator State
  const [baseSalary, setBaseSalary] = useState<string>('')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    
    // Load holdings with lots
    const { data: holdingsData } = await supabase
      .from('holdings')
      .select(`*, lots (id, units, purchase_date, purchase_price)`)
      .order('ticker', { ascending: true })
    
    // Load sold lots
    const { data: soldData } = await supabase
      .from('cgt_sales')
      .select('*')
      .order('sale_date', { ascending: false })
    
    setHoldings(holdingsData || [])
    setSoldLots(soldData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const calculateTaxSummary = (lots: SoldLot[], financialYear?: string): TaxSummary => {
    let filtered = lots
    if (financialYear) {
      const [startYear] = financialYear.split('-').map(Number)
      const fyStart = new Date(startYear, 6, 1) // July 1
      const fyEnd = new Date(startYear + 1, 5, 30) // June 30
      filtered = lots.filter(lot => {
        const saleDate = new Date(lot.sale_date)
        return saleDate >= fyStart && saleDate <= fyEnd
      })
    }
    
    let totalGrossGains = 0
    let totalDiscounts = 0
    let totalLosses = 0
    
    filtered.forEach(lot => {
      if (lot.gross_gain >= 0) {
        totalGrossGains += lot.gross_gain
        if (lot.discount_applied) {
          totalDiscounts += lot.gross_gain * 0.5
        }
      } else {
        totalLosses += Math.abs(lot.gross_gain)
      }
    })
    
    const totalNetGains = totalGrossGains - totalDiscounts
    const netCapitalGain = Math.max(0, totalNetGains - totalLosses)
    
    return {
      totalGrossGains,
      totalDiscounts,
      totalNetGains,
      totalLosses,
      netCapitalGain,
    }
  }

  const calculateIncomeTax = (taxableIncome: number): number => {
    for (const bracket of TAX_BRACKETS) {
      if (taxableIncome <= bracket.max) {
        return bracket.base + (taxableIncome - bracket.min) * bracket.rate
      }
    }
    return 0
  }

  const getMarginalRate = (taxableIncome: number): number => {
    for (const bracket of TAX_BRACKETS) {
      if (taxableIncome <= bracket.max) {
        return bracket.rate * 100
      }
    }
    return 45
  }

  const handleAddSale = async () => {
    if (!selectedHolding || !saleUnits || !saleDate || !salePrice) {
      setError('Please fill in all fields')
      return
    }

    const holding = holdings.find(h => h.id === selectedHolding)
    if (!holding) {
      setError('Holding not found')
      return
    }

    const units = parseFloat(saleUnits)
    const price = parseFloat(salePrice)
    const rate = parseFloat(exchangeRate) || 1

    // FIFO lot selection
    const sortedLots = [...holding.lots].sort(
      (a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
    )

    let remainingUnits = units
    const salesToCreate: Partial<SoldLot>[] = []

    for (const lot of sortedLots) {
      if (remainingUnits <= 0) break
      
      const unitsFromThisLot = Math.min(remainingUnits, lot.units)
      const purchaseDate = new Date(lot.purchase_date)
      const saleDateObj = new Date(saleDate)
      const holdingPeriodMs = saleDateObj.getTime() - purchaseDate.getTime()
      const holdingPeriodDays = holdingPeriodMs / (1000 * 60 * 60 * 24)
      const heldOver12Months = holdingPeriodDays >= 365

      // Convert to AUD if USD
      const purchasePriceAUD = holding.currency === 'USD' ? lot.purchase_price * rate : lot.purchase_price
      const salePriceAUD = holding.currency === 'USD' ? price * rate : price

      const costBase = unitsFromThisLot * purchasePriceAUD
      const proceeds = unitsFromThisLot * salePriceAUD
      const grossGain = proceeds - costBase
      const discountApplied = heldOver12Months && grossGain > 0
      const netGain = discountApplied ? grossGain * 0.5 : grossGain

      salesToCreate.push({
        holding_id: holding.id,
        ticker: holding.ticker,
        name: holding.name,
        units: unitsFromThisLot,
        purchase_date: lot.purchase_date,
        purchase_price: lot.purchase_price,
        sale_date: saleDate,
        sale_price: price,
        sale_price_aud: salePriceAUD,
        purchase_price_aud: purchasePriceAUD,
        currency: holding.currency,
        exchange_rate: rate,
        cost_base: costBase,
        proceeds,
        gross_gain: grossGain,
        held_over_12_months: heldOver12Months,
        discount_applied: discountApplied,
        net_gain: netGain,
      })

      remainingUnits -= unitsFromThisLot
    }

    if (remainingUnits > 0) {
      setError(`Not enough units in FIFO lots. Short by ${remainingUnits.toFixed(2)} units.`)
      return
    }

    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('Please log in')
      setSubmitting(false)
      return
    }

    // Insert sales
    for (const sale of salesToCreate) {
      await supabase.from('cgt_sales').insert({
        ...sale,
        user_id: user.id,
      })
    }

    // Update lot units (reduce by sold amount)
    let unitsToDeduct = units
    for (const lot of sortedLots) {
      if (unitsToDeduct <= 0) break
      
      const deduction = Math.min(unitsToDeduct, lot.units)
      const newUnits = lot.units - deduction
      
      if (newUnits <= 0) {
        await supabase.from('lots').delete().eq('id', lot.id)
      } else {
        await supabase.from('lots').update({ units: newUnits }).eq('id', lot.id)
      }
      
      unitsToDeduct -= deduction
    }

    setShowAddSale(false)
    setSelectedHolding('')
    setSaleUnits('')
    setSalePrice('')
    setSubmitting(false)
    loadData()
  }

  const handleDeleteSale = async (saleId: string) => {
    if (!confirm('Delete this sale record? This will not restore the original lot.')) return
    
    const supabase = createClient()
    await supabase.from('cgt_sales').delete().eq('id', saleId)
    loadData()
  }

  const toggleYear = (year: string) => {
    const newExpanded = new Set(expandedYears)
    if (newExpanded.has(year)) newExpanded.delete(year)
    else newExpanded.add(year)
    setExpandedYears(newExpanded)
  }

  // Group sales by financial year
  const salesByFY = soldLots.reduce((acc, sale) => {
    const saleDate = new Date(sale.sale_date)
    const year = saleDate.getMonth() >= 6 ? saleDate.getFullYear() : saleDate.getFullYear() - 1
    const fy = `${year}-${year + 1}`
    if (!acc[fy]) acc[fy] = []
    acc[fy].push(sale)
    return acc
  }, {} as Record<string, SoldLot[]>)

  const currentFY = new Date().getMonth() >= 6 
    ? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    : `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`
  
  const currentFYSummary = calculateTaxSummary(soldLots, currentFY)

  const formatCurrency = (value: number) => 
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Tax Estimator Calculation
  const salary = parseFloat(baseSalary) || 0
  const taxableIncome = salary + currentFYSummary.netCapitalGain
  const incomeTax = calculateIncomeTax(taxableIncome)
  const medicareLevyFull = taxableIncome * MEDICARE_LEVY_RATE
  const totalTax = incomeTax + medicareLevyFull
  const marginalRate = getMarginalRate(taxableIncome)
  const taxOnCGT = currentFYSummary.netCapitalGain * (marginalRate / 100)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-emerald-500" />
          <p className="text-sm text-gray-500">Loading CGT data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">CGT Tracker</h1>
          <p className="text-sm text-gray-500">Australian Capital Gains Tax tracking</p>
        </div>
        <button
          onClick={() => setShowAddSale(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Record Sale</span>
          <span className="sm:hidden">Sale</span>
        </button>
      </div>

      {/* Current FY Summary - Dark Card */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-white">FY {currentFY} Summary</span>
          </div>
          <button
            onClick={() => setShowTaxEstimator(!showTaxEstimator)}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded flex items-center gap-1"
          >
            <DollarSign className="w-3 h-3" />
            Tax Estimator
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <p className="text-xs text-slate-400">Gross Gains</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400">
              {formatCurrency(currentFYSummary.totalGrossGains)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">50% Discount</p>
            <p className="text-xl sm:text-2xl font-bold text-cyan-400">
              -{formatCurrency(currentFYSummary.totalDiscounts)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Losses</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-400">
              -{formatCurrency(currentFYSummary.totalLosses)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Net CGT</p>
            <p className={`text-xl sm:text-2xl font-bold ${currentFYSummary.netCapitalGain >= 0 ? 'text-white' : 'text-orange-400'}`}>
              {formatCurrency(currentFYSummary.netCapitalGain)}
            </p>
          </div>
        </div>

        {/* 50% Discount Info */}
        <div className="mt-3 flex items-start gap-2 text-xs bg-slate-700/50 text-slate-300 px-3 py-2 rounded">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Holdings sold after 12+ months receive a 50% CGT discount. 
            Losses are offset against short-term gains first.
          </span>
        </div>
      </div>

      {/* Tax Estimator Panel */}
      {showTaxEstimator && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            Tax Estimator (FY {currentFY})
          </h3>
          
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Base Salary (from PAYG)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                placeholder="120000"
                className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Base Salary</span>
              <span className="font-medium text-gray-900">{formatCurrency(salary)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">+ Net Capital Gains</span>
              <span className={`font-medium ${currentFYSummary.netCapitalGain >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                {formatCurrency(currentFYSummary.netCapitalGain)}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
              <span className="text-gray-600">Taxable Income</span>
              <span className="font-bold text-gray-900">{formatCurrency(taxableIncome)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Income Tax</span>
              <span className="font-medium text-gray-900">{formatCurrency(incomeTax)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Medicare Levy (2%)</span>
              <span className="font-medium text-gray-900">{formatCurrency(medicareLevyFull)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
              <span className="font-semibold text-gray-900">Total Tax Estimate</span>
              <span className="font-bold text-orange-600">{formatCurrency(totalTax)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 pt-1">
              <span>Marginal Rate</span>
              <span>{marginalRate}%</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Approx. Tax on CGT portion</span>
              <span>{formatCurrency(taxOnCGT)}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            * Estimate only. Does not include HECS, deductions, franking credits, or other income.
            Consult a tax professional for accurate advice.
          </p>
        </div>
      )}

      {/* Sales History */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Sales History
          </h3>
          <span className="text-xs text-gray-500">{soldLots.length} sales recorded</span>
        </div>

        {soldLots.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {Object.entries(salesByFY)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([fy, sales]) => {
                const fySum = calculateTaxSummary(sales)
                const isExpanded = expandedYears.has(fy)

                return (
                  <div key={fy}>
                    <button
                      onClick={() => toggleYear(fy)}
                      className="w-full flex items-center justify-between p-3 sm:p-4 bg-gray-50 hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <span className="text-sm font-medium text-gray-900">FY {fy}</span>
                        <span className="text-xs text-gray-500">({sales.length} sales)</span>
                      </div>
                      <span className={`text-sm font-semibold ${fySum.netCapitalGain >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                        Net: {formatCurrency(fySum.netCapitalGain)}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="divide-y divide-gray-50">
                        {sales.map(sale => (
                          <div key={sale.id} className="p-3 sm:p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium text-gray-900">{sale.ticker}</p>
                                <p className="text-xs text-gray-500">{sale.name}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteSale(sale.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div>
                                <p className="text-gray-500">Units Sold</p>
                                <p className="font-medium text-gray-900">{sale.units.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Sale Date</p>
                                <p className="font-medium text-gray-900">
                                  {new Date(sale.sale_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Proceeds (AUD)</p>
                                <p className="font-medium text-gray-900">{formatCurrency(sale.proceeds)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Cost Base</p>
                                <p className="font-medium text-gray-900">{formatCurrency(sale.cost_base)}</p>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center gap-4 text-xs">
                              <div className={`flex items-center gap-1 ${sale.gross_gain >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                {sale.gross_gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                <span>Gross: {formatCurrency(sale.gross_gain)}</span>
                              </div>
                              {sale.discount_applied && (
                                <span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded text-xs">
                                  50% Discount
                                </span>
                              )}
                              {sale.held_over_12_months && (
                                <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs">
                                  12+ months
                                </span>
                              )}
                              <span className={`font-semibold ${sale.net_gain >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                Net: {formatCurrency(sale.net_gain)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-1">No sales recorded yet</p>
            <p className="text-sm text-gray-400 mb-4">Record a sale to start tracking CGT</p>
            <button
              onClick={() => setShowAddSale(true)}
              className="text-sm px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Record Sale
            </button>
          </div>
        )}
      </div>

      {/* Add Sale Modal */}
      {showAddSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddSale(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Record Sale</h2>
              <button onClick={() => setShowAddSale(false)} className="p-1 text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                <select
                  value={selectedHolding}
                  onChange={(e) => setSelectedHolding(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a holding...</option>
                  {holdings
                    .filter(h => h.lots && h.lots.length > 0)
                    .map(h => {
                      const totalUnits = h.lots.reduce((sum, l) => sum + l.units, 0)
                      return (
                        <option key={h.id} value={h.id}>
                          {h.ticker} - {h.name} ({totalUnits.toLocaleString()} units)
                        </option>
                      )
                    })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Units to Sell (FIFO)</label>
                <input
                  type="number"
                  value={saleUnits}
                  onChange={(e) => setSaleUnits(e.target.value)}
                  placeholder="100"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lots will be selected in FIFO order (oldest first)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale Price per Unit ({holdings.find(h => h.id === selectedHolding)?.currency || 'USD'})
                </label>
                <input
                  type="number"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="150.00"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {holdings.find(h => h.id === selectedHolding)?.currency === 'USD' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exchange Rate (AUD per USD)
                  </label>
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    placeholder="1.55"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use RBA exchange rate on sale date for ATO compliance
                  </p>
                </div>
              )}

              <button
                onClick={handleAddSale}
                disabled={submitting}
                className="w-full py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Record Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
