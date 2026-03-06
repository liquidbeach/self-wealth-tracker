// src/app/api/exchange-rates/route.ts
import { NextResponse } from 'next/server'

// Cache exchange rates for 1 hour
let cachedRates: { USD_AUD: number; INR_AUD: number; timestamp: number } | null = null
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

export async function GET() {
  try {
    // Return cached rates if still valid
    if (cachedRates && Date.now() - cachedRates.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        USD_AUD: cachedRates.USD_AUD,
        INR_AUD: cachedRates.INR_AUD,
        cached: true,
      })
    }

    // Try to fetch from a free exchange rate API
    // Option 1: exchangerate.host (free, no API key required)
    const response = await fetch(
      'https://api.exchangerate.host/latest?base=AUD&symbols=USD,INR',
      { next: { revalidate: 3600 } }
    )

    if (response.ok) {
      const data = await response.json()
      if (data.rates) {
        // API returns AUD as base, so we need to invert
        // If 1 AUD = 0.65 USD, then 1 USD = 1/0.65 = 1.54 AUD
        const USD_AUD = data.rates.USD ? 1 / data.rates.USD : 1.55
        const INR_AUD = data.rates.INR ? 1 / data.rates.INR : 0.019

        cachedRates = { USD_AUD, INR_AUD, timestamp: Date.now() }

        return NextResponse.json({
          USD_AUD,
          INR_AUD,
          cached: false,
        })
      }
    }

    // Fallback: Try alternative API (frankfurter.app - free, no key)
    const fallbackResponse = await fetch(
      'https://api.frankfurter.app/latest?from=AUD&to=USD,INR'
    )

    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json()
      if (fallbackData.rates) {
        const USD_AUD = fallbackData.rates.USD ? 1 / fallbackData.rates.USD : 1.55
        const INR_AUD = fallbackData.rates.INR ? 1 / fallbackData.rates.INR : 0.019

        cachedRates = { USD_AUD, INR_AUD, timestamp: Date.now() }

        return NextResponse.json({
          USD_AUD,
          INR_AUD,
          cached: false,
        })
      }
    }

    // Return default rates if all APIs fail
    return NextResponse.json({
      USD_AUD: 1.55,
      INR_AUD: 0.019,
      fallback: true,
    })
  } catch (error) {
    console.error('Exchange rate fetch error:', error)
    // Return default rates on error
    return NextResponse.json({
      USD_AUD: 1.55,
      INR_AUD: 0.019,
      error: true,
    })
  }
}
