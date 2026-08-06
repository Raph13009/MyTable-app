# Guide de dépannage - Problème de connexion utilisateur

## 🚨 Problème actuel

**Utilisateur concerné:** Ryad  
**Email:** ryad932@outlook.com  
**Problème:** Ne peut pas créer de mot de passe / Le lien de connexion ne fonctionne pas

---

## 📋 Diagnostic rapide

### Étape 1: Vérifier le compte dans Supabase Dashboard

1. Allez sur [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez votre projet MyTable
3. Allez dans **Authentication** > **Users**
4. Recherchez `ryad932@outlook.com`

**Vérifiez:**
- ✅ L'utilisateur existe-t-il ?
- ✅ L'email est-il confirmé ? (colonne "Email Confirmed")
- ✅ Y a-t-il une date dans "Last Sign In" ?

### Étape 2: Vérifier l'email dans la table `chefs`

1. Dans Supabase, allez dans **Table Editor**
2. Ouvrez la table `chefs`
3. Recherchez `ryad932@outlook.com`

**Vérifiez:**
- ✅ Le chef existe-t-il dans la table ?
- ✅ L'email est-il exactement le même (pas de fautes de frappe) ?

---

## 🔧 Solutions selon le cas

### Cas 1: L'utilisateur existe dans `chefs` mais PAS dans `auth.users`

**Solution:** Créer le compte d'authentification

#### Option A: Via l'API admin (Recommandé)

```bash
# Assurez-vous que votre serveur de développement est lancé
npm run dev

# Dans un autre terminal, appelez l'API
curl "http://localhost:3000/api/admin/reset-user-password?email=ryad932@outlook.com"
```

Cette API va:
1. Vérifier si l'utilisateur existe
2. Créer le compte s'il n'existe pas
3. Envoyer un email de réinitialisation de mot de passe

#### Option B: Via le dashboard Supabase

1. Allez dans **Authentication** > **Users**
2. Cliquez sur **Add user** > **Create new user**
3. Entrez l'email: `ryad932@outlook.com`
4. Cochez "Auto Confirm User"
5. Ne mettez PAS de mot de passe (il en créera un lui-même)
6. Cliquez sur "Create user"

Ensuite, envoyez-lui un email de réinitialisation :
1. Trouvez l'utilisateur dans la liste
2. Cliquez sur les 3 points (...) > **Send Password Reset Email**

### Cas 2: L'utilisateur existe dans `auth.users` mais ne peut pas se connecter

**Solution:** Réinitialiser le mot de passe

#### Via l'API admin (Recommandé)

```bash
curl "http://localhost:3000/api/admin/reset-user-password?email=ryad932@outlook.com"
```

#### Via le dashboard Supabase

1. **Authentication** > **Users**
2. Trouvez `ryad932@outlook.com`
3. Cliquez sur les 3 points (...) > **Send Password Reset Email**

### Cas 3: L'email de réinitialisation n'arrive pas (Outlook)

**Problèmes connus avec Outlook:**
- Les emails peuvent arriver dans le dossier **Courrier indésirable** (Spam)
- Les emails peuvent être bloqués par les filtres Outlook
- Délai de réception pouvant aller jusqu'à 5-10 minutes

**Solutions:**

1. **Demandez à Ryad de vérifier:**
   - Son dossier **Courrier indésirable** / **Spam**
   - Son dossier **Autres** (si activé)
   - Les filtres de sa boîte de réception

2. **Vérifiez la configuration email dans Supabase:**
   - Allez dans **Authentication** > **Email Templates**
   - Vérifiez que le template "Magic Link" est activé
   - Vérifiez que le template "Reset Password" est activé

3. **Testez avec un autre email (temporairement):**
   - Si possible, demandez à Ryad s'il a un autre email (Gmail, etc.)
   - Créez un compte temporaire avec cet email pour tester
   - Une fois confirmé que ça marche, revenez sur Outlook

### Cas 4: Le lien de réinitialisation expire

**Durée de validité:** Les liens Supabase expirent après **1 heure**

**Solution:**
1. Demandez un nouveau lien (via l'API ou le dashboard)
2. Demandez à Ryad de cliquer **immédiatement** sur le nouveau lien

---

## 🛠️ Utilisation de l'outil admin

J'ai créé un nouvel endpoint API: `/api/admin/reset-user-password`

### Fonctionnalités

Cet endpoint permet de:
1. ✅ Vérifier si un utilisateur existe dans `auth.users`
2. ✅ Vérifier si un chef existe dans la table `chefs`
3. ✅ Créer automatiquement le compte auth si le chef existe mais pas le compte
4. ✅ Envoyer un email de réinitialisation de mot de passe
5. ✅ Afficher des informations de diagnostic complètes

### Comment l'utiliser

#### 1. Démarrez le serveur de développement

```bash
npm run dev
```

#### 2. Appelez l'API avec l'email de l'utilisateur

```bash
curl "http://localhost:3000/api/admin/reset-user-password?email=ryad932@outlook.com"
```

Ou via le navigateur:
```
http://localhost:3000/api/admin/reset-user-password?email=ryad932@outlook.com
```

#### 3. Lisez la réponse

**Si l'utilisateur n'existe pas:**
```json
{
  "exists": false,
  "created": true,
  "userId": "uuid-here",
  "email": "ryad932@outlook.com",
  "message": "User was created. They can now use 'Forgot Password' on the login page.",
  "chefData": { ... }
}
```

**Si l'utilisateur existe:**
```json
{
  "success": true,
  "exists": true,
  "userInfo": {
    "id": "uuid",
    "email": "ryad932@outlook.com",
    "emailConfirmed": true,
    "createdAt": "...",
    "lastSignIn": "..."
  },
  "message": "Password reset email sent to ryad932@outlook.com",
  "instructions": "The user should check their email (including spam folder) for a password reset link."
}
```

---

## 📝 Instructions pour Ryad

Une fois que vous avez envoyé l'email de réinitialisation, envoyez ces instructions à Ryad :

---

### 📧 Instructions de connexion pour Ryad

Bonjour Ryad,

Voici comment vous connecter à MyTable :

#### 1. Vérifiez votre email

Un email de réinitialisation de mot de passe a été envoyé à **ryad932@outlook.com**.

**⚠️ Important - Vérifiez ces dossiers :**
- Boîte de réception principale
- **Courrier indésirable / Spam** (très important !)
- Dossier "Autres" si activé

L'email peut prendre jusqu'à **5-10 minutes** pour arriver.

#### 2. Cliquez sur le lien dans l'email

L'email contient un lien "Reset Password" ou "Réinitialiser le mot de passe".

**⚠️ Important :**
- Cliquez sur le lien **dans l'heure qui suit** (il expire après 1h)
- Si le lien ne fonctionne pas, demandez-en un nouveau

#### 3. Créez votre mot de passe

Après avoir cliqué sur le lien :
1. Vous serez redirigé vers une page de création de mot de passe
2. Entrez un mot de passe sécurisé (**minimum 8 caractères**)
3. Confirmez votre mot de passe
4. Cliquez sur "Enregistrer"

#### 4. Connectez-vous

Une fois le mot de passe créé :
1. Allez sur [https://your-app-url.com/login](http://localhost:3000/login)
2. Entrez votre email: **ryad932@outlook.com**
3. Entrez le mot de passe que vous venez de créer
4. Cliquez sur "Se connecter"

#### ❓ Toujours des problèmes ?

Si vous ne recevez toujours pas l'email ou si le lien ne fonctionne pas :
1. Vérifiez que votre boîte email **Outlook** n'est pas pleine
2. Vérifiez les **paramètres de spam** d'Outlook
3. Essayez avec un autre navigateur (Chrome, Firefox, Edge)
4. Contactez-nous et nous vous aiderons

---

## 🔍 Logs à vérifier

Quand Ryad clique sur le lien, vérifiez les logs du serveur :

```
[auth/callback] ========== CALLBACK CALLED ==========
[auth/callback] Full URL: ...
[auth/callback] Code: ...
```

Si vous voyez une erreur :
```
[auth/callback] ❌ This usually means the magic link expired or was already used
```

Cela signifie que le lien a expiré → Envoyez-en un nouveau.

---

## 🆘 Besoin d'aide supplémentaire ?

Si aucune de ces solutions ne fonctionne :

1. **Vérifiez les URLs de redirection Supabase:**
   - Voir le fichier `SUPABASE_REDIRECT_URLS.md`

2. **Vérifiez les templates d'email Supabase:**
   - Voir le fichier `SUPABASE_EMAIL_TEMPLATES.md`

3. **Vérifiez la configuration complète:**
   - Voir le fichier `SUPABASE_SETUP.md`

4. **Contactez le support Supabase** si le problème persiste avec Outlook

---

## ✅ Checklist de résolution

- [ ] Vérifier que Ryad existe dans la table `chefs`
- [ ] Vérifier que Ryad existe dans `auth.users`
- [ ] Créer le compte auth si nécessaire
- [ ] Envoyer l'email de réinitialisation
- [ ] Confirmer avec Ryad qu'il a reçu l'email
- [ ] Vérifier le dossier spam si nécessaire
- [ ] Confirmer que Ryad a créé son mot de passe
- [ ] Tester la connexion

---

**Date de création:** 6 août 2026  
**Dernière mise à jour:** 6 août 2026
