import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  
  // Handle error responses from Supabase
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  
  if (error) {
    // Redirect to login with error message
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    )
  }

  if (code) {
    const supabase = createServerSupabaseClient()
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Redirect to login if something went wrong
  return NextResponse.redirect(new URL('/login', request.url))
}
```

---

## Your Auth Folder Structure Should Be:
```
src/app/auth/
├── callback/
│   └── route.ts      ← NEW (handles OAuth/email redirects)
└── confirm/
    └── route.ts      ← Already exists (handles OTP confirmation)
```

---

## Also Add to Supabase Redirect URLs:

Add this URL if not already there:
```
https://self-wealth-tracker-app.vercel.app/auth/confirm