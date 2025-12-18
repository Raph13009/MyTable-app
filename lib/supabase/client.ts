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
            
            // Toujours définir path=/ pour les cookies Supabase
            cookieString += `; path=/`
            
            if (options?.maxAge) {
              cookieString += `; max-age=${options.maxAge}`
            } else if (options?.expires) {
              cookieString += `; expires=${options.expires}`
            }
            
            // Utiliser 'lax' par défaut pour sameSite (nécessaire pour PKCE)
            if (options?.sameSite) {
              cookieString += `; samesite=${options.sameSite}`
            } else {
              cookieString += `; samesite=lax`
            }
            
            if (options?.secure) {
              cookieString += `; secure`
            }
            
            // Ne pas définir httpOnly pour les cookies côté client (ils doivent être accessibles via JS)
            document.cookie = cookieString
            console.log('[supabase-client] Cookie set:', name, {
              path: options?.path || '/',
              sameSite: options?.sameSite || 'lax',
              maxAge: options?.maxAge,
              secure: options?.secure,
            })
          })
          console.log('[supabase-client] All cookies after set:', document.cookie)
          
          // Vérifier que les cookies PKCE sont bien présents
          const pkceCookies = document.cookie.split('; ').filter(c => 
            c.includes('code-verifier') || 
            c.includes('pkce') ||
            (c.includes('sb-') && c.includes('auth'))
          )
          console.log('[supabase-client] PKCE cookies after set:', pkceCookies)
        },
      },
    }
  )
}
