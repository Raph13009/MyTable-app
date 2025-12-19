import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const url = request.nextUrl.clone()
    const protocol = request.headers.get('x-forwarded-proto') || url.protocol
    
    // If request is HTTP, redirect to HTTPS
    if (protocol === 'http:' && !url.hostname.includes('localhost')) {
      url.protocol = 'https:'
      return NextResponse.redirect(url, 301)
    }
  }
  
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

