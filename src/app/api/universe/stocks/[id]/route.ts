import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/universe/stocks/[id] - Update a stock
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const stockId = params.id

    const {
      name,
      sector_id,
      tier,
      exchange,
      market_cap,
      thesis,
      catalysts,
      risks,
      status,
      status_color,
      removal_reason
    } = body

    // Build update object with only provided fields
    const updateData: Record<string, any> = {}
    
    if (name !== undefined) updateData.name = name
    if (sector_id !== undefined) updateData.sector_id = sector_id
    if (tier !== undefined) updateData.tier = tier
    if (exchange !== undefined) updateData.exchange = exchange
    if (market_cap !== undefined) updateData.market_cap = market_cap
    if (thesis !== undefined) updateData.thesis = thesis
    if (catalysts !== undefined) updateData.catalysts = catalysts
    if (risks !== undefined) updateData.risks = risks
    if (status !== undefined) updateData.status = status
    if (status_color !== undefined) updateData.status_color = status_color
    
    // If removing, record the reason and date
    if (status === 'removed') {
      updateData.removal_reason = removal_reason || 'Manual removal'
      updateData.removed_date = new Date().toISOString().split('T')[0]
    }

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('universe_stocks')
      .update(updateData)
      .eq('id', stockId)
      .select(`
        *,
        universe_sectors (
          id,
          name,
          slug,
          color
        )
      `)
      .single()

    if (error) {
      console.error('Error updating universe stock:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ stock: data })
  } catch (error) {
    console.error('Universe stock PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/universe/stocks/[id] - Get single stock details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const stockId = params.id

    const { data, error } = await supabase
      .from('universe_stocks')
      .select(`
        *,
        universe_sectors (
          id,
          name,
          slug,
          description,
          color
        )
      `)
      .eq('id', stockId)
      .single()

    if (error) {
      console.error('Error fetching universe stock:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ stock: data })
  } catch (error) {
    console.error('Universe stock GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/universe/stocks/[id] - Permanently delete (use PATCH with status='removed' for soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const stockId = params.id

    const { error } = await supabase
      .from('universe_stocks')
      .delete()
      .eq('id', stockId)

    if (error) {
      console.error('Error deleting universe stock:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Universe stock DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
