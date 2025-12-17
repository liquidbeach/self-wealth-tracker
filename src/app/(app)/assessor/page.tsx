import { Search, TrendingUp } from 'lucide-react'

export default function AssessorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stock Assessor</h1>
        <p className="text-slate-500">Discover quality stocks and run deep-dive assessments</p>
      </div>

      {/* Search */}
      <div className="card">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ticker or company name..."
              className="input pl-10"
            />
          </div>
          <button className="btn-primary">Assess</button>
        </div>
      </div>

      {/* Screener Results */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Weekly Screener - Top 25</h3>
          <span className="text-sm text-slate-500">Last run: Not yet</span>
        </div>
        
        <div className="text-center py-12 text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Screener not yet configured</p>
          <p className="text-sm">Weekly screener results will appear here</p>
        </div>
      </div>
    </div>
  )
}
