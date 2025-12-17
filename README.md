# MyTable - Chat + Booking Platform

Plateforme de réservation et chat en temps réel avec les chefs, construite avec Next.js (App Router) et Supabase.

## 🚀 Fonctionnalités

- **Réservation** : Formulaire de réservation personnalisé par chef (`/book/[chefSlug]`)
- **Chat temps réel** : Communication en temps réel via Supabase Realtime (`/chat/[conversationId]`)
- **Authentification sans mot de passe** : Magic links via Supabase Auth
- **Gestion des demandes** : Accept/Refuse avec tokens sécurisés
- **Emails transactionnels** : Notifications automatiques (Resend ou Make)

## 📋 Prérequis

- Node.js 18+ et npm
- Compte Supabase (gratuit)
- Compte Resend (pour les emails) ou Make (webhook)

## 🛠️ Installation locale

### 1. Cloner et installer les dépendances

```bash
npm install
```

### 2. Configuration Supabase

1. Créer un projet sur [Supabase](https://supabase.com)
2. Dans le SQL Editor, exécuter le fichier `supabase/migrations/001_initial_schema.sql`
3. Activer Realtime pour la table `messages` :
   - Aller dans Database > Replication
   - Activer la réplication pour la table `messages`

### 3. Configuration des variables d'environnement

Créer un fichier `.env.local` à la racine :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
EMAIL_PROVIDER=resend

# Email (Make - alternative)
# EMAIL_PROVIDER=make
# MAKE_WEBHOOK_URL=your_make_webhook_url
```

**Important** : La `SUPABASE_SERVICE_ROLE_KEY` est nécessaire pour les opérations serveur (création de bookings, conversations, etc.). Vous la trouvez dans Supabase Dashboard > Settings > API > service_role key (⚠️ gardez-la secrète, ne la commitez jamais !)

### 4. Configuration Supabase Auth

Dans le dashboard Supabase :
1. Aller dans Authentication > URL Configuration
2. Ajouter `http://localhost:3000/auth/callback` dans "Redirect URLs"
3. Configurer les templates d'email si nécessaire

### 5. Lancer le serveur de développement

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 📁 Structure du projet

```
MyTable-app/
├── app/
│   ├── api/
│   │   └── bookings/          # API route pour créer des bookings
│   ├── auth/
│   │   └── callback/          # Handler magic link Supabase
│   ├── book/
│   │   └── [chefSlug]/        # Page de réservation
│   ├── chat/
│   │   └── [conversationId]/  # Page de chat temps réel
│   ├── decision/              # Endpoint accept/refuse
│   ├── booking-confirmation/  # Page de confirmation
│   ├── layout.tsx
│   ├── page.tsx               # Page d'accueil
│   └── globals.css
├── components/
│   ├── ui/                    # Composants UI réutilisables
│   ├── BookingForm.tsx
│   └── ChatInterface.tsx
├── lib/
│   ├── supabase/             # Clients Supabase
│   ├── email.ts              # Abstraction email
│   └── utils.ts              # Utilitaires
├── supabase/
│   └── migrations/           # Migrations SQL
├── types/
│   └── database.ts           # Types TypeScript
└── middleware.ts             # Middleware Supabase
```

## 🗄️ Schéma de base de données

### Tables principales

- **chefs** : Informations des chefs
- **menus** : Menus proposés par chaque chef
- **booking_requests** : Demandes de réservation
- **conversations** : Conversations de chat
- **participants** : Participants aux conversations
- **messages** : Messages du chat (Realtime activé)
- **decision_tokens** : Tokens sécurisés pour accept/refuse

### Row Level Security (RLS)

- Les chefs et menus sont publics (lecture)
- Les conversations et messages sont accessibles uniquement aux participants
- Les tokens de décision ne sont pas accessibles publiquement

## 🔐 Sécurité

- **Tokens de décision** : Hashés avec bcrypt avant stockage
- **RLS** : Politiques strictes sur toutes les tables sensibles
- **Magic links** : Authentification sans mot de passe via Supabase
- **Validation** : Validation côté client et serveur

## 📧 Configuration Email

### Option 1 : Resend (recommandé)

1. Créer un compte sur [Resend](https://resend.com)
2. Obtenir une API key
3. Configurer le domaine d'envoi
4. Ajouter `RESEND_API_KEY` et `RESEND_FROM_EMAIL` dans `.env.local`

### Option 2 : Make (webhook)

1. Créer un webhook dans Make
2. Configurer `EMAIL_PROVIDER=make` et `MAKE_WEBHOOK_URL` dans `.env.local`

## 🚢 Déploiement sur Vercel

### 1. Préparer le projet

```bash
# Build pour vérifier qu'il n'y a pas d'erreurs
npm run build
```

### 2. Déployer sur Vercel

1. Connecter votre repo GitHub à Vercel
2. Dans les paramètres du projet Vercel, ajouter les variables d'environnement :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (votre URL Vercel)
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `EMAIL_PROVIDER`

### 3. Configuration Supabase pour production

1. Dans Supabase Dashboard > Authentication > URL Configuration
2. Ajouter votre URL Vercel dans "Redirect URLs" :
   - `https://your-app.vercel.app/auth/callback`

### 4. Vérifier Realtime

S'assurer que Realtime est activé pour la table `messages` dans Supabase.

## 🧪 Données de test

Pour tester l'application, insérer des données de test dans Supabase :

```sql
-- Insérer un chef
INSERT INTO chefs (slug, name, email, city, postal_code)
VALUES ('chef-example', 'Chef Example', 'chef@example.com', 'Paris', '75001');

-- Insérer un menu pour ce chef
INSERT INTO menus (chef_id, name, description, price)
SELECT id, 'Menu Découverte', 'Un menu pour découvrir notre cuisine', 45.00
FROM chefs WHERE slug = 'chef-example';
```

Puis accéder à : `http://localhost:3000/book/chef-example`

## 🔄 Workflow

1. **Client** remplit le formulaire `/book/[chefSlug]`
2. **Système** crée :
   - `booking_request` (status: pending)
   - `conversation`
   - `participants` (client + chef)
   - `decision_tokens` (accept + refuse)
3. **Email** envoyé au chef avec liens Accept/Refuse
4. **Chef** clique sur Accept ou Refuse
5. **Système** :
   - Met à jour le statut
   - Envoie un email au client
   - Si accepté : envoie les liens de chat
6. **Participants** accèdent au chat via magic link

## 🐛 Dépannage

### Erreur "Invalid API key"
- Vérifier que les variables d'environnement sont correctement définies
- Redémarrer le serveur après modification de `.env.local`

### Chat ne fonctionne pas en temps réel
- Vérifier que Realtime est activé pour la table `messages` dans Supabase
- Vérifier la connexion WebSocket dans la console du navigateur

### Magic link ne fonctionne pas
- Vérifier la configuration des Redirect URLs dans Supabase
- Vérifier que l'email est bien envoyé (spam)

### Erreurs RLS
- Vérifier que les politiques RLS sont bien créées
- Vérifier que l'utilisateur est bien authentifié

## 📝 Notes

- Les tokens de décision expirent après 7 jours
- Les tokens sont à usage unique (marqués comme `used` après utilisation)
- Le chat nécessite une authentification (magic link automatique)

## 🎨 Design

- Couleur principale : `#FBCF03` (jaune)
- Couleurs secondaires : Noir (`#000000`) et Blanc (`#FFFFFF`)
- Design moderne et épuré inspiré de chefmaison.com

## 📄 Licence

Ce projet est privé.

