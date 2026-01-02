# Vercel Deployment Troubleshooting

## Problème : "Deployment failed" mais aucun déploiement visible sur Vercel

### Étapes de diagnostic

#### 1. Vérifier la connexion GitHub-Vercel

1. Aller sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Vérifier que le projet est bien connecté au bon repository GitHub
3. Vérifier que la branche `main` est bien surveillée

#### 2. Vérifier les variables d'environnement sur Vercel

**Variables REQUISES :**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
RESEND_API_KEY
RESEND_FROM_EMAIL
EMAIL_PROVIDER
```

**Où les ajouter :**
1. Vercel Dashboard > Votre projet > Settings > Environment Variables
2. Ajouter chaque variable pour "Production", "Preview", et "Development"

#### 3. Vérifier les logs de build

1. Aller sur Vercel Dashboard > Votre projet > Deployments
2. Cliquer sur le dernier déploiement (même s'il a échoué)
3. Vérifier les logs de build pour voir l'erreur exacte

#### 4. Forcer un nouveau déploiement

Si aucun déploiement n'apparaît :

1. Vercel Dashboard > Votre projet > Settings > Git
2. Vérifier que le repository est bien connecté
3. Cliquer sur "Redeploy" ou faire un commit vide pour déclencher un nouveau build

#### 5. Vérifier la configuration du projet

Dans Vercel Dashboard > Votre projet > Settings > General :

- **Framework Preset** : Next.js
- **Build Command** : `npm run build` (par défaut)
- **Output Directory** : `.next` (par défaut)
- **Install Command** : `npm install` (par défaut)
- **Root Directory** : `./` (par défaut)

#### 6. Vérifier les erreurs courantes

**Erreur : "Missing environment variables"**
- Solution : Ajouter toutes les variables d'environnement listées ci-dessus

**Erreur : "Build failed"**
- Solution : Vérifier les logs de build pour l'erreur exacte
- Le build local passe ? Vérifier que toutes les dépendances sont dans `package.json`

**Erreur : "Dynamic server usage"**
- Solution : Déjà corrigé avec `export const dynamic = 'force-dynamic'` dans les routes API

#### 7. Actions à essayer

1. **Déconnecter et reconnecter le repository GitHub**
   - Vercel Dashboard > Settings > Git > Disconnect
   - Puis reconnecter le repository

2. **Créer un nouveau projet Vercel**
   - Si le problème persiste, créer un nouveau projet et connecter le même repository

3. **Vérifier les permissions GitHub**
   - Vérifier que Vercel a accès au repository
   - GitHub > Settings > Applications > Authorized OAuth Apps > Vercel

#### 8. Test manuel du build

Pour vérifier que le build fonctionne localement :

```bash
# Nettoyer le cache
rm -rf .next node_modules
npm install
npm run build
```

Si le build local passe mais pas sur Vercel, c'est probablement un problème de variables d'environnement.

#### 9. Contact Vercel Support

Si rien ne fonctionne :
- Vercel Dashboard > Help > Contact Support
- Fournir les logs de build et la configuration du projet
