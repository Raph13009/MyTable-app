import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            // Force secure cookies in production
            const cookieOptions = {
              ...options,
              secure: options?.secure !== undefined 
                ? options.secure 
                : process.env.NODE_ENV === 'production',
              sameSite: options?.sameSite || 'lax',
            }
            supabaseResponse.cookies.set(name, value, cookieOptions)
          })
        },
      },
    }
  )

  // Refresh the session by calling getUser
  // This will update the session if it's expired or refresh the tokens
  // Note: ne jamais rediriger /admin vers /dashboard (la page admin gère elle-même l'auth)
  const { data: { user } } = await supabase.auth.getUser()
  
  // Log for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    const authCookies = request.cookies.getAll().filter(c => 
      c.name.includes('sb-') && c.name.includes('auth')
    )
    console.log('[middleware] Auth cookies found:', authCookies.map(c => c.name))
    console.log('[middleware] User authenticated:', !!user)
    if (user) {
      console.log('[middleware] User email:', user.email)
    }
  }

  return supabaseResponse
}

