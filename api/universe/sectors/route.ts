import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// GET /api/universe/sectors - Get all sectors
export async function GET() {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('universe_sectors')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching universe sectors:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sectors: data || [] })
  } catch (error) {
    console.error('Universe sectors API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
