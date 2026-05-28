import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/universe/alerts - Get alerts (unread by default)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const includeRead = searchParams.get('includeRead') === 'true'
    const stockId = searchParams.get('stockId')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('universe_alerts')
      .select(`
        *,
        universe_stocks (
          id,
          ticker,
          name
        )
      `)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by read status
    if (!includeRead) {
      query = query.eq('is_read', false)
    }

    // Filter by stock
    if (stockId) {
      query = query.eq('stock_id', stockId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching universe alerts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count unread alerts by severity
    const unreadCounts = {
      red: data?.filter(a => !a.is_read && a.severity === 'red').length || 0,
      amber: data?.filter(a => !a.is_read && a.severity === 'amber').length || 0,
      green: data?.filter(a => !a.is_read && a.severity === 'green').length || 0,
      total: data?.filter(a => !a.is_read).length || 0
    }

    return NextResponse.json({ 
      alerts: data || [],
      unreadCounts 
    })
  } catch (error) {
    console.error('Universe alerts API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/universe/alerts - Create a new alert
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const {
      stock_id,
      alert_type,
      severity = 'amber',
      message,
      source
    } = body

    // Validate required fields
    if (!stock_id || !alert_type || !message) {
      return NextResponse.json(
        { error: 'stock_id, alert_type, and message are required' },
        { status: 400 }
      )
    }

    // Validate severity
    if (!['red', 'amber', 'green'].includes(severity)) {
      return NextResponse.json(
        { error: 'severity must be red, amber, or green' },
        { status: 400 }
      )
    }

    // Validate alert_type
    const validTypes = ['price_movement', 'earnings', 'analyst_change', 'news', 'thesis_review', 'other']
    if (!validTypes.includes(alert_type)) {
      return NextResponse.json(
        { error: `alert_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('universe_alerts')
      .insert({
        stock_id,
        alert_type,
        severity,
        message,
        source,
        is_read: false
      })
      .select(`
        *,
        universe_stocks (
          id,
          ticker,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Error creating universe alert:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ alert: data }, { status: 201 })
  } catch (error) {
    console.error('Universe alerts POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
