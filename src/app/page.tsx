import React, { useState, useMemo } from 'react';

// Mock data for demonstration
const initialHoldings = [
  {
    id: 1,
    ticker: 'CBA',
    name: 'Commonwealth Bank',
    market: 'ASX',
    type: 'Equity',
    units: 50,
    purchaseDate: '2024-03-15',
    purchasePrice: 112.50,
    currentPrice: 145.20,
    currency: 'AUD'
  },
  {
    id: 2,
    ticker: 'VAS',
    name: 'Vanguard Australian Shares',
    market: 'ASX',
    type: 'ETF',
    units: 200,
    purchaseDate: '2024-01-10',
    purchasePrice: 89.30,
    currentPrice: 94.15,
    currency: 'AUD'
  },
  {
    id: 3,
    ticker: 'BHP',
    name: 'BHP Group',
    market: 'ASX',
    type: 'Equity',
    units: 75,
    purchaseDate: '2023-11-20',
    purchasePrice: 45.80,
    currentPrice: 42.30,
    currency: 'AUD'
  },
  {
    id: 4,
    ticker: 'AAPL',
    name: 'Apple Inc.',
    market: 'INTL',
    type: 'Equity',
    units: 20,
    purchaseDate: '2024-02-01',
    purchasePrice: 185.50,
    currentPrice: 208.30,
    currency: 'USD'
  },
  {
    id: 5,
    ticker: 'VTI',
    name: 'Vanguard Total Stock Market',
    market: 'INTL',
    type: 'ETF',
    units: 30,
    purchaseDate: '2024-04-05',
    purchasePrice: 245.00,
    currentPrice: 268.50,
    currency: 'USD'
  },
  {
    id: 6,
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    market: 'INTL',
    type: 'Equity',
    units: 15,
    purchaseDate: '2023-12-15',
    purchasePrice: 375.20,
    currentPrice: 425.80,
    currency: 'USD'
  }
];

const EXCHANGE_RATE = 0.65; // USD to AUD (1 USD = 1.54 AUD, so 1 AUD = 0.65 USD)
const AUD_TO_USD = 1 / EXCHANGE_RATE;

export default function PortfolioTracker() {
  const [holdings, setHoldings] = useState(initialHoldings);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState(null);
  const [cashBalances, setCashBalances] = useState({ AUD: 5420.50, USD: 1250.00 });
  const [activeTab, setActiveTab] = useState('all');

  const formatCurrency = (amount, currency) => {
    const symbol = currency === 'AUD' ? 'A$' : 'US$';
    return `${symbol}${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const calculateHoldingMetrics = (holding) => {
    const purchaseAmount = holding.units * holding.purchasePrice;
    const currentValue = holding.units * holding.currentPrice;
    const gainLoss = currentValue - purchaseAmount;
    const gainLossPercent = ((currentValue - purchaseAmount) / purchaseAmount) * 100;
    return { purchaseAmount, currentValue, gainLoss, gainLossPercent };
  };

  const portfolioSummary = useMemo(() => {
    let asxValue = 0;
    let asxCost = 0;
    let intlValueUSD = 0;
    let intlCostUSD = 0;

    holdings.forEach(h => {
      const metrics = calculateHoldingMetrics(h);
      if (h.market === 'ASX') {
        asxValue += metrics.currentValue;
        asxCost += metrics.purchaseAmount;
      } else {
        intlValueUSD += metrics.currentValue;
        intlCostUSD += metrics.purchaseAmount;
      }
    });

    const intlValueAUD = intlValueUSD * AUD_TO_USD;
    const totalValueAUD = asxValue + intlValueAUD + cashBalances.AUD + (cashBalances.USD * AUD_TO_USD);
    const totalCostAUD = asxCost + (intlCostUSD * AUD_TO_USD);
    const totalGainLoss = (asxValue - asxCost) + (intlValueUSD - intlCostUSD) * AUD_TO_USD;
    const totalGainLossPercent = totalCostAUD > 0 ? (totalGainLoss / totalCostAUD) * 100 : 0;

    return {
      asxValue,
      asxGainLoss: asxValue - asxCost,
      asxGainLossPercent: asxCost > 0 ? ((asxValue - asxCost) / asxCost) * 100 : 0,
      intlValueUSD,
      intlGainLoss: intlValueUSD - intlCostUSD,
      intlGainLossPercent: intlCostUSD > 0 ? ((intlValueUSD - intlCostUSD) / intlCostUSD) * 100 : 0,
      totalValueAUD,
      totalGainLoss,
      totalGainLossPercent,
      cashAUD: cashBalances.AUD,
      cashUSD: cashBalances.USD
    };
  }, [holdings, cashBalances]);

  const filteredHoldings = useMemo(() => {
    if (activeTab === 'all') return holdings;
    if (activeTab === 'asx') return holdings.filter(h => h.market === 'ASX');
    if (activeTab === 'intl') return holdings.filter(h => h.market === 'INTL');
    return holdings;
  }, [holdings, activeTab]);

  const deleteHolding = (id) => {
    setHoldings(holdings.filter(h => h.id !== id));
  };

  const HoldingRow = ({ holding }) => {
    const metrics = calculateHoldingMetrics(holding);
    const isPositive = metrics.gainLoss >= 0;

    return (
      <tr className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
        <td className="py-4 px-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
              holding.market === 'ASX' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {holding.ticker.slice(0, 3)}
            </div>
            <div>
              <div className="font-semibold text-slate-100">{holding.ticker}</div>
              <div className="text-xs text-slate-500">{holding.name}</div>
            </div>
          </div>
        </td>
        <td className="py-4 px-4">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            holding.type === 'ETF' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {holding.type}
          </span>
        </td>
        <td className="py-4 px-4 text-right font-mono text-slate-300">{holding.units}</td>
        <td className="py-4 px-4 text-right text-slate-400 text-sm">{holding.purchaseDate}</td>
        <td className="py-4 px-4 text-right font-mono text-slate-300">
          {formatCurrency(holding.purchasePrice, holding.currency)}
        </td>
        <td className="py-4 px-4 text-right font-mono text-slate-400">
          {formatCurrency(metrics.purchaseAmount, holding.currency)}
        </td>
        <td className="py-4 px-4 text-right font-mono text-slate-100 font-semibold">
          {formatCurrency(holding.currentPrice, holding.currency)}
        </td>
        <td className="py-4 px-4 text-right font-mono text-slate-100">
          {formatCurrency(metrics.currentValue, holding.currency)}
        </td>
        <td className="py-4 px-4 text-right">
          <div className={`font-mono font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(Math.abs(metrics.gainLoss), holding.currency)}
          </div>
          <div className={`text-xs ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {formatPercent(metrics.gainLossPercent)}
          </div>
        </td>
        <td className="py-4 px-4">
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditingHolding(holding)}
              className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={() => deleteHolding(holding.id)}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const AddEditModal = ({ holding, onClose }) => {
    const [form, setForm] = useState(holding || {
      ticker: '',
      name: '',
      market: 'ASX',
      type: 'Equity',
      units: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      purchasePrice: '',
      currentPrice: '',
      currency: 'AUD'
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      const newHolding = {
        ...form,
        id: holding?.id || Date.now(),
        units: parseFloat(form.units),
        purchasePrice: parseFloat(form.purchasePrice),
        currentPrice: parseFloat(form.currentPrice),
        currency: form.market === 'ASX' ? 'AUD' : 'USD'
      };

      if (holding) {
        setHoldings(holdings.map(h => h.id === holding.id ? newHolding : h));
      } else {
        setHoldings([...holdings, newHolding]);
      }
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-700 shadow-2xl">
          <h3 className="text-xl font-bold text-slate-100 mb-6">
            {holding ? 'Edit Holding' : 'Add New Holding'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Ticker</label>
                <input
                  type="text"
                  value={form.ticker}
                  onChange={(e) => setForm({...form, ticker: e.target.value.toUpperCase()})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Market</label>
                <select
                  value={form.market}
                  onChange={(e) => setForm({...form, market: e.target.value, currency: e.target.value === 'ASX' ? 'AUD' : 'USD'})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                >
                  <option value="ASX">ASX</option>
                  <option value="INTL">International</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Company Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({...form, type: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                >
                  <option value="Equity">Equity</option>
                  <option value="ETF">ETF</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Units</label>
                <input
                  type="number"
                  value={form.units}
                  onChange={(e) => setForm({...form, units: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                  required
                  min="0"
                  step="any"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => setForm({...form, purchaseDate: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Purchase Price ({form.market === 'ASX' ? 'AUD' : 'USD'})
                </label>
                <input
                  type="number"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({...form, purchasePrice: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Current Price ({form.market === 'ASX' ? 'AUD' : 'USD'})
              </label>
              <input
                type="number"
                value={form.currentPrice}
                onChange={(e) => setForm({...form, currentPrice: e.target.value})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                required
                min="0"
                step="0.01"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
              >
                {holding ? 'Update' : 'Add Holding'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">Buffett Tracker</h1>
                <p className="text-xs text-slate-500">Own Your Decisions</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-slate-500">AUD/USD Rate</div>
                <div className="text-sm font-mono text-slate-300">{AUD_TO_USD.toFixed(4)}</div>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Holding
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Total Portfolio */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl p-5 border border-slate-700">
            <div className="text-sm text-slate-400 mb-1">Portfolio Total</div>
            <div className="text-2xl font-bold text-slate-100">
              {formatCurrency(portfolioSummary.totalValueAUD, 'AUD')}
            </div>
            <div className={`text-sm font-semibold mt-1 ${portfolioSummary.totalGainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(Math.abs(portfolioSummary.totalGainLoss), 'AUD')} ({formatPercent(portfolioSummary.totalGainLossPercent)})
            </div>
          </div>

          {/* ASX Holdings */}
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-amber-400"></div>
              <span className="text-sm text-slate-400">ASX Market Value</span>
            </div>
            <div className="text-xl font-bold text-slate-100">
              {formatCurrency(portfolioSummary.asxValue, 'AUD')}
            </div>
            <div className={`text-sm ${portfolioSummary.asxGainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPercent(portfolioSummary.asxGainLossPercent)}
            </div>
          </div>

          {/* International Holdings */}
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="text-sm text-slate-400">Intl Market Value</span>
            </div>
            <div className="text-xl font-bold text-slate-100">
              {formatCurrency(portfolioSummary.intlValueUSD, 'USD')}
            </div>
            <div className={`text-sm ${portfolioSummary.intlGainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPercent(portfolioSummary.intlGainLossPercent)}
            </div>
          </div>

          {/* Cash */}
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
            <div className="text-sm text-slate-400 mb-1">Cash Wallet</div>
            <div className="text-lg font-bold text-slate-100">
              {formatCurrency(portfolioSummary.cashAUD, 'AUD')}
            </div>
            <div className="text-sm text-slate-400">
              {formatCurrency(portfolioSummary.cashUSD, 'USD')}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'all', label: 'All Holdings' },
            { id: 'asx', label: 'ASX' },
            { id: 'intl', label: 'International' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Holdings Table */}
        <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">Holding</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">Type</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">Units</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">Purchase Date</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">Buy Price</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">Cost Basis</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">Current</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">Value</th>
                  <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">Gain/Loss</th>
                  <th className="py-4 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredHoldings.map(holding => (
                  <HoldingRow key={holding.id} holding={holding} />
                ))}
              </tbody>
            </table>
          </div>

          {filteredHoldings.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              No holdings found. Add your first investment to get started.
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-sm text-slate-600">
          <p>"The stock market is a device for transferring money from the impatient to the patient." — Warren Buffett</p>
        </div>
      </main>

      {/* Modals */}
      {showAddModal && <AddEditModal onClose={() => setShowAddModal(false)} />}
      {editingHolding && <AddEditModal holding={editingHolding} onClose={() => setEditingHolding(null)} />}
    </div>
  );
}
