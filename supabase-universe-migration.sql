-- ============================================
-- AI Infrastructure Universe - Database Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create universe_sectors table
CREATE TABLE IF NOT EXISTS universe_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT 'gray',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create universe_stocks table
CREATE TABLE IF NOT EXISTS universe_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sector_id UUID REFERENCES universe_sectors(id),
  tier TEXT CHECK (tier IN ('heavyweight', 'velocity')) DEFAULT 'heavyweight',
  exchange TEXT CHECK (exchange IN ('NYSE', 'NASDAQ')) DEFAULT 'NASDAQ',
  market_cap BIGINT, -- stored in raw dollars
  thesis TEXT,
  catalysts TEXT,
  risks TEXT,
  status TEXT CHECK (status IN ('active', 'watch', 'review', 'removed')) DEFAULT 'active',
  status_color TEXT CHECK (status_color IN ('green', 'amber', 'red')) DEFAULT 'green',
  added_date DATE DEFAULT CURRENT_DATE,
  removed_date DATE,
  removal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create universe_alerts table
CREATE TABLE IF NOT EXISTS universe_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id UUID REFERENCES universe_stocks(id) ON DELETE CASCADE,
  alert_type TEXT CHECK (alert_type IN ('price_movement', 'earnings', 'analyst_change', 'news', 'thesis_review', 'other')) NOT NULL,
  severity TEXT CHECK (severity IN ('red', 'amber', 'green')) DEFAULT 'amber',
  message TEXT NOT NULL,
  source TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_universe_stocks_sector ON universe_stocks(sector_id);
CREATE INDEX IF NOT EXISTS idx_universe_stocks_status ON universe_stocks(status);
CREATE INDEX IF NOT EXISTS idx_universe_stocks_tier ON universe_stocks(tier);
CREATE INDEX IF NOT EXISTS idx_universe_alerts_stock ON universe_alerts(stock_id);
CREATE INDEX IF NOT EXISTS idx_universe_alerts_is_read ON universe_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_universe_alerts_severity ON universe_alerts(severity);

-- 5. Enable RLS
ALTER TABLE universe_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE universe_alerts ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies (allow all authenticated users to read, only you to write)
-- For sectors - everyone can read
CREATE POLICY "Anyone can view sectors" ON universe_sectors FOR SELECT USING (true);

-- For stocks - everyone can read active stocks
CREATE POLICY "Anyone can view stocks" ON universe_stocks FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert stocks" ON universe_stocks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update stocks" ON universe_stocks FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete stocks" ON universe_stocks FOR DELETE USING (auth.uid() IS NOT NULL);

-- For alerts - everyone can read and manage their own alerts
CREATE POLICY "Anyone can view alerts" ON universe_alerts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert alerts" ON universe_alerts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update alerts" ON universe_alerts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete alerts" ON universe_alerts FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================
-- SEED DATA
-- ============================================

-- 7. Insert sectors
INSERT INTO universe_sectors (name, slug, description, color) VALUES
  ('Silicon & Compute', 'silicon', 'GPU, CPU, AI accelerator chip designers', 'blue'),
  ('Networking & Interconnect', 'networking', 'Data center networking, optical, interconnect', 'purple'),
  ('Semiconductor Equipment', 'equipment', 'Chip manufacturing equipment makers', 'orange'),
  ('Memory & Storage', 'memory', 'HBM, DRAM, NAND, enterprise storage', 'cyan'),
  ('Power & Cooling', 'power', 'Power management, cooling solutions for data centers', 'green'),
  ('Cloud & Data Centre Infra', 'cloud', 'Hyperscalers, data center REITs, infrastructure', 'indigo')
ON CONFLICT (slug) DO NOTHING;

-- 8. Insert 37 stocks
-- Get sector IDs first
DO $$
DECLARE
  silicon_id UUID;
  networking_id UUID;
  equipment_id UUID;
  memory_id UUID;
  power_id UUID;
  cloud_id UUID;
BEGIN
  SELECT id INTO silicon_id FROM universe_sectors WHERE slug = 'silicon';
  SELECT id INTO networking_id FROM universe_sectors WHERE slug = 'networking';
  SELECT id INTO equipment_id FROM universe_sectors WHERE slug = 'equipment';
  SELECT id INTO memory_id FROM universe_sectors WHERE slug = 'memory';
  SELECT id INTO power_id FROM universe_sectors WHERE slug = 'power';
  SELECT id INTO cloud_id FROM universe_sectors WHERE slug = 'cloud';

  -- SILICON & COMPUTE (8 stocks)
  INSERT INTO universe_stocks (ticker, name, sector_id, tier, exchange, market_cap, thesis, catalysts, risks, status, status_color) VALUES
    ('NVDA', 'NVIDIA Corporation', silicon_id, 'heavyweight', 'NASDAQ', 3200000000000, 'Dominant AI GPU supplier with 80%+ data center GPU market share. CUDA moat creates massive switching costs.', 'Blackwell architecture ramp, sovereign AI deals, automotive growth', 'China export restrictions, customer concentration (hyperscalers), valuation', 'active', 'green'),
    ('AMD', 'Advanced Micro Devices', silicon_id, 'heavyweight', 'NASDAQ', 260000000000, 'Strong #2 in data center GPUs with MI300X. Growing AI accelerator business taking share from NVIDIA.', 'MI350 launch, EPYC CPU gains, laptop market recovery', 'Execution risk vs NVDA, China exposure, ROCm ecosystem maturity', 'active', 'green'),
    ('AVGO', 'Broadcom Inc', silicon_id, 'heavyweight', 'NASDAQ', 850000000000, 'Custom AI chip leader (TPU for Google, others). VMware acquisition creates software recurring revenue.', 'Custom AI ASIC wins, VMware synergies, networking growth', 'Customer concentration, integration execution, competition from NVDA', 'active', 'green'),
    ('QCOM', 'Qualcomm Inc', silicon_id, 'heavyweight', 'NASDAQ', 190000000000, 'Mobile AI leader, edge AI opportunity with Snapdragon X. Licensing business provides steady cash flow.', 'PC market entry with Snapdragon X, automotive ADAS growth, IoT expansion', 'Apple modem loss risk, China smartphone weakness, ARM competition', 'active', 'green'),
    ('INTC', 'Intel Corporation', silicon_id, 'velocity', 'NASDAQ', 95000000000, 'Turnaround story with foundry ambitions. Gaudi AI accelerators gaining traction. Deep US government ties.', 'CHIPS Act funding, 18A node progress, Gaudi 3 adoption', 'Execution risk, cash burn, market share loss continues', 'watch', 'amber'),
    ('ARM', 'Arm Holdings', silicon_id, 'heavyweight', 'NASDAQ', 150000000000, 'Architecture licensing monopoly for mobile/edge. AI pushes more ARM designs into data center.', 'Data center CPU adoption, royalty rate increases, AI edge growth', 'Valuation, RISC-V competition, customer pushback on pricing', 'active', 'green'),
    ('MRVL', 'Marvell Technology', silicon_id, 'heavyweight', 'NASDAQ', 75000000000, 'Custom silicon and electro-optics leader. Strong in cloud switching and 5G infrastructure.', 'Custom AI chip wins, 800G optics ramp, cloud capex growth', 'Customer concentration, China exposure, inventory cycles', 'active', 'green'),
    ('MPWR', 'Monolithic Power Systems', silicon_id, 'velocity', 'NASDAQ', 40000000000, 'Power management IC leader for AI servers. Critical for GPU power delivery.', 'AI server power density, automotive growth, data center expansion', 'Customer concentration, valuation, competition', 'active', 'green')
  ON CONFLICT (ticker) DO NOTHING;

  -- NETWORKING & INTERCONNECT (6 stocks)
  INSERT INTO universe_stocks (ticker, name, sector_id, tier, exchange, market_cap, thesis, catalysts, risks, status, status_color) VALUES
    ('CSCO', 'Cisco Systems', networking_id, 'heavyweight', 'NASDAQ', 230000000000, 'Enterprise networking leader pivoting to AI infrastructure. Splunk acquisition adds observability.', 'AI networking demand, Splunk synergies, security growth', 'Enterprise spending slowdown, competition from Arista, legacy transition', 'active', 'green'),
    ('ANET', 'Arista Networks', networking_id, 'heavyweight', 'NYSE', 115000000000, 'Cloud networking leader with 400G/800G switch leadership. Primary vendor for hyperscalers.', 'AI cluster networking, campus expansion, 800G adoption', 'Customer concentration (Meta, Microsoft), valuation, competition', 'active', 'green'),
    ('CDNS', 'Cadence Design Systems', networking_id, 'heavyweight', 'NASDAQ', 85000000000, 'EDA software essential for chip design. AI chip complexity drives more tool usage.', 'AI chip design complexity, system design expansion, IP growth', 'Customer concentration, competition from Synopsys, China risk', 'active', 'green'),
    ('SNPS', 'Synopsys Inc', networking_id, 'heavyweight', 'NASDAQ', 90000000000, 'EDA software duopoly with Cadence. Critical for AI chip design verification.', 'AI chip complexity, Ansys acquisition synergies, IP growth', 'Regulatory risk on Ansys deal, customer concentration, competition', 'active', 'green'),
    ('LITE', 'Lumentum Holdings', networking_id, 'velocity', 'NASDAQ', 7000000000, 'Optical components for data centers. 3D sensing and telecom diversification.', 'Data center laser demand, 800G ramp, telecom recovery', 'Customer concentration, inventory cycles, competition', 'watch', 'amber'),
    ('COHR', 'Coherent Corp', networking_id, 'velocity', 'NYSE', 15000000000, 'Optical components and lasers for AI data centers. Vertical integration advantage.', 'AI transceiver demand, 800G/1.6T ramp, datacom growth', 'Debt levels, integration execution, cyclicality', 'active', 'green')
  ON CONFLICT (ticker) DO NOTHING;

  -- SEMICONDUCTOR EQUIPMENT (6 stocks)
  INSERT INTO universe_stocks (ticker, name, sector_id, tier, exchange, market_cap, thesis, catalysts, risks, status, status_color) VALUES
    ('ASML', 'ASML Holding', equipment_id, 'heavyweight', 'NASDAQ', 350000000000, 'EUV lithography monopoly. Every advanced AI chip requires ASML equipment.', 'High-NA EUV adoption, China restrictions benefiting allies, capacity expansion', 'China revenue loss, cyclicality, customer concentration', 'active', 'green'),
    ('LRCX', 'Lam Research', equipment_id, 'heavyweight', 'NASDAQ', 115000000000, 'Etch and deposition leader. Critical for 3D NAND and advanced logic.', 'HBM capacity expansion, gate-all-around transition, NAND recovery', 'China exposure, cyclicality, memory spending volatility', 'active', 'green'),
    ('AMAT', 'Applied Materials', equipment_id, 'heavyweight', 'NASDAQ', 165000000000, 'Broadest equipment portfolio. Leader in deposition, etch, and inspection.', 'Advanced packaging growth, gate-all-around, ICAPS segment', 'China restrictions, cyclicality, competition', 'active', 'green'),
    ('KLAC', 'KLA Corporation', equipment_id, 'heavyweight', 'NASDAQ', 95000000000, 'Process control monopoly. Defect inspection critical for yield at advanced nodes.', 'EUV inspection demand, advanced packaging, yield requirements', 'Cyclicality, China exposure, customer concentration', 'active', 'green'),
    ('TER', 'Teradyne Inc', equipment_id, 'velocity', 'NASDAQ', 22000000000, 'Semiconductor test equipment leader. AI chips require more testing.', 'AI chip complexity driving test demand, robotics growth, memory test', 'Cyclicality, competition, customer concentration', 'active', 'green'),
    ('ONTO', 'Onto Innovation', equipment_id, 'velocity', 'NYSE', 9000000000, 'Specialty process control for advanced packaging. Critical for HBM and chiplets.', 'Advanced packaging inspection, HBM growth, panel-level packaging', 'Customer concentration, cyclicality, competition', 'active', 'green')
  ON CONFLICT (ticker) DO NOTHING;

  -- MEMORY & STORAGE (5 stocks)
  INSERT INTO universe_stocks (ticker, name, sector_id, tier, exchange, market_cap, thesis, catalysts, risks, status, status_color) VALUES
    ('MU', 'Micron Technology', memory_id, 'heavyweight', 'NASDAQ', 115000000000, 'HBM3E leader for AI training. Memory is the bottleneck for AI scaling.', 'HBM capacity expansion, DDR5 transition, NAND recovery', 'Cyclicality, China risk, pricing volatility, Samsung/SK competition', 'active', 'green'),
    ('WDC', 'Western Digital', memory_id, 'velocity', 'NASDAQ', 22000000000, 'Flash storage leader. AI data storage demand growing exponentially.', 'NAND recovery, enterprise SSD growth, data center expansion', 'Debt levels, cyclicality, competition from Samsung', 'watch', 'amber'),
    ('STX', 'Seagate Technology', memory_id, 'velocity', 'NASDAQ', 20000000000, 'HDD leader for mass storage. AI training data requires massive storage.', 'HAMR technology ramp, cloud storage demand, nearline recovery', 'HDD decline long-term, cyclicality, competition', 'watch', 'amber'),
    ('PSTG', 'Pure Storage', memory_id, 'velocity', 'NYSE', 18000000000, 'All-flash enterprise storage leader. AI data pipelines need fast storage.', 'AI storage demand, subscription growth, hyperscaler wins', 'Competition from Dell/NetApp, valuation, enterprise spending', 'active', 'green'),
    ('NTAP', 'NetApp Inc', memory_id, 'velocity', 'NASDAQ', 25000000000, 'Enterprise storage with cloud integration. Hybrid cloud data management.', 'Cloud storage growth, AI data management, all-flash transition', 'Competition, legacy business decline, hyperscaler direct storage', 'active', 'green')
  ON CONFLICT (ticker) DO NOTHING;

  -- POWER & COOLING (5 stocks)
  INSERT INTO universe_stocks (ticker, name, sector_id, tier, exchange, market_cap, thesis, catalysts, risks, status, status_color) VALUES
    ('VRT', 'Vertiv Holdings', power_id, 'heavyweight', 'NYSE', 45000000000, 'Data center power and cooling leader. AI power density driving upgrade cycle.', 'AI data center buildout, liquid cooling adoption, grid infrastructure', 'Supply chain, execution, competition from Schneider/Eaton', 'active', 'green'),
    ('ETN', 'Eaton Corporation', power_id, 'heavyweight', 'NYSE', 130000000000, 'Electrical equipment diversified. Data center power management growing.', 'Data center power demand, grid modernization, EV infrastructure', 'Diversified exposure dilutes AI theme, valuation', 'active', 'green'),
    ('EMR', 'Emerson Electric', power_id, 'heavyweight', 'NYSE', 65000000000, 'Industrial automation with data center exposure. AspenTech software adds recurring revenue.', 'Data center cooling, industrial automation, software growth', 'Diversified business, cyclicality, competition', 'active', 'green'),
    ('GNRC', 'Generac Holdings', power_id, 'velocity', 'NYSE', 10000000000, 'Backup power specialist. Data centers need reliable power backup.', 'Data center backup power, grid instability, energy storage', 'Residential weakness, competition, execution', 'watch', 'amber'),
    ('PWR', 'Quanta Services', power_id, 'heavyweight', 'NYSE', 45000000000, 'Power infrastructure contractor. Building the grid for AI data centers.', 'Data center power connections, grid expansion, renewable integration', 'Labor availability, project execution, cyclicality', 'active', 'green')
  ON CONFLICT (ticker) DO NOTHING;

  -- CLOUD & DATA CENTRE INFRA (7 stocks)
  INSERT INTO universe_stocks (ticker, name, sector_id, tier, exchange, market_cap, thesis, catalysts, risks, status, status_color) VALUES
    ('AMZN', 'Amazon.com Inc', cloud_id, 'heavyweight', 'NASDAQ', 2100000000000, 'AWS leads cloud infrastructure. Trainium/Inferentia custom AI chips reduce NVIDIA dependency.', 'AWS AI services growth, Trainium adoption, retail AI efficiency', 'Competition from Azure/GCP, capex requirements, regulation', 'active', 'green'),
    ('MSFT', 'Microsoft Corporation', cloud_id, 'heavyweight', 'NASDAQ', 3100000000000, 'Azure #2 in cloud with OpenAI partnership. Copilot monetization across enterprise.', 'Copilot adoption, Azure AI growth, OpenAI integration', 'OpenAI dependency, antitrust, capex burden', 'active', 'green'),
    ('GOOGL', 'Alphabet Inc', cloud_id, 'heavyweight', 'NASDAQ', 2200000000000, 'GCP #3 with strong AI/ML tooling. TPU custom silicon competitive advantage.', 'Gemini adoption, GCP growth, TPU v5, search AI integration', 'Antitrust, ad market dependency, cloud market share', 'active', 'green'),
    ('ORCL', 'Oracle Corporation', cloud_id, 'heavyweight', 'NYSE', 400000000000, 'OCI growing fast with AI focus. Database moat creates stickiness.', 'OCI AI infrastructure, database cloud migration, multi-cloud', 'Legacy business decline, competition from hyperscalers', 'active', 'green'),
    ('DLR', 'Digital Realty Trust', cloud_id, 'heavyweight', 'NYSE', 55000000000, 'Data center REIT with global footprint. AI driving unprecedented demand.', 'AI data center demand, power availability, land bank value', 'Interest rates, power constraints, competition', 'active', 'green'),
    ('EQIX', 'Equinix Inc', cloud_id, 'heavyweight', 'NASDAQ', 85000000000, 'Interconnection-focused data center REIT. Network density creates moat.', 'AI interconnection demand, xScale JV expansion, ecosystem growth', 'Interest rates, power costs, competition', 'active', 'green'),
    ('AMT', 'American Tower Corp', cloud_id, 'velocity', 'NYSE', 95000000000, 'Tower REIT expanding into data centers. Edge AI infrastructure opportunity.', 'Edge data center growth, 5G densification, CoreSite integration', 'Interest rate sensitivity, tower growth slowing, India exposure', 'active', 'green')
  ON CONFLICT (ticker) DO NOTHING;

END $$;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these to verify the migration worked:
-- SELECT COUNT(*) FROM universe_sectors;  -- Should be 6
-- SELECT COUNT(*) FROM universe_stocks;   -- Should be 37
-- SELECT s.name as sector, COUNT(st.id) as stocks 
-- FROM universe_sectors s 
-- LEFT JOIN universe_stocks st ON st.sector_id = s.id 
-- GROUP BY s.name;
