import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/universe/stocks - Get all active universe stocks with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const sector = searchParams.get('sector')
    const tier = searchParams.get('tier')
    const search = searchParams.get('search')
    const includeRemoved = searchParams.get('includeRemoved') === 'true'

    let query = supabase
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
      .order('ticker')

    // Filter by status (exclude removed by default)
    if (!includeRemoved) {
      query = query.neq('status', 'removed')
    }

    // Filter by tier
    if (tier && tier !== 'all') {
      query = query.eq('tier', tier)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching universe stocks:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Apply search filter (client-side for flexibility)
    let filteredData = data || []
    if (search) {
      const searchLower = search.toLowerCase()
      filteredData = filteredData.filter(stock => 
        stock.ticker.toLowerCase().includes(searchLower) ||
        stock.name.toLowerCase().includes(searchLower) ||
        stock.thesis?.toLowerCase().includes(searchLower)
      )
    }

    // Filter by sector slug if sector param was provided
    if (sector && sector !== 'all') {
      filteredData = filteredData.filter(stock => 
        stock.universe_sectors?.slug === sector
      )
    }

    return NextResponse.json({ stocks: filteredData })
  } catch (error) {
    console.error('Universe stocks API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/universe/stocks - Add a new stock to the universe
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const {
      ticker,
      name,
      sector_id,
      tier,
      exchange,
      market_cap,
      thesis,
      catalysts,
      risks,
      status = 'active',
      status_color = 'green'
    } = body

    // Validate required fields
    if (!ticker || !name || !sector_id) {
      return NextResponse.json(
        { error: 'ticker, name, and sector_id are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('universe_stocks')
      .insert({
        ticker: ticker.toUpperCase(),
        name,
        sector_id,
        tier: tier || 'heavyweight',
        exchange: exchange || 'NASDAQ',
        market_cap,
        thesis,
        catalysts,
        risks,
        status,
        status_color,
        added_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding universe stock:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ stock: data }, { status: 201 })
  } catch (error) {
    console.error('Universe stocks POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
