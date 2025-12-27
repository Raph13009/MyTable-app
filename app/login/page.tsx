'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
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
            const next = searchParams.get('next') || '/dashboard'
            console.log('[Login] Step 4: Redirecting to:', next)
            
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
      
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const next = searchParams.get('next') || '/dashboard'
        console.log('[Login] User already authenticated, redirecting to:', next)
        router.push(next)
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
    setLoading(true)

    try {
      console.log('[Login] ========== STARTING LOGIN PROCESS ==========')
      
      // Se déconnecter d'abord si un autre compte est connecté
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        const normalizedCurrentEmail = currentUser.email?.toLowerCase().trim()
        const normalizedNewEmail = email.toLowerCase().trim()
        
        if (normalizedCurrentEmail !== normalizedNewEmail) {
          console.log('[Login] ⚠️  Different email detected - signing out current user first...')
          await supabase.auth.signOut()
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      // Vérifier si l'utilisateur existe dans auth.users
      const { data: { user: existingUser }, error: checkError } = await supabase.auth.getUser()
      
      // Envoyer le magic link
      const normalizedEmail = email.toLowerCase().trim()
      const next = searchParams.get('next') || '/dashboard'
      const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      
      console.log('[Login] Sending magic link to:', normalizedEmail)
      console.log('[Login] Redirect URL:', redirectUrl)
      
      setSending(true)
      setLoading(false)
      
      console.log('[Login] ========== CALLING signInWithOtp ==========')
      console.log('[Login] Email:', normalizedEmail)
      console.log('[Login] Redirect URL:', redirectUrl)
      console.log('[Login] Options:', {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: true,
      })
      
      const { data: otpData, error: authError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true, // Créer l'utilisateur s'il n'existe pas
        },
      })

      console.log('[Login] ========== signInWithOtp RESULT ==========')
      console.log('[Login] OTP data:', otpData)
      console.log('[Login] Auth error:', authError)
      console.log('[Login] Magic link sent:', !authError)

      if (authError) {
        console.error('[Login] ❌ Error sending magic link:', authError.message)
        console.error('[Login] Error code:', authError.status)
        console.error('[Login] Full error:', JSON.stringify(authError, null, 2))
        setSending(false)
        setLoading(false)
        throw authError
      }

      console.log('[Login] ✅ Magic link sent successfully')
      console.log('[Login] Note: Supabase envoie automatiquement l\'email. Vérifiez votre boîte de réception et les spams.')
    } catch (err: any) {
      console.error('[Login] Error:', err)
      setError(err.message || 'Une erreur est survenue')
      setLoading(false)
      setSending(false)
    }
  }

  // Afficher un message de chargement si on traite un magic link
  const isProcessingMagicLink = loading && typeof window !== 'undefined' && window.location.hash.includes('access_token')

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white border-2 border-gray-300 rounded-lg p-8">
          {isProcessingMagicLink ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FBCF03] mx-auto mb-4"></div>
              <h1 className="text-2xl font-bold text-black mb-2">
                Connexion en cours...
              </h1>
              <p className="text-gray-600 mb-6">
                Veuillez patienter pendant que nous vous connectons
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-black mb-2">
                Connexion
              </h1>
              <p className="text-gray-600 mb-6">
                Entrez votre email pour recevoir un lien de connexion
              </p>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              disabled={loading || sending}
            />

            {error && (
              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {sending && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <p className="text-green-700 text-sm font-medium mb-2">
                  ✓ Lien de connexion envoyé !
                </p>
                <p className="text-green-600 text-xs">
                  Vérifiez votre boîte de réception et vos spams. Le lien expire dans 1 heure.
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || sending || !email.trim()}
              className="w-full"
            >
              {sending ? 'Envoi en cours...' : loading ? 'Vérification...' : 'Recevoir le lien de connexion'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

