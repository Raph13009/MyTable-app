# Checklist de Tests Q/A - MyTable

**Date de création :** [À compléter]  
**Version :** [À compléter]  
**Testeur :** [À compléter]  
**Environnement :** Production / Staging

---

## 📋 Table des matières

1. [Tests Fonctionnels - Formulaire de Réservation](#1-tests-fonctionnels---formulaire-de-réservation)
2. [Tests Fonctionnels - Authentification](#2-tests-fonctionnels---authentification)
3. [Tests Fonctionnels - Dashboard](#3-tests-fonctionnels---dashboard)
4. [Tests Fonctionnels - Messagerie](#4-tests-fonctionnels---messagerie)
5. [Tests Fonctionnels - Menu Chef](#5-tests-fonctionnels---menu-chef)
6. [Tests Fonctionnels - Emails](#6-tests-fonctionnels---emails)
7. [Tests Fonctionnels - Workflow de Réservation](#7-tests-fonctionnels---workflow-de-réservation)
8. [Tests UI/UX - Responsive Design](#8-tests-uiux---responsive-design)
9. [Tests de Performance](#9-tests-de-performance)
10. [Tests de Sécurité](#10-tests-de-sécurité)
11. [Tests Cross-Browser](#11-tests-cross-browser)

---

## 1. Tests Fonctionnels - Formulaire de Réservation

### 1.1 Page 1 - Informations Personnelles

- [ ] **TC-001** : Vérifier que le formulaire commence toujours sur la Page 1
- [ ] **TC-002** : Tester la saisie du prénom (validation, caractères spéciaux)
- [ ] **TC-003** : Tester la saisie du nom (validation, caractères spéciaux)
- [ ] **TC-004** : Tester la saisie de l'email (format valide/invalide)
- [ ] **TC-005** : Tester la confirmation d'email (doit correspondre à l'email)
- [ ] **TC-006** : Tester la saisie du téléphone (format, caractères)
- [ ] **TC-007** : Vérifier que tous les champs sont obligatoires
- [ ] **TC-008** : Tester la sélection des 3 types de services :
  - [ ] Repas à domicile
  - [ ] Cours de Cuisine
  - [ ] Événement sur plusieurs jours
- [ ] **TC-009** : Vérifier que le bouton "Continuer" est désactivé si les champs ne sont pas remplis
- [ ] **TC-010** : Vérifier que le scroll automatique fonctionne après clic sur "Continuer"

### 1.2 Page 2 - Repas à Domicile

- [ ] **TC-011** : Vérifier l'affichage du calendrier pour la date
- [ ] **TC-012** : Tester la sélection d'une date (passée, présente, future)
- [ ] **TC-013** : Vérifier que les dates passées ne sont pas sélectionnables
- [ ] **TC-014** : Tester la sélection du nombre de convives (1-20)
- [ ] **TC-015** : Tester la saisie du nombre d'enfants (0-20)
- [ ] **TC-016** : Vérifier que le nombre d'enfants ne peut pas dépasser le nombre de convives
- [ ] **TC-017** : Tester la sélection du moment du repas (Déjeuner/Dîner)
- [ ] **TC-018** : Tester la saisie de la ville
- [ ] **TC-019** : Tester la saisie du code postal (format français)
- [ ] **TC-020** : Tester la sélection du menu (liste déroulante)
- [ ] **TC-021** : Tester la case "Allergies" (cocher/décocher)
- [ ] **TC-022** : Vérifier l'affichage du champ "Détails des allergies" quand la case est cochée
- [ ] **TC-023** : Tester la saisie des notes (textarea)
- [ ] **TC-024** : Vérifier la case "J'accepte les termes et conditions"
- [ ] **TC-025** : Tester l'ouverture de la popup des termes et conditions
- [ ] **TC-026** : Vérifier que le bouton "Envoyer la demande" est désactivé si les termes ne sont pas acceptés
- [ ] **TC-027** : Tester le bouton "Retour" (retour à la Page 1)
- [ ] **TC-028** : Vérifier que les données de la Page 1 sont conservées après retour

### 1.3 Page 2 - Cours de Cuisine

- [ ] **TC-029** : Vérifier l'affichage des champs spécifiques au cours de cuisine
- [ ] **TC-030** : Tester la saisie de la période (date de début et date de fin)
- [ ] **TC-031** : Vérifier que la date de fin est après la date de début
- [ ] **TC-032** : Tester la saisie du budget global (nombre positif)
- [ ] **TC-033** : Tester la saisie du sujet du cours (textarea)
- [ ] **TC-034** : Tester la saisie du nombre de convives
- [ ] **TC-035** : Tester la saisie du nombre d'enfants
- [ ] **TC-036** : Tester la saisie de la ville et code postal
- [ ] **TC-037** : Tester la saisie des notes
- [ ] **TC-038** : Vérifier la validation complète du formulaire

### 1.4 Page 2 - Événement sur Plusieurs Jours

- [ ] **TC-039** : Vérifier l'affichage du calendrier multi-dates
- [ ] **TC-040** : Tester la sélection de plusieurs dates
- [ ] **TC-041** : Vérifier que les dates passées ne sont pas sélectionnables
- [ ] **TC-042** : Tester la sélection des options de repas (PDJ, Déjeuner, Dîner)
- [ ] **TC-043** : Vérifier qu'au moins une option de repas est sélectionnée
- [ ] **TC-044** : Tester la saisie du prix global (nombre positif)
- [ ] **TC-045** : Tester la saisie de la ville et code postal
- [ ] **TC-046** : Tester la saisie des notes
- [ ] **TC-047** : Vérifier la validation complète du formulaire

### 1.5 Soumission du Formulaire

- [ ] **TC-048** : Tester l'envoi du formulaire avec toutes les données valides
- [ ] **TC-049** : Vérifier le message de confirmation après envoi
- [ ] **TC-050** : Vérifier la redirection après envoi
- [ ] **TC-051** : Tester l'envoi avec des données invalides (doit afficher des erreurs)
- [ ] **TC-052** : Vérifier que le formulaire ne peut pas être soumis deux fois

---

## 2. Tests Fonctionnels - Authentification

### 2.1 Magic Link (Chef)

- [ ] **TC-053** : Vérifier que le chef reçoit un magic link après acceptation d'une réservation
- [ ] **TC-054** : Tester le clic sur le magic link dans l'email
- [ ] **TC-055** : Vérifier que le magic link redirige vers `/dashboard` (pas `/login`)
- [ ] **TC-056** : Vérifier que la session est créée automatiquement
- [ ] **TC-057** : Tester l'expiration du magic link (après 1h)
- [ ] **TC-058** : Vérifier que le chef est connecté après le clic sur le magic link

### 2.2 Connexion Client

- [ ] **TC-059** : Tester l'accès à la page de login
- [ ] **TC-060** : Tester la saisie de l'email sur la page de login
- [ ] **TC-061** : Vérifier l'envoi du magic link au client
- [ ] **TC-062** : Tester le clic sur le magic link client
- [ ] **TC-063** : Vérifier la redirection après connexion
- [ ] **TC-064** : Tester la déconnexion

### 2.3 Gestion de Session

- [ ] **TC-065** : Vérifier que la session persiste après rafraîchissement de la page
- [ ] **TC-066** : Tester la déconnexion automatique après expiration
- [ ] **TC-067** : Vérifier l'accès aux pages protégées sans session (redirection vers login)

---

## 3. Tests Fonctionnels - Dashboard

### 3.1 Affichage

- [ ] **TC-068** : Vérifier l'affichage de la liste des conversations
- [ ] **TC-069** : Vérifier que le header est sticky (reste visible au scroll)
- [ ] **TC-070** : Vérifier l'affichage des informations de chaque conversation :
  - [ ] Nom du chef/client
  - [ ] Date de la réservation
  - [ ] Statut (badge coloré)
  - [ ] Nombre de convives
  - [ ] Ville
  - [ ] Prix
- [ ] **TC-071** : Vérifier l'affichage de l'avatar avec la première lettre du prénom du chef
- [ ] **TC-072** : Tester le clic sur une conversation (redirection vers le chat)
- [ ] **TC-073** : Vérifier l'affichage du message "Aucune conversation" si aucune conversation

### 3.2 Filtres et Recherche

- [ ] **TC-074** : Tester les filtres par statut (si présents)
- [ ] **TC-075** : Vérifier le tri des conversations (par date, statut)
- [ ] **TC-076** : Tester la recherche de conversations (si présente)

### 3.3 Responsive

- [ ] **TC-077** : Vérifier l'affichage sur mobile (< 768px)
- [ ] **TC-078** : Vérifier l'affichage sur tablette (768px - 1024px)
- [ ] **TC-079** : Vérifier l'affichage sur desktop (> 1024px)

---

## 4. Tests Fonctionnels - Messagerie

### 4.1 Affichage des Messages

- [ ] **TC-080** : Vérifier l'affichage des messages existants
- [ ] **TC-081** : Vérifier que les messages du client sont alignés à droite
- [ ] **TC-082** : Vérifier que les messages du chef sont alignés à gauche
- [ ] **TC-083** : Vérifier l'affichage des messages système (notifications)
- [ ] **TC-084** : Vérifier le scroll automatique vers le dernier message
- [ ] **TC-085** : Tester l'affichage des messages en temps réel (nouveau message)

### 4.2 Envoi de Messages

- [ ] **TC-086** : Tester l'envoi d'un message texte simple
- [ ] **TC-087** : Tester l'envoi d'un message avec plusieurs lignes (desktop)
- [ ] **TC-088** : Vérifier que le bouton d'envoi est désactivé si le champ est vide
- [ ] **TC-089** : Tester l'envoi avec la touche Entrée (mobile = envoie, desktop = nouvelle ligne)
- [ ] **TC-090** : Tester l'envoi avec Shift+Entrée (desktop = envoie)
- [ ] **TC-091** : Vérifier l'affichage du loader pendant l'envoi
- [ ] **TC-092** : Tester l'envoi de messages très longs
- [ ] **TC-093** : Vérifier la sanitization des messages (emails, téléphones masqués)

### 4.3 Header du Chat

- [ ] **TC-094** : Vérifier l'affichage du nom du chef/client
- [ ] **TC-095** : Vérifier l'affichage du statut de la réservation
- [ ] **TC-096** : Vérifier l'affichage du nombre de convives
- [ ] **TC-097** : Vérifier l'affichage du moment du repas (déjeuner/dîner) si applicable
- [ ] **TC-098** : Tester le bouton "Retour" (retour au dashboard)
- [ ] **TC-099** : Tester le bouton "Voir l'offre" (ouverture du modal)
- [ ] **TC-100** : Tester le bouton "Menu" (chef uniquement, jaune)
- [ ] **TC-101** : Tester le bouton "Voir le menu" (client uniquement, si menu existe)
- [ ] **TC-102** : Tester le bouton "Finaliser" (client uniquement, statut accepted)
- [ ] **TC-103** : Tester le bouton "Annuler" (si applicable)

### 4.4 Modal "Voir l'Offre"

- [ ] **TC-104** : Vérifier l'ouverture du modal
- [ ] **TC-105** : Vérifier l'affichage de toutes les informations de la réservation
- [ ] **TC-106** : Vérifier l'affichage selon le type de service (repas/cours/événement)
- [ ] **TC-107** : Tester la modification du nombre de convives (client uniquement)
- [ ] **TC-108** : Tester la modification du nombre d'enfants (client uniquement)
- [ ] **TC-109** : Vérifier que "Nombre de menus" est en lecture seule (dérivé des convives)
- [ ] **TC-110** : Tester l'ajout d'extras (chef uniquement)
- [ ] **TC-111** : Tester la suppression d'extras (chef uniquement)
- [ ] **TC-112** : Vérifier le calcul du total (prix de base + extras)
- [ ] **TC-113** : Tester le bouton "Valider les modifications"
- [ ] **TC-114** : Vérifier la fermeture du modal
- [ ] **TC-115** : Vérifier l'affichage des notifications après modification

### 4.5 Card Initiale (Premier Message)

- [ ] **TC-116** : Vérifier l'affichage de la card jaune au début d'une conversation
- [ ] **TC-117** : Vérifier le wording : "Retrouvez les détails de votre évènement dans 'Voir l'offre'"
- [ ] **TC-118** : Vérifier le wording : "Pour confirmer définitivement votre réservation, appuyez sur 'Finaliser'"
- [ ] **TC-119** : Vérifier que la card disparaît après le premier message

---

## 5. Tests Fonctionnels - Menu Chef

### 5.1 Création du Menu

- [ ] **TC-120** : Vérifier que le bouton "Menu" est visible uniquement pour le chef
- [ ] **TC-121** : Vérifier que le bouton "Menu" est jaune (contrasté)
- [ ] **TC-122** : Tester l'ouverture du modal de menu
- [ ] **TC-123** : Vérifier l'affichage des 6 catégories :
  - [ ] Apéritifs
  - [ ] Mise en bouche
  - [ ] Entrée
  - [ ] Plat
  - [ ] Dessert
  - [ ] Mignardises
- [ ] **TC-124** : Tester l'ajout d'un item dans une catégorie
- [ ] **TC-125** : Tester l'ajout de plusieurs items dans une même catégorie
- [ ] **TC-126** : Tester la suppression d'un item
- [ ] **TC-127** : Tester l'ajout avec la touche Entrée
- [ ] **TC-128** : Vérifier que les catégories vides ne sont pas sauvegardées
- [ ] **TC-129** : Tester le bouton "Enregistrer le menu"
- [ ] **TC-130** : Vérifier l'affichage du loader pendant la sauvegarde
- [ ] **TC-131** : Vérifier la fermeture du modal après sauvegarde

### 5.2 Affichage du Menu

- [ ] **TC-132** : Vérifier qu'un message système est créé après sauvegarde du menu
- [ ] **TC-133** : Vérifier le formatage du message de menu (catégories et items)
- [ ] **TC-134** : Vérifier que le bouton "Voir le menu" apparaît côté client
- [ ] **TC-135** : Tester le clic sur "Voir le menu" (scroll vers le message)
- [ ] **TC-136** : Vérifier l'affichage du menu dans le modal d'information

### 5.3 Modification du Menu

- [ ] **TC-137** : Tester la modification d'un menu existant
- [ ] **TC-138** : Vérifier que les données existantes sont chargées dans le modal
- [ ] **TC-139** : Vérifier qu'un nouveau message est créé après modification

---

## 6. Tests Fonctionnels - Emails

### 6.1 Email Client - Confirmation de Réservation

- [ ] **TC-140** : Vérifier la réception de l'email après soumission du formulaire
- [ ] **TC-141** : Vérifier le sujet : "Votre demande de réservation a été transmise au Chef avec succès"
- [ ] **TC-142** : Vérifier le contenu : "Un email de confirmation vous a été envoyé"
- [ ] **TC-143** : Vérifier le contenu : "Le Chef va examiner votre demande et vous recevrez une réponse par mail sous 24h"
- [ ] **TC-144** : Vérifier le footer avec contact@guidemytable.fr
- [ ] **TC-145** : Vérifier que tous les liens pointent vers https://guidemytable.fr/
- [ ] **TC-146** : Vérifier qu'aucun CTA n'est bleu (jaune, noir ou blanc uniquement)

### 6.2 Email Chef - Nouvelle Réservation

- [ ] **TC-147** : Vérifier la réception de l'email par le chef
- [ ] **TC-148** : Vérifier l'affichage du nom complet du client
- [ ] **TC-149** : Vérifier l'affichage de tous les détails selon le type de service
- [ ] **TC-150** : Vérifier l'affichage du nombre de convives et d'enfants
- [ ] **TC-151** : Vérifier l'affichage du moment du repas (déjeuner/dîner) si applicable
- [ ] **TC-152** : Vérifier les boutons "Accepter" et "Refuser"
- [ ] **TC-153** : Vérifier qu'aucun CTA n'est bleu

### 6.3 Email Client - Réservation Acceptée

- [ ] **TC-154** : Vérifier la réception de l'email après acceptation
- [ ] **TC-155** : Vérifier l'affichage du nom complet du chef (Prénom Nom)
- [ ] **TC-156** : Vérifier le contenu de l'email
- [ ] **TC-157** : Vérifier les liens et CTAs

### 6.4 Email Client - Réservation Refusée

- [ ] **TC-158** : Vérifier la réception de l'email après refus
- [ ] **TC-159** : Vérifier le sujet : "Votre demande MyTable - disponibilité du chef"
- [ ] **TC-160** : Vérifier le contenu : "n'a malheureusement pas pu être acceptée"
- [ ] **TC-161** : Vérifier le contenu : "autres profils de Chefs talentueux"
- [ ] **TC-162** : Vérifier que le CTA redirige vers https://guidemytable.fr/
- [ ] **TC-163** : Vérifier qu'aucun CTA n'est bleu

### 6.5 Email Chef - Réservation Validée

- [ ] **TC-164** : Vérifier la réception de l'email après validation par le client
- [ ] **TC-165** : Vérifier l'affichage du nombre de convives et d'enfants
- [ ] **TC-166** : Vérifier le contenu de l'email

### 6.6 Email Client - Réservation Annulée

- [ ] **TC-167** : Vérifier la réception de l'email après annulation
- [ ] **TC-168** : Vérifier que le CTA redirige vers https://guidemytable.fr/
- [ ] **TC-169** : Vérifier que le CTA est jaune (variant yellow)

---

## 7. Tests Fonctionnels - Workflow de Réservation

### 7.1 Statut "Pending"

- [ ] **TC-170** : Vérifier l'affichage du statut "En attente" dans le dashboard
- [ ] **TC-171** : Vérifier que le chef peut accepter ou refuser
- [ ] **TC-172** : Vérifier que le client ne peut pas finaliser

### 7.2 Statut "Accepted"

- [ ] **TC-173** : Vérifier l'affichage du statut "Acceptée" dans le dashboard
- [ ] **TC-174** : Vérifier que le client peut finaliser
- [ ] **TC-175** : Vérifier que le chef reçoit un magic link
- [ ] **TC-176** : Vérifier que le chef peut accéder au chat
- [ ] **TC-177** : Vérifier que le chef peut créer un menu
- [ ] **TC-178** : Vérifier que le client peut modifier le nombre de convives

### 7.3 Statut "Refused"

- [ ] **TC-179** : Vérifier l'affichage du statut "Refusée" dans le dashboard
- [ ] **TC-180** : Vérifier que le client reçoit l'email de refus
- [ ] **TC-181** : Vérifier que la conversation est toujours accessible en lecture

### 7.4 Statut "Validated by Client"

- [ ] **TC-182** : Vérifier l'affichage du statut "Validée" dans le dashboard
- [ ] **TC-183** : Vérifier que le client ne peut plus modifier
- [ ] **TC-184** : Vérifier que le chef reçoit l'email de validation
- [ ] **TC-185** : Vérifier l'affichage de l'étape "Paiement en attente"

### 7.5 Statut "Cancelled"

- [ ] **TC-186** : Vérifier l'affichage du statut "Annulée" dans le dashboard
- [ ] **TC-187** : Vérifier que le chat est en lecture seule
- [ ] **TC-188** : Vérifier que le client reçoit l'email d'annulation

### 7.6 Statut "Completed"

- [ ] **TC-189** : Vérifier l'affichage du statut "Terminée" dans le dashboard
- [ ] **TC-190** : Vérifier l'affichage de toutes les étapes complétées

---

## 8. Tests UI/UX - Responsive Design

### 8.1 Mobile (< 768px)

- [ ] **TC-191** : Vérifier l'affichage du formulaire de réservation
- [ ] **TC-192** : Vérifier l'affichage du dashboard
- [ ] **TC-193** : Vérifier l'affichage du chat
- [ ] **TC-194** : Vérifier que les boutons sont optimisés pour le tactile
- [ ] **TC-195** : Vérifier que les modals sont adaptés mobile
- [ ] **TC-196** : Vérifier que le header est sticky
- [ ] **TC-197** : Vérifier que la touche Entrée envoie le message (input)

### 8.2 Tablet (768px - 1024px)

- [ ] **TC-198** : Vérifier l'affichage adaptatif
- [ ] **TC-199** : Vérifier que tous les éléments sont accessibles

### 8.3 Desktop (> 1024px)

- [ ] **TC-200** : Vérifier l'affichage optimal
- [ ] **TC-201** : Vérifier que la touche Entrée crée une nouvelle ligne (textarea)
- [ ] **TC-202** : Vérifier que Shift+Entrée envoie le message
- [ ] **TC-203** : Vérifier l'auto-resize du textarea

---

## 9. Tests de Performance

- [ ] **TC-204** : Vérifier le temps de chargement de la page d'accueil (< 3s)
- [ ] **TC-205** : Vérifier le temps de chargement du dashboard (< 2s)
- [ ] **TC-206** : Vérifier le temps de chargement du chat (< 2s)
- [ ] **TC-207** : Vérifier que les messages s'affichent en temps réel (< 1s de latence)
- [ ] **TC-208** : Vérifier que les images se chargent correctement
- [ ] **TC-209** : Tester avec une connexion lente (3G)

---

## 10. Tests de Sécurité

- [ ] **TC-210** : Vérifier que les données sensibles ne sont pas exposées dans le code source
- [ ] **TC-211** : Vérifier que les emails et téléphones sont masqués dans les messages
- [ ] **TC-212** : Vérifier que seuls les participants peuvent voir leur conversation
- [ ] **TC-213** : Vérifier que le chef ne peut modifier que ses propres réservations
- [ ] **TC-214** : Vérifier que le client ne peut modifier que ses propres réservations
- [ ] **TC-215** : Tester l'injection SQL (si applicable)
- [ ] **TC-216** : Tester l'injection XSS dans les messages
- [ ] **TC-217** : Vérifier que les magic links expirent après 1h
- [ ] **TC-218** : Vérifier que les sessions expirent correctement

---

## 11. Tests Cross-Browser

### 11.1 Chrome

- [ ] **TC-219** : Tester toutes les fonctionnalités principales
- [ ] **TC-220** : Vérifier l'affichage visuel

### 11.2 Safari

- [ ] **TC-221** : Tester toutes les fonctionnalités principales
- [ ] **TC-222** : Vérifier l'affichage visuel
- [ ] **TC-223** : Vérifier le comportement sur iOS

### 11.3 Firefox

- [ ] **TC-224** : Tester toutes les fonctionnalités principales
- [ ] **TC-225** : Vérifier l'affichage visuel

### 11.4 Edge

- [ ] **TC-226** : Tester toutes les fonctionnalités principales
- [ ] **TC-227** : Vérifier l'affichage visuel

---

## 📝 Notes de Test

**Bugs trouvés :**

| ID Bug | Description | Priorité | Statut | Date |
|--------|-------------|----------|--------|------|
|        |             |          |        |      |

**Améliorations suggérées :**

| ID | Description | Priorité | Statut | Date |
|----|-------------|----------|--------|------|
|    |             |          |        |      |

---

## ✅ Résumé des Tests

**Total de tests :** 227  
**Tests passés :** [À compléter]  
**Tests échoués :** [À compléter]  
**Tests bloqués :** [À compléter]  
**Taux de réussite :** [À compléter]%

**Date de fin des tests :** [À compléter]  
**Approuvé par :** [À compléter]  
**Signature :** [À compléter]

---

## 🔍 Points d'Attention Spéciaux

1. **Magic Links** : Vérifier que les URLs de redirection sont correctement configurées dans Supabase
2. **Emails** : Vérifier que tous les emails sont reçus et que les liens fonctionnent
3. **Responsive** : Tester sur de vrais appareils, pas seulement avec les DevTools
4. **Performance** : Surveiller les temps de chargement, surtout sur mobile
5. **Sécurité** : Vérifier que les données sensibles sont bien protégées

---

**Document créé le :** [Date]  
**Dernière mise à jour :** [Date]  
**Version du document :** 1.0
