'use client'

import { useEffect, useState } from 'react'
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

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
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
            setError(t('auth.resetPasswordLinkInvalid'))
            setCheckingSession(false)
            return
          }
          // Nettoyer le hash
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError(t('auth.resetPasswordLinkExpired'))
        setCheckingSession(false)
        return
      }

      setHasSession(true)
      setUserEmail(user.email ?? null)
      setCheckingSession(false)
    }

    checkSession()
  }, [supabase, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError(t('auth.resetPasswordMinLength'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('auth.resetPasswordMismatch'))
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      console.error('[ResetPassword] updateUser error:', updateError.message)
      setError(t('auth.resetPasswordUpdateError', { message: updateError.message }))
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-black mb-2">
            {t('auth.resetPasswordTitle')}
          </h1>
          <p className="text-gray-600 text-sm">
            {userEmail
              ? t('auth.resetPasswordSubtitleWithEmail', { email: userEmail })
              : t('auth.resetPasswordSubtitle')}
          </p>
        </div>

        {checkingSession ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FBCF03] mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">{t('auth.resetPasswordCheckingLink')}</p>
          </div>
        ) : !hasSession ? (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full bg-[#FBCF03] text-black font-semibold py-2.5 rounded-lg hover:bg-[#E6BA00] transition-colors"
            >
              {t('auth.resetPasswordBackToLogin')}
            </button>
          </>
        ) : success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm font-medium text-green-700 mb-1">
              ✓ {t('auth.resetPasswordSuccessTitle')}
            </p>
            <p className="text-xs text-green-600">
              {t('auth.resetPasswordSuccessRedirect')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.resetPasswordNewPassword')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent outline-none"
                  placeholder={t('auth.resetPasswordPlaceholder')}
                  required
                  minLength={8}
                  disabled={loading}
                  autoComplete="new-password"
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.resetPasswordConfirmPassword')}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent outline-none"
                  placeholder={t('auth.resetPasswordConfirmPlaceholder')}
                  required
                  minLength={8}
                  disabled={loading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-[#FBCF03] text-black font-semibold py-2.5 rounded-lg hover:bg-[#E6BA00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('auth.resetPasswordSaving') : t('auth.resetPasswordSaveButton')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
