'use client'

import { useState } from 'react'
import { Target, TrendingDown, Calculator } from 'lucide-react'
import TradeSimulatorCore from './trade-simulator-core'
import PullbackCalculator from './pullback-calculator'

type Tab = 'simulator' | 'pullback'

export default function TradeSimulatorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('simulator')

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-600" />
            Trade Simulator
          </h1>
          <p className="text-sm text-gray-500">Model entry → exit economics before pulling the trigger</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'simulator'
              ? 'bg-slate-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Trade Simulator
        </button>
        <button
          onClick={() => setActiveTab('pullback')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'pullback'
              ? 'bg-slate-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          Pullback Calculator
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'simulator' && <TradeSimulatorCore />}
      {activeTab === 'pullback' && <PullbackCalculator />}
    </div>
  )
}
