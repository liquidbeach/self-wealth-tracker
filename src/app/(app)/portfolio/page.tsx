'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { 
  Plus, 
  Briefcase, 
  ChevronDown, 
  ChevronRight, 
  Edit2, 
  Trash2,
  Upload,
  Wallet,
  MoreHorizontal
} from 'lucide-react'
import AddHoldingModal from '@/components/AddHoldingModal'
import AddLotModal from '@/components/AddLotModal'
import EditHoldingModal from '@/components/EditHoldingModal'
import CashBalanceModal from '@/components/CashBalanceModal'
import ImportDataModal from '@/components/ImportDataModal'
import RefreshPricesButton from '@/components/RefreshPricesButton'

interface Lot {
  id: string
  units: number
  purchase_date: string
  purchase_price: number
  notes: string | null
}

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
  notes: string | null
  thesis: string | null
  lots: Lot[]
}

interface CashBalance {
  id: string
  account_name: string
  currency: string
  balance: number
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedHoldings, setExpandedHoldings] = useState<Set<string>>(new Set())
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null)
  
  // Modal states
  const [showAddHolding, setShowAddHolding] = useState(false)
  const [showAddLot, setShowAddLot] = useState(false)
  const [showEditHolding, setShowEditHolding] = useState(false)
  const [showCashBalance, setShowCashBalance] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    
    // Load holdings with lots
    const { data: holdingsData } = await supabase
      .from('holdings')
      .select(`
        *,
        lots (*)
      `)
      .order('ticker', { ascending: true })

    // Load cash balances
    const { data: cashData } = await supabase
      .from('cash_balances')
      .select('*')
      .order('currency', { ascending: true })

    setHoldings(holdingsData || [])
    setCashBalances(cashData || [])
    setLoading(false)
    setLastPriceUpdate(new Date())
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleExpanded = (holdingId: string) => {
    const newExpanded = new Set(expandedHoldings)
    if (newExpanded.has(holdingId)) {
      newExpanded.delete(holdingId)
    } else {
      newExpanded.add(holdingId)
    }
    setExpandedHoldings(newExpanded)
  }

  const handleAddLot = (holding: Holding) => {
    setSelectedHolding(holding)
    setShowAddLot(true)
  }

  const handleEditHolding = (holding: Holding) => {
    setSelectedHolding(holding)
    setShowEditHolding(true)
  }

  const handleDeleteLot = async (lotId: string) => {
    if (!confirm('Delete this lot?')) return
    
    const supabase = createClient()
    await supabase.from('lots').delete().eq('id', lotId)
    loadData()
  }

  // Calculate totals
  const getCashByCurrency = (currency: string): number => {
    return cashBalances
      .filter(c => c.currency === currency)
      .reduce((sum, c) => sum + Number(c.balance), 0)
  }

  const calculateHoldingStats = (holding: Holding) => {
    const lots = holding.lots || []
    const totalUnits = lots.reduce((sum, lot) => sum + Number(lot.units), 0)
    const totalCost = lots.reduce((sum, lot) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0)
    const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0
    const currentPrice = holding.current_price || avgPrice
    const currentValue = totalUnits * currentPrice
    const gainLoss = currentValue - totalCost
    const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0
    const firstBuyDate = lots.length > 0 
      ? lots.reduce((earliest, lot) => lot.purchase_date < earliest ? lot.purchase_date : earliest, lots[0].purchase_date)
      : null

    return { totalUnits, totalCost, avgPrice, currentPrice, currentValue, gainLoss, gainLossPct, firstBuyDate }
  }

  const getCurrencySymbol = (currency: string) => {
    if (currency === 'INR') return '₹'
    return '$'
  }

  const formatCurrency = (value: number, currency: string) => {
    const symbol = getCurrencySymbol(currency)
    return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }

  // Calculate portfolio totals by currency
  const calculatePortfolioTotals = () => {
    const totals: Record<string, { value: number; cost: number; gain: number }> = {
      AUD: { value: 0, cost: 0, gain: 0 },
      USD: { value: 0, cost: 0, gain: 0 },
      INR: { value: 0, cost: 0, gain: 0 }
    }

    holdings.forEach(holding => {
      const stats = calculateHoldingStats(holding)
      const currency = holding.currency
      if (totals[currency]) {
        totals[currency].value += stats.currentValue
        totals[currency].cost += stats.totalCost
        totals[currency].gain += stats.gainLoss
      }
    })

    return totals
  }

  const portfolioTotals = calculatePortfolioTotals()

  // Group holdings by currency
  const holdingsByCurrency = holdings.reduce((acc, holding) => {
    const currency = holding.currency
    if (!acc[currency]) acc[currency] = []
    acc[currency].push(holding)
    return acc
  }, {} as Record<string, Holding[]>)

  // Define column widths for consistent alignment
  const colWidths = {
    expand: 'w-10',
    holding: 'w-[220px]',
    type: 'w-[100px]',
    firstBuy: 'w-[120px]',
    units: 'w-[100px]',
    avgPrice: 'w-[100px]',
    current: 'w-[100px]',
    value: 'w-[120px]',
    gainLoss: 'w-[100px]',
    actions: 'w-[80px]'
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portfolio</h1>
          <p className="text-slate-500">Track your holdings and performance</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshPricesButton onSuccess={loadData} />
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="btn-secondary flex items-center gap-2"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowCashBalance(true)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Wallet className="w-4 h-4" />
                    Manage Cash
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowImport(true)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Upload className="w-4 h-4" />
                    Import Data
                  </button>
                </div>
              </>
            )}
          </div>
          <button 
            onClick={() => setShowAddHolding(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Holding
          </button>
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AUD */}
        <div className="card">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm text-slate-500">🇦🇺 Australian (AUD)</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            ${(portfolioTotals.AUD.value + getCashByCurrency('AUD')).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </p>
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-slate-500">
              Cash: ${getCashByCurrency('AUD').toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
            {portfolioTotals.AUD.cost > 0 && (
              <span className={portfolioTotals.AUD.gain >= 0 ? 'text-green-600' : 'text-red-600'}>
                {portfolioTotals.AUD.gain >= 0 ? '+' : ''}
                {((portfolioTotals.AUD.gain / portfolioTotals.AUD.cost) * 100).toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* USD */}
        <div className="card">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm text-slate-500">🇺🇸 US (USD)</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            ${(portfolioTotals.USD.value + getCashByCurrency('USD')).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-slate-500">
              Cash: ${getCashByCurrency('USD').toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            {portfolioTotals.USD.cost > 0 && (
              <span className={portfolioTotals.USD.gain >= 0 ? 'text-green-600' : 'text-red-600'}>
                {portfolioTotals.USD.gain >= 0 ? '+' : ''}
                {((portfolioTotals.USD.gain / portfolioTotals.USD.cost) * 100).toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* INR */}
        <div className="card">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm text-slate-500">🇮🇳 Indian (INR)</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            ₹{(portfolioTotals.INR.value + getCashByCurrency('INR')).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-slate-500">
              Cash: ₹{getCashByCurrency('INR').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            {portfolioTotals.INR.cost > 0 && (
              <span className={portfolioTotals.INR.gain >= 0 ? 'text-green-600' : 'text-red-600'}>
                {portfolioTotals.INR.gain >= 0 ? '+' : ''}
                {((portfolioTotals.INR.gain / portfolioTotals.INR.cost) * 100).toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Holdings */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Holdings</h3>
          {lastPriceUpdate && (
            <span className="text-xs text-slate-400">
              Prices as of {lastPriceUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-slate-400">
            Loading...
          </div>
        ) : holdings.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(holdingsByCurrency).map(([currency, currencyHoldings]) => (
              <div key={currency}>
                <h4 className="text-sm font-medium text-slate-500 mb-3 uppercase tracking-wide">
                  {currency === 'AUD' ? '🇦🇺 Australian (AUD)' : 
                   currency === 'USD' ? '🇺🇸 US (USD)' : 
                   '🇮🇳 Indian (INR)'}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className={`${colWidths.expand} text-left py-3 px-2`}></th>
                        <th className={`${colWidths.holding} text-left py-3 px-2 text-sm font-medium text-slate-500`}>Holding</th>
                        <th className={`${colWidths.type} text-left py-3 px-2 text-sm font-medium text-slate-500`}>Type</th>
                        <th className={`${colWidths.firstBuy} text-left py-3 px-2 text-sm font-medium text-slate-500`}>First Buy</th>
                        <th className={`${colWidths.units} text-right py-3 px-2 text-sm font-medium text-slate-500`}>Units</th>
                        <th className={`${colWidths.avgPrice} text-right py-3 px-2 text-sm font-medium text-slate-500`}>Avg Price</th>
                        <th className={`${colWidths.current} text-right py-3 px-2 text-sm font-medium text-slate-500`}>Current</th>
                        <th className={`${colWidths.value} text-right py-3 px-2 text-sm font-medium text-slate-500`}>Value</th>
                        <th className={`${colWidths.gainLoss} text-right py-3 px-2 text-sm font-medium text-slate-500`}>Gain/Loss</th>
                        <th className={`${colWidths.actions} text-right py-3 px-2`}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {currencyHoldings.map((holding) => {
                        const stats = calculateHoldingStats(holding)
                        const isExpanded = expandedHoldings.has(holding.id)
                        const lots = holding.lots || []
                        const hasLivePrice = holding.current_price !== null

                        return (
                          <>
                            <tr 
                              key={holding.id} 
                              className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                              onClick={() => lots.length > 0 && toggleExpanded(holding.id)}
                            >
                              <td className={`${colWidths.expand} py-3 px-2`}>
                                {lots.length > 0 && (
                                  isExpanded ? 
                                    <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </td>
                              <td className={`${colWidths.holding} py-3 px-2`}>
                                <div>
                                  <p className="font-medium text-slate-900">{holding.ticker}</p>
                                  <p className="text-sm text-slate-500 truncate">{holding.name}</p>
                                </div>
                              </td>
                              <td className={`${colWidths.type} py-3 px-2`}>
                                <span className="text-sm text-slate-600">{holding.asset_type}</span>
                              </td>
                              <td className={`${colWidths.firstBuy} py-3 px-2 text-sm text-slate-600`}>
                                {stats.firstBuyDate ? formatDate(stats.firstBuyDate) : '-'}
                              </td>
                              <td className={`${colWidths.units} py-3 px-2 text-sm text-slate-900 text-right`}>
                                {stats.totalUnits.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                {lots.length > 1 && (
                                  <span className="text-slate-400 text-xs ml-1">({lots.length})</span>
                                )}
                              </td>
                              <td className={`${colWidths.avgPrice} py-3 px-2 text-sm text-slate-900 text-right`}>
                                {formatCurrency(stats.avgPrice, currency)}
                              </td>
                              <td className={`${colWidths.current} py-3 px-2 text-sm text-right`}>
                                <span className={hasLivePrice ? 'text-slate-900' : 'text-slate-400'}>
                                  {formatCurrency(stats.currentPrice, currency)}
                                </span>
                              </td>
                              <td className={`${colWidths.value} py-3 px-2 text-sm text-slate-900 text-right font-medium`}>
                                {formatCurrency(stats.currentValue, currency)}
                              </td>
                              <td className={`${colWidths.gainLoss} py-3 px-2 text-sm text-right font-medium ${
                                stats.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {stats.totalCost > 0 ? (
                                  `${stats.gainLoss >= 0 ? '+' : ''}${stats.gainLossPct.toFixed(1)}%`
                                ) : '-'}
                              </td>
                              <td className={`${colWidths.actions} py-3 px-2 text-right`} onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleAddLot(holding)}
                                    className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                                    title="Add lot"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleEditHolding(holding)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {/* Expanded lots */}
                            {isExpanded && lots.length > 0 && (
                              <tr key={`${holding.id}-lots`}>
                                <td colSpan={10} className="bg-slate-50 px-2 py-3">
                                  <div className="ml-10">
                                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">Purchase Lots</p>
                                    <table className="w-full table-fixed">
                                      <thead>
                                        <tr className="text-xs text-slate-500">
                                          <th className="w-[120px] text-left py-1 px-2">Date</th>
                                          <th className="w-[100px] text-right py-1 px-2">Units</th>
                                          <th className="w-[100px] text-right py-1 px-2">Price</th>
                                          <th className="w-[120px] text-right py-1 px-2">Cost</th>
                                          <th className="w-[100px] text-right py-1 px-2">Gain/Loss</th>
                                          <th className="w-[50px] text-right py-1 px-2"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lots.map((lot) => {
                                          const lotCost = Number(lot.units) * Number(lot.purchase_price)
                                          const lotValue = Number(lot.units) * stats.currentPrice
                                          const lotGain = lotValue - lotCost
                                          const lotGainPct = lotCost > 0 ? (lotGain / lotCost) * 100 : 0

                                          return (
                                            <tr key={lot.id} className="text-sm border-t border-slate-200">
                                              <td className="w-[120px] py-2 px-2 text-slate-600">
                                                {formatDate(lot.purchase_date)}
                                              </td>
                                              <td className="w-[100px] py-2 px-2 text-right text-slate-900">
                                                {Number(lot.units).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                              </td>
                                              <td className="w-[100px] py-2 px-2 text-right text-slate-900">
                                                {formatCurrency(Number(lot.purchase_price), currency)}
                                              </td>
                                              <td className="w-[120px] py-2 px-2 text-right text-slate-900">
                                                {formatCurrency(lotCost, currency)}
                                              </td>
                                              <td className={`w-[100px] py-2 px-2 text-right font-medium ${
                                                lotGain >= 0 ? 'text-green-600' : 'text-red-600'
                                              }`}>
                                                {hasLivePrice ? (
                                                  `${lotGain >= 0 ? '+' : ''}${lotGainPct.toFixed(1)}%`
                                                ) : '-'}
                                              </td>
                                              <td className="w-[50px] py-2 px-2 text-right">
                                                <button
                                                  onClick={() => handleDeleteLot(lot.id)}
                                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                  title="Delete lot"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                    {holding.thesis && (
                                      <div className="mt-3 pt-3 border-t border-slate-200">
                                        <p className="text-xs font-medium text-slate-500 uppercase mb-1">Thesis</p>
                                        <p className="text-sm text-slate-600">{holding.thesis}</p>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No holdings yet</p>
            <p className="text-sm mb-4">Add your first holding or import from your HTML tracker</p>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setShowImport(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import Data
              </button>
              <button 
                onClick={() => setShowAddHolding(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Holding
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddHoldingModal
        isOpen={showAddHolding}
        onClose={() => setShowAddHolding(false)}
        onSuccess={loadData}
      />
      <AddLotModal
        isOpen={showAddLot}
        onClose={() => {
          setShowAddLot(false)
          setSelectedHolding(null)
        }}
        onSuccess={loadData}
        holding={selectedHolding}
      />
      <EditHoldingModal
        isOpen={showEditHolding}
        onClose={() => {
          setShowEditHolding(false)
          setSelectedHolding(null)
        }}
        onSuccess={loadData}
        onDelete={loadData}
        holding={selectedHolding}
      />
      <CashBalanceModal
        isOpen={showCashBalance}
        onClose={() => setShowCashBalance(false)}
        onSuccess={loadData}
      />
      <ImportDataModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
