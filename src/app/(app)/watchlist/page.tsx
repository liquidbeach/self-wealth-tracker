import { Plus, Eye } from 'lucide-react'

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Watchlist</h1>
          <p className="text-slate-500">Track stocks you're interested in</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Stock
        </button>
      </div>

      <div className="card">
        <div className="text-center py-12 text-slate-400">
          <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No stocks in watchlist</p>
          <p className="text-sm mb-4">Add stocks to monitor their prices</p>
          <button className="btn-primary">
            <Plus className="w-4 h-4 inline mr-2" />
            Add Stock
          </button>
        </div>
      </div>
    </div>
  )
}
