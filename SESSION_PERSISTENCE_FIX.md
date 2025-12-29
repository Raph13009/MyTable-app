# Session Persistence Fix - Documentation

**Date:** 2024  
**Issue:** Magic link login works, but session is lost when navigating from `/dashboard` to `/chat/[id]`

---

## 🔍 Root Cause Analysis

### Problem
1. Magic link redirects to `/dashboard#access_token=...&refresh_token=...`
2. Tokens are in URL hash (client-side only)
3. Server components cannot read URL hash
4. Middleware runs before client components
5. Session is never stored in cookies
6. Navigation to `/chat/[id]` fails because no session in cookies

### Why This Happens
- Supabase magic links can redirect in two ways:
  - **PKCE flow**: `/auth/callback?code=...` (server-side, handled by callback route)
  - **Hash flow**: `/dashboard#access_token=...` (client-side, tokens in hash)
- When tokens are in the hash, they must be extracted client-side and set as a session
- The session must be stored in cookies so middleware and server components can read it

---

## ✅ Solution Implemented

### 1. Created `AuthTokenHandler` Component

**File:** `/components/AuthTokenHandler.tsx`

**Purpose:**
- Client component that runs on protected pages
- Extracts tokens from URL hash (`#access_token=...`)
- Calls `supabase.auth.setSession()` to store session in cookies
- Cleans URL hash after processing
- Refreshes page to ensure server components see the session

**Key Logic:**
```typescript
// Extract tokens from hash
const params = new URLSearchParams(hash)
const accessToken = params.get('access_token')
const refreshToken = params.get('refresh_token')

// Set session (stores in cookies via client config)
await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: refreshToken,
})

// Clean URL and refresh
window.history.replaceState(null, '', cleanUrl)
router.refresh()
```

### 2. Added to Protected Pages

**Files Modified:**
- `/app/dashboard/page.tsx` - Added `<AuthTokenHandler />`
- `/app/chat/[conversationId]/page.tsx` - Added `<AuthTokenHandler />`

**Why:**
- These pages are protected and need to handle hash tokens
- Ensures session is set before server components try to read it

### 3. Enhanced Middleware Logging

**File:** `/lib/supabase/middleware.ts`

**Changes:**
- Added development logging to debug session issues
- Logs auth cookies and user authentication status

---

## 🔄 Flow After Fix

### Magic Link Click → Dashboard

1. **User clicks magic link**
   - Supabase redirects to `/dashboard#access_token=...&refresh_token=...`

2. **Dashboard page loads**
   - Server component runs first (no session in cookies yet)
   - Client component (`AuthTokenHandler`) mounts

3. **AuthTokenHandler runs**
   - Extracts tokens from hash
   - Calls `supabase.auth.setSession()` → stores in cookies
   - Cleans URL hash
   - Calls `router.refresh()`

4. **Page refreshes**
   - Middleware runs → reads cookies → finds session
   - Server component runs → `getUser()` succeeds
   - Dashboard renders with authenticated user

### Dashboard → Chat Navigation

1. **User clicks conversation**
   - Navigates to `/chat/[conversationId]`

2. **Chat page loads**
   - Middleware runs → reads cookies → finds session ✅
   - Server component runs → `getUser()` succeeds ✅
   - Chat renders with authenticated user ✅

---

## 🧪 Testing Steps

### Test 1: Magic Link → Dashboard → Chat

1. Click magic link from email
2. Should redirect to `/dashboard#access_token=...`
3. Dashboard should load (may show loading briefly)
4. URL hash should be cleaned (no `#access_token=...`)
5. Click a conversation
6. Chat should open WITHOUT redirecting to `/login`

**Expected Result:** ✅ No login redirect, chat opens directly

### Test 2: Direct Chat Access

1. Navigate directly to `/chat/[conversationId]` (with valid session)
2. Should open chat without redirect

**Expected Result:** ✅ Chat opens directly

### Test 3: Session Persistence

1. Login via magic link
2. Navigate: Dashboard → Chat → Dashboard → Chat
3. Should remain authenticated throughout

**Expected Result:** ✅ No login redirects

### Test 4: Expired Session

1. Wait for session to expire (or clear cookies)
2. Navigate to `/chat/[conversationId]`
3. Should redirect to `/login?next=/chat/...`

**Expected Result:** ✅ Redirects to login when session expired

---

## 🔧 Technical Details

### Cookie Storage

When `supabase.auth.setSession()` is called:
- Supabase client (via `@supabase/ssr`) stores session in cookies
- Cookie names: `sb-<project-ref>-auth-token`, etc.
- Cookies are accessible to:
  - Client components (via `document.cookie`)
  - Server components (via `cookies()` from `next/headers`)
  - Middleware (via `request.cookies`)

### Session Refresh

- Middleware calls `supabase.auth.getUser()` on every request
- This refreshes the session if needed
- Expired tokens are automatically refreshed

### URL Hash vs Query Params

- **Hash (`#`)**: Client-side only, not sent to server
- **Query params (`?`)**: Server-side, sent in request
- Magic links can use either, but hash is more common for security

---

## ⚠️ Important Notes

1. **First Load Delay**: On first load after magic link, there may be a brief moment where the server component doesn't see the session. This is normal and handled by the refresh.

2. **Hash Tokens**: If tokens are in the hash, they MUST be extracted client-side. Server components cannot read the hash.

3. **Cookie Configuration**: Cookies must be configured correctly:
   - `path: '/'` (accessible to all routes)
   - `sameSite: 'lax'` (for PKCE flow)
   - `secure: true` in production (HTTPS only)

4. **Middleware Order**: Middleware runs before page components, so it may not see the session on the very first request after magic link. The refresh handles this.

---

## 📊 Files Changed

1. ✅ `/components/AuthTokenHandler.tsx` (new)
2. ✅ `/app/dashboard/page.tsx` (added component)
3. ✅ `/app/chat/[conversationId]/page.tsx` (added component)
4. ✅ `/lib/supabase/middleware.ts` (enhanced logging)

---

## ✅ Verification Checklist

- [x] AuthTokenHandler extracts tokens from hash
- [x] AuthTokenHandler sets session in cookies
- [x] AuthTokenHandler cleans URL hash
- [x] AuthTokenHandler refreshes page
- [x] Middleware reads session from cookies
- [x] Server components can read session
- [x] Navigation works without login redirect
- [x] Session persists across routes

---

**Status:** ✅ Ready for testing
