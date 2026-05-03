'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [info, setInfo] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const supabase = createClient()

  // Gérer les tokens dans le hash (magic link Supabase) - PRIORITAIRE - EXÉCUTER EN PREMIER
  // Ce useEffect doit s'exécuter AVANT tous les autres pour éviter les redirections prématurées
  useEffect(() => {
    // Fonction pour gérer le magic link
    const handleMagicLink = async () => {
      // Vérifier si on a des tokens dans le hash (format: #access_token=...&type=magiclink)
      if (typeof window === 'undefined') {
        console.log('[Login] Window undefined, skipping')
        return
      }
      
      console.log('[Login] ========== STARTING MAGIC LINK HANDLER ==========')
      console.log('[Login] Current URL:', window.location.href)
      console.log('[Login] Hash:', window.location.hash)
      
      const hash = window.location.hash.substring(1) // Enlever le #
      if (!hash) {
        console.log('[Login] No hash found, skipping magic link handling')
        return
      }
      
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')
      
      console.log('[Login] ========== PARSING HASH ==========')
      console.log('[Login] Hash length:', hash.length)
      console.log('[Login] Access token present:', !!accessToken)
      console.log('[Login] Access token length:', accessToken?.length || 0)
      console.log('[Login] Refresh token present:', !!refreshToken)
      console.log('[Login] Type:', type)
      
      if (accessToken && type === 'magiclink') {
        console.log('[Login] ✅✅✅ MAGIC LINK DETECTED - CONNECTING USER ✅✅✅')
        setLoading(true)
        setError('') // Clear any previous errors
        
        try {
          // Échanger le token pour une session
          console.log('[Login] Step 1: Calling supabase.auth.setSession...')
          console.log('[Login] Access token preview:', accessToken.substring(0, 50) + '...')
          console.log('[Login] Refresh token preview:', refreshToken?.substring(0, 20) + '...')
          
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })
          
          console.log('[Login] Step 2: setSession response received')
          console.log('[Login] Error:', error ? error.message : 'none')
          console.log('[Login] Data session:', !!data?.session)
          console.log('[Login] Data user:', !!data?.user)
          
          if (error) {
            console.error('[Login] ❌❌❌ ERROR setting session ❌❌❌')
            console.error('[Login] Error message:', error.message)
            console.error('[Login] Error status:', error.status)
            console.error('[Login] Error name:', error.name)
            console.error('[Login] Full error:', JSON.stringify(error, null, 2))
            setError(`Erreur lors de la connexion: ${error.message}`)
            setLoading(false)
            return
          }
          
          if (data.session && data.user) {
            console.log('[Login] ✅✅✅ SESSION CREATED SUCCESSFULLY ✅✅✅')
            console.log('[Login] User email:', data.user.email)
            console.log('[Login] User ID:', data.user.id)
            console.log('[Login] Session expires at:', data.session.expires_at)
            
            // Attendre un peu pour s'assurer que les cookies sont bien set
            await new Promise(resolve => setTimeout(resolve, 200))
            
            // Vérifier que la session est bien active
            console.log('[Login] Step 3: Verifying session is active...')
            const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser()
            
            if (verifyError) {
              console.error('[Login] ⚠️ Verify error (but continuing):', verifyError.message)
            }
            
            if (verifiedUser) {
              console.log('[Login] ✅ Session verified - User:', verifiedUser.email)
            } else {
              console.log('[Login] ⚠️ No verified user, but continuing anyway')
            }
            
            // Nettoyer le hash de l'URL immédiatement
            const nextParam = searchParams.get('next')
            const fromAdmin = typeof window !== 'undefined' && document.referrer?.includes('/admin')
            const next = nextParam || (fromAdmin ? '/admin' : '/dashboard')
            console.log('[Login] Step 4: Redirecting to:', next, fromAdmin ? '(from admin)' : '')
            
            // Nettoyer l'URL
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
            
            // Rediriger immédiatement vers le dashboard
            console.log('[Login] Step 5: Performing redirect...')
            // Utiliser window.location.href pour forcer une navigation complète
            window.location.href = next
            return // Important : arrêter l'exécution ici
          } else {
            console.error('[Login] ❌ No session or user in response')
            console.error('[Login] Data object:', {
              hasSession: !!data?.session,
              hasUser: !!data?.user,
              sessionKeys: data?.session ? Object.keys(data.session) : [],
              userKeys: data?.user ? Object.keys(data.user) : [],
            })
            setError('Erreur lors de la création de la session.')
            setLoading(false)
          }
        } catch (err: any) {
          console.error('[Login] ❌❌❌ EXCEPTION handling magic link ❌❌❌')
          console.error('[Login] Exception type:', err?.constructor?.name)
          console.error('[Login] Exception message:', err?.message)
          console.error('[Login] Exception stack:', err?.stack)
          setError(`Erreur lors de la connexion: ${err?.message || 'Erreur inconnue'}`)
          setLoading(false)
        }
      } else {
        console.log('[Login] No magic link tokens found in hash')
        if (!accessToken) console.log('[Login] Missing access_token')
        if (type !== 'magiclink') console.log('[Login] Type is not magiclink:', type)
      }
    }
    
    // Exécuter IMMÉDIATEMENT sans délai
    console.log('[Login] Mounting component, checking for magic link...')
    handleMagicLink()
    
    // Écouter aussi les changements de hash (au cas où)
    const handleHashChange = () => {
      console.log('[Login] Hash changed event fired, re-checking...')
      handleMagicLink()
    }
    window.addEventListener('hashchange', handleHashChange)
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [supabase, searchParams]) // Ajouter supabase et searchParams comme dépendances

  // Pré-remplir l'email si présent dans l'URL
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  // Vérifier les erreurs dans l'URL
  useEffect(() => {
    const urlError = searchParams.get('error')
    const errorDetails = searchParams.get('details')
    
    if (urlError === 'auth_failed') {
      if (errorDetails?.includes('expired') || errorDetails?.includes('invalid')) {
        setError('Le lien de connexion a expiré ou est invalide. Veuillez demander un nouveau lien.')
      } else {
        setError(`Erreur lors de la connexion: ${errorDetails || 'Veuillez réessayer.'}`)
      }
    }
  }, [searchParams])

  // Vérifier si l'utilisateur est déjà connecté
  // Mais seulement si l'email n'est pas pré-rempli ou si force=true n'est pas présent
  // ET seulement s'il n'y a pas de tokens dans le hash (pour éviter les conflits avec le magic link)
  useEffect(() => {
    const checkAuth = async () => {
      console.log('[Login] checkAuth: start')
      // Ne pas vérifier l'authentification si on a des tokens dans le hash (le magic link handler s'en occupe)
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        if (params.get('access_token') && params.get('type') === 'magiclink') {
          console.log('[Login] Magic link tokens detected, skipping auth check')
          return
        }
      }
      
      const emailParam = searchParams.get('email')
      const force = searchParams.get('force')
      const nextParam = searchParams.get('next')
      console.log('[Login] checkAuth: params', {
        emailParam: !!emailParam,
        force,
        nextParam,
        hasHash: typeof window !== 'undefined' ? !!window.location.hash : false,
        path: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      })
      
      // Si un email est pré-rempli ou si force=true, on ne redirige pas automatiquement
      // pour permettre à l'utilisateur de demander un nouveau magic link ou de se reconnecter
      if (emailParam || force === 'true') {
        // Si force=true, déconnecter l'utilisateur actuel pour forcer la reconnexion
        if (force === 'true') {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            console.log('[Login] Force reconnection - signing out current user')
            await supabase.auth.signOut()
          }
        }
        return
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('[Login] checkAuth: getSession error:', sessionError.message)
        return
      }

      if (!sessionData?.session) {
        console.log('[Login] checkAuth: no session found, staying on login')
        return
      }

      const sessionExpiresAt = sessionData.session.expires_at
      if (sessionExpiresAt && sessionExpiresAt * 1000 < Date.now()) {
        console.warn('[Login] checkAuth: session expired, signing out', {
          expiresAt: new Date(sessionExpiresAt * 1000).toISOString(),
        })
        await supabase.auth.signOut()
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('[Login] checkAuth: getUser error, signing out', userError.message)
        await supabase.auth.signOut()
        return
      }

      if (user) {
        // Si l'utilisateur venait de /admin (referrer), le renvoyer vers /admin au lieu de /dashboard
        const fromAdmin = typeof window !== 'undefined' && document.referrer?.includes('/admin')
        const next = nextParam || (fromAdmin ? '/admin' : '/dashboard')
        console.log('[Login] User already authenticated, redirecting to:', next, fromAdmin ? '(from admin)' : '')
        router.push(next)
      } else {
        console.log('[Login] checkAuth: session present but no user, staying on login')
      }
    }
    
    // Attendre un peu pour laisser le magic link handler s'exécuter en premier
    const timeoutId = setTimeout(() => {
    checkAuth()
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [router, supabase, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setResetSent(false)
    setLoading(true)

    const normalizedEmail = email.toLowerCase().trim()
    const next = searchParams.get('next') || '/dashboard'

    try {
      // Se déconnecter d'abord si un autre compte est connecté
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        const normalizedCurrentEmail = currentUser.email?.toLowerCase().trim()
        if (normalizedCurrentEmail !== normalizedEmail) {
          console.log('[Login] Different email detected - signing out current user first')
          await supabase.auth.signOut()
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }

      // === Cas 1 : connexion par mot de passe ===
      if (password.trim()) {
        console.log('[Login] Signing in with password for', normalizedEmail)
        const { data, error: pwError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (pwError) {
          console.error('[Login] Password sign-in error:', pwError.message)
          // Message lisible : "Invalid login credentials" → soit pas de mdp, soit mauvais
          if (pwError.message?.toLowerCase().includes('invalid login credentials')) {
            setError(
              "Email ou mot de passe incorrect. Si vous n'avez jamais défini de mot de passe, cliquez sur \"Mot de passe oublié / Définir mon mot de passe\" ci-dessous."
            )
          } else if (pwError.message?.toLowerCase().includes('email not confirmed')) {
            setError("Votre email n'est pas confirmé. Demandez un lien de connexion pour activer votre compte.")
          } else {
            setError(`Erreur lors de la connexion : ${pwError.message}`)
          }
          setLoading(false)
          return
        }

        if (data.session && data.user) {
          console.log('[Login] Password sign-in success for', data.user.email)
          await new Promise(resolve => setTimeout(resolve, 200))
          window.location.href = next
          return
        }

        setError('La session n\'a pas pu être créée. Réessayez.')
        setLoading(false)
        return
      }

      // === Cas 2 : magic link (mdp vide) ===
      const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

      console.log('[Login] Sending magic link to:', normalizedEmail)
      setSending(true)
      setLoading(false)

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      })

      if (authError) {
        console.error('[Login] Error sending magic link:', authError.message)
        setSending(false)
        setLoading(false)
        throw authError
      }

      console.log('[Login] Magic link sent successfully')
    } catch (err: any) {
      console.error('[Login] Error:', err)
      setError(err.message || 'Une erreur est survenue')
      setLoading(false)
      setSending(false)
    }
  }

  const handleForgotPassword = async () => {
    setError('')
    setInfo('')
    setResetSent(false)

    const normalizedEmail = email.toLowerCase().trim()
    if (!normalizedEmail) {
      setError('Entrez d\'abord votre email pour recevoir le lien.')
      return
    }

    try {
      setLoading(true)
      const next = searchParams.get('next') || '/dashboard'
      // On passe par /auth/callback pour échanger le code, puis on redirige vers /auth/reset-password
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        `/auth/reset-password?next=${encodeURIComponent(next)}`
      )}`

      console.log('[Login] Sending password reset email to', normalizedEmail)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      })

      if (resetError) {
        console.error('[Login] Reset password error:', resetError.message)
        setError(`Impossible d'envoyer l'email : ${resetError.message}`)
        setLoading(false)
        return
      }

      setResetSent(true)
      setInfo(
        'Email envoyé ! Cliquez sur le lien reçu pour définir votre mot de passe. Pensez à vérifier vos spams.'
      )
      setLoading(false)
    } catch (err: any) {
      console.error('[Login] Forgot password exception:', err)
      setError(err.message || 'Une erreur est survenue')
      setLoading(false)
    }
  }

  // Afficher un message de chargement si on traite un magic link
  const isProcessingMagicLink = loading && typeof window !== 'undefined' && window.location.hash.includes('access_token')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {isProcessingMagicLink ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FBCF03] mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-black mb-2">
              Connexion en cours...
            </h1>
            <p className="text-gray-600">
              Veuillez patienter pendant que nous vous connectons
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-black mb-2">Connexion</h1>
              <p className="text-gray-600 text-sm">
                Entrez votre email et votre mot de passe.<br />
                Sans mot de passe, vous recevrez un lien de connexion par email.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent outline-none"
                  placeholder="votre@email.com"
                  required
                  disabled={loading || sending}
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe <span className="text-gray-400 font-normal">(facultatif)</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent outline-none"
                  placeholder="••••••••"
                  disabled={loading || sending}
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {info && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">{info}</p>
                </div>
              )}

              {sending && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-700 mb-1">
                    ✓ Lien de connexion envoyé !
                  </p>
                  <p className="text-xs text-green-600">
                    Vérifiez votre boîte de réception et vos spams. Le lien expire dans 1 heure.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || sending || !email.trim()}
                className="w-full bg-[#FBCF03] text-black font-semibold py-2.5 rounded-lg hover:bg-[#E6BA00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending
                  ? 'Envoi en cours...'
                  : loading
                  ? 'Connexion...'
                  : password.trim()
                  ? 'Connexion'
                  : 'Recevoir le lien de connexion'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading || sending || resetSent}
                  className="text-sm text-gray-600 hover:text-black underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mot de passe oublié / Définir mon mot de passe
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
