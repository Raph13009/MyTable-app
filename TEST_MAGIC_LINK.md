# Guide de test pour le Magic Link

## ⚠️ Important

1. **Utilisez un VRAI email** - `votre-email@example.com` ne fonctionnera pas
2. **Vérifiez votre boîte spam** - Les emails peuvent arriver avec un délai
3. **Vérifiez la configuration Supabase** - Les emails doivent être activés

## Test 1: Route de test

```bash
# Remplacez par VOTRE email réel
http://localhost:3000/api/test-magic-link?email=VOTRE-EMAIL@example.com
```

**Résultat attendu :**
- ✅ `success: true` dans la réponse JSON
- ✅ Email reçu dans votre boîte mail (peut prendre 1-2 minutes)
- ✅ Lien de connexion dans l'email

## Test 2: Accepter une mission

1. Créez une nouvelle réservation
2. Cliquez sur "Accepter" dans l'email reçu
3. **Vérifiez les logs dans le terminal** :
   - `[decision] ⚠️ NOT sending bookingAcceptedToChef email to chef`
   - `[decision] ========== SENDING MAGIC LINK TO CHEF ==========`
   - `[decision] ✅✅✅ Magic link sent successfully to chef via Supabase ✅✅✅`

4. **Vérifiez votre boîte mail** :
   - ❌ Vous ne devriez PAS recevoir l'email "Réservation acceptée"
   - ✅ Vous devriez recevoir UNIQUEMENT le magic link de Supabase

## Vérification Supabase

Dans **Supabase Dashboard** > **Authentication** > **Settings** :

1. ✅ **Enable email signup** : Activé
2. ✅ **Enable email confirmations** : Activé (ou désactivé selon vos besoins)
3. ✅ **Site URL** : `http://localhost:3000` (pour dev) ou votre URL de production
4. ✅ **Redirect URLs** : Contient `http://localhost:3000/auth/callback`

## Si vous ne recevez pas d'email

1. **Vérifiez les logs** : Regardez le terminal pour voir les erreurs
2. **Vérifiez la configuration Supabase** : Les emails doivent être activés
3. **Testez avec un autre email** : Peut-être que l'email a un problème
4. **Vérifiez le spam** : Les emails peuvent arriver en spam
5. **Attendez 1-2 minutes** : Les emails peuvent avoir un délai

## Logs à vérifier

Quand vous acceptez une mission, vous devriez voir dans le terminal :

```
[decision] ========== ACCEPT ACTION ==========
[decision] ⚠️ NOT sending bookingAcceptedToChef email to chef
[decision] ========== SENDING MAGIC LINK TO CHEF ==========
[decision] Calling supabase.auth.signInWithOtp...
[decision] ✅✅✅ Magic link sent successfully to chef via Supabase ✅✅✅
```

Si vous voyez une erreur, copiez les logs complets.
