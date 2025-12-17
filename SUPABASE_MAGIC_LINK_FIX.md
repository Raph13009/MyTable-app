# Fix pour les Magic Links qui expirent

## Problème
Les magic links expirent trop rapidement ou sont invalides.

## Solutions

### 1. Vérifier la configuration Supabase

Dans **Supabase Dashboard** > **Authentication** > **Settings** :

1. **Email Auth** :
   - Vérifiez que "Enable email signup" est activé
   - Vérifiez que "Enable email confirmations" est activé (ou désactivé selon vos besoins)

2. **URL Configuration** :
   - Assurez-vous que `http://localhost:3000/auth/callback` est dans la liste des "Redirect URLs"
   - Pour la production, ajoutez aussi votre URL de production

3. **Email Templates** :
   - Le template "Magic Link" doit contenir `{{ .ConfirmationURL }}`
   - Vérifiez que le template est correctement configuré

### 2. Durée de validité des liens

Par défaut, les magic links Supabase expirent après **1 heure**. Si vous avez besoin d'une durée plus longue, vous pouvez :

1. Aller dans **Authentication** > **Settings** > **Auth**
2. Modifier le "JWT expiry" (mais cela affecte aussi les sessions)
3. Ou utiliser des liens de réinitialisation de mot de passe qui ont une durée plus longue

### 3. Vérifier que l'utilisateur existe

Si l'utilisateur existe déjà dans `auth.users`, le magic link devrait fonctionner. Si ce n'est pas le cas :

1. Vérifiez dans **Authentication** > **Users** que l'utilisateur existe
2. Vérifiez que l'email correspond exactement (même casse)

### 4. Tester avec un nouveau lien

Si un lien a expiré :
1. Retournez sur la page de login
2. Entrez à nouveau votre email
3. Demandez un nouveau magic link
4. Cliquez sur le nouveau lien immédiatement

### 5. Logs à vérifier

Regardez les logs du serveur (terminal) pour voir :
- `[ChatLogin] ========== SENDING MAGIC LINK ==========`
- `[auth/callback] ========== CALLBACK CALLED ==========`

Ces logs vous diront exactement ce qui se passe.

## Dépannage

Si le problème persiste :

1. **Vérifiez les logs** : Regardez les logs du serveur pour voir les erreurs exactes
2. **Testez avec un email différent** : Peut-être que l'email a un problème
3. **Vérifiez la configuration Supabase** : Assurez-vous que tout est correctement configuré
4. **Vérifiez que l'URL de callback est correcte** : Elle doit être exactement `http://localhost:3000/auth/callback`

