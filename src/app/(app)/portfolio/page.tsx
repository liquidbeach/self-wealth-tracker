import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Plus, Briefcase } from 'lucide-react'
import Link from 'next/link'

export default async function PortfolioPage() {
  const supabase = createServerSupabaseClient()
  
  // Get user's holdings with lots
  const { data: holdings } = await supabase
    .from('holdings')
    .select(`
      *,
      lots (*)
    `)
    .order('created_at', { ascending: false })

  // Get cash balances
  const { data: cashBalances } = await supabase
    .from('cash_balances')
    .select('*')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portfolio</h1>
          <p className="text-slate-500">Track your holdings and performance</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Holding
        </button>
      </div>

      {/* Cash balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-slate-500 mb-1">Cash (AUD)</p>
          <p className="text-xl font-bold text-slate-900">
            ${cashBalances?.filter(c => c.currency === 'AUD').reduce((sum, c) => sum + Number(c.balance), 0).toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500 mb-1">Cash (USD)</p>
          <p className="text-xl font-bold text-slate-900">
            ${cashBalances?.filter(c => c.currency === 'USD').reduce((sum, c) => sum + Number(c.balance), 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500 mb-1">Cash (INR)</p>
          <p className="text-xl font-bold text-slate-900">
            ₹{cashBalances?.filter(c => c.currency === 'INR').reduce((sum, c) => sum + Number(c.balance), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
      </div>

      {/* Holdings table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Holdings</h3>
        
        {holdings && holdings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Holding</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Market</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Type</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Units</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Avg Price</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Current</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Gain/Loss</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => {
                  const totalUnits = holding.lots?.reduce((sum: number, lot: any) => sum + Number(lot.units), 0) || 0
                  const totalCost = holding.lots?.reduce((sum: number, lot: any) => sum + (Number(lot.units) * Number(lot.purchase_price)), 0) || 0
                  const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0
                  const currentValue = totalUnits * (holding.current_price || 0)
                  const gainLoss = currentValue - totalCost
                  const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0

                  return (
                    <tr key={holding.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-slate-900">{holding.ticker}</p>
                          <p className="text-sm text-slate-500">{holding.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{holding.market}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{holding.asset_type}</td>
                      <td className="py-3 px-4 text-sm text-slate-900 text-right">{totalUnits.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm text-slate-900 text-right">${avgPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm text-slate-900 text-right">${holding.current_price?.toFixed(2) || '-'}</td>
                      <td className={`py-3 px-4 text-sm text-right font-medium ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {gainLoss >= 0 ? '+' : ''}{gainLossPct.toFixed(2)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No holdings yet</p>
            <p className="text-sm mb-4">Add your first holding to get started</p>
            <button className="btn-primary">
              <Plus className="w-4 h-4 inline mr-2" />
              Add Holding
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
