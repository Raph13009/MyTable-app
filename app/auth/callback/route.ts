import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/database'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  console.log('========================================')
  console.log('[auth/callback] ========== CALLBACK CALLED ==========')
  console.log('[auth/callback] Full URL:', requestUrl.toString())
  console.log('[auth/callback] Code:', code ? `present (${code.substring(0, 10)}...)` : 'missing')
  console.log('[auth/callback] Next:', next)
  console.log('[auth/callback] Error:', error)
  console.log('[auth/callback] Error description:', errorDescription)
  console.log('[auth/callback] All search params:', Object.fromEntries(requestUrl.searchParams))
  
  // Vérifier les cookies
  const allCookies = request.cookies.getAll()
  console.log('[auth/callback] All cookies received:', allCookies.map(c => c.name))
  const pkceCookies = allCookies.filter(c => 
    c.name.includes('code-verifier') || 
    c.name.includes('pkce') || 
    c.name.includes('sb-') && c.name.includes('auth')
  )
  console.log('[auth/callback] PKCE/auth cookies:', pkceCookies.map(c => c.name))
  console.log('========================================')

  // Si Supabase a retourné une erreur, la gérer
  if (error) {
    console.error('[auth/callback] ❌ Supabase error in URL:', error)
    console.error('[auth/callback] ❌ Error description:', errorDescription)
    console.error('[auth/callback] ❌ This usually means the magic link expired or was already used')
    
    // Extraire le conversationId même si next n'est pas dans l'URL
    let conversationId = null
    if (next && next.includes('/chat/')) {
      conversationId = next.split('/chat/')[1]?.split('?')[0]?.split('/')[0]
    } else {
      // Essayer de l'extraire de l'URL complète
      const chatMatch = requestUrl.toString().match(/\/chat\/([a-f0-9-]+)/)
      if (chatMatch) {
        conversationId = chatMatch[1]
      }
    }
    
    console.log('[auth/callback] Extracted conversationId:', conversationId)
    
    if (conversationId) {
      const redirectUrl = new URL(`/chat/${conversationId}/login`, request.url)
      redirectUrl.searchParams.set('error', 'auth_failed')
      if (errorDescription) {
        redirectUrl.searchParams.set('details', errorDescription)
      }
      console.log('[auth/callback] Redirecting to:', redirectUrl.toString())
      return NextResponse.redirect(redirectUrl)
    }
    
    const homeUrl = new URL('/', request.url)
    homeUrl.searchParams.set('error', 'auth_failed')
    if (errorDescription) {
      homeUrl.searchParams.set('details', errorDescription)
    }
    console.log('[auth/callback] Redirecting to home:', homeUrl.toString())
    return NextResponse.redirect(homeUrl)
  }

  // Si pas de code, rediriger vers la page demandée (peut-être déjà connecté)
  if (!code) {
    console.log('[auth/callback] ⚠️ No code provided, redirecting to next')
    return NextResponse.redirect(new URL(next, request.url))
  }

  // Créer une réponse pour pouvoir set les cookies
  // IMPORTANT: Il faut créer la réponse AVANT de créer le client Supabase
  // pour que les cookies puissent être set correctement
  console.log('[auth/callback] Creating redirect URL from next:', next)
  const redirectUrl = new URL(next, request.url)
  console.log('[auth/callback] Final redirect URL will be:', redirectUrl.toString())
  
  // Créer une réponse de redirection qui sera mise à jour avec les cookies
  let response = NextResponse.redirect(redirectUrl)

  if (code) {
    // Créer le client Supabase avec gestion des cookies pour la réponse
    // Le code verifier PKCE doit être dans les cookies de la requête
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Créer une nouvelle réponse de redirection
            const newResponse = NextResponse.redirect(redirectUrl)
            
            // Mettre à jour tous les cookies dans la nouvelle réponse
            cookiesToSet.forEach(({ name, value, options }) => {
              // S'assurer que les options sont correctes pour les cookies de session
              const cookieOptions = {
                path: options?.path || '/',
                sameSite: (options?.sameSite || 'lax') as 'lax' | 'strict' | 'none',
                httpOnly: options?.httpOnly !== undefined ? options.httpOnly : false,
                secure: options?.secure !== undefined ? options.secure : process.env.NODE_ENV === 'production',
                maxAge: options?.maxAge,
                expires: options?.expires,
              }
              
              // Set le cookie dans la réponse
              newResponse.cookies.set(name, value, cookieOptions)
              
              console.log('[auth/callback] Setting cookie:', name, cookieOptions)
            })
            
            // Mettre à jour la réponse
            response = newResponse
          },
        },
      }
    )
    
    // Vérifier que les cookies sont bien présents
    const allCookies = request.cookies.getAll()
    console.log('[auth/callback] All cookies:', allCookies.map(c => c.name))
    const pkceCookies = allCookies.filter(c => c.name.includes('code-verifier') || c.name.includes('pkce'))
    console.log('[auth/callback] PKCE cookies:', pkceCookies.map(c => c.name))
    
    console.log('[auth/callback] ========== EXCHANGING CODE ==========')
    console.log('[auth/callback] Code length:', code.length)
    console.log('[auth/callback] Code preview:', code.substring(0, 20) + '...')
    
    // Vérifier les cookies avant l'échange
    const cookiesBefore = request.cookies.getAll()
    console.log('[auth/callback] Cookies before exchange:', cookiesBefore.map(c => c.name))
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    console.log('[auth/callback] ========== EXCHANGE RESULT ==========')
    console.log('[auth/callback] Data:', data ? {
      user: data.user?.email,
      userId: data.user?.id,
      session: data.session ? 'present' : 'missing',
      accessToken: data.session?.access_token ? 'present' : 'missing',
    } : 'null')
    console.log('[auth/callback] Error:', error)
    
    if (error) {
      console.error('[auth/callback] ❌❌❌ ERROR EXCHANGING CODE ❌❌❌')
      console.error('[auth/callback] Error message:', error.message)
      console.error('[auth/callback] Error status:', error.status)
      console.error('[auth/callback] Error name:', error.name)
      console.error('[auth/callback] Full error:', JSON.stringify(error, null, 2))
      
      // Vérifier les cookies après l'erreur
      const cookiesAfter = request.cookies.getAll()
      console.log('[auth/callback] Cookies after error:', cookiesAfter.map(c => c.name))
      
      // Si l'erreur est liée au code verifier PKCE, rediriger vers login avec un message clair
      if (error.message?.includes('code verifier') || error.message?.includes('PKCE')) {
        console.error('[auth/callback] PKCE code verifier error - redirecting to login')
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('error', 'auth_failed')
        loginUrl.searchParams.set('details', 'Le lien de connexion a expiré ou est invalide. Veuillez demander un nouveau lien.')
        if (next) {
          loginUrl.searchParams.set('next', next)
        }
        console.log('[auth/callback] Redirecting to login:', loginUrl.toString())
        return NextResponse.redirect(loginUrl)
      }
      
      // Extraire le conversationId
      let conversationId = null
      if (next && next.includes('/chat/')) {
        conversationId = next.split('/chat/')[1]?.split('?')[0]?.split('/')[0]
      } else {
        const chatMatch = requestUrl.toString().match(/\/chat\/([a-f0-9-]+)/)
        if (chatMatch) {
          conversationId = chatMatch[1]
        }
      }
      
      if (conversationId) {
        const redirectUrl = new URL(`/chat/${conversationId}/login`, request.url)
        redirectUrl.searchParams.set('error', 'auth_failed')
        redirectUrl.searchParams.set('details', error.message || 'Erreur lors de l\'échange du code')
        console.log('[auth/callback] Redirecting to login with error:', redirectUrl.toString())
        return NextResponse.redirect(redirectUrl)
      }
      
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'auth_failed')
      loginUrl.searchParams.set('details', error.message || 'Erreur lors de l\'échange du code')
      if (next) {
        loginUrl.searchParams.set('next', next)
      }
      console.log('[auth/callback] Redirecting to login with error:', loginUrl.toString())
      return NextResponse.redirect(loginUrl)
    }

    console.log('[auth/callback] ========== SESSION CREATED ==========')
    console.log('[auth/callback] User email:', data.user?.email)
    console.log('[auth/callback] User ID:', data.user?.id)
    console.log('[auth/callback] Session present:', !!data.session)
    console.log('[auth/callback] Access token present:', !!data.session?.access_token)
    
    // Vérifier que la session est bien créée
    console.log('[auth/callback] Verifying user after session creation...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('[auth/callback] Verification result:')
    console.log('[auth/callback] - User:', user?.email)
    console.log('[auth/callback] - Error:', userError)
    
    if (userError || !user) {
      console.error('[auth/callback] ❌❌❌ WARNING: User not found after session creation ❌❌❌')
      console.error('[auth/callback] User error:', userError)
      console.error('[auth/callback] This means the session was not properly set in cookies')
      
      // Extraire le conversationId
      let conversationId = null
      if (next && next.includes('/chat/')) {
        conversationId = next.split('/chat/')[1]?.split('?')[0]?.split('/')[0]
      }
      
      if (conversationId) {
        const redirectUrl = new URL(`/chat/${conversationId}/login`, request.url)
        redirectUrl.searchParams.set('error', 'auth_failed')
        redirectUrl.searchParams.set('details', 'Session créée mais utilisateur introuvable')
        console.log('[auth/callback] Redirecting to login:', redirectUrl.toString())
        return NextResponse.redirect(redirectUrl)
      }
      
      const homeUrl = new URL('/', request.url)
      homeUrl.searchParams.set('error', 'auth_failed')
      return NextResponse.redirect(homeUrl)
    }
    
    console.log('[auth/callback] ✅✅✅ USER VERIFIED SUCCESSFULLY ✅✅✅')
    console.log('[auth/callback] User email:', user.email)
    console.log('[auth/callback] User ID:', user.id)
    console.log('[auth/callback] Next parameter:', next)
    console.log('[auth/callback] Decoded next:', decodeURIComponent(next))
    console.log('[auth/callback] Redirecting to:', next)
    
    // La réponse devrait déjà contenir tous les cookies de session grâce à setAll
    // Vérifier les cookies dans la réponse
    const responseCookies = response.cookies.getAll()
    console.log('[auth/callback] Cookies in response:', responseCookies.map(c => c.name))
    console.log('[auth/callback] Session access token present:', !!data.session?.access_token)
    console.log('[auth/callback] ========== CALLBACK SUCCESS ==========')
    
    // S'assurer que la redirection utilise bien le paramètre next
    const finalRedirectUrl = new URL(next, request.url)
    console.log('[auth/callback] Final redirect URL:', finalRedirectUrl.toString())
    
    // Créer une nouvelle réponse de redirection avec les cookies
    const finalResponse = NextResponse.redirect(finalRedirectUrl)
    
    // Copier tous les cookies de la réponse précédente
    responseCookies.forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, {
        path: cookie.path || '/',
        sameSite: cookie.sameSite as 'lax' | 'strict' | 'none' || 'lax',
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        maxAge: cookie.maxAge,
        expires: cookie.expires,
      })
    })
    
    return finalResponse
  } else {
    console.log('[auth/callback] ⚠️ No code provided, redirecting to next')
    return NextResponse.redirect(new URL(next, request.url))
  }
}

