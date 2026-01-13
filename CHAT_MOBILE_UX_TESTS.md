# Tests UX Chat Mobile - Documentation

**Date de création :** 2024  
**Version :** 1.0  
**Objectif :** Vérifier les améliorations UX du chat mobile (scroll indépendant, multiline, keyboard safe-area)

---

## 📋 Table des matières

1. [Test du scroll pendant la saisie](#1-test-du-scroll-pendant-la-saisie)
2. [Test du multiline et auto-resize](#2-test-du-multiline-et-auto-resize)
3. [Test de l'envoi de messages](#3-test-de-lenvoi-de-messages)
4. [Test de la safe-area (keyboard)](#4-test-de-la-safe-area-keyboard)
5. [Tests cross-device et cross-browser](#5-tests-cross-device-et-cross-browser)

---

## 1. Test du scroll pendant la saisie

### Objectif
Vérifier que l'utilisateur peut scroller l'historique des messages pendant qu'il écrit, même avec le clavier ouvert.

### Étapes de test

1. **Préparation**
   - Ouvrir l'application sur un appareil mobile (iPhone ou Android)
   - Naviguer vers une conversation avec plusieurs messages (au moins 10-15 messages pour avoir du scroll)
   - S'assurer que la conversation est ouverte et les messages sont visibles

2. **Test du scroll avec clavier fermé**
   - [ ] Vérifier que le scroll fonctionne normalement quand le clavier est fermé
   - [ ] Vérifier que le scroll est fluide (pas de saccades)
   - [ ] Vérifier que le scroll peut atteindre le haut et le bas de la conversation

3. **Test du scroll avec clavier ouvert**
   - [ ] Taper dans le champ de saisie pour ouvrir le clavier
   - [ ] Vérifier que le clavier s'ouvre correctement
   - [ ] **CRITIQUE** : Vérifier qu'on peut toujours scroller l'historique des messages même avec le clavier ouvert
   - [ ] Vérifier que le scroll reste fluide avec le clavier ouvert
   - [ ] Vérifier qu'on peut scroller vers le haut pour voir les anciens messages
   - [ ] Vérifier qu'on peut scroller vers le bas pour voir les nouveaux messages

4. **Test du scroll lock (à éviter)**
   - [ ] Vérifier qu'il n'y a PAS de "scroll lock" (le scroll ne se bloque pas)
   - [ ] Vérifier que le scroll fonctionne même pendant la saisie
   - [ ] Vérifier que le conteneur de messages reste scrollable indépendamment du champ de saisie

### Résultat attendu
✅ Le scroll doit fonctionner à tout moment, même avec le clavier ouvert et pendant la saisie.

### Résultat observé
- [ ] ✅ Pass
- [ ] ❌ Fail (décrire le problème)

---

## 2. Test du multiline et auto-resize

### Objectif
Vérifier que le champ de saisie mobile supporte le multiline et s'ajuste automatiquement.

### Étapes de test

1. **Test de base du textarea**
   - [ ] Vérifier que le champ de saisie est un textarea (pas un input monoline)
   - [ ] Vérifier que le champ a une hauteur minimale appropriée (44px minimum pour les zones tactiles)

2. **Test de l'auto-resize**
   - [ ] Taper un message court (1 ligne)
   - [ ] Vérifier que le champ conserve sa hauteur minimale
   - [ ] Taper un message plus long qui dépasse une ligne
   - [ ] **CRITIQUE** : Vérifier que le champ grandit automatiquement pour accommoder le contenu
   - [ ] Taper un message très long (plusieurs lignes)
   - [ ] Vérifier que le champ grandit jusqu'à une hauteur maximale (120px)
   - [ ] Vérifier que lorsque la hauteur maximale est atteinte, le champ devient scrollable verticalement

3. **Test du multiline**
   - [ ] Taper du texte et appuyer sur "Entrée" (Return)
   - [ ] **CRITIQUE** : Vérifier que "Entrée" crée une nouvelle ligne (ne provoque PAS d'envoi)
   - [ ] Vérifier qu'on peut créer plusieurs lignes
   - [ ] Vérifier que le texte multiline est bien formaté et visible

4. **Test visuel**
   - [ ] Vérifier que le style du textarea correspond au design (même apparence que l'input précédent)
   - [ ] Vérifier que le champ a les mêmes bordures arrondies
   - [ ] Vérifier que le placeholder est visible
   - [ ] Vérifier que le focus state fonctionne correctement

### Résultat attendu
✅ Le champ de saisie doit être un textarea avec auto-resize jusqu'à 120px max, et "Entrée" doit créer une nouvelle ligne.

### Résultat observé
- [ ] ✅ Pass
- [ ] ❌ Fail (décrire le problème)

---

## 3. Test de l'envoi de messages

### Objectif
Vérifier que l'envoi fonctionne correctement avec le nouveau comportement (envoi uniquement via bouton).

### Étapes de test

1. **Test d'envoi avec le bouton**
   - [ ] Taper un message court (1 ligne)
   - [ ] Cliquer sur le bouton d'envoi (icône flèche)
   - [ ] **CRITIQUE** : Vérifier que le message est envoyé correctement
   - [ ] Vérifier que le message apparaît dans la conversation
   - [ ] Vérifier que le champ de saisie est vidé après l'envoi
   - [ ] Vérifier que le champ reprend sa hauteur minimale

2. **Test d'envoi avec message multiline**
   - [ ] Taper un message avec plusieurs lignes (utiliser "Entrée" pour créer des lignes)
   - [ ] Cliquer sur le bouton d'envoi
   - [ ] **CRITIQUE** : Vérifier que le message multiline est envoyé correctement
   - [ ] Vérifier que le formatage multiline est préservé dans le message envoyé
   - [ ] Vérifier que le message s'affiche correctement dans la conversation

3. **Test que "Entrée" n'envoie PAS (mobile)**
   - [ ] Taper un message dans le champ de saisie
   - [ ] Appuyer sur "Entrée" (Return) dans le champ
   - [ ] **CRITIQUE** : Vérifier que le message n'est PAS envoyé
   - [ ] Vérifier qu'une nouvelle ligne est créée à la place
   - [ ] Vérifier que le message reste dans le champ de saisie

4. **Test du bouton désactivé**
   - [ ] Vérifier que le bouton d'envoi est désactivé quand le champ est vide
   - [ ] Vérifier que le bouton est désactivé pendant l'envoi (état de chargement)
   - [ ] Vérifier que le bouton redevient actif après l'envoi

5. **Test avec message très long**
   - [ ] Taper un message très long (plus de 10 lignes)
   - [ ] Vérifier que le champ atteint sa hauteur maximale et devient scrollable
   - [ ] Cliquer sur le bouton d'envoi
   - [ ] Vérifier que le message complet est envoyé

### Résultat attendu
✅ L'envoi doit se faire uniquement via le bouton. "Entrée" doit créer une nouvelle ligne, pas envoyer.

### Résultat observé
- [ ] ✅ Pass
- [ ] ❌ Fail (décrire le problème)

---

## 4. Test de la safe-area (keyboard)

### Objectif
Vérifier que l'input n'est pas masqué par les barres de navigation système (notch, barre de navigation iOS/Android).

### Étapes de test

1. **Test sur iPhone avec notch (si disponible)**
   - [ ] Ouvrir le chat sur un iPhone avec notch (iPhone X et plus récent)
   - [ ] Ouvrir le clavier en tapant dans le champ de saisie
   - [ ] **CRITIQUE** : Vérifier que le champ de saisie n'est pas masqué par la barre de navigation iOS
   - [ ] Vérifier qu'il y a un espacement approprié en bas (safe-area-inset-bottom)
   - [ ] Vérifier que le bouton d'envoi est accessible

2. **Test sur Android**
   - [ ] Ouvrir le chat sur un appareil Android
   - [ ] Ouvrir le clavier
   - [ ] Vérifier que le champ de saisie est accessible
   - [ ] Vérifier que le bouton d'envoi est accessible
   - [ ] Vérifier qu'il n'y a pas de chevauchement avec les contrôles système

3. **Test de l'affichage avec clavier**
   - [ ] Ouvrir le clavier
   - [ ] Vérifier que le conteneur d'input reste visible
   - [ ] Vérifier que le champ de saisie reste accessible
   - [ ] Vérifier que le bouton d'envoi reste accessible
   - [ ] Vérifier que le scroll des messages fonctionne toujours

### Résultat attendu
✅ Le champ de saisie et le bouton doivent rester accessibles même avec le clavier ouvert, avec un espacement approprié pour les safe-areas.

### Résultat observé
- [ ] ✅ Pass
- [ ] ❌ Fail (décrire le problème)

---

## 5. Tests cross-device et cross-browser

### Objectif
Vérifier que les améliorations fonctionnent sur différents appareils et navigateurs.

### Étapes de test

1. **Tests sur différents appareils iOS**
   - [ ] iPhone (écran petit, < 768px)
   - [ ] iPhone Plus/Max (écran plus grand)
   - [ ] iPad (si applicable, > 768px - doit utiliser le comportement desktop)

2. **Tests sur différents appareils Android**
   - [ ] Smartphone Android (écran petit)
   - [ ] Smartphone Android (écran grand)
   - [ ] Tablette Android (si applicable, > 768px - doit utiliser le comportement desktop)

3. **Tests sur différents navigateurs iOS**
   - [ ] Safari iOS
   - [ ] Chrome iOS

4. **Tests sur différents navigateurs Android**
   - [ ] Chrome Android
   - [ ] Firefox Android (si disponible)
   - [ ] Samsung Internet (si disponible)

5. **Test du comportement desktop (contrôle)**
   - [ ] Ouvrir le chat sur un navigateur desktop (largeur > 768px)
   - [ ] Vérifier que le comportement desktop est conservé (textarea avec Shift+Enter pour envoyer)
   - [ ] Vérifier que l'auto-resize fonctionne sur desktop
   - [ ] Vérifier que le scroll fonctionne normalement

### Résultat attendu
✅ Tous les comportements doivent fonctionner correctement sur tous les appareils et navigateurs testés.

### Résultat observé
- [ ] ✅ Pass (tous les navigateurs/appareils)
- [ ] ⚠️ Partiel (décrire les problèmes spécifiques)
- [ ] ❌ Fail (décrire le problème)

---

## 📝 Notes générales

### Bugs connus
- (À compléter lors des tests)

### Améliorations suggérées
- (À compléter lors des tests)

### Version testée
- Date : ___________
- Version de l'application : ___________
- Navigateurs testés : ___________
- Appareils testés : ___________

---

## 🎯 Checklist rapide

### Tests critiques (doivent tous passer)
- [ ] Scroll fonctionne avec clavier ouvert
- [ ] Textarea avec auto-resize fonctionne
- [ ] "Entrée" crée une nouvelle ligne (n'envoie pas)
- [ ] Bouton d'envoi fonctionne
- [ ] Safe-area fonctionne sur iPhone avec notch

### Tests secondaires
- [ ] Scroll fluide
- [ ] Message multiline envoyé correctement
- [ ] Bouton désactivé quand vide
- [ ] Tests cross-browser
- [ ] Tests cross-device

---

## 🔍 Tests UI automatisés (optionnel)

Si des tests automatisés sont ajoutés (ex: Playwright), ils devraient vérifier :

1. **Présence du textarea sur mobile**
   - Détecter que l'input mobile est un textarea (pas un input)

2. **Comportement du scroll**
   - Vérifier que le scroll fonctionne avec le clavier simulé

3. **Comportement d'envoi**
   - Vérifier que le submit via formulaire fonctionne
   - Vérifier que Enter dans le textarea ne déclenche pas l'envoi

4. **Auto-resize**
   - Vérifier que le textarea grandit avec le contenu
   - Vérifier la hauteur maximale

---

**Document créé pour les améliorations UX du chat mobile - Version 1.0**
