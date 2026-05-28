'use client'

interface Sector {
  id: string
  name: string
  slug: string
  color: string
}

interface SectorTabsProps {
  sectors: Sector[]
  activeSector: string
  onSectorChange: (slug: string) => void
  stockCounts: Record<string, number>
  tier: string
  onTierChange: (tier: string) => void
}

export default function SectorTabs({
  sectors,
  activeSector,
  onSectorChange,
  stockCounts,
  tier,
  onTierChange
}: SectorTabsProps) {
  const allTabs = [
    { slug: 'all', name: 'All Sectors', color: 'gray' },
    ...sectors
  ]

  return (
    <div className="mb-6">
      {/* Sector Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {allTabs.map((sector) => {
          const count = sector.slug === 'all' 
            ? Object.values(stockCounts).reduce((a, b) => a + b, 0)
            : stockCounts[sector.slug] || 0
          const isActive = activeSector === sector.slug
          
          return (
            <button
              key={sector.slug}
              onClick={() => onSectorChange(sector.slug)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {sector.name}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-gray-200 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tier Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Filter by tier:</span>
        <select
          value={tier}
          onChange={(e) => onTierChange(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="all">All Tiers</option>
          <option value="heavyweight">Heavyweights Only</option>
          <option value="velocity">Emerging Velocity Only</option>
        </select>
      </div>
    </div>
  )
}
