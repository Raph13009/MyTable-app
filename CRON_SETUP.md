# Configuration du Cron Job pour les Alertes d'Inactivité

## Endpoint API

L'endpoint `/api/check-inactive-bookings` vérifie automatiquement les demandes de réservation en attente **créées hier (J+1, Europe/Paris)** et envoie un email d'alerte à `contact@guidemytable.fr` (et une relance au chef si l'email est disponible). Aucune relance n'est envoyée au-delà de J+1.

## Configuration Vercel Cron

Pour activer la vérification automatique, ajoutez ceci dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/check-inactive-bookings",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Cela exécutera la vérification toutes les 6 heures.

**Alternative :** Pour une vérification plus fréquente (toutes les heures) :
```json
{
  "crons": [
    {
      "path": "/api/check-inactive-bookings",
      "schedule": "0 * * * *"
    }
  ]
}
```

## Test Manuel

Vous pouvez tester l'endpoint manuellement en visitant :
```
https://votre-domaine.com/api/check-inactive-bookings
```

Ou via curl :
```bash
curl https://votre-domaine.com/api/check-inactive-bookings
```

## Format de l'Email d'Alerte

L'email envoyé à `contact@guidemytable.fr` contient :
- **Sujet** : "Inactivité d'un chef - [Nom du chef] n'a pas répondu à [Nom du client]"
- **Contenu** :
  - Détails de la demande (ID, date de création, temps écoulé)
  - Coordonnées complètes du client (nom, email, téléphone)
  - Coordonnées complètes du chef (nom, email, téléphone)

## Notes

- L'endpoint vérifie uniquement les `booking_requests` avec `status = 'pending'`
- Seules les demandes créées **hier** (J+1, fuseau Europe/Paris) sont prises en compte
- Un email est envoyé une seule fois (à J+1) pour chaque demande inactive — pas de relance les jours suivants
- Les emails sont envoyés en parallèle pour optimiser les performances
