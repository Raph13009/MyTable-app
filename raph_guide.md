# Raph's Next.js + TypeScript Guide

**Guide personnel pour éviter les erreurs courantes de déploiement**

---

## 🚀 Checklist Avant Chaque Push

### 1. Tester le Build Localement
```bash
npm run build
```
**⚠️ Ne jamais push si le build local échoue !**

### 2. Vérifier TypeScript
```bash
npx tsc --noEmit
```
**⚠️ Corriger toutes les erreurs TypeScript avant de push**

---

## ⚙️ Configuration Initiale (À Faire en Début de Projet)

### ESLint - `.eslintrc.json`
```json
{
  "extends": "next/core-web-vitals",
  "rules": {
    "react/no-unescaped-entities": "off"
  }
}
```
**Pourquoi :** Évite les erreurs avec les apostrophes dans le texte JSX

### TypeScript - `tsconfig.json`
Vérifier que `strict: true` est activé pour détecter les erreurs tôt.

---

## 🐛 Erreurs Courantes et Solutions

### ❌ Erreur : Apostrophes dans JSX
```
Error: `'` can be escaped with `&apos;`
```
**Solution :**
- Utiliser `&apos;` dans le texte JSX
- OU désactiver la règle dans `.eslintrc.json` (recommandé)

### ❌ Erreur : Type 'null' is not assignable to type 'string | undefined'
```
Type 'null' is not assignable to type 'string | undefined'
```
**Solution :**
- Utiliser `undefined` au lieu de `null` pour les champs optionnels
- Exemple : `booking_date: undefined` (pas `null`)

### ❌ Erreur : Property is possibly 'null' or 'undefined'
```
'user' is possibly 'null'
```
**Solution :**
- Utiliser l'optional chaining : `user?.email` au lieu de `user.email`
- OU vérifier avant : `if (user) { ... }`

---

## 📝 Bonnes Pratiques

### 1. Types Optionnels
```typescript
// ✅ BON
const data = {
  name: 'John',
  email: undefined,  // Pour les champs optionnels
}

// ❌ MAUVAIS
const data = {
  name: 'John',
  email: null,  // Ne pas utiliser null
}
```

### 2. Optional Chaining
```typescript
// ✅ BON
const email = user?.email
const id = user?.id

// ❌ MAUVAIS
const email = user.email  // Peut crasher si user est null
```

### 3. Fichiers de Test
Si vous créez des fichiers de test (`*-test.tsx`), soit :
- Les exclure du build de production
- OU s'assurer qu'ils respectent tous les types TypeScript

---

## 🔍 Commandes Utiles

```bash
# Build local
npm run build

# Vérifier TypeScript
npx tsc --noEmit

# Linter
npm run lint

# Vérifier les erreurs avant push
npm run build && npx tsc --noEmit
```

---

## 📦 Structure Recommandée

```
project/
├── .eslintrc.json          # Config ESLint (désactiver règles strictes)
├── tsconfig.json           # Config TypeScript (strict: true)
├── next.config.js          # Config Next.js
└── app/                    # Pages Next.js
    └── (test)/             # Fichiers de test (exclure du build si possible)
```

---

## 🎯 Workflow Recommandé

1. **Développer** → Faire les changements
2. **Tester localement** → `npm run build` + `npx tsc --noEmit`
3. **Corriger les erreurs** → Avant de commit
4. **Commit** → Seulement si tout passe
5. **Push** → Vercel buildera automatiquement

---

## 💡 Astuces

- **Toujours tester le build local avant de push**
- **Utiliser `undefined` pour les champs optionnels TypeScript**
- **Configurer ESLint dès le début du projet**
- **Vérifier les types avec `tsc --noEmit` régulièrement**

---

**Dernière mise à jour :** 2024  
**Version :** 1.0
