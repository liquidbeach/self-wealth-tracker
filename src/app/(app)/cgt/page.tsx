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
  Lock,
  Unlock,
  ArrowRight,
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
  sell_brokerage?: number
  buy_brokerage?: number
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

interface FYSummaryRecord {
  id?: string
  user_id?: string
  financial_year: string
  opening_carried_losses: number
  manual_loss_adjustment: number
  manual_adjustment_note?: string
  total_gross_gains: number
  total_discounts: number
  total_losses: number
  losses_applied: number
  closing_carried_losses: number
  net_taxable_gain: number
  is_finalized: boolean
  finalized_at?: string
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
  
  // Brokerage State
  const [broker, setBroker] = useState<'stake' | 'commsec' | 'cmc' | 'custom'>('stake')
  const [customSellBrokerage, setCustomSellBrokerage] = useState<string>('')
  const [buyBrokerageAdjustment, setBuyBrokerageAdjustment] = useState<string>('')
  const [regulatoryFees, setRegulatoryFees] = useState<string>('') // SEC, FINRA, etc.
  
  // Tax Estimator State
  const [baseSalary, setBaseSalary] = useState<string>('')
  
  // Offset Balance State (persisted to localStorage)
  const [offsetBalance, setOffsetBalance] = useState<string>('')
  const [showRealBalance, setShowRealBalance] = useState(false)
  
  // FY Tracking State
  const [fySummaries, setFySummaries] = useState<FYSummaryRecord[]>([])
  const [selectedFY, setSelectedFY] = useState<string>('')
  const [manualLossAdjustment, setManualLossAdjustment] = useState<string>('')
  const [manualAdjustmentNote, setManualAdjustmentNote] = useState<string>('')
  const [showCarryForward, setShowCarryForward] = useState(true)
  
  // Helper: Get FY string from date
  const getFYFromDate = (date: Date): string => {
    const year = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1
    return `${year}-${year + 1}`
  }
  
  // Helper: Get all FYs with sales
  const getAllFYs = (): string[] => {
    const fys = new Set<string>()
    soldLots.forEach(sale => {
      const saleDate = new Date(sale.sale_date)
      fys.add(getFYFromDate(saleDate))
    })
    // Always include current FY
    fys.add(getFYFromDate(new Date()))
    return Array.from(fys).sort().reverse()
  }
  
  // Load offset balance from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('swt_offset_balance')
    if (saved) setOffsetBalance(saved)
  }, [])
  
  // Save offset balance to localStorage when it changes
  useEffect(() => {
    if (offsetBalance) {
      localStorage.setItem('swt_offset_balance', offsetBalance)
    }
  }, [offsetBalance])

  // Calculate sell brokerage based on broker and proceeds
  const calculateSellBrokerage = (proceeds: number, currency: string, rate: number): number => {
    if (broker === 'custom') {
      return parseFloat(customSellBrokerage) || 0
    }
    
    if (broker === 'stake') {
      // Stake: $3 flat (USD for US stocks, AUD for AU stocks)
      return 3
    }
    
    if (broker === 'cmc') {
      // CMC: $0 first trade, then $11 or 0.10%
      // Assume not first trade
      return Math.max(11, proceeds * 0.001)
    }
    
    if (broker === 'commsec') {
      // CommSec tiered (AUD):
      // Need to convert to AUD for tier calculation if USD
      let proceedsAUD = proceeds
      if (currency === 'USD') {
        proceedsAUD = proceeds * rate
      }
      
      if (proceedsAUD <= 1000) return 5
      if (proceedsAUD <= 10000) return 10
      if (proceedsAUD <= 25000) return 19.95
      return proceedsAUD * 0.0012 // 0.12%
    }
    
    return 0
  }

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
    
    // Load FY summaries
    const { data: fyData } = await supabase
      .from('cgt_fy_summary')
      .select('*')
      .order('financial_year', { ascending: false })
    
    setHoldings(holdingsData || [])
    setSoldLots(soldData || [])
    setFySummaries(fyData || [])
    
    // Set selected FY to current FY
    const currentFY = getFYFromDate(new Date())
    setSelectedFY(currentFY)
    
    // Load manual adjustment for current FY if exists
    const currentFYRecord = (fyData || []).find((fy: FYSummaryRecord) => fy.financial_year === currentFY)
    if (currentFYRecord) {
      setManualLossAdjustment(currentFYRecord.manual_loss_adjustment?.toString() || '')
      setManualAdjustmentNote(currentFYRecord.manual_adjustment_note || '')
    }
    
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

  // Calculate complete FY summary with carry forward
  const calculateFYWithCarryForward = (fy: string): FYSummaryRecord => {
    const salesSummary = calculateTaxSummary(soldLots, fy)
    
    // Get prior FY's closing losses (our opening losses)
    const [startYear] = fy.split('-').map(Number)
    const priorFY = `${startYear - 1}-${startYear}`
    const priorFYRecord = fySummaries.find(s => s.financial_year === priorFY)
    const openingLosses = priorFYRecord?.closing_carried_losses || 0
    
    // Get manual adjustment for this FY
    const thisFYRecord = fySummaries.find(s => s.financial_year === fy)
    const manualAdj = thisFYRecord?.manual_loss_adjustment || (fy === selectedFY ? parseFloat(manualLossAdjustment) || 0 : 0)
    
    // Total available losses
    const totalAvailableLosses = openingLosses + manualAdj + salesSummary.totalLosses
    
    // Net gains after discount
    const netGainsAfterDiscount = salesSummary.totalGrossGains - salesSummary.totalDiscounts
    
    // Apply losses (losses MUST offset gains first)
    const lossesApplied = Math.min(totalAvailableLosses, netGainsAfterDiscount)
    const netTaxableGain = Math.max(0, netGainsAfterDiscount - lossesApplied)
    const closingLosses = Math.max(0, totalAvailableLosses - lossesApplied)
    
    return {
      financial_year: fy,
      opening_carried_losses: openingLosses,
      manual_loss_adjustment: manualAdj,
      manual_adjustment_note: thisFYRecord?.manual_adjustment_note || manualAdjustmentNote,
      total_gross_gains: salesSummary.totalGrossGains,
      total_discounts: salesSummary.totalDiscounts,
      total_losses: salesSummary.totalLosses,
      losses_applied: lossesApplied,
      closing_carried_losses: closingLosses,
      net_taxable_gain: netTaxableGain,
      is_finalized: thisFYRecord?.is_finalized || false,
      finalized_at: thisFYRecord?.finalized_at,
    }
  }

  // Save FY summary to database
  const saveFYSummary = async (fyRecord: FYSummaryRecord) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const existingRecord = fySummaries.find(s => s.financial_year === fyRecord.financial_year)
    
    if (existingRecord?.id) {
      // Update existing
      await supabase
        .from('cgt_fy_summary')
        .update({
          ...fyRecord,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id)
    } else {
      // Insert new
      await supabase
        .from('cgt_fy_summary')
        .insert({
          ...fyRecord,
          user_id: user.id,
        })
    }
    
    loadData()
  }

  // Finalize FY (lock it)
  const finalizeFY = async (fy: string) => {
    if (!confirm(`Finalize FY ${fy}? This locks the record after you've filed your tax return.`)) return
    
    const fyRecord = calculateFYWithCarryForward(fy)
    fyRecord.is_finalized = true
    fyRecord.finalized_at = new Date().toISOString()
    await saveFYSummary(fyRecord)
  }

  // Unlock FY (for corrections)
  const unlockFY = async (fy: string) => {
    if (!confirm(`Unlock FY ${fy}? Only do this if you need to make corrections.`)) return
    
    const supabase = createClient()
    const existingRecord = fySummaries.find(s => s.financial_year === fy)
    if (existingRecord?.id) {
      await supabase
        .from('cgt_fy_summary')
        .update({ is_finalized: false, finalized_at: null })
        .eq('id', existingRecord.id)
      loadData()
    }
  }

  // Save manual adjustment
  const saveManualAdjustment = async () => {
    const fyRecord = calculateFYWithCarryForward(selectedFY)
    fyRecord.manual_loss_adjustment = parseFloat(manualLossAdjustment) || 0
    fyRecord.manual_adjustment_note = manualAdjustmentNote
    await saveFYSummary(fyRecord)
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
    const buyBrokerageAdj = parseFloat(buyBrokerageAdjustment) || 0

    // FIFO lot selection
    const sortedLots = [...holding.lots].sort(
      (a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
    )

    let remainingUnits = units
    const salesToCreate: Partial<SoldLot>[] = []
    
    // Calculate total proceeds for brokerage calculation
    const totalGrossProceeds = units * price
    const sellBrokerage = calculateSellBrokerage(totalGrossProceeds, holding.currency, rate)
    const regFees = parseFloat(regulatoryFees) || 0
    const totalSellFees = sellBrokerage + regFees
    
    // Distribute brokerage proportionally across lots
    let totalUnitsToSell = 0
    for (const lot of sortedLots) {
      if (totalUnitsToSell >= units) break
      totalUnitsToSell += Math.min(units - totalUnitsToSell, lot.units)
    }

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

      // Proportional brokerage for this lot
      const lotProportion = unitsFromThisLot / totalUnitsToSell
      const lotSellBrokerage = totalSellFees * lotProportion
      const lotBuyBrokerageAdj = buyBrokerageAdj * lotProportion

      // Calculate with brokerage
      const costBase = (unitsFromThisLot * purchasePriceAUD) + lotBuyBrokerageAdj
      const proceeds = (unitsFromThisLot * salePriceAUD) - lotSellBrokerage
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
        sell_brokerage: lotSellBrokerage,
        buy_brokerage: lotBuyBrokerageAdj,
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
    setBroker('stake')
    setCustomSellBrokerage('')
    setBuyBrokerageAdjustment('')
    setRegulatoryFees('')
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

  // Computed FY summary with carry forward
  const currentFY = getFYFromDate(new Date())
  const viewingFY = selectedFY || currentFY
  const computedFYSummary = calculateFYWithCarryForward(viewingFY)
  const currentFYSummary = calculateTaxSummary(soldLots, currentFY)
  
  // Tax Estimator Calculation (uses computed summary with carry forward)
  const salary = parseFloat(baseSalary) || 0
  const taxableIncome = salary + computedFYSummary.net_taxable_gain
  const incomeTax = calculateIncomeTax(taxableIncome)
  const medicareLevyFull = taxableIncome * MEDICARE_LEVY_RATE
  const totalTax = incomeTax + medicareLevyFull
  const marginalRate = getMarginalRate(taxableIncome)
  const taxOnCGT = computedFYSummary.net_taxable_gain * (marginalRate / 100)

  // Preview calculation for modal
  const selectedHoldingData = holdings.find(h => h.id === selectedHolding)
  const previewUnits = parseFloat(saleUnits) || 0
  const previewPrice = parseFloat(salePrice) || 0
  const previewRate = parseFloat(exchangeRate) || 1
  const previewGrossProceeds = previewUnits * previewPrice
  const previewSellBrokerage = selectedHoldingData 
    ? calculateSellBrokerage(previewGrossProceeds, selectedHoldingData.currency, previewRate)
    : 0
  const previewRegFees = parseFloat(regulatoryFees) || 0
  const previewBuyBrokerageAdj = parseFloat(buyBrokerageAdjustment) || 0
  const previewTotalSellFees = previewSellBrokerage + previewRegFees

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

      {/* FY Summary - Dark Card */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Calculator className="w-4 h-4 text-slate-400" />
            <select
              value={viewingFY}
              onChange={(e) => {
                setSelectedFY(e.target.value)
                const fyRecord = fySummaries.find(s => s.financial_year === e.target.value)
                setManualLossAdjustment(fyRecord?.manual_loss_adjustment?.toString() || '')
                setManualAdjustmentNote(fyRecord?.manual_adjustment_note || '')
              }}
              className="bg-slate-700 text-white text-sm font-medium px-2 py-1 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {getAllFYs().map(fy => (
                <option key={fy} value={fy}>FY {fy}</option>
              ))}
            </select>
            {computedFYSummary.is_finalized && (
              <span className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-2 py-0.5 rounded">
                <Lock className="w-3 h-3" />
                Finalized
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCarryForward(!showCarryForward)}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded"
            >
              {showCarryForward ? 'Hide' : 'Show'} Details
            </button>
            <button
              onClick={() => setShowTaxEstimator(!showTaxEstimator)}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded flex items-center gap-1"
            >
              <DollarSign className="w-3 h-3" />
              Tax Est.
            </button>
          </div>
        </div>
        
        {/* Main Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <p className="text-xs text-slate-400">Gross Gains</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400">
              {formatCurrency(computedFYSummary.total_gross_gains)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">50% Discount</p>
            <p className="text-xl sm:text-2xl font-bold text-cyan-400">
              -{formatCurrency(computedFYSummary.total_discounts)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Losses Applied</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-400">
              -{formatCurrency(computedFYSummary.losses_applied)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Net Taxable</p>
            <p className={`text-xl sm:text-2xl font-bold ${computedFYSummary.net_taxable_gain >= 0 ? 'text-white' : 'text-orange-400'}`}>
              {formatCurrency(computedFYSummary.net_taxable_gain)}
            </p>
          </div>
        </div>

        {/* Carry Forward Details */}
        {showCarryForward && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <h4 className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-2">
              <ArrowRight className="w-3 h-3" />
              Carry Forward Breakdown
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left: Loss Sources */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Opening (from prior FY):</span>
                  <span className="font-medium text-orange-400">
                    {formatCurrency(computedFYSummary.opening_carried_losses)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>This FY Sales Losses:</span>
                  <span className="font-medium text-orange-400">
                    {formatCurrency(computedFYSummary.total_losses)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Manual Adjustment:</span>
                  <span className="font-medium text-orange-400">
                    {formatCurrency(computedFYSummary.manual_loss_adjustment)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-200 pt-2 border-t border-slate-600">
                  <span className="font-medium">Total Available:</span>
                  <span className="font-bold text-orange-400">
                    {formatCurrency(
                      computedFYSummary.opening_carried_losses + 
                      computedFYSummary.total_losses + 
                      computedFYSummary.manual_loss_adjustment
                    )}
                  </span>
                </div>
              </div>
              
              {/* Right: Application & Carry Forward */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Gains After Discount:</span>
                  <span className="font-medium text-emerald-400">
                    {formatCurrency(computedFYSummary.total_gross_gains - computedFYSummary.total_discounts)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Losses Used:</span>
                  <span className="font-medium text-orange-400">
                    -{formatCurrency(computedFYSummary.losses_applied)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-200 pt-2 border-t border-slate-600">
                  <span className="font-medium">Net Taxable:</span>
                  <span className="font-bold text-white">
                    {formatCurrency(computedFYSummary.net_taxable_gain)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-200 bg-slate-700 -mx-2 px-2 py-2 rounded mt-2">
                  <span className="font-medium">Carry Forward to Next FY:</span>
                  <span className="font-bold text-cyan-400">
                    {formatCurrency(computedFYSummary.closing_carried_losses)}
                  </span>
                </div>
              </div>
            </div>

            {/* Manual Adjustment Input (only for non-finalized FYs) */}
            {!computedFYSummary.is_finalized && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <label className="text-xs text-slate-400 mb-2 block">
                  Manual Loss Adjustment (pre-SWT losses or corrections)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      value={manualLossAdjustment}
                      onChange={(e) => setManualLossAdjustment(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={manualAdjustmentNote}
                    onChange={(e) => setManualAdjustmentNote(e.target.value)}
                    placeholder="Note (e.g., FY23-24 losses)"
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={saveManualAdjustment}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Finalize / Unlock Button */}
            <div className="mt-4 flex justify-end">
              {computedFYSummary.is_finalized ? (
                <button
                  onClick={() => unlockFY(viewingFY)}
                  className="flex items-center gap-1 text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded"
                >
                  <Unlock className="w-3 h-3" />
                  Unlock FY
                </button>
              ) : (
                <button
                  onClick={() => finalizeFY(viewingFY)}
                  className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded"
                >
                  <Lock className="w-3 h-3" />
                  Finalize FY (after tax filing)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick Info */}
        {!showCarryForward && (
          <div className="mt-3 flex items-start gap-2 text-xs bg-slate-700/50 text-slate-300 px-3 py-2 rounded">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              {computedFYSummary.closing_carried_losses > 0 
                ? `${formatCurrency(computedFYSummary.closing_carried_losses)} losses carry forward to next FY.`
                : 'All losses used. No carry forward.'
              }
              {' '}Click "Show Details" for full breakdown.
            </span>
          </div>
        )}
      </div>

      {/* Real Balance Calculator */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Real Balance Calculator
          </h3>
          <button
            onClick={() => setShowRealBalance(!showRealBalance)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {showRealBalance ? 'Hide' : 'Show'}
          </button>
        </div>

        {showRealBalance ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Offset Account Balance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={offsetBalance}
                  onChange={(e) => setOffsetBalance(e.target.value)}
                  placeholder="50000"
                  className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Enter your current offset/savings balance</p>
            </div>

            {parseFloat(offsetBalance) > 0 && (
              <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Offset Balance</span>
                    <span className="font-medium text-gray-900">{formatCurrency(parseFloat(offsetBalance))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Less: CGT Owed (FY {currentFY})</span>
                    <span className="font-medium text-orange-600">
                      ({formatCurrency(taxOnCGT)})
                    </span>
                  </div>
                  <div className="border-t border-emerald-300 pt-2 flex justify-between">
                    <span className="font-semibold text-gray-900">Your Real Balance</span>
                    <span className="text-xl font-bold text-emerald-600">
                      {formatCurrency(parseFloat(offsetBalance) - taxOnCGT)}
                    </span>
                  </div>
                </div>
                
                <p className="text-xs text-emerald-700 mt-3 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  This is your spendable balance after reserving for CGT at your marginal rate ({marginalRate}%).
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">
              {parseFloat(offsetBalance) > 0 
                ? `Balance: ${formatCurrency(parseFloat(offsetBalance))}` 
                : 'Enter your offset balance to see real available funds'}
            </span>
            {parseFloat(offsetBalance) > 0 && (
              <span className="text-sm font-semibold text-emerald-600">
                Real: {formatCurrency(parseFloat(offsetBalance) - taxOnCGT)}
              </span>
            )}
          </div>
        )}
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

                            <div className="mt-2 flex items-center gap-4 text-xs flex-wrap">
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
                              {(sale.sell_brokerage || sale.buy_brokerage) && (
                                <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs">
                                  Brokerage incl.
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
                          {h.ticker} ({h.currency}) - {h.name} ({totalUnits.toLocaleString()} units)
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
                  Sale Price per Unit ({selectedHoldingData?.currency || 'USD'})
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

              {selectedHoldingData?.currency === 'USD' && (
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

              {/* Brokerage Section */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Brokerage Fees</label>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Broker</label>
                    <select
                      value={broker}
                      onChange={(e) => setBroker(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="stake">Stake ($3 flat)</option>
                      <option value="commsec">CommSec (tiered: $5-0.12%)</option>
                      <option value="cmc">CMC ($11 or 0.10%)</option>
                      <option value="custom">Custom amount</option>
                    </select>
                  </div>

                  {broker === 'custom' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Sell Brokerage</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <input
                          type="number"
                          value={customSellBrokerage}
                          onChange={(e) => setCustomSellBrokerage(e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Buy Brokerage Adjustment (if not in purchase price)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        value={buyBrokerageAdjustment}
                        onChange={(e) => setBuyBrokerageAdjustment(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Add if purchase price didn't include brokerage
                    </p>
                  </div>

                  {/* Regulatory Fees */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Regulatory/Other Fees (SEC, FINRA, etc.)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        value={regulatoryFees}
                        onChange={(e) => setRegulatoryFees(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter from trade confirmation (US stocks)
                    </p>
                  </div>

                  {/* Brokerage Preview */}
                  {previewUnits > 0 && previewPrice > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs">
                      <p className="font-medium text-orange-800 mb-1">Fees Preview</p>
                      <div className="space-y-1 text-orange-700">
                        <div className="flex justify-between">
                          <span>Sell Brokerage:</span>
                          <span>${previewSellBrokerage.toFixed(2)}</span>
                        </div>
                        {previewRegFees > 0 && (
                          <div className="flex justify-between">
                            <span>Regulatory Fees:</span>
                            <span>${previewRegFees.toFixed(2)}</span>
                          </div>
                        )}
                        {previewBuyBrokerageAdj > 0 && (
                          <div className="flex justify-between">
                            <span>Buy Brokerage Adj:</span>
                            <span>${previewBuyBrokerageAdj.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium border-t border-orange-300 pt-1">
                          <span>Total Fees:</span>
                          <span>${(previewTotalSellFees + previewBuyBrokerageAdj).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
