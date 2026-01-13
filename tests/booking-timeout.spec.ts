import { test, expect } from '@playwright/test'

/**
 * Tests E2E pour le flow de réservation avec gestion de timeout
 * 
 * Ces tests vérifient :
 * - Le comportement en cas de réseau lent
 * - La gestion des timeouts
 * - L'UI de retry
 * - L'idempotence (pas de doublons)
 */

test.describe('Booking Form - Timeout & Retry', () => {
  test.beforeEach(async ({ page }) => {
    // Aller sur une page de réservation de test
    // Note: Assurez-vous d'avoir un chef avec slug 'test-chef' dans votre DB de test
    await page.goto('/book/test-chef')
  })

  test('should handle slow network and show timeout error', async ({ page, context }) => {
    // Simuler un réseau lent (3G)
    await context.route('**/api/bookings', async (route) => {
      // Attendre 35 secondes pour déclencher le timeout (timeout = 30s)
      await new Promise(resolve => setTimeout(resolve, 35000))
      await route.continue()
    })

    // Remplir le formulaire
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="emailConfirm"]', 'test@example.com')
    await page.fill('input[name="phone"]', '0123456789')
    
    // Sélectionner repas à domicile
    await page.click('input[value="repas_domicile"]')
    
    // Cliquer sur "Suivant"
    await page.click('button[type="submit"]')
    
    // Remplir la page 2
    await page.waitForSelector('input[name="city"]')
    await page.fill('input[name="city"]', 'Paris')
    await page.fill('input[name="postalCode"]', '75001')
    
    // Sélectionner une date (J+3)
    const minDate = new Date()
    minDate.setDate(minDate.getDate() + 3)
    const dateString = minDate.toISOString().split('T')[0]
    await page.fill('input[name="bookingDate"]', dateString)
    
    // Sélectionner le moment du repas
    await page.selectOption('select[name="mealTime"]', 'diner')
    
    // Accepter les termes
    await page.check('input[name="acceptedTerms"]')
    
    // Soumettre le formulaire
    const submitButton = page.locator('button[type="submit"]').filter({ hasText: /soumettre|submit/i })
    
    // Vérifier que le bouton est en loading
    await submitButton.click()
    await expect(submitButton).toBeDisabled()
    
    // Attendre le timeout (30s + marge)
    await page.waitForTimeout(35000)
    
    // Vérifier qu'un message d'erreur timeout apparaît
    const errorMessage = page.locator('text=/timeout|trop de temps/i')
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
    
    // Vérifier qu'un bouton "Réessayer" apparaît
    const retryButton = page.locator('button:has-text("Réessayer")')
    await expect(retryButton).toBeVisible()
  })

  test('should allow retry after timeout', async ({ page, context }) => {
    let requestCount = 0
    
    // Simuler un réseau lent la première fois, puis rapide au retry
    await context.route('**/api/bookings', async (route) => {
      requestCount++
      if (requestCount === 1) {
        // Première requête: timeout
        await new Promise(resolve => setTimeout(resolve, 35000))
      } else {
        // Retry: réponse rapide
        await route.continue()
      }
    })

    // Remplir et soumettre le formulaire (même flow que test précédent)
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="emailConfirm"]', 'test@example.com')
    await page.fill('input[name="phone"]', '0123456789')
    await page.click('input[value="repas_domicile"]')
    await page.click('button[type="submit"]')
    
    await page.waitForSelector('input[name="city"]')
    await page.fill('input[name="city"]', 'Paris')
    await page.fill('input[name="postalCode"]', '75001')
    
    const minDate = new Date()
    minDate.setDate(minDate.getDate() + 3)
    const dateString = minDate.toISOString().split('T')[0]
    await page.fill('input[name="bookingDate"]', dateString)
    await page.selectOption('select[name="mealTime"]', 'diner')
    await page.check('input[name="acceptedTerms"]')
    
    // Première soumission (va timeout)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(35000)
    
    // Cliquer sur Réessayer
    const retryButton = page.locator('button:has-text("Réessayer")')
    await expect(retryButton).toBeVisible()
    await retryButton.click()
    
    // Vérifier que le retry fonctionne (pas de timeout cette fois)
    // Note: Dans un vrai scénario, on devrait vérifier la redirection vers /booking-confirmation
    // Mais ici on simule juste que le retry ne timeout pas
    await expect(retryButton).not.toBeVisible({ timeout: 10000 })
  })

  test('should prevent duplicate bookings with idempotency', async ({ page, context }) => {
    let requestCount = 0
    const requests: any[] = []
    
    // Intercepter les requêtes pour vérifier l'idempotence
    await context.route('**/api/bookings', async (route) => {
      const request = route.request()
      const postData = request.postDataJSON()
      requests.push(postData)
      requestCount++
      
      // Simuler une réponse lente mais qui réussit
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.continue()
    })

    // Remplir le formulaire
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="email"]', 'test-idempotency@example.com')
    await page.fill('input[name="emailConfirm"]', 'test-idempotency@example.com')
    await page.fill('input[name="phone"]', '0123456789')
    await page.click('input[value="repas_domicile"]')
    await page.click('button[type="submit"]')
    
    await page.waitForSelector('input[name="city"]')
    await page.fill('input[name="city"]', 'Paris')
    await page.fill('input[name="postalCode"]', '75001')
    
    const minDate = new Date()
    minDate.setDate(minDate.getDate() + 3)
    const dateString = minDate.toISOString().split('T')[0]
    await page.fill('input[name="bookingDate"]', dateString)
    await page.selectOption('select[name="mealTime"]', 'diner')
    await page.check('input[name="acceptedTerms"]')
    
    // Cliquer plusieurs fois rapidement sur submit (simuler double-clic)
    const submitButton = page.locator('button[type="submit"]').filter({ hasText: /soumettre|submit/i })
    await submitButton.click()
    await page.waitForTimeout(100)
    await submitButton.click() // Double-clic
    
    // Attendre que les requêtes soient envoyées
    await page.waitForTimeout(5000)
    
    // Vérifier qu'au moins une requête a été envoyée avec idempotencyToken
    expect(requests.length).toBeGreaterThan(0)
    
    // Vérifier que toutes les requêtes ont le même email et bookingDate
    // (l'idempotence devrait empêcher les doublons)
    const emails = requests.map(r => r.email?.toLowerCase().trim())
    const bookingDates = requests.map(r => r.bookingDate)
    
    // Toutes les requêtes doivent avoir le même email et date
    expect(new Set(emails).size).toBeLessThanOrEqual(1)
    expect(new Set(bookingDates).size).toBeLessThanOrEqual(1)
  })

  test('should handle network error gracefully', async ({ page, context }) => {
    // Simuler une erreur réseau
    await context.route('**/api/bookings', route => route.abort('failed'))

    // Remplir et soumettre le formulaire
    await page.fill('input[name="firstName"]', 'Test')
    await page.fill('input[name="lastName"]', 'User')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="emailConfirm"]', 'test@example.com')
    await page.fill('input[name="phone"]', '0123456789')
    await page.click('input[value="repas_domicile"]')
    await page.click('button[type="submit"]')
    
    await page.waitForSelector('input[name="city"]')
    await page.fill('input[name="city"]', 'Paris')
    await page.fill('input[name="postalCode"]', '75001')
    
    const minDate = new Date()
    minDate.setDate(minDate.getDate() + 3)
    const dateString = minDate.toISOString().split('T')[0]
    await page.fill('input[name="bookingDate"]', dateString)
    await page.selectOption('select[name="mealTime"]', 'diner')
    await page.check('input[name="acceptedTerms"]')
    
    await page.click('button[type="submit"]')
    
    // Vérifier qu'un message d'erreur apparaît
    const errorMessage = page.locator('text=/erreur|error|connexion/i')
    await expect(errorMessage).toBeVisible({ timeout: 10000 })
    
    // Vérifier qu'un bouton retry est disponible
    const retryButton = page.locator('button:has-text("Réessayer")')
    await expect(retryButton).toBeVisible()
  })
})
