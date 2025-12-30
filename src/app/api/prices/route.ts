import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Yahoo Finance price fetcher
async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 60 } // Cache for 1 minute
    })

    if (!response.ok) return null

    const data = await response.json()
    const result = data.chart?.result?.[0]
    
    if (!result) return null

    return result.meta?.regularMarketPrice || result.meta?.previousClose || null
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error)
    return null
  }
}

// Format ticker for Yahoo Finance
function formatForYahoo(ticker: string, market: string): string {
  // Handle already formatted tickers
  if (ticker.endsWith('.AX') || ticker.endsWith('.BO') || ticker.endsWith('.BSE')) {
    // Convert .BSE to .BO for Yahoo
    return ticker.replace('.BSE', '.BO')
  }
  
  switch (market) {
    case 'ASX':
      return `${ticker}.AX`
    case 'BSE':
      return `${ticker}.BO`
    case 'US':
    default:
      return ticker
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Verify user is authenticated
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('id, ticker, market, currency')
      .eq('user_id', session.user.id)

    if (holdingsError) {
      return NextResponse.json({ error: holdingsError.message }, { status: 500 })
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ message: 'No holdings to update', updated: 0 })
    }

    // Fetch prices for each holding
    const updates: { id: string; ticker: string; price: number | null; error?: string }[] = []
    
    // Process in batches to avoid rate limiting
    const batchSize = 5
    for (let i = 0; i < holdings.length; i += batchSize) {
      const batch = holdings.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (holding) => {
        const yahooTicker = formatForYahoo(holding.ticker, holding.market)
        const price = await fetchYahooPrice(yahooTicker)
        
        return {
          id: holding.id,
          ticker: holding.ticker,
          price,
          error: price === null ? 'Failed to fetch' : undefined
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      updates.push(...batchResults)
      
      // Delay between batches
      if (i + batchSize < holdings.length) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // Update holdings with new prices
    let successCount = 0
    let failCount = 0
    
    for (const update of updates) {
      if (update.price !== null) {
        const { error } = await supabase
          .from('holdings')
          .update({ current_price: update.price })
          .eq('id', update.id)
        
        if (!error) {
          successCount++
        } else {
          failCount++
        }
      } else {
        failCount++
      }
    }

    // Also update FX rates
    const fxUpdates = await updateFxRates(supabase)

    return NextResponse.json({
      message: 'Prices updated',
      updated: successCount,
      failed: failCount,
      fxRates: fxUpdates,
      details: updates
    })

  } catch (error: any) {
    console.error('Price update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function updateFxRates(supabase: any) {
  try {
    // Fetch FX rates from Yahoo Finance
    const [audusd, usdinr] = await Promise.all([
      fetchYahooPrice('AUDUSD=X'),
      fetchYahooPrice('USDINR=X')
    ])

    const updates = []

    if (audusd) {
      // AUD to USD
      await supabase.from('fx_rates').upsert({
        from_currency: 'AUD',
        to_currency: 'USD',
        rate: audusd,
        updated_at: new Date().toISOString()
      }, { onConflict: 'from_currency,to_currency' })
      
      // USD to AUD (inverse)
      await supabase.from('fx_rates').upsert({
        from_currency: 'USD',
        to_currency: 'AUD',
        rate: 1 / audusd,
        updated_at: new Date().toISOString()
      }, { onConflict: 'from_currency,to_currency' })
      
      updates.push({ pair: 'AUDUSD', rate: audusd })
    }

    if (usdinr) {
      // USD to INR
      await supabase.from('fx_rates').upsert({
        from_currency: 'USD',
        to_currency: 'INR',
        rate: usdinr,
        updated_at: new Date().toISOString()
      }, { onConflict: 'from_currency,to_currency' })
      
      // INR to USD (inverse)
      await supabase.from('fx_rates').upsert({
        from_currency: 'INR',
        to_currency: 'USD',
        rate: 1 / usdinr,
        updated_at: new Date().toISOString()
      }, { onConflict: 'from_currency,to_currency' })
      
      updates.push({ pair: 'USDINR', rate: usdinr })
    }

    if (audusd && usdinr) {
      const audinr = audusd * usdinr
      
      // AUD to INR
      await supabase.from('fx_rates').upsert({
        from_currency: 'AUD',
        to_currency: 'INR',
        rate: audinr,
        updated_at: new Date().toISOString()
      }, { onConflict: 'from_currency,to_currency' })
      
      // INR to AUD (inverse)
      await supabase.from('fx_rates').upsert({
        from_currency: 'INR',
        to_currency: 'AUD',
        rate: 1 / audinr,
        updated_at: new Date().toISOString()
      }, { onConflict: 'from_currency,to_currency' })
      
      updates.push({ pair: 'AUDINR', rate: audinr })
    }

    return updates
  } catch (error) {
    console.error('FX rate update error:', error)
    return []
  }
}

// GET endpoint to just fetch current prices without updating
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Use POST to update prices',
    endpoint: '/api/prices'
  })
}
