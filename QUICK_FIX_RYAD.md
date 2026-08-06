# 🆘 Guide Rapide - Ryad ne peut pas se connecter

## Solution la plus rapide

### Option 1: Interface Admin (Recommandé)

1. Démarrez le serveur:
   ```bash
   npm run dev
   ```

2. Ouvrez dans votre navigateur:
   ```
   http://localhost:3000/admin/user-management
   ```

3. Entrez l'email: `ryad932@outlook.com`

4. Cliquez sur "Vérifier et réinitialiser"

5. L'outil va:
   - ✅ Vérifier si le compte existe
   - ✅ Créer le compte si nécessaire
   - ✅ Envoyer un email de réinitialisation

### Option 2: Via l'API (Alternative)

```bash
# Démarrez le serveur
npm run dev

# Dans un autre terminal
curl "http://localhost:3000/api/admin/reset-user-password?email=ryad932@outlook.com"
```

### Option 3: Via Supabase Dashboard (Sans code)

1. Allez sur https://app.supabase.com
2. Sélectionnez votre projet
3. **Authentication** > **Users**
4. Recherchez `ryad932@outlook.com`
5. Si l'utilisateur existe:
   - Cliquez sur les 3 points (...) > **Send Password Reset Email**
6. Si l'utilisateur n'existe PAS:
   - Cliquez sur **Add user** > **Create new user**
   - Email: `ryad932@outlook.com`
   - Cochez "Auto Confirm User"
   - Cliquez "Create user"
   - Puis envoyez l'email de réinitialisation (étape 5)

---

## Instructions pour Ryad

Une fois l'email envoyé, dites à Ryad:

> **Bonjour Ryad,**
> 
> J'ai envoyé un email de réinitialisation de mot de passe à **ryad932@outlook.com**.
> 
> **⚠️ IMPORTANT - Vérifiez ces endroits:**
> - Votre boîte de réception Outlook
> - **Votre dossier Spam / Courrier indésirable** (très important!)
> - L'email peut prendre jusqu'à 5-10 minutes
>
> **Une fois reçu:**
> 1. Cliquez sur le lien dans l'email (valide 1 heure)
> 2. Créez un mot de passe (minimum 8 caractères)
> 3. Connectez-vous sur https://your-app-url.com/login
>
> **Toujours pas d'email?** Contactez-moi et je vous en renvoie un.

---

## ❓ FAQ rapide

**Q: Pourquoi Ryad ne peut pas "créer" un mot de passe?**  
R: Sur MyTable, les mots de passe sont créés via un email de réinitialisation, pas directement sur le site.

**Q: Pourquoi l'email n'arrive pas?**  
R: Outlook filtre parfois ces emails. Il doit vérifier le spam.

**Q: Le lien ne marche pas**  
R: Les liens expirent après 1 heure. Envoyez-en un nouveau.

**Q: Ryad existe déjà comme chef?**  
R: L'outil vérifie automatiquement et crée le compte auth s'il n'existe pas.

---

## 📚 Documentation complète

Pour plus de détails, voir:
- `TROUBLESHOOT_USER_LOGIN.md` - Guide complet de dépannage
- `SUPABASE_SETUP.md` - Configuration Supabase
- `DEBUG_MAGIC_LINK.md` - Debugging des liens d'authentification

---

**Créé le:** 6 août 2026
