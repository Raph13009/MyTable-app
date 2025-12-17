# Configuration des variables d'environnement

## 📝 Créer votre fichier .env.local

Créez un fichier `.env.local` à la racine du projet avec le contenu suivant :

```env
# ============================================
# SUPABASE CONFIGURATION
# ============================================
# Obtenez ces valeurs depuis votre dashboard Supabase :
# https://app.supabase.com/project/_/settings/api

# URL de votre projet Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Clé API anonyme (publique, safe pour le client)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# ============================================
# APPLICATION CONFIGURATION
# ============================================
# URL de base de votre application
# En local : http://localhost:3000
# En production : https://your-app.vercel.app

NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# EMAIL CONFIGURATION (RESEND)
# ============================================
# Option 1 : Utiliser Resend (recommandé)
# 1. Créez un compte sur https://resend.com
# 2. Obtenez votre API key dans le dashboard
# 3. Configurez votre domaine d'envoi
# 4. Utilisez un email vérifié comme FROM_EMAIL

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
EMAIL_PROVIDER=resend

# ============================================
# EMAIL CONFIGURATION (MAKE - Alternative)
# ============================================
# Option 2 : Utiliser Make (webhook)
# Si vous préférez utiliser Make au lieu de Resend,
# décommentez ces lignes et commentez les lignes Resend ci-dessus

# EMAIL_PROVIDER=make
# MAKE_WEBHOOK_URL=https://hook.us1.make.com/your-webhook-url
```

## 🔑 Où trouver les valeurs

### Supabase

1. Allez sur [https://app.supabase.com](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **Settings** > **API**
4. Copiez :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Resend (pour les emails)

1. Créez un compte sur [https://resend.com](https://resend.com)
2. Allez dans **API Keys**
3. Créez une nouvelle clé API
4. Copiez la clé → `RESEND_API_KEY`
5. Pour `RESEND_FROM_EMAIL`, utilisez un email vérifié dans votre compte Resend

### Application URL

- **Local** : `http://localhost:3000`
- **Production** : Votre URL Vercel (ex: `https://mytable-app.vercel.app`)

## ⚠️ Important

- Le fichier `.env.local` est dans `.gitignore` et ne sera pas commité
- Ne partagez jamais vos clés API publiquement
- Pour la production (Vercel), ajoutez ces variables dans les **Environment Variables** du dashboard Vercel

## ✅ Vérification

Après avoir créé votre `.env.local`, redémarrez le serveur de développement :

```bash
npm run dev
```

Si tout est correct, l'application devrait démarrer sans erreur.

