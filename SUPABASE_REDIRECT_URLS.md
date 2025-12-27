# Configuration des Redirect URLs dans Supabase

## ⚠️ PROBLÈME ACTUEL

Supabase redirige vers `/login#access_token=...` au lieu de `/auth/callback?code=...` parce que l'URL `/login` n'est pas dans la liste des Redirect URLs autorisées.

## ✅ SOLUTION

Ajoutez **TOUTES** ces URLs dans **Supabase Dashboard** > **Authentication** > **URL Configuration** > **Redirect URLs** :

### URLs à ajouter pour la production :

```
https://app.guidemytable.fr/auth/callback
https://app.guidemytable.fr/login
https://app.guidemytable.fr/
```

### URLs à ajouter pour le développement local :

```
http://localhost:3000/auth/callback
http://localhost:3000/login
http://localhost:3000/
```

## 📝 Instructions étape par étape

1. Allez dans votre **Supabase Dashboard**
2. Cliquez sur **Authentication** dans le menu de gauche
3. Cliquez sur **URL Configuration**
4. Dans la section **Redirect URLs**, ajoutez chaque URL sur une ligne séparée :
   - `https://app.guidemytable.fr/auth/callback`
   - `https://app.guidemytable.fr/login`
   - `https://app.guidemytable.fr/`
5. Cliquez sur **Save**

## 🔍 Pourquoi ces URLs ?

- **`/auth/callback`** : URL de callback standard pour le flux PKCE (avec `?code=...`)
- **`/login`** : URL de fallback où Supabase peut rediriger avec des tokens dans le hash (`#access_token=...`)
- **`/`** : URL racine comme fallback ultime

## ✅ Après avoir ajouté les URLs

1. Testez en envoyant un nouveau magic link
2. Le magic link devrait maintenant fonctionner correctement
3. Si Supabase redirige vers `/login#access_token=...`, le code dans `/login` détectera automatiquement les tokens et connectera l'utilisateur

## 🐛 Si ça ne fonctionne toujours pas

1. Vérifiez que les URLs sont **exactement** comme indiqué (pas d'espaces, pas de trailing slash sauf pour `/`)
2. Vérifiez que vous avez bien cliqué sur **Save**
3. Attendez quelques secondes pour que les changements soient propagés
4. Testez avec un **nouveau** magic link (les anciens liens peuvent être invalides)
