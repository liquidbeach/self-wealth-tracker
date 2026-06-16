'use client'

import { useState } from 'react'
import { Target, TrendingDown, Calculator } from 'lucide-react'
import TradeSimulatorCore from './trade-simulator-core'
import PullbackCalculator from './pullback-calculator'
import QuickCalc from './quick-calc'

type Tab = 'simulator' | 'pullback' | 'quickcalc'

export default function TradeSimulatorPage() {
  const [activeTab, setActiveTab] = useState<Tab>('simulator')

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'simulator', label: 'Trade Simulator', icon: Target },
    { id: 'pullback', label: 'Pullback Calculator', icon: TrendingDown },
    { id: 'quickcalc', label: 'Quick Calc', icon: Calculator },
  ]

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-green-400" />
            Trade Simulator
          </h1>
          <p className="text-sm text-gray-500">Model entry → exit economics before pulling the trigger</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-gray-400 border border-gray-800 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'simulator' && <TradeSimulatorCore />}
      {activeTab === 'pullback' && <PullbackCalculator />}
      {activeTab === 'quickcalc' && (
        <QuickCalc
          onUseInSimulator={(values) => {
            // Switch to simulator tab — values are already calculated in Quick Calc
            setActiveTab('simulator')
          }}
        />
      )}
    </div>
  )
}
