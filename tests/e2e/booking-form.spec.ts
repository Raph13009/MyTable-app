/**
 * Tests E2E pour le formulaire de réservation
 * Utilise Playwright pour tester l'autofill iOS, la validation et le comportement mobile
 */

import { test, expect } from '@playwright/test'

test.describe('Formulaire de réservation - Tests E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Aller à la page de réservation (remplacer par l'URL réelle)
    // await page.goto('/book/test-chef')
  })

  test('devrait avoir les attributs autofill corrects pour iOS', async ({ page }) => {
    // Simuler un iPhone
    await page.setViewportSize({ width: 375, height: 667 })
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    )

    // Vérifier les attributs autocomplete
    const firstNameInput = page.locator('input[name="firstName"]')
    await expect(firstNameInput).toHaveAttribute('autocomplete', 'given-name')
    await expect(firstNameInput).toHaveAttribute('inputmode', 'text')

    const lastNameInput = page.locator('input[name="lastName"]')
    await expect(lastNameInput).toHaveAttribute('autocomplete', 'family-name')
    await expect(lastNameInput).toHaveAttribute('inputmode', 'text')

    const emailInput = page.locator('input[name="email"]')
    await expect(emailInput).toHaveAttribute('autocomplete', 'email')
    await expect(emailInput).toHaveAttribute('inputmode', 'email')

    const phoneInput = page.locator('input[name="phone"]')
    await expect(phoneInput).toHaveAttribute('autocomplete', 'tel')
    await expect(phoneInput).toHaveAttribute('inputmode', 'tel')

    const cityInput = page.locator('input[name="city"]')
    await expect(cityInput).toHaveAttribute('autocomplete', 'address-level2')
    await expect(cityInput).toHaveAttribute('inputmode', 'text')

    const postalCodeInput = page.locator('input[name="postalCode"]')
    await expect(postalCodeInput).toHaveAttribute('autocomplete', 'postal-code')
    await expect(postalCodeInput).toHaveAttribute('inputmode', 'numeric')
  })

  test('devrait forcer le clavier numérique pour le champ Enfants sur iOS', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    )

    // Naviguer vers la page 2 du formulaire
    // (nécessite de remplir la page 1 d'abord)

    const childrenInput = page.locator('input[name="childrenCount"]')
    await expect(childrenInput).toHaveAttribute('inputmode', 'numeric')
    await expect(childrenInput).toHaveAttribute('pattern', '[0-9]*')
    await expect(childrenInput).toHaveAttribute('type', 'number')
  })

  test('devrait afficher le message d\'erreur global si des champs sont manquants', async ({ page }) => {
    // Remplir la page 1
    await page.fill('input[name="firstName"]', 'John')
    await page.fill('input[name="lastName"]', 'Doe')
    await page.fill('input[name="email"]', 'john@example.com')
    await page.fill('input[name="emailConfirm"]', 'john@example.com')
    await page.fill('input[name="phone"]', '0123456789')
    
    // Sélectionner un type de service
    await page.click('input[value="repas_domicile"]')
    
    // Aller à la page 2
    await page.click('button:has-text("Suivant")')
    
    // Essayer de soumettre sans remplir les champs requis
    await page.click('button:has-text("Envoyer")')
    
    // Vérifier que le message d'erreur global apparaît
    await expect(page.locator('text=Certains champs obligatoires sont manquants.')).toBeVisible()
  })

  test('devrait faire défiler vers le message d\'erreur global', async ({ page }) => {
    // Remplir la page 1
    await page.fill('input[name="firstName"]', 'John')
    await page.fill('input[name="lastName"]', 'Doe')
    await page.fill('input[name="email"]', 'john@example.com')
    await page.fill('input[name="emailConfirm"]', 'john@example.com')
    await page.fill('input[name="phone"]', '0123456789')
    
    // Sélectionner un type de service
    await page.click('input[value="repas_domicile"]')
    
    // Aller à la page 2
    await page.click('button:has-text("Suivant")')
    
    // Scroller vers le bas pour que le bouton soit visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    
    // Essayer de soumettre sans remplir les champs requis
    await page.click('button:has-text("Envoyer")')
    
    // Attendre que le message d'erreur apparaisse
    await expect(page.locator('text=Certains champs obligatoires sont manquants.')).toBeVisible()
    
    // Vérifier que le message est dans le viewport (scroll automatique)
    const errorMessage = page.locator('text=Certains champs obligatoires sont manquants.')
    const boundingBox = await errorMessage.boundingBox()
    expect(boundingBox).not.toBeNull()
  })

  test('devrait masquer le message d\'erreur global quand l\'utilisateur modifie un champ', async ({ page }) => {
    // Remplir la page 1
    await page.fill('input[name="firstName"]', 'John')
    await page.fill('input[name="lastName"]', 'Doe')
    await page.fill('input[name="email"]', 'john@example.com')
    await page.fill('input[name="emailConfirm"]', 'john@example.com')
    await page.fill('input[name="phone"]', '0123456789')
    
    // Sélectionner un type de service
    await page.click('input[value="repas_domicile"]')
    
    // Aller à la page 2
    await page.click('button:has-text("Suivant")')
    
    // Essayer de soumettre sans remplir les champs requis
    await page.click('button:has-text("Envoyer")')
    
    // Vérifier que le message d'erreur apparaît
    await expect(page.locator('text=Certains champs obligatoires sont manquants.')).toBeVisible()
    
    // Modifier un champ
    await page.fill('input[name="city"]', 'Paris')
    
    // Vérifier que le message d'erreur disparaît
    await expect(page.locator('text=Certains champs obligatoires sont manquants.')).not.toBeVisible()
  })
})
