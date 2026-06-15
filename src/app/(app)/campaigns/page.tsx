'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Target,
  Plus,
  Calendar,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Loader2,
  Archive,
  CheckCircle,
  Clock,
  Zap,
  X,
  Pencil,
  Save,
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  total_budget: number | null
  status: string
  created_at: string
  position_count?: number
  deployed_count?: number
  total_deployed?: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  planning: { label: 'Planning', color: 'text-gray-400', bg: 'bg-white/10 border-gray-700', icon: Clock },
  active: { label: 'Active', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: Zap },
  completed: { label: 'Completed', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: CheckCircle },
  archived: { label: 'Archived', color: 'text-gray-500', bg: 'bg-white/5 border-gray-800', icon: Archive },
}

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-AU')
}

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBudget, setEditBudget] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newStart, setNewStart] = useState('2026-07-01')
  const [newEnd, setNewEnd] = useState('2027-06-30')
  const [newBudget, setNewBudget] = useState('212500')

  const fetchCampaigns = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('start_date', { ascending: false })

    if (data) {
      // Get position counts for each campaign
      const enriched = await Promise.all(
        data.map(async (campaign) => {
          const { data: positions } = await supabase
            .from('campaign_positions')
            .select('status, actual_deployed')
            .eq('campaign_id', campaign.id)

          const posArr = positions || []
          return {
            ...campaign,
            position_count: posArr.length,
            deployed_count: posArr.filter(p => p.status === 'deployed' || p.status === 'partial_exit').length,
            total_deployed: posArr.reduce((sum, p) => sum + (p.actual_deployed || 0), 0),
          }
        })
      )
      setCampaigns(enriched)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        start_date: newStart,
        end_date: newEnd,
        total_budget: parseFloat(newBudget) || null,
        status: 'planning',
        user_id: user.id,
      })
      .select()
      .single()

    if (data) {
      router.push(`/campaigns/${data.id}`)
    }
    setCreating(false)
  }

  const openEditBudget = (e: React.MouseEvent, campaign: Campaign) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(campaign.id)
    setEditBudget(campaign.total_budget?.toString() || '')
  }

  const saveEditBudget = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!editingId) return
    setEditSaving(true)
    const supabase = createClient()
    await supabase.from('campaigns').update({
      total_budget: parseFloat(editBudget) || null,
    }).eq('id', editingId)
    setEditingId(null)
    setEditSaving(false)
    fetchCampaigns()
  }

  const cancelEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(null)
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-400" />
            Campaigns
          </h1>
          <p className="text-sm text-gray-500">Strategic investment campaigns with planned vs actual tracking</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Create Campaign</h3>
            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Campaign Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. FY2027 AI Infrastructure"
                className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Campaign thesis..."
                className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Total Budget ($)</label>
              <input
                type="number"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 text-white border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign List */}
      {loading ? (
        <div className="bg-[#1c1c28] border border-gray-800 rounded-xl p-10 text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading campaigns...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-[#1c1c28] border border-gray-800 border-dashed rounded-xl p-10 text-center">
          <Target className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No campaigns yet</p>
          <p className="text-gray-600 text-xs mt-1">Create your first campaign to start planning</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const status = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.planning
            const StatusIcon = status.icon
            const deployPct = campaign.total_budget && campaign.total_budget > 0
              ? ((campaign.total_deployed || 0) / campaign.total_budget) * 100
              : 0

            return (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="block bg-[#1c1c28] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                        {campaign.name}
                      </h2>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {status.label}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-xs text-gray-500 line-clamp-1">{campaign.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0 mt-1" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] text-gray-600 mb-0.5">DATE RANGE</p>
                    <p className="text-xs text-gray-300 font-mono">
                      {new Date(campaign.start_date).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                      {' → '}
                      {new Date(campaign.end_date).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 mb-0.5">BUDGET</p>
                    {editingId === campaign.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                        <input
                          type="number"
                          value={editBudget}
                          onChange={(e) => setEditBudget(e.target.value)}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEditBudget(e as any) } if (e.key === 'Escape') setEditingId(null) }}
                          className="w-24 px-2 py-1 bg-white/5 text-white border border-blue-500 rounded text-sm font-mono focus:outline-none"
                          autoFocus
                        />
                        <button onClick={saveEditBudget} disabled={editSaving} className="p-1 text-green-400 hover:text-green-300"><Save className="w-3.5 h-3.5" /></button>
                        <button onClick={cancelEdit} className="p-1 text-gray-500 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <p className="text-sm text-white font-mono font-medium">
                          {campaign.total_budget ? fmt(campaign.total_budget) : '—'}
                        </p>
                        <button onClick={(e) => openEditBudget(e, campaign)} className="p-0.5 text-gray-600 hover:text-blue-400 transition-colors"><Pencil className="w-3 h-3" /></button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 mb-0.5">POSITIONS</p>
                    <p className="text-sm text-white font-mono">
                      {campaign.deployed_count || 0}
                      <span className="text-gray-500">/{campaign.position_count || 0}</span>
                      <span className="text-[10px] text-gray-600 ml-1">deployed</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 mb-0.5">CAPITAL DEPLOYED</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white font-mono">
                        {fmt(campaign.total_deployed || 0)}
                      </p>
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.min(deployPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">{deployPct.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">
        Campaigns • Strategic investment planning & tracking • Not financial advice
      </p>
    </div>
  )
}
