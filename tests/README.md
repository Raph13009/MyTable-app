# Tests E2E avec Playwright

## Installation

Les dépendances sont déjà installées. Si besoin :

```bash
npm install
npx playwright install chromium
```

## Configuration

Les tests utilisent la configuration dans `playwright.config.ts`. Le serveur de développement Next.js sera lancé automatiquement avant les tests.

## Exécution des tests

### Tous les tests
```bash
npm run test:e2e
```

### Interface graphique (recommandé pour le développement)
```bash
npm run test:e2e:ui
```

### Mode visible (avec navigateur visible)
```bash
npm run test:e2e:headed
```

## Test : Envoi de message avec optimistic UI

Le test `chat-send-message.spec.ts` vérifie que :
1. Un message envoyé apparaît **immédiatement** dans le chat (optimistic UI)
2. Le message reste visible après revalidation
3. Il n'y a pas de doublons
4. Les messages sont correctement triés par `created_at`

### Prérequis pour le test

Le test nécessite une conversation existante avec un chef authentifié. Vous pouvez :

1. **Utiliser une conversation existante** :
   ```bash
   CONVERSATION_ID=your-conversation-id CHEF_EMAIL=chef@example.com npm run test:e2e
   ```

2. **Créer une conversation de test** :
   - Créer un booking via `/book/[chefSlug]`
   - Noter le `conversationId` retourné
   - Utiliser cet ID dans le test

### Variables d'environnement

- `CONVERSATION_ID` : ID de la conversation à utiliser (optionnel, défaut: 'test-conversation-id')
- `CHEF_EMAIL` : Email du chef pour se connecter (optionnel, défaut: 'chef@example.com')

## Résultats attendus

Le test doit passer et confirmer :
- ✅ Message apparu immédiatement (optimistic UI)
- ✅ Message toujours visible après revalidation
- ✅ Pas de doublons détectés
- ✅ Message correctement trié (en dernier)
