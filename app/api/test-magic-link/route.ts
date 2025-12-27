import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBaseUrl } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required. Use ?email=test@example.com' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const baseUrl = getBaseUrl()
    const redirectUrl = `${baseUrl}/auth/callback?next=${encodeURIComponent('/dashboard')}`
    
    console.log('[test-magic-link] ========== TESTING MAGIC LINK ==========')
    console.log('[test-magic-link] Email:', email)
    console.log('[test-magic-link] Redirect URL:', redirectUrl)
    console.log('[test-magic-link] Base URL:', baseUrl)
    console.log('[test-magic-link] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('[test-magic-link] Has service role key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    const normalizedEmail = email.toLowerCase().trim()
    console.log('[test-magic-link] Normalized email:', normalizedEmail)
    
    // Envoyer le magic link
    console.log('[test-magic-link] Calling supabase.auth.signInWithOtp...')
    const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: true,
      },
    })

    if (otpError) {
      console.error('[test-magic-link] ❌❌❌ ERROR ❌❌❌')
      console.error('[test-magic-link] Error message:', otpError.message)
      console.error('[test-magic-link] Error status:', otpError.status)
      console.error('[test-magic-link] Error code:', otpError.code)
      console.error('[test-magic-link] Full error:', JSON.stringify(otpError, null, 2))
      return NextResponse.json({
        success: false,
        error: otpError.message,
        status: otpError.status,
        code: otpError.code,
        details: otpError,
      }, { status: 500 })
    }

    console.log('[test-magic-link] ✅✅✅ SUCCESS ✅✅✅')
    console.log('[test-magic-link] OTP data:', JSON.stringify(otpData, null, 2))
    console.log('[test-magic-link] ⚠️ NOTE: Supabase sends the email automatically')
    console.log('[test-magic-link] ⚠️ Check your email inbox and spam folder')
    console.log('[test-magic-link] ⚠️ In development, emails might be delayed or require Supabase email configuration')
    
    return NextResponse.json({
      success: true,
      message: 'Magic link sent successfully',
      email: email,
      redirectUrl: redirectUrl,
      otpData: otpData,
    })
  } catch (error: any) {
    console.error('[test-magic-link] ❌ Exception:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
    }, { status: 500 })
  }
}
