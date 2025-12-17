# Debug Magic Link - Étapes de diagnostic

## 🔍 Pour identifier le problème

### 1. Regardez les logs du serveur (terminal)

Quand vous cliquez sur le magic link, vous devriez voir dans le terminal :

```
[auth/callback] ========== CALLBACK CALLED ==========
[auth/callback] Full URL: ...
[auth/callback] Code: ...
[auth/callback] Error: ...
```

**Copiez-collez ces logs ici** pour qu'on puisse voir exactement ce qui se passe.

### 2. Vérifiez l'URL du magic link

Quand vous recevez l'email, regardez l'URL du lien. Elle devrait ressembler à :

```
https://votre-projet.supabase.co/auth/v1/verify?token=...&type=email&redirect_to=http://localhost:3000/auth/callback?next=/chat/...
```

### 3. Vérifiez la configuration Supabase

Dans **Supabase Dashboard** > **Authentication** > **URL Configuration** :

- ✅ `http://localhost:3000/auth/callback` doit être dans "Redirect URLs"
- ✅ Pas d'espace ou de caractères spéciaux
- ✅ URL exacte (pas de trailing slash)

### 4. Testez avec un nouveau lien

1. Retournez sur `/chat/[conversationId]/login`
2. Entrez votre email
3. Demandez un nouveau magic link
4. **Cliquez immédiatement** sur le nouveau lien (dans les 5 minutes)
5. Regardez les logs du serveur

### 5. Vérifiez que l'utilisateur existe

Dans **Supabase Dashboard** > **Authentication** > **Users** :

- Vérifiez que l'email existe
- Vérifiez que l'email correspond exactement (même casse)

## 📋 Informations à me donner

Pour que je puisse vous aider, j'ai besoin de :

1. **Les logs du serveur** quand vous cliquez sur le magic link
2. **L'URL complète** du magic link (les premiers caractères suffisent)
3. **Le message d'erreur exact** que vous voyez
4. **La configuration Supabase** (est-ce que l'URL de callback est bien configurée ?)

