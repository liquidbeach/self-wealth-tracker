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
  const [exchangeRate, setExchangeRate] = useState<string>('1.55') // AUD/USD at SALE date
  const [purchaseExchangeRate, setPurchaseExchangeRate] = useState<string>('') // AUD/USD at PURCHASE date (ATO monthly avg)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Brokerage State — all manual, editable, no hardcoded broker logic
  const [broker, setBroker] = useState<string>('') // free-text label (Stake/CommSec/CMC/etc.)
  const [buyBrokerage, setBuyBrokerage] = useState<string>('') // buy cost
  const [sellBrokerage, setSellBrokerage] = useState<string>('') // sell cost
  const [regulatoryFees, setRegulatoryFees] = useState<string>('') // SEC, FINRA, GST, etc.
  const [conversionFees, setConversionFees] = useState<string>('') // FX conversion fee
  const [otherFees, setOtherFees] = useState<string>('') // catch-all
  // Which currency are the fees entered in? (matches stock currency by default)
  const [feesCurrency, setFeesCurrency] = useState<'native' | 'AUD'>('native')
  // Explicit market override — 'auto' follows the holding, or force US/ASX
  const [marketOverride, setMarketOverride] = useState<'auto' | 'US' | 'ASX'>('auto')
  
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

  // Convert a fee entered in the fees currency into AUD
  // If fees are entered in native (stock) currency and stock is USD, multiply by rate.
  const feeToAUD = (feeNative: number, currency: string, rate: number): number => {
    if (feesCurrency === 'AUD') return feeNative
    // fees entered in native currency
    return currency === 'USD' ? feeNative * rate : feeNative
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
    const rate = parseFloat(exchangeRate) || 1  // sale-date rate
    // Purchase-date rate: use entered value, else fall back to sale rate for backward compat
    const buyRate = parseFloat(purchaseExchangeRate) || rate

    // FIFO lot selection
    const sortedLots = [...holding.lots].sort(
      (a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
    )

    let remainingUnits = units
    const salesToCreate: Partial<SoldLot>[] = []

    // Effective trade currency: override wins, else the holding's currency
    const tradeCurrency =
      marketOverride === 'US' ? 'USD'
      : marketOverride === 'ASX' ? 'AUD'
      : holding.currency

    // All fees are manually entered. Convert each to AUD based on feesCurrency toggle.
    const buyBrokerageAUD = feeToAUD(parseFloat(buyBrokerage) || 0, tradeCurrency, rate)
    const sellBrokerageAUD = feeToAUD(parseFloat(sellBrokerage) || 0, tradeCurrency, rate)
    const regFeesAUD = feeToAUD(parseFloat(regulatoryFees) || 0, tradeCurrency, rate)
    const conversionFeesAUD = feeToAUD(parseFloat(conversionFees) || 0, tradeCurrency, rate)
    const otherFeesAUD = feeToAUD(parseFloat(otherFees) || 0, tradeCurrency, rate)

    // Total sell-side fees (everything except buy brokerage) in AUD
    const totalSellFees = sellBrokerageAUD + regFeesAUD + conversionFeesAUD + otherFeesAUD
    const buyBrokerageAdj = buyBrokerageAUD
    
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

      // Convert to AUD if USD — purchase uses buy-date rate, sale uses sale-date rate (ATO monthly averages)
      const purchasePriceAUD = tradeCurrency === 'USD' ? lot.purchase_price * buyRate : lot.purchase_price
      const salePriceAUD = tradeCurrency === 'USD' ? price * rate : price

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
        currency: tradeCurrency,
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
    setBroker('')
    setBuyBrokerage('')
    setSellBrokerage('')
    setRegulatoryFees('')
    setConversionFees('')
    setOtherFees('')
    setMarketOverride('auto')
    setPurchaseExchangeRate('')
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
  // Effective currency: explicit override wins, else follow the holding
  const effectiveCurrency =
    marketOverride === 'US' ? 'USD'
    : marketOverride === 'ASX' ? 'AUD'
    : (selectedHoldingData?.currency || 'AUD')
  const isUSTrade = effectiveCurrency === 'USD'
  const previewUnits = parseFloat(saleUnits) || 0
  const previewPrice = parseFloat(salePrice) || 0
  const previewRate = parseFloat(exchangeRate) || 1
  const previewCurrency = effectiveCurrency
  const previewGrossProceeds = previewUnits * previewPrice
  // All fees manual; convert to AUD for preview using the same feeToAUD logic
  const previewBuyBrokerage = feeToAUD(parseFloat(buyBrokerage) || 0, previewCurrency, previewRate)
  const previewSellBrokerage = feeToAUD(parseFloat(sellBrokerage) || 0, previewCurrency, previewRate)
  const previewRegFees = feeToAUD(parseFloat(regulatoryFees) || 0, previewCurrency, previewRate)
  const previewConversionFees = feeToAUD(parseFloat(conversionFees) || 0, previewCurrency, previewRate)
  const previewOtherFees = feeToAUD(parseFloat(otherFees) || 0, previewCurrency, previewRate)
  const previewBuyBrokerageAdj = previewBuyBrokerage
  const previewTotalSellFees = previewSellBrokerage + previewRegFees + previewConversionFees + previewOtherFees
  const feesCurLabel = feesCurrency === 'AUD' ? 'AUD' : previewCurrency

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-green-400" />
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
          <h1 className="text-xl sm:text-2xl font-bold text-white">CGT Tracker</h1>
          <p className="text-sm text-gray-500">Australian Capital Gains Tax tracking</p>
        </div>
        <button
          onClick={() => setShowAddSale(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-600"
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
            <Calculator className="w-4 h-4 text-gray-500" />
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
              <span className="flex items-center gap-1 text-xs bg-green-600 text-white px-2 py-0.5 rounded">
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
            <p className="text-xs text-gray-500">Gross Gains</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400">
              {formatCurrency(computedFYSummary.total_gross_gains)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">50% Discount</p>
            <p className="text-xl sm:text-2xl font-bold text-cyan-400">
              -{formatCurrency(computedFYSummary.total_discounts)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Losses Applied</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-400">
              -{formatCurrency(computedFYSummary.losses_applied)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Net Taxable</p>
            <p className={`text-xl sm:text-2xl font-bold ${computedFYSummary.net_taxable_gain >= 0 ? 'text-white' : 'text-orange-400'}`}>
              {formatCurrency(computedFYSummary.net_taxable_gain)}
            </p>
          </div>
        </div>

        {/* Carry Forward Details */}
        {showCarryForward && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <h4 className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-2">
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
                <label className="text-xs text-gray-500 mb-2 block">
                  Manual Loss Adjustment (pre-SWT losses or corrections)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
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
                    className="px-3 py-2 bg-green-600 hover:bg-green-600 text-white text-sm rounded"
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
                  className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-600 text-white px-3 py-1.5 rounded"
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
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Real Balance Calculator
          </h3>
          <button
            onClick={() => setShowRealBalance(!showRealBalance)}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            {showRealBalance ? 'Hide' : 'Show'}
          </button>
        </div>

        {(() => {
          // Calculate CGT owed using default 32.5% or actual marginal rate if salary entered
          const effectiveRate = salary > 0 ? marginalRate : 32.5
          const netTaxableGain = computedFYSummary.net_taxable_gain
          const cgtOwed = netTaxableGain * (effectiveRate / 100)
          const offsetAmt = parseFloat(offsetBalance) || 0
          const realBalance = offsetAmt - cgtOwed

          return showRealBalance ? (
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
                    className="w-full pl-7 pr-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Enter your current offset/savings balance</p>
              </div>

              {/* CGT Calculation Breakdown */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <p className="text-xs font-medium text-orange-400 mb-2">CGT Calculation (FY {viewingFY})</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-orange-300">Net Taxable Gain:</span>
                    <span className="font-medium text-orange-400">{formatCurrency(netTaxableGain)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-300">× Tax Rate:</span>
                    <span className="font-medium text-orange-400">{effectiveRate}%</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-orange-500/30">
                    <span className="font-medium text-orange-400">CGT Owed:</span>
                    <span className="font-bold text-yellow-400">{formatCurrency(cgtOwed)}</span>
                  </div>
                </div>
                <p className="text-xs text-yellow-400 mt-2">
                  {salary > 0 
                    ? `Using marginal rate based on salary in Tax Estimator.`
                    : `Using default 32.5%. Enter salary in Tax Estimator for your actual rate.`
                  }
                </p>
              </div>

              {/* Real Balance Result */}
              {offsetAmt > 0 && (
                <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 border border-green-500/20 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Offset Balance</span>
                      <span className="font-medium text-white">{formatCurrency(offsetAmt)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Less: CGT Owed</span>
                      <span className="font-medium text-yellow-400">({formatCurrency(cgtOwed)})</span>
                    </div>
                    <div className="border-t border-emerald-300 pt-2 flex justify-between">
                      <span className="font-semibold text-white">Your Real Balance, John</span>
                      <span className="text-xl font-bold text-green-400">
                        {formatCurrency(realBalance)}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-green-400 mt-3 flex items-start gap-1">
                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    This is your spendable balance after reserving {formatCurrency(cgtOwed)} for CGT.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-400">
                {offsetAmt > 0 
                  ? `Balance: ${formatCurrency(offsetAmt)} | CGT Owed: ${formatCurrency(cgtOwed)}` 
                  : 'Enter your offset balance to see real available funds'}
              </span>
              {offsetAmt > 0 && (
                <span className="text-sm font-semibold text-green-400">
                  Real: {formatCurrency(realBalance)}
                </span>
              )}
            </div>
          )
        })()}
      </div>

      {/* Tax Estimator Panel */}
      {showTaxEstimator && (
        <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
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
                className="w-full pl-7 pr-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Base Salary</span>
              <span className="font-medium text-white">{formatCurrency(salary)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">+ Net Capital Gains</span>
              <span className={`font-medium ${currentFYSummary.netCapitalGain >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                {formatCurrency(currentFYSummary.netCapitalGain)}
              </span>
            </div>
            <div className="border-t border-gray-800 pt-2 flex justify-between text-sm">
              <span className="text-gray-400">Taxable Income</span>
              <span className="font-bold text-white">{formatCurrency(taxableIncome)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Income Tax</span>
              <span className="font-medium text-white">{formatCurrency(incomeTax)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Medicare Levy (2%)</span>
              <span className="font-medium text-white">{formatCurrency(medicareLevyFull)}</span>
            </div>
            <div className="border-t border-gray-800 pt-2 flex justify-between text-sm">
              <span className="font-semibold text-white">Total Tax Estimate</span>
              <span className="font-bold text-yellow-400">{formatCurrency(totalTax)}</span>
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
      <div className="bg-[#1c1c28] border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-800/50">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Sales History
          </h3>
          <span className="text-xs text-gray-500">{soldLots.length} sales recorded</span>
        </div>

        {soldLots.length > 0 ? (
          <div className="divide-y divide-gray-800">
            {Object.entries(salesByFY)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([fy, sales]) => {
                const fySum = calculateTaxSummary(sales)
                const isExpanded = expandedYears.has(fy)

                return (
                  <div key={fy}>
                    <button
                      onClick={() => toggleYear(fy)}
                      className="w-full flex items-center justify-between p-3 sm:p-4 bg-white/5 hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <span className="text-sm font-medium text-white">FY {fy}</span>
                        <span className="text-xs text-gray-500">({sales.length} sales)</span>
                      </div>
                      <span className={`text-sm font-semibold ${fySum.netCapitalGain >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                        Net: {formatCurrency(fySum.netCapitalGain)}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="divide-y divide-gray-50">
                        {sales.map(sale => (
                          <div key={sale.id} className="p-3 sm:p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium text-white">{sale.ticker}</p>
                                <p className="text-xs text-gray-500">{sale.name}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteSale(sale.id)}
                                className="p-1 text-gray-400 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div>
                                <p className="text-gray-500">Units Sold</p>
                                <p className="font-medium text-white">{sale.units.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Sale Date</p>
                                <p className="font-medium text-white">
                                  {new Date(sale.sale_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Proceeds (AUD)</p>
                                <p className="font-medium text-white">{formatCurrency(sale.proceeds)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Cost Base</p>
                                <p className="font-medium text-white">{formatCurrency(sale.cost_base)}</p>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center gap-4 text-xs flex-wrap">
                              <div className={`flex items-center gap-1 ${sale.gross_gain >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                {sale.gross_gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                <span>Gross: {formatCurrency(sale.gross_gain)}</span>
                              </div>
                              {sale.discount_applied && (
                                <span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded text-xs">
                                  50% Discount
                                </span>
                              )}
                              {sale.held_over_12_months && (
                                <span className="bg-green-500/100/20 text-green-400 px-1.5 py-0.5 rounded text-xs">
                                  12+ months
                                </span>
                              )}
                              {(sale.sell_brokerage || sale.buy_brokerage) && (
                                <span className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded text-xs">
                                  Brokerage incl.
                                </span>
                              )}
                              <span className={`font-semibold ${sale.net_gain >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
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
              className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-600"
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
          <div className="relative bg-[#1c1c28] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Record Sale</h2>
              <button onClick={() => setShowAddSale(false)} className="p-1 text-gray-400 hover:text-gray-400">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Stock</label>
                <select
                  value={selectedHolding}
                  onChange={(e) => setSelectedHolding(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                <label className="block text-sm font-medium text-gray-300 mb-1">Units to Sell (FIFO)</label>
                <input
                  type="number"
                  value={saleUnits}
                  onChange={(e) => setSaleUnits(e.target.value)}
                  placeholder="100"
                  step="0.01"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lots will be selected in FIFO order (oldest first)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Sale Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Sale Price per Unit ({effectiveCurrency})
                </label>
                <input
                  type="number"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="150.00"
                  step="0.01"
                  className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Market selector — drives currency, fees, conversion */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Market</label>
                <div className="flex items-center bg-black/30 rounded-lg p-0.5 border border-gray-800">
                  {[
                    { val: 'auto', label: selectedHoldingData ? `Auto (${selectedHoldingData.currency})` : 'Auto' },
                    { val: 'ASX', label: 'ASX (AUD)' },
                    { val: 'US', label: 'US (USD)' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setMarketOverride(opt.val as any)}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        marketOverride === opt.val ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-600 mt-1">
                  {isUSTrade ? 'US trade — prices & fees in USD, converted to AUD for CGT' : 'ASX trade — everything in AUD'}
                </p>
              </div>

              {isUSTrade && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Purchase FX Rate (AUD per USD)
                    </label>
                    <input
                      type="number"
                      value={purchaseExchangeRate}
                      onChange={(e) => setPurchaseExchangeRate(e.target.value)}
                      placeholder="e.g. 1.528"
                      step="0.001"
                      className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      ATO monthly avg for the BUY month. Leave blank to use sale rate.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Sale FX Rate (AUD per USD)
                    </label>
                    <input
                      type="number"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      placeholder="e.g. 1.424"
                      step="0.001"
                      className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      ATO monthly avg for the SELL month. Note: ATO quotes USD per A$1 — invert it (1 ÷ 0.7024 = 1.424).
                    </p>
                  </div>
                </div>
              )}

              {/* Fees Section — all manual & editable */}
              <div className="border-t border-gray-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">Trade Costs & Fees</label>
                  {isUSTrade && (
                    <div className="flex items-center bg-black/30 rounded-lg p-0.5 border border-gray-800">
                      <button
                        type="button"
                        onClick={() => setFeesCurrency('native')}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${feesCurrency === 'native' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500'}`}
                      >
                        Fees in USD
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeesCurrency('AUD')}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${feesCurrency === 'AUD' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500'}`}
                      >
                        Fees in AUD
                      </button>
                    </div>
                  )}
                </div>

                {/* Broker label */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">Broker (optional label)</label>
                  <input
                    type="text"
                    value={broker}
                    onChange={(e) => setBroker(e.target.value)}
                    placeholder="e.g. Stake, CommSec, CMC"
                    className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Buy Brokerage', value: buyBrokerage, set: setBuyBrokerage, hint: 'If not already in cost base' },
                    { label: 'Sell Brokerage', value: sellBrokerage, set: setSellBrokerage, hint: 'Broker sell fee' },
                    { label: 'Regulatory Fees', value: regulatoryFees, set: setRegulatoryFees, hint: 'SEC, FINRA, GST' },
                    { label: 'FX Conversion Fee', value: conversionFees, set: setConversionFees, hint: 'USD↔AUD spread' },
                    { label: 'Other Fees', value: otherFees, set: setOtherFees, hint: 'Anything else' },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                          {feesCurLabel === 'USD' ? 'US$' : 'A$'}
                        </span>
                        <input
                          type="number"
                          value={f.value}
                          onChange={(e) => f.set(e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          className="w-full pl-9 pr-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-0.5">{f.hint}</p>
                    </div>
                  ))}
                </div>

                {/* Fees Preview — always in AUD */}
                {previewUnits > 0 && previewPrice > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-xs mt-3">
                    <p className="font-medium text-orange-400 mb-1">
                      Fees Preview (converted to AUD{feesCurrency === 'native' && previewCurrency === 'USD' ? ` @ ${previewRate}` : ''})
                    </p>
                    <div className="space-y-1 text-orange-300">
                      {previewBuyBrokerage > 0 && (
                        <div className="flex justify-between"><span>Buy Brokerage:</span><span>A${previewBuyBrokerage.toFixed(2)}</span></div>
                      )}
                      {previewSellBrokerage > 0 && (
                        <div className="flex justify-between"><span>Sell Brokerage:</span><span>A${previewSellBrokerage.toFixed(2)}</span></div>
                      )}
                      {previewRegFees > 0 && (
                        <div className="flex justify-between"><span>Regulatory:</span><span>A${previewRegFees.toFixed(2)}</span></div>
                      )}
                      {previewConversionFees > 0 && (
                        <div className="flex justify-between"><span>FX Conversion:</span><span>A${previewConversionFees.toFixed(2)}</span></div>
                      )}
                      {previewOtherFees > 0 && (
                        <div className="flex justify-between"><span>Other:</span><span>A${previewOtherFees.toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between font-medium border-t border-orange-500/30 pt-1">
                        <span>Total Fees:</span>
                        <span>A${(previewTotalSellFees + previewBuyBrokerageAdj).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleAddSale}
                disabled={submitting}
                className="w-full py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
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
