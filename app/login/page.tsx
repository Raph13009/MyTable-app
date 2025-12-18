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
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const next = searchParams.get('next') || '/dashboard'
        console.log('[Login] User already authenticated, redirecting to:', next)
        router.push(next)
      }
    }
    checkAuth()
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

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white border-2 border-gray-300 rounded-lg p-8">
          <h1 className="text-2xl font-bold text-black mb-2">
            Connexion
          </h1>
          <p className="text-gray-600 mb-6">
            Entrez votre email pour recevoir un lien de connexion
          </p>

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

