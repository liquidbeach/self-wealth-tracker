import { Shield, AlertTriangle, TrendingDown } from 'lucide-react'

export default function RiskPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Risk Management</h1>
        <p className="text-slate-500">Monitor portfolio risk and see early warning signals</p>
      </div>

      {/* Risk Score Card */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Portfolio Risk Score</h3>
        <div className="text-center py-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <span className="text-3xl font-bold text-slate-400">--</span>
          </div>
          <p className="text-slate-500">Add holdings to calculate risk score</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Concentration */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Concentration Analysis</h3>
          <div className="text-center py-8 text-slate-400">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No holdings to analyze</p>
          </div>
        </div>

        {/* Drawdown Monitor */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Drawdown Monitor</h3>
          <div className="text-center py-8 text-slate-400">
            <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No holdings to monitor</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Alerts</h3>
        <div className="text-center py-8 text-slate-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No alerts</p>
          <p className="text-sm">Early warning signals will appear here</p>
        </div>
      </div>
    </div>
  )
}
