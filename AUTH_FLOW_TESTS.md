# Authentication Flow - Test Scenarios

**Last updated:** After refactoring magic link flow  
**Status:** Ready for testing

---

## ✅ Unified Flow Summary

**After chef accepts a booking:**

1. **Client receives:**
   - Magic link email from Supabase Auth (authentication)
   - Informational email from Resend (transactional notification)

2. **Chef receives:**
   - Magic link email from Supabase Auth (authentication)

3. **Both magic links:**
   - Redirect to: `/auth/callback?next=/dashboard`
   - Authenticate the user
   - Redirect to `/dashboard` after successful authentication

---

## 🧪 Test Scenarios

### Test 1: Client Flow - Happy Path

**Steps:**
1. Client submits booking form
2. Chef receives email with accept/refuse links
3. Chef clicks "Accept"
4. Client receives:
   - Magic link email from Supabase Auth
   - Informational email from Resend
5. Client clicks magic link
6. Client is authenticated and redirected to `/dashboard`

**Expected Result:**
- ✅ Client is logged in
- ✅ Client sees their dashboard with conversations
- ✅ No manual login step required
- ✅ Two emails received (magic link + informational)

**Status:** [ ] Pass / [ ] Fail

---

### Test 2: Chef Flow - Happy Path

**Steps:**
1. Chef receives booking request email
2. Chef clicks "Accept"
3. Chef receives magic link email from Supabase Auth
4. Chef clicks magic link
5. Chef is authenticated and redirected to `/dashboard`

**Expected Result:**
- ✅ Chef is logged in
- ✅ Chef sees their dashboard with conversations
- ✅ No manual login step required

**Status:** [ ] Pass / [ ] Fail

---

### Test 3: Edge Case - User Already Exists

**Steps:**
1. Client submits booking (user created in Supabase Auth)
2. Chef accepts
3. Magic link is sent to existing client user
4. Client clicks magic link

**Expected Result:**
- ✅ No duplicate user created
- ✅ Existing user is authenticated
- ✅ Magic link works correctly

**Status:** [ ] Pass / [ ] Fail

---

### Test 4: Edge Case - Magic Link Expired

**Steps:**
1. Chef accepts booking
2. Client receives magic link
3. Wait > 1 hour (magic link expires)
4. Client clicks expired magic link

**Expected Result:**
- ✅ Error message displayed
- ✅ Redirect to login page with error
- ✅ Client can request new magic link

**Status:** [ ] Pass / [ ] Fail

---

### Test 5: Edge Case - Clicking Link Twice

**Steps:**
1. Chef accepts booking
2. Client receives magic link
3. Client clicks magic link (first time) → authenticated
4. Client clicks same magic link again (second time)

**Expected Result:**
- ✅ First click: Success, authenticated
- ✅ Second click: Error (link already used/expired)
- ✅ No duplicate session created

**Status:** [ ] Pass / [ ] Fail

---

### Test 6: Regression - Booking Submission Still Works

**Steps:**
1. Client submits booking form
2. Check that client user is created in Supabase Auth
3. Check that confirmation email is sent

**Expected Result:**
- ✅ User created successfully
- ✅ Confirmation email sent via Resend
- ✅ No magic link sent at this stage (correct)

**Status:** [ ] Pass / [ ] Fail

---

### Test 7: Regression - Chef Refusal Still Works

**Steps:**
1. Chef receives booking request
2. Chef clicks "Refuse"
3. Client receives refusal email

**Expected Result:**
- ✅ Booking status updated to "refused"
- ✅ Client receives refusal email via Resend
- ✅ No magic links sent (correct - booking refused)

**Status:** [ ] Pass / [ ] Fail

---

### Test 8: Security - Redirect URL Validation

**Steps:**
1. Chef accepts booking
2. Check magic link URL in email
3. Verify redirect URL format

**Expected Result:**
- ✅ Redirect URL: `/auth/callback?next=/dashboard`
- ✅ URL is properly encoded
- ✅ No direct `/dashboard` link (must go through callback)

**Status:** [ ] Pass / [ ] Fail

---

### Test 9: Consistency - Both Users Get Same Flow

**Steps:**
1. Chef accepts booking
2. Compare client and chef magic link emails
3. Compare redirect URLs

**Expected Result:**
- ✅ Both use same redirect URL format
- ✅ Both go through `/auth/callback`
- ✅ Both redirect to `/dashboard` after auth
- ✅ Identical authentication flow

**Status:** [ ] Pass / [ ] Fail

---

### Test 10: Email Separation - Responsibilities Clear

**Steps:**
1. Chef accepts booking
2. Check client emails received
3. Check chef emails received

**Expected Result:**
- ✅ Client: Magic link (Supabase) + Informational (Resend)
- ✅ Chef: Magic link (Supabase) only
- ✅ No authentication URLs in Resend emails
- ✅ Clear separation of responsibilities

**Status:** [ ] Pass / [ ] Fail

---

## 📊 Test Results Summary

**Total Tests:** 10  
**Passed:** [ ]  
**Failed:** [ ]  
**Not Tested:** [ ]

**Date Tested:** [ ]  
**Tester:** [ ]  
**Environment:** [ ] Production / [ ] Staging / [ ] Local

---

## 🔍 Notes

- Magic links expire after 1 hour (Supabase default)
- All redirects go through `/auth/callback` for security
- No duplicate users should be created
- Email wording unchanged (except informational email update)
