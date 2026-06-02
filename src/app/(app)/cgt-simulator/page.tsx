'use client'

import { useState, useEffect, useMemo } from 'react'
import { Calculator, TrendingUp, Calendar, AlertTriangle, CheckCircle, DollarSign, Target, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface Lot {
  id: string
  units: number
  purchase_price: number
  purchase_date: string
  notes?: string
}

interface Stock {
  id: string
  ticker: string
  name: string
}

interface Holding {
  id: string
  stock_id: string
  ticker: string
  name: string
  total_units: number
  average_price: number
  current_price?: number
  lots: Lot[]
}

interface SimulationResult {
  lotsUsed: {
    lot: Lot
    unitsUsed: number
    costBase: number
    proceeds: number
    gain: number
    heldDays: number
    discountEligible: boolean
    taxableGain: number
    cgt: number
  }[]
  summary: {
    totalUnits: number
    grossProceeds: number
    totalCostBase: number
    totalGain: number
    totalTaxableGain: number
    totalCGT: number
    netProceeds: number
    remainingUnits: number
  }
}

const TAX_RATE = 0.325 // 32.5% marginal rate
const DISCOUNT_DAYS = 365 // 12 months for CGT discount

export default function CGTSimulatorPage() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null)
  const [simulationMode, setSimulationMode] = useState<'units' | 'value' | 'costbase'>('units')
  const [inputValue, setInputValue] = useState<string>('')
  const [currentPrice, setCurrentPrice] = useState<string>('')
  const [result, setResult] = useState<SimulationResult | null>(null)

  // Fetch holdings with lots directly from Supabase
  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        const supabase = createClient()
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        // Fetch holdings with stocks and lots
        const { data: holdingsData, error: holdingsError } = await supabase
          .from('holdings')
          .select('*, lots(*)')
          .eq('user_id', user.id)

        if (holdingsError) {
          console.error('Error fetching holdings:', holdingsError)
          setLoading(false)
          return
        }

        // Transform data to expected format
        const transformedHoldings: Holding[] = (holdingsData || []).map((h: any) => {
          const lots = h.lots || []
          const totalUnits = lots.reduce((sum: number, lot: any) => sum + (lot.units || 0), 0)
          const totalCost = lots.reduce((sum: number, lot: any) => sum + ((lot.units || 0) * (lot.purchase_price || 0)), 0)
          const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0

          return {
            id: h.id,
            stock_id: h.stock_id,
            ticker: h.ticker || 'Unknown',
            name: h.name || 'Unknown',
            total_units: totalUnits,
            average_price: avgPrice,
            lots: lots
          }
        }).filter((h: Holding) => h.total_units > 0)

        setHoldings(transformedHoldings)
      } catch (error) {
        console.error('Error fetching holdings:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchHoldings()
  }, [])

  // Sort lots by FIFO (oldest first)
  const sortedLots = useMemo(() => {
    if (!selectedHolding?.lots) return []
    return [...selectedHolding.lots].sort(
      (a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
    )
  }, [selectedHolding])

  // Calculate days held
  const getDaysHeld = (purchaseDate: string): number => {
    const purchase = new Date(purchaseDate)
    const today = new Date()
    return Math.floor((today.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Simulate sale
  const runSimulation = () => {
    if (!selectedHolding || !currentPrice || sortedLots.length === 0) return

    const price = parseFloat(currentPrice)
    if (isNaN(price) || price <= 0) return

    let unitsToSell = 0
    
    if (simulationMode === 'units') {
      unitsToSell = parseFloat(inputValue) || 0
    } else if (simulationMode === 'value') {
      // Calculate units needed to get target value (before CGT)
      const targetValue = parseFloat(inputValue) || 0
      unitsToSell = Math.ceil(targetValue / price)
    } else if (simulationMode === 'costbase') {
      // Calculate units needed to extract total cost base
      // This is iterative since CGT affects net proceeds
      const totalCostBase = sortedLots.reduce((sum, lot) => sum + (lot.units * lot.purchase_price), 0)
      
      // Solve for units: we need net proceeds = cost base
      // Start with estimate and iterate
      let estimate = 0
      let remainingUnits = sortedLots.reduce((sum, lot) => sum + lot.units, 0)
      let tempUnits = 0
      
      for (const lot of sortedLots) {
        const availableUnits = lot.units
        const costPerUnit = lot.purchase_price
        const daysHeld = getDaysHeld(lot.purchase_date)
        const hasDiscount = daysHeld >= DISCOUNT_DAYS
        
        for (let u = 1; u <= availableUnits && estimate < totalCostBase * 1.5; u++) {
          const proceeds = price * (tempUnits + u)
          const costBase = sortedLots.slice(0, sortedLots.indexOf(lot)).reduce((sum, l) => sum + (l.units * l.purchase_price), 0) + (u * costPerUnit)
          const gain = proceeds - costBase
          const taxableGain = gain > 0 ? (hasDiscount ? gain * 0.5 : gain) : 0
          const cgt = taxableGain * TAX_RATE
          const net = proceeds - cgt
          
          if (net >= totalCostBase) {
            unitsToSell = tempUnits + u
            estimate = totalCostBase
            break
          }
        }
        
        if (estimate >= totalCostBase) break
        tempUnits += availableUnits
      }
      
      if (unitsToSell === 0) {
        // Need to sell all units
        unitsToSell = remainingUnits
      }
    }

    // Ensure we don't exceed available units
    const totalAvailable = sortedLots.reduce((sum, lot) => sum + lot.units, 0)
    unitsToSell = Math.min(unitsToSell, totalAvailable)

    // Calculate FIFO sale
    let remainingToSell = unitsToSell
    const lotsUsed: SimulationResult['lotsUsed'] = []

    for (const lot of sortedLots) {
      if (remainingToSell <= 0) break

      const unitsFromThisLot = Math.min(lot.units, remainingToSell)
      const costBase = unitsFromThisLot * lot.purchase_price
      const proceeds = unitsFromThisLot * price
      const gain = proceeds - costBase
      const daysHeld = getDaysHeld(lot.purchase_date)
      const discountEligible = daysHeld >= DISCOUNT_DAYS
      const taxableGain = gain > 0 ? (discountEligible ? gain * 0.5 : gain) : Math.max(gain, 0)
      const cgt = taxableGain * TAX_RATE

      lotsUsed.push({
        lot,
        unitsUsed: unitsFromThisLot,
        costBase,
        proceeds,
        gain,
        heldDays: daysHeld,
        discountEligible,
        taxableGain,
        cgt
      })

      remainingToSell -= unitsFromThisLot
    }

    // Calculate summary
    const summary = {
      totalUnits: lotsUsed.reduce((sum, l) => sum + l.unitsUsed, 0),
      grossProceeds: lotsUsed.reduce((sum, l) => sum + l.proceeds, 0),
      totalCostBase: lotsUsed.reduce((sum, l) => sum + l.costBase, 0),
      totalGain: lotsUsed.reduce((sum, l) => sum + l.gain, 0),
      totalTaxableGain: lotsUsed.reduce((sum, l) => sum + l.taxableGain, 0),
      totalCGT: lotsUsed.reduce((sum, l) => sum + l.cgt, 0),
      netProceeds: lotsUsed.reduce((sum, l) => sum + l.proceeds - l.cgt, 0),
      remainingUnits: totalAvailable - lotsUsed.reduce((sum, l) => sum + l.unitsUsed, 0)
    }

    setResult({ lotsUsed, summary })
  }

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2
    }).format(value)
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Reset simulation
  const resetSimulation = () => {
    setResult(null)
    setInputValue('')
  }

  // When holding changes, reset
  useEffect(() => {
    resetSimulation()
    if (selectedHolding?.current_price) {
      setCurrentPrice(selectedHolding.current_price.toString())
    } else {
      setCurrentPrice('')
    }
  }, [selectedHolding])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading holdings...</div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calculator className="w-7 h-7 text-emerald-600" />
          CGT Simulator
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Plan your sales before executing — see CGT impact using FIFO method
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How it works</p>
            <ul className="space-y-1 text-blue-700">
              <li>• Uses FIFO (First In, First Out) — oldest lots sell first</li>
              <li>• Holdings held 12+ months get 50% CGT discount</li>
              <li>• Tax rate: 32.5% (your marginal rate)</li>
              <li>• "Extract Cost Base" mode calculates units to de-risk while leaving runners</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Section */}
        <div className="space-y-4">
          {/* Stock Selector */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Stock to Simulate
            </label>
            <select
              value={selectedHolding?.id || ''}
              onChange={(e) => {
                const holding = holdings.find(h => h.id === e.target.value)
                setSelectedHolding(holding || null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Choose a holding...</option>
              {holdings.map(h => (
                <option key={h.id} value={h.id}>
                  {h.ticker} — {h.total_units} units @ avg {formatCurrency(h.average_price)}
                </option>
              ))}
            </select>
          </div>

          {selectedHolding && (
            <>
              {/* Current Price Input */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current/Expected Sale Price (per unit)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value)}
                    placeholder="Enter sale price"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Simulation Mode */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Simulation Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="mode"
                      checked={simulationMode === 'units'}
                      onChange={() => { setSimulationMode('units'); resetSimulation() }}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Sell by Units</p>
                      <p className="text-xs text-gray-500">I want to sell X units</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="mode"
                      checked={simulationMode === 'value'}
                      onChange={() => { setSimulationMode('value'); resetSimulation() }}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Sell by Target Value</p>
                      <p className="text-xs text-gray-500">I want $X in gross proceeds</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg cursor-pointer hover:bg-emerald-100 transition-colors">
                    <input
                      type="radio"
                      name="mode"
                      checked={simulationMode === 'costbase'}
                      onChange={() => { setSimulationMode('costbase'); resetSimulation() }}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-medium text-emerald-900">Extract Cost Base</p>
                      <p className="text-xs text-emerald-700">De-risk: get your money back, let runners ride</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Input Value */}
              {simulationMode !== 'costbase' && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {simulationMode === 'units' ? 'Units to Sell' : 'Target Gross Proceeds'}
                  </label>
                  <div className="relative">
                    {simulationMode === 'value' && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    )}
                    <input
                      type="number"
                      step={simulationMode === 'units' ? '1' : '0.01'}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={simulationMode === 'units' ? 'Number of units' : 'Amount in AUD'}
                      className={`w-full ${simulationMode === 'value' ? 'pl-8' : 'pl-4'} pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500`}
                    />
                  </div>
                </div>
              )}

              {/* Run Simulation Button */}
              <button
                onClick={runSimulation}
                disabled={!currentPrice || (simulationMode !== 'costbase' && !inputValue)}
                className="w-full py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Calculator className="w-5 h-5" />
                Run Simulation
              </button>

              {/* Current Holdings Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Current Lots (FIFO Order)</h3>
                <div className="space-y-2">
                  {sortedLots.map((lot, idx) => {
                    const daysHeld = getDaysHeld(lot.purchase_date)
                    const isEligible = daysHeld >= DISCOUNT_DAYS
                    const daysUntilEligible = DISCOUNT_DAYS - daysHeld

                    return (
                      <div key={lot.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-100 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-medium">{lot.units} units</span>
                            <span className="text-gray-500"> @ {formatCurrency(lot.purchase_price)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{formatDate(lot.purchase_date)}</span>
                          {isEligible ? (
                            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              50% discount
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {daysUntilEligible}d to discount
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm">
                  <span className="text-gray-600">Total Cost Base:</span>
                  <span className="font-medium">{formatCurrency(sortedLots.reduce((sum, lot) => sum + (lot.units * lot.purchase_price), 0))}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Results Section */}
        <div>
          {result ? (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-600" />
                  Simulation Results
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Units to Sell</p>
                    <p className="text-xl font-bold text-gray-900">{result.summary.totalUnits}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Remaining (Runners)</p>
                    <p className="text-xl font-bold text-emerald-600">{result.summary.remainingUnits}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Gross Proceeds</span>
                    <span className="font-medium">{formatCurrency(result.summary.grossProceeds)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Total Cost Base</span>
                    <span className="font-medium">({formatCurrency(result.summary.totalCostBase)})</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Capital Gain</span>
                    <span className={`font-medium ${result.summary.totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(result.summary.totalGain)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Taxable Gain (after discounts)</span>
                    <span className="font-medium">{formatCurrency(result.summary.totalTaxableGain)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">CGT Owed (@ 32.5%)</span>
                    <span className="font-medium text-red-600">({formatCurrency(result.summary.totalCGT)})</span>
                  </div>
                  <div className="flex justify-between py-3 bg-emerald-50 rounded-lg px-3 mt-2">
                    <span className="font-semibold text-emerald-900">Net Proceeds</span>
                    <span className="font-bold text-lg text-emerald-700">{formatCurrency(result.summary.netProceeds)}</span>
                  </div>
                </div>
              </div>

              {/* Lot Breakdown */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Lot-by-Lot Breakdown (FIFO)</h3>
                <div className="space-y-3">
                  {result.lotsUsed.map((item, idx) => (
                    <div key={item.lot.id} className={`p-3 rounded-lg border ${item.discountEligible ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Lot {idx + 1}</span>
                          <span className="text-sm text-gray-600">
                            {item.unitsUsed} of {item.lot.units} units @ {formatCurrency(item.lot.purchase_price)}
                          </span>
                        </div>
                        {item.discountEligible ? (
                          <span className="text-xs px-2 py-1 bg-emerald-200 text-emerald-800 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            50% CGT Discount
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-amber-200 text-amber-800 rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            No Discount
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>Purchased: {formatDate(item.lot.purchase_date)}</div>
                        <div>Held: {item.heldDays} days</div>
                        <div>Gain: {formatCurrency(item.gain)}</div>
                        <div>CGT: <span className="text-red-600 font-medium">{formatCurrency(item.cgt)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* What If Section */}
              {result.lotsUsed.some(l => !l.discountEligible) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Calendar className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-yellow-900">💡 Wait for CGT Discount?</p>
                      <div className="text-sm text-yellow-800 mt-1 space-y-1">
                        {result.lotsUsed.filter(l => !l.discountEligible).map((item, idx) => {
                          const daysToDiscount = DISCOUNT_DAYS - item.heldDays
                          const potentialSaving = item.taxableGain * 0.5 * TAX_RATE
                          return (
                            <p key={idx}>
                              Lot {result.lotsUsed.indexOf(item) + 1}: Wait {daysToDiscount} more days → Save {formatCurrency(potentialSaving)} in CGT
                            </p>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">Simulation results will appear here</p>
              <p className="text-sm text-gray-400 mt-1">Select a stock and run a simulation to see CGT breakdown</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
        For planning purposes only • Not financial or tax advice • Consult a tax professional
      </div>
    </div>
  )
}
