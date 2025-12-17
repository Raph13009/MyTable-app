'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ChatLoginPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const conversationId = params.conversationId as string
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  // Vérifier les erreurs dans l'URL
  useEffect(() => {
    const urlError = searchParams.get('error')
    const errorDetails = searchParams.get('details')
    
    if (urlError === 'unauthorized') {
      setError('Vous n\'êtes pas autorisé à accéder à cette conversation.')
    } else if (urlError === 'auth_failed') {
      if (errorDetails?.includes('expired') || errorDetails?.includes('invalid')) {
        setError('Le lien de connexion a expiré ou est invalide. Veuillez demander un nouveau lien.')
      } else {
        setError(`Erreur lors de la connexion: ${errorDetails || 'Veuillez réessayer.'}`)
      }
    } else if (urlError === 'conversation_not_found') {
      setError('Cette conversation n\'existe pas ou a été supprimée.')
    }
  }, [searchParams])

  // Vérifier si l'utilisateur est déjà connecté
  useEffect(() => {
    const checkAuth = async () => {
      console.log('[ChatLogin] ========== CHECKING IF ALREADY AUTHENTICATED ==========')
      console.log('[ChatLogin] Conversation ID:', conversationId)
      console.log('[ChatLogin] Current cookies:', document.cookie)
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('[ChatLogin] User check result:')
      console.log('[ChatLogin] - User:', user?.email)
      console.log('[ChatLogin] - Error:', userError)
      console.log('[ChatLogin] - User exists:', !!user)
      
      if (user) {
        console.log('[ChatLogin] ✅ User is authenticated, checking participant status...')
        // Vérifier que l'email correspond à un participant via API (bypass RLS)
        try {
          const response = await fetch(`/api/check-participant?conversationId=${conversationId}&email=${encodeURIComponent(user.email || '')}`)
          const data = await response.json()
          console.log('[ChatLogin] Participant check result:', data)
          if (data.isParticipant) {
            console.log('[ChatLogin] ✅ User is participant, redirecting to chat')
            router.push(`/chat/${conversationId}`)
          } else {
            console.log('[ChatLogin] ❌ User is NOT a participant')
          }
        } catch (error) {
          console.error('[ChatLogin] Error checking participant:', error)
        }
      } else {
        console.log('[ChatLogin] ❌ User is NOT authenticated')
      }
      console.log('[ChatLogin] ======================================================')
    }
    checkAuth()
  }, [conversationId, router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      console.log('[ChatLogin] ========== STARTING LOGIN PROCESS ==========')
      
      // IMPORTANT : Se déconnecter d'abord si un autre compte est connecté
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        const normalizedCurrentEmail = currentUser.email?.toLowerCase().trim()
        const normalizedNewEmail = email.toLowerCase().trim()
        
        console.log('[ChatLogin] Current user:', normalizedCurrentEmail)
        console.log('[ChatLogin] New email:', normalizedNewEmail)
        console.log('[ChatLogin] Same email?', normalizedCurrentEmail === normalizedNewEmail)
        
        // Si ce n'est pas le même email, se déconnecter d'abord
        if (normalizedCurrentEmail !== normalizedNewEmail) {
          console.log('[ChatLogin] ⚠️  Different email detected - signing out current user first...')
          await supabase.auth.signOut()
          console.log('[ChatLogin] ✅ Signed out previous user')
          // Attendre un peu pour que la déconnexion soit effective
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      console.log('[ChatLogin] Checking participants for email:', email.toLowerCase().trim())
      console.log('[ChatLogin] Conversation ID:', conversationId)
      
      // Utiliser l'API route pour vérifier le participant (bypass RLS)
      const response = await fetch(`/api/check-participant?conversationId=${conversationId}&email=${encodeURIComponent(email.toLowerCase().trim())}`)
      const data = await response.json()
      
      console.log('[ChatLogin] Participants check result:', data)
      console.log('[ChatLogin] Response OK:', response.ok)
      console.log('[ChatLogin] Is participant:', data.isParticipant)
      console.log('[ChatLogin] All participants:', data.allParticipants)
      console.log('[ChatLogin] Matching participants:', data.matchingParticipants)

      if (!response.ok) {
        console.error('[ChatLogin] API error:', data)
        setError(`Erreur: ${data.error || 'Erreur lors de la vérification'}`)
        setLoading(false)
        return
      }

      if (!data.isParticipant) {
        console.log('[ChatLogin] Email not found in participants')
        console.log('[ChatLogin] Available emails:', data.allParticipants?.map((p: any) => p.email))
        setError(`Cet email n'est pas autorisé. Emails autorisés: ${data.allParticipants?.map((p: any) => p.email).join(', ') || 'aucun'}`)
        setLoading(false)
        return
      }

      // Envoyer le magic link
      const normalizedEmail = email.toLowerCase().trim()
      const redirectUrl = `${window.location.origin}/auth/callback?next=/chat/${conversationId}`
      
      console.log('[ChatLogin] ========== SENDING MAGIC LINK ==========')
      console.log('[ChatLogin] Email:', normalizedEmail)
      console.log('[ChatLogin] Redirect URL:', redirectUrl)
      console.log('[ChatLogin] Conversation ID:', conversationId)
      
      setSending(true)
      
      console.log('[ChatLogin] ========== CALLING signInWithOtp ==========')
      console.log('[ChatLogin] Email:', normalizedEmail)
      console.log('[ChatLogin] Redirect URL:', redirectUrl)
      
      // Vérifier les cookies avant l'appel
      console.log('[ChatLogin] Cookies before signInWithOtp:', document.cookie)
      
      const { data: otpData, error: authError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true, // Créer l'utilisateur s'il n'existe pas
        },
      })

      console.log('[ChatLogin] ========== signInWithOtp RESULT ==========')
      console.log('[ChatLogin] OTP response data:', otpData)
      console.log('[ChatLogin] OTP response error:', authError)
      console.log('[ChatLogin] Error details:', authError ? JSON.stringify(authError, null, 2) : 'none')
      
      // Vérifier les cookies après l'appel
      console.log('[ChatLogin] Cookies after signInWithOtp:', document.cookie)
      console.log('[ChatLogin] ==========================================')
      
      if (authError) {
        console.error('[ChatLogin] ❌ Error sending magic link:', authError.message)
        console.error('[ChatLogin] Error code:', authError.status)
        console.error('[ChatLogin] Full error:', authError)
      } else {
        console.log('[ChatLogin] ✅ Magic link sent successfully')
      }
      console.log('[ChatLogin] ========== MAGIC LINK SENT ==========')

      if (authError) {
        console.error('[ChatLogin] Auth error:', authError)
        throw authError
      }

      // Afficher un message de succès
      console.log('[ChatLogin] Magic link sent successfully')
      setSending(false)
      setLoading(false)
      alert('Un lien de connexion a été envoyé à votre email. Vérifiez votre boîte de réception.')
    } catch (err: any) {
      console.error('[ChatLogin] Error:', err)
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
            Accéder au chat
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
                <p className="text-green-700 text-sm">
                  ✓ Lien de connexion envoyé ! Vérifiez votre email.
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

