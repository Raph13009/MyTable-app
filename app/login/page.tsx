'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [hashProcessing, setHashProcessing] = useState(false)
  const supabase = createClient()

  // Filet de sécurité : si un ancien lien magique pointe encore vers /login
  // (avec #access_token=...&type=magiclink|recovery dans le hash), on échange
  // le token et on redirige. Aucun magic link n'est envoyé depuis cette page.
  useEffect(() => {
    const handleIncomingHash = async () => {
      if (typeof window === 'undefined' || !window.location.hash) return

      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      if (!accessToken || (type !== 'magiclink' && type !== 'recovery')) return

      setHashProcessing(true)
      const { data, error: setErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      })

      if (setErr || !data.session) {
        console.error('[Login] Hash session error:', setErr?.message)
        setError(t('auth.linkExpired'))
        setHashProcessing(false)
        return
      }

      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      const next =
        type === 'recovery'
          ? `/auth/reset-password?next=${encodeURIComponent(searchParams.get('next') || '/dashboard')}`
          : searchParams.get('next') || '/dashboard'
      window.location.href = next
    }

    handleIncomingHash()
  }, [supabase, searchParams, t])

  // Pré-remplir l'email si présent dans l'URL
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) setEmail(emailParam)
  }, [searchParams])

  // Affiche les erreurs renvoyées par /auth/callback
  useEffect(() => {
    const urlError = searchParams.get('error')
    const errorDetails = searchParams.get('details')
    if (urlError === 'auth_failed') {
      setError(errorDetails || t('auth.authFailed'))
    }
  }, [searchParams, t])

  // Si déjà connecté, rediriger
  useEffect(() => {
    const checkAuth = async () => {
      if (typeof window !== 'undefined' && window.location.hash) return
      if (searchParams.get('email') || searchParams.get('force') === 'true') {
        if (searchParams.get('force') === 'true') {
          await supabase.auth.signOut()
        }
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const fromAdmin = typeof window !== 'undefined' && document.referrer?.includes('/admin')
        const next = searchParams.get('next') || (fromAdmin ? '/admin' : '/dashboard')
        router.push(next)
      }
    }
    checkAuth()
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
      // Si un autre compte est connecté, le déconnecter d'abord
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser && currentUser.email?.toLowerCase().trim() !== normalizedEmail) {
        await supabase.auth.signOut()
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      const { data, error: pwError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (pwError) {
        console.error('[Login] Sign-in error:', pwError.message)
        const msg = pwError.message?.toLowerCase() || ''
        if (msg.includes('invalid login credentials')) {
          setError(t('auth.invalidCredentials'))
        } else if (msg.includes('email not confirmed')) {
          setError(t('auth.emailNotConfirmed'))
        } else {
          setError(t('auth.loginError', { message: pwError.message }))
        }
        setLoading(false)
        return
      }

      if (data.session && data.user) {
        await new Promise(resolve => setTimeout(resolve, 200))
        window.location.href = next
        return
      }

      setError(t('auth.sessionNotCreated'))
      setLoading(false)
    } catch (err: any) {
      console.error('[Login] Exception:', err)
      setError(err.message || t('auth.genericError'))
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setError('')
    setInfo('')

    const normalizedEmail = email.toLowerCase().trim()
    if (!normalizedEmail) {
      setError(t('auth.forgotPasswordEnterEmail'))
      return
    }

    try {
      setLoading(true)
      const next = searchParams.get('next') || '/dashboard'
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        `/auth/reset-password?next=${encodeURIComponent(next)}`
      )}`

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      })

      if (resetError) {
        setError(t('auth.resetEmailSendError', { message: resetError.message }))
        setLoading(false)
        return
      }

      setResetSent(true)
      setInfo(t('auth.resetEmailSent'))
      setLoading(false)
    } catch (err: any) {
      setError(err.message || t('auth.genericError'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {hashProcessing ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FBCF03] mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-black mb-2">{t('auth.hashProcessingTitle')}</h1>
            <p className="text-gray-600">{t('auth.hashProcessingSubtitle')}</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-black mb-2">{t('auth.loginPageTitle')}</h1>
              <p className="text-gray-600 text-sm">
                {t('auth.loginPageSubtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent outline-none"
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent outline-none"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
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

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full bg-[#FBCF03] text-black font-semibold py-2.5 rounded-lg hover:bg-[#E6BA00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('auth.submitting') : t('auth.login')}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading || resetSent}
                  className="text-sm text-gray-600 hover:text-black underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
