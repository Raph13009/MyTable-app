import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

export function createClient() {
  // createBrowserClient de @supabase/ssr v0.8.0 gère automatiquement les cookies pour PKCE
  // On configure explicitement les cookies pour s'assurer que le code verifier est stocké
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Récupérer tous les cookies du navigateur
          if (typeof document === 'undefined') return []
          const cookies = document.cookie.split('; ').map(cookie => {
            const [name, ...rest] = cookie.split('=')
            return { name, value: decodeURIComponent(rest.join('=')) }
          }).filter(c => c.name)
          console.log('[supabase-client] Getting cookies:', cookies.map(c => c.name))
          return cookies
        },
        setAll(cookiesToSet) {
          // Définir tous les cookies dans le navigateur
          if (typeof document === 'undefined') return
          console.log('[supabase-client] Setting cookies:', cookiesToSet.map(c => c.name))
          cookiesToSet.forEach(({ name, value, options }) => {
            let cookieString = `${name}=${encodeURIComponent(value)}`
            if (options?.maxAge) {
              cookieString += `; max-age=${options.maxAge}`
            }
            if (options?.path) {
              cookieString += `; path=${options.path}`
            } else {
              cookieString += `; path=/`
            }
            if (options?.sameSite) {
              cookieString += `; samesite=${options.sameSite}`
            } else {
              cookieString += `; samesite=lax`
            }
            if (options?.secure) {
              cookieString += `; secure`
            }
            document.cookie = cookieString
            console.log('[supabase-client] Cookie set:', name, 'Path:', options?.path || '/')
          })
          console.log('[supabase-client] All cookies after set:', document.cookie)
        },
      },
    }
  )
}
