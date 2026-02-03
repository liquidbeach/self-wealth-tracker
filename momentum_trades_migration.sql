-- Momentum Trades Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS momentum_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  entry_price DECIMAL(12, 4) NOT NULL,
  entry_date DATE NOT NULL,
  exit_price DECIMAL(12, 4),
  exit_date DATE,
  units DECIMAL(12, 4) NOT NULL,
  target_price DECIMAL(12, 4),
  stop_loss DECIMAL(12, 4),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE momentum_trades ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own trades"
  ON momentum_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON momentum_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON momentum_trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
  ON momentum_trades FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_momentum_trades_user_status ON momentum_trades(user_id, status);
CREATE INDEX idx_momentum_trades_symbol ON momentum_trades(symbol);
