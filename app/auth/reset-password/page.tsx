'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // L'utilisateur arrive ici après le callback OAuth qui a posé la session.
  // On vérifie qu'il y a bien une session active avant d'afficher le formulaire.
  useEffect(() => {
    const checkSession = async () => {
      // Si Supabase a posé un hash (#access_token=...&type=recovery), poser la session.
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const type = params.get('type')

        if (accessToken && (type === 'recovery' || type === 'magiclink')) {
          console.log('[ResetPassword] Hash tokens detected, setting session')
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })
          if (setErr) {
            console.error('[ResetPassword] setSession error:', setErr.message)
            setError('Le lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau.')
            setCheckingSession(false)
            return
          }
          // Nettoyer le hash
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Lien expiré ou invalide. Retournez sur la page de connexion pour en demander un nouveau.')
        setCheckingSession(false)
        return
      }

      setHasSession(true)
      setUserEmail(user.email ?? null)
      setCheckingSession(false)
    }

    checkSession()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      console.error('[ResetPassword] updateUser error:', updateError.message)
      setError(`Erreur : ${updateError.message}`)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    const next = searchParams.get('next') || '/dashboard'
    setTimeout(() => {
      window.location.href = next
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white border-2 border-gray-300 rounded-lg p-8">
          <h1 className="text-2xl font-bold text-black mb-2">
            Définir mon mot de passe
          </h1>
          <p className="text-gray-600 mb-6">
            {userEmail
              ? `Choisissez un mot de passe pour le compte ${userEmail}.`
              : 'Choisissez un mot de passe pour votre compte.'}
          </p>

          {checkingSession ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FBCF03] mx-auto mb-3"></div>
              <p className="text-gray-600 text-sm">Vérification du lien…</p>
            </div>
          ) : !hasSession ? (
            <>
              {error && (
                <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 mb-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              <Button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full"
              >
                Retour à la connexion
              </Button>
            </>
          ) : success ? (
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
              <p className="text-green-700 text-sm font-medium mb-1">
                ✓ Mot de passe enregistré !
              </p>
              <p className="text-green-600 text-xs">
                Redirection en cours…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nouveau mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Au moins 8 caractères"
                required
                minLength={8}
                disabled={loading}
                autoComplete="new-password"
              />
              <Input
                label="Confirmer le mot de passe"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez le mot de passe"
                required
                minLength={8}
                disabled={loading}
                autoComplete="new-password"
              />

              {error && (
                <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full"
              >
                {loading ? 'Enregistrement…' : 'Enregistrer mon mot de passe'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
