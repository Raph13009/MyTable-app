# Tests de Validation du Menu - Documentation

**Date de création :** 2024  
**Version :** 1.0  
**Objectif :** Vérifier la validation et le comportement du bouton "Enregistrer le menu"

---

## 📋 Table des matières

1. [Test du bouton "Enregistrer le menu" désactivé](#1-test-du-bouton-enregistrer-le-menu-désactivé)
2. [Test de la validation inline](#2-test-de-la-validation-inline)
3. [Test du comportement après ajout](#3-test-du-comportement-après-ajout)
4. [Test de l'enregistrement du menu](#4-test-de-lenregistrement-du-menu)

---

## 1. Test du bouton "Enregistrer le menu" désactivé

### Objectif
Vérifier que le bouton "Enregistrer le menu" est désactivé quand aucune liste de plats n'a été persistée (ajoutée).

### Étapes de test

1. **Préparation**
   - Se connecter en tant que chef
   - Ouvrir une conversation avec une réservation
   - Cliquer sur le bouton "Menu" dans le header du chat

2. **Test avec menu vide**
   - [ ] Vérifier que le modal du menu s'ouvre
   - [ ] Vérifier que toutes les catégories (Apéritifs, Mise en bouche, Entrée, Plat, Dessert, Mignardises) sont vides
   - [ ] **CRITIQUE** : Vérifier que le bouton "Enregistrer le menu" est désactivé (grisé, non cliquable)
   - [ ] Vérifier que le curseur montre "not-allowed" au survol du bouton désactivé

3. **Test après avoir tapé mais pas ajouté**
   - [ ] Taper un nom de plat dans une catégorie (ex: "Salade de saison" dans Entrée)
   - [ ] **CRITIQUE** : Vérifier que le bouton "Enregistrer le menu" reste désactivé
   - [ ] Ne PAS cliquer sur "Ajouter"
   - [ ] Vérifier que le plat n'apparaît pas dans la liste des plats ajoutés

### Résultat attendu
✅ Le bouton "Enregistrer le menu" doit être désactivé tant qu'aucun plat n'a été ajouté à une catégorie.

### Résultat observé
- [ ] ✅ Pass
- [ ] ❌ Fail (décrire le problème)

---

## 2. Test de la validation inline

### Objectif
Vérifier qu'un message de validation s'affiche sous chaque input qui contient du texte mais dont le plat n'a pas été ajouté.

### Étapes de test

1. **Test de validation sur un input**
   - [ ] Ouvrir le modal du menu
   - [ ] Taper un nom de plat dans une catégorie (ex: "Soupe à l'oignon" dans Entrée)
   - [ ] **CRITIQUE** : Vérifier qu'un message de validation s'affiche sous l'input
   - [ ] Vérifier que le message affiche : "Vous devez cliquer sur 'Ajouter' pour enregistrer ce plat"
   - [ ] Vérifier que le message est en couleur ambre/jaune (amber-600)
   - [ ] Vérifier qu'une icône d'avertissement est présente à côté du texte

2. **Test de validation sur plusieurs inputs**
   - [ ] Taper un plat dans la catégorie "Apéritifs" (ex: "Champagnes")
   - [ ] Taper un plat dans la catégorie "Plat" (ex: "Bœuf bourguignon")
   - [ ] Ne PAS cliquer sur "Ajouter" pour ces deux plats
   - [ ] **CRITIQUE** : Vérifier que les deux inputs affichent le message de validation
   - [ ] Vérifier que chaque message de validation est indépendant (sous son propre input)

3. **Test de l'apparence de l'input avec validation**
   - [ ] Taper du texte dans un input
   - [ ] **CRITIQUE** : Vérifier que la bordure de l'input change de couleur (devient ambre/jaune)
   - [ ] Vérifier que le focus state reflète aussi cette couleur

4. **Test de disparition de la validation**
   - [ ] Taper du texte dans un input
   - [ ] Vérifier que le message de validation s'affiche
   - [ ] Cliquer sur "Ajouter"
   - [ ] **CRITIQUE** : Vérifier que le message de validation disparaît
   - [ ] Vérifier que la bordure de l'input redevient normale (gris)
   - [ ] Vérifier que le plat apparaît dans la liste des plats ajoutés

5. **Test avec input vide**
   - [ ] Vérifier qu'aucun message de validation n'apparaît quand l'input est vide
   - [ ] Vérifier que la bordure de l'input est normale (gris) quand l'input est vide

### Résultat attendu
✅ Un message de validation doit s'afficher sous chaque input qui contient du texte mais dont le plat n'a pas été ajouté. Le message doit disparaître après l'ajout.

### Résultat observé
- [ ] ✅ Pass
- [ ] ❌ Fail (décrire le problème)

---

## 3. Test du comportement après ajout

### Objectif
Vérifier que le bouton "Enregistrer le menu" s'active après avoir ajouté au moins un plat.

### Étapes de test

1. **Test d'activation du bouton**
   - [ ] Ouvrir le modal du menu (bouton doit être désactivé)
   - [ ] Taper un nom de plat dans une catégorie
   - [ ] Cliquer sur "Ajouter"
   - [ ] **CRITIQUE** : Vérifier que le bouton "Enregistrer le menu" devient actif (cliquable)
   - [ ] Vérifier que le bouton change d'apparence (opacité normale, couleur normale)

2. **Test avec plusieurs plats ajoutés**
   - [ ] Ajouter un plat dans "Apéritifs"
   - [ ] Ajouter un plat dans "Plat"
   - [ ] Ajouter un plat dans "Dessert"
   - [ ] **CRITIQUE** : Vérifier que le bouton reste actif
   - [ ] Vérifier que tous les plats apparaissent dans leurs catégories respectives

3. **Test après suppression**
   - [ ] Ajouter un plat
   - [ ] Vérifier que le bouton est actif
   - [ ] Supprimer le plat (icône X)
   - [ ] **CRITIQUE** : Vérifier que le bouton redevient désactivé si aucun plat ne reste

4. **Test avec input non vide mais plat ajouté**
   - [ ] Ajouter un plat dans une catégorie
   - [ ] Taper un nouveau nom de plat dans la même catégorie (sans ajouter)
   - [ ] **CRITIQUE** : Vérifier que le bouton reste actif (car au moins un plat a été ajouté)
   - [ ] Vérifier que le message de validation s'affiche pour le nouvel input

### Résultat attendu
✅ Le bouton "Enregistrer le menu" doit s'activer dès qu'au moins un plat a été ajouté, même si d'autres inputs contiennent du texte non ajouté.

### Résultat observé
- [ ] ✅ Pass
- [ ] ❌ Fail (décrire le problème)

---

## 4. Test de l'enregistrement du menu

### Objectif
Vérifier que le menu peut être enregistré correctement et que le comportement de validation est cohérent.

### Étapes de test

1. **Test d'enregistrement avec plats ajoutés**
   - [ ] Ajouter au moins un plat dans une ou plusieurs catégories
   - [ ] Vérifier que le bouton "Enregistrer le menu" est actif
   - [ ] Cliquer sur "Enregistrer le menu"
   - [ ] **CRITIQUE** : Vérifier que le menu est enregistré avec succès
   - [ ] Vérifier que la page se recharge ou que le modal se ferme
   - [ ] Vérifier que le menu apparaît dans la conversation

2. **Test d'enregistrement avec inputs non vides mais non ajoutés**
   - [ ] Ajouter un plat dans une catégorie (pour activer le bouton)
   - [ ] Taper du texte dans une autre catégorie (sans ajouter)
   - [ ] Cliquer sur "Enregistrer le menu"
   - [ ] **CRITIQUE** : Vérifier que seuls les plats ajoutés sont enregistrés
   - [ ] Vérifier que le texte non ajouté n'apparaît pas dans le menu enregistré

3. **Test de prévention d'enregistrement vide**
   - [ ] S'assurer qu'aucun plat n'est ajouté (bouton désactivé)
   - [ ] Essayer de cliquer sur le bouton "Enregistrer le menu" (devrait être désactivé)
   - [ ] **CRITIQUE** : Vérifier qu'il est impossible d'enregistrer un menu vide
   - [ ] Vérifier qu'aucune requête API n'est envoyée si le bouton est désactivé

4. **Test avec toutes les catégories**
   - [ ] Ajouter au moins un plat dans chaque catégorie
   - [ ] Vérifier que le bouton est actif
   - [ ] Enregistrer le menu
   - [ ] **CRITIQUE** : Vérifier que tous les plats de toutes les catégories sont enregistrés
   - [ ] Vérifier que le menu complet apparaît correctement

### Résultat attendu
✅ Le menu ne peut être enregistré que si au moins un plat a été ajouté. Seuls les plats ajoutés sont enregistrés, pas les textes non ajoutés dans les inputs.

### Résultat observé
- [ ] ✅ Pass
- [ ] ❌ Fail (décrire le problème)

---

## 🎯 Checklist rapide

### Tests critiques (doivent tous passer)
- [ ] Bouton "Enregistrer le menu" désactivé quand menu vide
- [ ] Validation inline s'affiche pour inputs non vides non ajoutés
- [ ] Bouton s'active après ajout d'un plat
- [ ] Message de validation disparaît après ajout
- [ ] Menu vide ne peut pas être enregistré

### Tests secondaires
- [ ] Bordure input change de couleur avec validation
- [ ] Plusieurs validations peuvent être affichées simultanément
- [ ] Bouton se désactive après suppression du dernier plat
- [ ] Menu enregistré ne contient que les plats ajoutés

---

## 📝 Notes générales

### Bugs connus
- (À compléter lors des tests)

### Améliorations suggérées
- (À compléter lors des tests)

### Version testée
- Date : ___________
- Version de l'application : ___________
- Navigateur testé : ___________
- Appareil testé : ___________

---

## 🔍 Scénarios de test supplémentaires

### Scénario 1 : Workflow complet
1. Ouvrir le modal du menu
2. Vérifier que le bouton est désactivé
3. Taper "Champagnes" dans Apéritifs (sans ajouter)
4. Vérifier que la validation s'affiche et que le bouton reste désactivé
5. Cliquer sur "Ajouter"
6. Vérifier que le bouton devient actif
7. Enregistrer le menu
8. Vérifier que le menu est enregistré avec succès

### Scénario 2 : Correction d'erreur
1. Taper du texte dans un input
2. Vérifier que la validation s'affiche
3. Effacer le texte
4. Vérifier que la validation disparaît
5. Retaper du texte
6. Vérifier que la validation réapparaît

### Scénario 3 : Multiples catégories
1. Ajouter un plat dans "Apéritifs"
2. Taper du texte dans "Plat" (sans ajouter)
3. Vérifier que le bouton est actif (car au moins un plat ajouté)
4. Vérifier que la validation s'affiche pour "Plat"
5. Enregistrer le menu
6. Vérifier que seul "Apéritifs" est enregistré

---

**Document créé pour les tests de validation du menu - Version 1.0**
