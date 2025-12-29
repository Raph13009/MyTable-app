# Raph's Next.js Project Setup Guide

Quick reference guide to avoid common deployment issues with Next.js, TypeScript, and ESLint.

## 🚀 Initial Setup Checklist

### 1. ESLint Configuration

**File:** `.eslintrc.json`

```json
{
  "extends": "next/core-web-vitals",
  "rules": {
    "react/no-unescaped-entities": "off"
  }
}
```

**Why:** Prevents apostrophe errors in JSX comments and text. Next.js ESLint is strict about HTML entities.

### 2. TypeScript Best Practices

#### Use `undefined` instead of `null` for optional fields

```typescript
// ❌ BAD
const user: User = {
  email: 'test@example.com',
  phone: null,  // TypeScript error!
  confirmation_sent_at: null
}

// ✅ GOOD
const user: User = {
  email: 'test@example.com',
  phone: undefined,  // Correct
  confirmation_sent_at: undefined
}
```

**Why:** TypeScript optional fields expect `string | undefined`, not `string | null`.

#### Handle nullable values properly

```typescript
// ❌ BAD
if (user.email) { ... }  // Error if user can be null

// ✅ GOOD
if (user?.email) { ... }  // Safe with optional chaining

// ✅ GOOD
const email = user?.email ?? 'default@example.com'
```

### 3. Mock Data for Testing

When creating mock objects for tests, always match the exact type:

```typescript
// ✅ GOOD - Match exact type structure
const mockUser: User = {
  id: 'test-id',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  confirmation_sent_at: undefined,  // Not null!
  recovery_sent_at: undefined,
  email_confirmed_at: new Date().toISOString(),
  invited_at: undefined,
  action_link: undefined,
  last_sign_in_at: new Date().toISOString(),
  phone: undefined,
  phone_confirmed_at: undefined,
  confirmed_at: new Date().toISOString(),
  is_anonymous: false,
} as User
```

### 4. Pre-Deployment Checklist

Before pushing to production:

```bash
# 1. Check TypeScript errors
npx tsc --noEmit

# 2. Run build locally
npm run build

# 3. Fix all errors before pushing
git add .
git commit -m "fix: ..."
git push
```

**Never push if `npm run build` fails locally!**

### 5. Common TypeScript Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Type 'null' is not assignable to type 'string \| undefined'` | Using `null` instead of `undefined` | Replace `null` with `undefined` |
| `'user' is possibly 'null'` | Not checking for null | Use `user?.property` or `user ?? defaultValue` |
| `Property 'X' is possibly 'undefined'` | Not handling optional fields | Use `property ?? defaultValue` or optional chaining |

### 6. ESLint Warnings to Watch

- **`react/no-unescaped-entities`**: Apostrophes in JSX text
  - Fix: Use `&apos;` or disable rule globally
- **`@next/next/no-img-element`**: Using `<img>` instead of `<Image />`
  - Fix: Use Next.js `<Image />` component or disable if intentional
- **`react-hooks/exhaustive-deps`**: Missing dependencies in useEffect
  - Fix: Add missing dependencies or use `// eslint-disable-next-line`

### 7. Vercel Deployment Tips

1. **Always test build locally first**
   ```bash
   npm run build
   ```

2. **If deployment fails, check:**
   - TypeScript errors (`npx tsc --noEmit`)
   - ESLint errors (shown in build output)
   - Missing environment variables

3. **Clear Vercel cache if needed:**
   - Go to Vercel dashboard → Settings → Clear Build Cache
   - Or redeploy after fixing errors

### 8. Quick Fixes Reference

#### Fix apostrophe errors
```typescript
// In .eslintrc.json
"rules": {
  "react/no-unescaped-entities": "off"
}
```

#### Fix null/undefined errors
```typescript
// Replace all null with undefined in optional fields
const obj = {
  field: undefined  // not null
}
```

#### Fix optional chaining
```typescript
// Always use ?. for potentially null/undefined values
const value = obj?.property?.nested ?? defaultValue
```

## 📝 Project Template

When starting a new Next.js project:

1. ✅ Configure `.eslintrc.json` with relaxed rules
2. ✅ Set up TypeScript strict mode (or configure as needed)
3. ✅ Create test files with proper type casting
4. ✅ Add pre-commit hook to run `npm run build` (optional but recommended)
5. ✅ Document environment variables in `.env.example`

## 🎯 Golden Rules

1. **Test locally before pushing** - Always run `npm run build`
2. **Use `undefined` not `null`** - For TypeScript optional fields
3. **Use optional chaining** - `?.` for potentially null values
4. **Configure ESLint early** - Disable problematic rules upfront
5. **Match types exactly** - Mock data must match real type structure

---

**Last updated:** 2024  
**For:** Next.js 14+ projects with TypeScript and ESLint
