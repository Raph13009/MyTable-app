# WordPress + Elementor : Preconnect pour accélérer l'embed explore2

Ce guide explique comment ajouter les balises `preconnect` sur ta page WordPress (guidemytable.fr) pour accélérer le chargement de la section embed (carte explore2).

---

## Pourquoi faire ça ?

Quand un visiteur charge ta page WordPress, le navigateur doit établir des connexions vers :
- **app.guidemytable.fr** (ton iframe embed)
- **api.mapbox.com** (la carte Mapbox utilisée dans l'embed)

Sans preconnect, ces connexions ne démarrent qu'au moment où l'iframe charge. Avec preconnect, le navigateur prépare ces connexions **dès le chargement de la page**, ce qui réduit la latence quand l'embed se charge.

---

## Méthode 1 : Via Elementor (recommandé)

### Étape 1 : Accéder aux paramètres du thème / Custom HTML

1. Connecte-toi à l’admin WordPress
2. Va dans **Apparence → Éditeur de thème** (ou utilise un plugin comme "Insert Headers and Footers" si tu préfères)

**OU** si tu utilises Elementor Pro :

1. Va dans **Elementor → Paramètres → Custom CSS**
2. Ou utilise le widget **HTML** d’Elementor pour insérer du code dans le `<head>`

### Étape 2 : Ajouter le code dans le `<head>`

Tu dois insérer ce code **dans le `<head>`** de la page qui contient l’embed (ou sur tout le site si l’embed est sur plusieurs pages).

**Code à ajouter :**

```html
<!-- Preconnect pour l'embed MyTable explore2 -->
<link rel="preconnect" href="https://app.guidemytable.fr" crossorigin>
<link rel="preconnect" href="https://api.mapbox.com" crossorigin>
<link rel="dns-prefetch" href="https://api.mapbox.com">
```

---

## Méthode 2 : Plugin "Insert Headers and Footers"

Si tu n’as pas accès au thème ou que c’est plus simple :

1. Installe le plugin **Insert Headers and Footers** (WPCode propose une version similaire)
2. Va dans **Réglages → Insert Headers and Footers**
3. Dans la zone **Scripts in Header**, colle le code ci-dessus
4. Enregistre

---

## Méthode 3 : Via le fichier `header.php` du thème

1. Va dans **Apparence → Éditeur de thème**
2. Ouvre **header.php**
3. Trouve la balise `</head>` (juste avant la fermeture du head)
4. **Juste avant** `</head>`, ajoute :

```html
<!-- Preconnect pour l'embed MyTable explore2 -->
<link rel="preconnect" href="https://app.guidemytable.fr" crossorigin>
<link rel="preconnect" href="https://api.mapbox.com" crossorigin>
<link rel="dns-prefetch" href="https://api.mapbox.com">
```

5. Enregistre le fichier

---

## Méthode 4 : Elementor – Page spécifique

Si l’embed est sur **une seule page** et que tu utilises Elementor :

1. Ouvre la page en édition Elementor
2. Clique sur l’icône **Paramètres** (engrenage) en bas à gauche
3. Va dans l’onglet **Avancé** (Advanced)
4. Dans **Custom CSS** ou **Head Scripts** (si disponible), tu ne peux pas toujours ajouter du HTML ici

→ Dans ce cas, utilise plutôt la **Méthode 2** (plugin) pour que le preconnect soit sur toutes les pages, ou la **Méthode 3** si tu as accès au thème.

---

## Vérification

1. Charge ta page avec l’embed
2. Ouvre les **DevTools** (F12) → onglet **Network**
3. Recharge la page
4. Regarde les requêtes vers `app.guidemytable.fr` et `api.mapbox.com`
5. Les connexions devraient démarrer plus tôt (dès le chargement initial de la page)

---

## Résumé des URLs à preconnect

| URL | Rôle |
|-----|------|
| `https://app.guidemytable.fr` | Ton app (iframe embed) |
| `https://api.mapbox.com` | API Mapbox (carte) |

---

## Note sur `crossorigin`

L’attribut `crossorigin` est important pour les preconnect vers des domaines qui servent des ressources (scripts, fonts, etc.). Il indique au navigateur que la requête peut être cross-origin. Pour app.guidemytable.fr et api.mapbox.com, c’est pertinent.
