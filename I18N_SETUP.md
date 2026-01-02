# i18n System Documentation

## Overview

Professional internationalization system with browser language detection, manual language switcher, and localStorage persistence.

## Features

- ✅ **Browser language detection** (fr/en) with fallback to French
- ✅ **Manual language switcher** in header (desktop & mobile)
- ✅ **localStorage persistence** - user choice is remembered
- ✅ **Scalable JSON-based translations** - easy to add new languages
- ✅ **Type-safe** - TypeScript support
- ✅ **Zero dependencies** - custom lightweight solution

## Architecture

### Files Structure

```
/lib/i18n.ts              # Core i18n utilities (detection, persistence)
/hooks/useTranslation.ts   # React hook for translations
/messages/
  ├── fr.json             # French translations
  └── en.json             # English translations
/components/
  ├── LanguageSwitcher.tsx    # Language selector component
  └── LocaleProvider.tsx       # Updates HTML lang attribute
```

## Usage

### In Components

```tsx
'use client'

import { useTranslation } from '@/hooks/useTranslation'

export default function MyComponent() {
  const { t, locale, changeLocale } = useTranslation()

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('common.loading')}</p>
      <button onClick={() => changeLocale('en')}>
        Switch to English
      </button>
    </div>
  )
}
```

### Translation Keys

Translation keys use dot notation:

```json
{
  "common": {
    "loading": "Chargement...",
    "cancel": "Annuler"
  },
  "dashboard": {
    "title": "Messages"
  }
}
```

Usage: `t('common.loading')` → "Chargement..." (fr) or "Loading..." (en)

### Adding New Translations

1. **Add to both language files** (`messages/fr.json` and `messages/en.json`):

```json
// fr.json
{
  "mySection": {
    "myKey": "Mon texte en français"
  }
}

// en.json
{
  "mySection": {
    "myKey": "My English text"
  }
}
```

2. **Use in component**:

```tsx
const { t } = useTranslation()
<p>{t('mySection.myKey')}</p>
```

### Language Switcher

The `LanguageSwitcher` component is already integrated in:
- Dashboard header (desktop: top-right, mobile: next to logout button)

To add it elsewhere:

```tsx
import LanguageSwitcher from '@/components/LanguageSwitcher'

<LanguageSwitcher />
```

## Supported Languages

Currently supported:
- **French (fr)** - Default
- **English (en)**

To add more languages:
1. Create `messages/[locale].json`
2. Add locale to `supportedLocales` in `/lib/i18n.ts`
3. Import and add to `messages` object in `/hooks/useTranslation.ts`
4. Add option to `LanguageSwitcher.tsx`

## Browser Detection

The system automatically detects browser language:
1. Checks `localStorage.getItem('locale')` (user preference)
2. Falls back to `navigator.language`
3. Defaults to French if unsupported

## Persistence

User language choice is stored in `localStorage` with key `'locale'` and persists across sessions.

## HTML Lang Attribute

The `LocaleProvider` component automatically updates the `<html lang="...">` attribute based on the detected locale.

## Best Practices

1. **Always use translation keys** - Never hardcode UI text
2. **Keep keys organized** - Use nested objects for logical grouping
3. **Use descriptive keys** - `dashboard.filterOngoing` not `filter1`
4. **Test both languages** - Ensure all UI text is translated
5. **Add translations incrementally** - Translate as you develop

## Example: Complete Component Translation

```tsx
'use client'

import { useTranslation } from '@/hooks/useTranslation'

export default function MyComponent() {
  const { t } = useTranslation()

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <button>{t('common.save')}</button>
      <p>{t('dashboard.noConversations')}</p>
    </div>
  )
}
```

## Migration Guide

To translate existing components:

1. Import the hook:
```tsx
import { useTranslation } from '@/hooks/useTranslation'
```

2. Get the `t` function:
```tsx
const { t } = useTranslation()
```

3. Replace hardcoded strings:
```tsx
// Before
<h1>Messages</h1>

// After
<h1>{t('dashboard.title')}</h1>
```

4. Add translations to JSON files if needed
