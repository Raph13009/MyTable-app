# Configuration Supabase pour les Magic Links

## ⚠️ IMPORTANT : Configuration requise dans Supabase Dashboard

Pour que les magic links fonctionnent correctement, vous devez configurer Supabase :

### 1. Authentication > URL Configuration

1. Allez dans **Supabase Dashboard** > **Authentication** > **URL Configuration**
2. Dans **Redirect URLs**, ajoutez :
   ```
   http://localhost:3000/auth/callback
   ```
   Pour la production, ajoutez aussi :
   ```
   https://your-domain.com/auth/callback
   ```

### 2. Vérifier que l'URL est bien autorisée

L'URL de callback doit être **exactement** celle configurée dans Supabase. Si l'URL n'est pas dans la liste, Supabase retournera une erreur.

### 3. Template d'email (optionnel)

Si vous voulez personnaliser l'email de magic link :
1. Allez dans **Authentication** > **Email Templates**
2. Modifiez le template "Magic Link"
3. L'URL de confirmation sera automatiquement remplacée par `{{ .ConfirmationURL }}`

## 🔍 Dépannage

Si vous voyez `error=auth_failed` dans l'URL après avoir cliqué sur le magic link :

1. **Vérifiez les logs du serveur** : Regardez les logs qui commencent par `[auth/callback]`
2. **Vérifiez l'URL de callback** : Elle doit être exactement `http://localhost:3000/auth/callback`
3. **Vérifiez les paramètres dans l'URL** : L'URL devrait contenir `?code=...` et `&next=...`

## 📝 Exemple d'URL de callback correcte

```
http://localhost:3000/auth/callback?code=abc123&next=/chat/conversation-id
```

Si vous voyez `?error=...` au lieu de `?code=...`, c'est que Supabase a rejeté la requête (URL non autorisée).

