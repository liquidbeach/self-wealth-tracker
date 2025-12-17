// Database types for Self Wealth Tracker

export type Currency = 'AUD' | 'USD' | 'INR'
export type Market = 'ASX' | 'US' | 'BSE'
export type AssetType = 'Equity' | 'ETF' | 'Gold' | 'REIT'
export type InvestmentStyle = 'Growth' | 'Dividend' | 'Blend'
export type MoatClassification = 'Wide' | 'Narrow' | 'None'
export type MoatTrend = 'Widening' | 'Stable' | 'Narrowing'
export type Verdict = 'BUY' | 'HOLD' | 'AVOID'
export type AlertLevel = 'OK' | 'Watch' | 'Review' | 'Critical'
export type RiskLevel = 'Low' | 'Moderate' | 'Elevated' | 'High'

// User
export interface User {
  id: string
  email: string
  display_name: string | null
  preferences: UserPreferences
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  default_currency: Currency
  position_limit_pct: number
  sector_limit_pct: number
  cash_buffer_pct: number
  drawdown_alert_pct: number
}

// Cash Balances
export interface CashBalance {
  id: string
  user_id: string
  account_name: string
  currency: Currency
  balance: number
  notes: string | null
  created_at: string
  updated_at: string
}

// Holdings
export interface Holding {
  id: string
  user_id: string
  ticker: string
  name: string
  market: Market
  currency: Currency
  asset_type: AssetType
  sector: string | null
  investment_style: InvestmentStyle | null
  current_price: number | null
  notes: string | null
  thesis: string | null
  created_at: string
  updated_at: string
}

// Lots (for CGT tracking)
export interface Lot {
  id: string
  holding_id: string
  units: number
  purchase_date: string
  purchase_price: number
  notes: string | null
  created_at: string
}

// Holding with lots (joined)
export interface HoldingWithLots extends Holding {
  lots: Lot[]
  total_units: number
  total_cost: number
  average_price: number
  current_value: number
  gain_loss: number
  gain_loss_pct: number
}

// Watchlist
export interface WatchlistItem {
  id: string
  user_id: string
  ticker: string
  name: string
  market: Market
  currency: Currency
  current_price: number | null
  target_price: number | null
  notes: string | null
  thesis: string | null
  alert_enabled: boolean
  added_at: string
  updated_at: string
}

// Research Notes
export interface ResearchNote {
  id: string
  user_id: string
  ticker: string | null
  market: Market | null
  note_type: 'annual_report' | 'earnings_call' | 'news' | 'thesis' | 'general' | 'learning'
  title: string
  content: string | null
  source_url: string | null
  created_at: string
  updated_at: string
}

// Reading List
export interface ReadingListItem {
  id: string
  user_id: string
  title: string
  url: string | null
  source: string | null
  ticker: string | null
  is_read: boolean
  priority: 'high' | 'normal' | 'low'
  notes: string | null
  added_at: string
  read_at: string | null
}

// Stock
export interface Stock {
  ticker: string
  market: Market
  name: string
  sector: string | null
  industry: string | null
  currency: Currency
  market_cap: number | null
  last_price: number | null
  investment_style: InvestmentStyle | null
  is_active: boolean
  updated_at: string
}

// Price
export interface Price {
  id: number
  ticker: string
  market: Market
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number
  volume: number | null
}

// Financials
export interface Financials {
  id: string
  ticker: string
  market: Market
  fiscal_year: number
  fiscal_period: string
  revenue: number | null
  gross_profit: number | null
  operating_income: number | null
  net_income: number | null
  eps: number | null
  total_assets: number | null
  total_debt: number | null
  total_equity: number | null
  free_cash_flow: number | null
  roic: number | null
  roe: number | null
  gross_margin: number | null
  operating_margin: number | null
  debt_to_equity: number | null
  dividend_yield: number | null
  updated_at: string
}

// Moat Score
export interface MoatScore {
  id: string
  ticker: string
  market: Market
  switching_cost_score: number
  switching_cost_notes: string | null
  brand_power_score: number
  brand_power_notes: string | null
  cost_advantage_score: number
  cost_advantage_notes: string | null
  network_effect_score: number
  network_effect_notes: string | null
  efficient_scale_score: number
  efficient_scale_notes: string | null
  regulatory_moat_score: number
  regulatory_moat_notes: string | null
  data_moat_score: number
  data_moat_notes: string | null
  culture_moat_score: number
  culture_moat_notes: string | null
  counter_positioning_score: number
  counter_positioning_notes: string | null
  overall_moat_score: number
  primary_moat_type: string | null
  secondary_moat_type: string | null
  moat_classification: MoatClassification
  moat_trend: MoatTrend
  moat_trend_notes: string | null
  assessed_at: string
  assessed_by: string
  confidence_level: 'High' | 'Medium' | 'Low'
}

// Verdict
export interface StockVerdict {
  id: string
  ticker: string
  market: Market
  moat_score: number
  financial_health_score: number
  earnings_quality_score: number
  management_score: number
  valuation_score: number
  total_score: number
  verdict: Verdict
  intrinsic_value: number | null
  current_price: number | null
  margin_of_safety: number | null
  target_buy_price: number | null
  investment_thesis: string | null
  key_risks: string[]
  bull_case: string | null
  bear_case: string | null
  catalysts: string[]
  red_flags: string[]
  has_red_flags: boolean
  assessed_at: string
}

// Screener Result
export interface ScreenerResult {
  id: string
  ticker: string
  market: Market
  run_date: string
  quality_score: number
  valuation_score: number
  combined_score: number
  combined_rank: number
  passes_all_filters: boolean
  roic_5yr: number | null
  gross_margin: number | null
  debt_equity: number | null
  pe_ratio: number | null
  is_new_this_week: boolean
  previous_rank: number | null
  rank_change: number | null
  // Joined data
  stock?: Stock
}

// Portfolio Risk
export interface PortfolioRisk {
  id: string
  user_id: string
  snapshot_date: string
  risk_score: number
  risk_level: RiskLevel
  top_holding_pct: number
  top_3_holdings_pct: number
  top_sector_pct: number
  growth_pct: number
  dividend_pct: number
  blend_pct: number
  aus_pct: number
  us_pct: number
  india_pct: number
  alerts: RiskAlert[]
}

export interface RiskAlert {
  type: 'concentration' | 'correlation' | 'drawdown' | 'sector' | 'global'
  level: 'info' | 'warning' | 'critical'
  message: string
}

// FX Rate
export interface FxRate {
  id: string
  from_currency: Currency
  to_currency: Currency
  rate: number
  updated_at: string
}

// Portfolio Summary (computed)
export interface PortfolioSummary {
  total_value_aud: number
  total_value_usd: number
  total_value_inr: number
  total_cost_aud: number
  total_gain_loss_aud: number
  total_gain_loss_pct: number
  holdings_count: number
  cash_aud: number
  cash_usd: number
  cash_inr: number
}
