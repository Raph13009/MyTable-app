'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Client component to handle authentication tokens from URL hash
 * 
 * When Supabase magic links redirect with tokens in the hash (#access_token=...),
 * this component extracts them and sets the session in cookies so that:
 * - Middleware can read the session
 * - Server components can read the session
 * - Navigation works without losing auth state
 */
export default function AuthTokenHandler() {
  const router = useRouter()

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    const handleHashTokens = async () => {
      const hash = window.location.hash.substring(1) // Remove #
      if (!hash) {
        console.log('[AuthTokenHandler] No hash found, skipping')
        return
      }

      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')
      const error = params.get('error')
      const errorDescription = params.get('error_description')

      console.log('[AuthTokenHandler] ========== CHECKING HASH TOKENS ==========')
      console.log('[AuthTokenHandler] Hash present:', !!hash)
      console.log('[AuthTokenHandler] Access token present:', !!accessToken)
      console.log('[AuthTokenHandler] Refresh token present:', !!refreshToken)
      console.log('[AuthTokenHandler] Type:', type)
      console.log('[AuthTokenHandler] Error:', error)

      // If there's an error in the hash, redirect to login
      if (error) {
        console.error('[AuthTokenHandler] ❌ Error in hash:', error, errorDescription)
        const cleanUrl = window.location.pathname + window.location.search
        router.replace(`/login?error=auth_failed&details=${encodeURIComponent(errorDescription || error)}`)
        return
      }

      // If we have tokens, set the session
      if (accessToken && refreshToken && type === 'magiclink') {
        console.log('[AuthTokenHandler] ✅ Found magic link tokens in hash')
        console.log('[AuthTokenHandler] Setting session from hash tokens...')

        try {
          const supabase = createClient()
          
          // Set the session using the tokens from the hash
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (setSessionError) {
            console.error('[AuthTokenHandler] ❌ Error setting session:', setSessionError)
            router.replace(`/login?error=auth_failed&details=${encodeURIComponent(setSessionError.message)}`)
            return
          }

          if (!data.session) {
            console.error('[AuthTokenHandler] ❌ No session after setSession')
            router.replace('/login?error=auth_failed&details=Session not created')
            return
          }

          console.log('[AuthTokenHandler] ✅✅✅ SESSION SET SUCCESSFULLY ✅✅✅')
          console.log('[AuthTokenHandler] User email:', data.user?.email)
          console.log('[AuthTokenHandler] User ID:', data.user?.id)
          console.log('[AuthTokenHandler] Session expires at:', data.session.expires_at)

          // Clear the hash from the URL (clean URL)
          const cleanUrl = window.location.pathname + window.location.search
          console.log('[AuthTokenHandler] Cleaning URL hash, redirecting to:', cleanUrl)
          window.history.replaceState(null, '', cleanUrl)

          // Refresh the page to ensure server components see the new session
          // This is necessary because server components render before client components
          console.log('[AuthTokenHandler] Refreshing page to apply session...')
          router.refresh()
        } catch (error: any) {
          console.error('[AuthTokenHandler] ❌ Exception setting session:', error)
          router.replace(`/login?error=auth_failed&details=${encodeURIComponent(error.message || 'Unknown error')}`)
        }
      } else {
        console.log('[AuthTokenHandler] No magic link tokens found in hash')
      }
    }

    handleHashTokens()
  }, [router])

  // This component doesn't render anything
  return null
}
