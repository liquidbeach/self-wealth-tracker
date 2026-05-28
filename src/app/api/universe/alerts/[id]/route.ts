import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/universe/alerts/[id] - Update alert (mark as read)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const alertId = params.id

    const { is_read } = body

    const updateData: Record<string, any> = {}
    
    if (is_read !== undefined) {
      updateData.is_read = is_read
      if (is_read) {
        updateData.read_at = new Date().toISOString()
      }
    }

    const { data, error } = await supabase
      .from('universe_alerts')
      .update(updateData)
      .eq('id', alertId)
      .select()
      .single()

    if (error) {
      console.error('Error updating universe alert:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ alert: data })
  } catch (error) {
    console.error('Universe alert PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/universe/alerts/[id] - Delete an alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const alertId = params.id

    const { error } = await supabase
      .from('universe_alerts')
      .delete()
      .eq('id', alertId)

    if (error) {
      console.error('Error deleting universe alert:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Universe alert DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
