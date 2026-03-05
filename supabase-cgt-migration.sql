-- CGT Sales Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS cgt_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holding_id UUID REFERENCES holdings(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  units DECIMAL(15, 6) NOT NULL,
  purchase_date DATE NOT NULL,
  purchase_price DECIMAL(15, 4) NOT NULL,
  sale_date DATE NOT NULL,
  sale_price DECIMAL(15, 4) NOT NULL,
  sale_price_aud DECIMAL(15, 4) NOT NULL,
  purchase_price_aud DECIMAL(15, 4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  exchange_rate DECIMAL(10, 4) NOT NULL DEFAULT 1.0,
  cost_base DECIMAL(15, 2) NOT NULL,
  proceeds DECIMAL(15, 2) NOT NULL,
  gross_gain DECIMAL(15, 2) NOT NULL,
  held_over_12_months BOOLEAN NOT NULL DEFAULT false,
  discount_applied BOOLEAN NOT NULL DEFAULT false,
  net_gain DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE cgt_sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own CGT sales"
  ON cgt_sales FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own CGT sales"
  ON cgt_sales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CGT sales"
  ON cgt_sales FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own CGT sales"
  ON cgt_sales FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_cgt_sales_user_id ON cgt_sales(user_id);
CREATE INDEX idx_cgt_sales_sale_date ON cgt_sales(sale_date);
CREATE INDEX idx_cgt_sales_ticker ON cgt_sales(ticker);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_cgt_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_cgt_sales_updated_at
  BEFORE UPDATE ON cgt_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_cgt_sales_updated_at();
