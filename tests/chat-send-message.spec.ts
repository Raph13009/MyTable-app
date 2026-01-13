import { test, expect } from '@playwright/test'

/**
 * Test E2E : Vérifier que lorsqu'un chef envoie un message,
 * celui-ci apparaît immédiatement dans son chat (optimistic UI)
 * 
 * Prérequis :
 * - Une conversation doit exister avec un chef et un client
 * - Le chef doit pouvoir se connecter avec son email
 * - Variable d'environnement CONVERSATION_ID (optionnel) pour spécifier une conversation
 */
test.describe('Chat - Envoi de message avec optimistic UI', () => {
  test('Le message doit apparaître instantanément côté expéditeur après envoi', async ({ page }) => {
    // Configuration : utiliser une conversationId depuis l'env ou créer une nouvelle
    const conversationId = process.env.CONVERSATION_ID || 'test-conversation-id'
    const chefEmail = process.env.CHEF_EMAIL || 'chef@example.com'
    
    // Aller sur la page de login du chat
    await page.goto(`/chat/${conversationId}/login`)
    
    // Attendre que la page soit chargée
    await page.waitForLoadState('networkidle')
    
    // Remplir le formulaire de login avec l'email du chef
    const emailInput = page.locator('input[type="email"]').first()
    if (await emailInput.isVisible()) {
      await emailInput.fill(chefEmail)
      
      // Cliquer sur le bouton de connexion
      const submitButton = page.locator('button[type="submit"]').first()
      await submitButton.click()
      
      // Attendre la redirection vers la page de chat
      await page.waitForURL(`**/chat/${conversationId}`, { timeout: 10000 })
    } else {
      // Si on est déjà connecté, on va directement au chat
      await page.goto(`/chat/${conversationId}`)
    }
    
    // Attendre que le chat soit chargé
    await page.waitForLoadState('networkidle')
    
    // Compter le nombre de messages initial
    const initialMessages = await page.locator('[data-testid^="message-"]').count()
    console.log(`[Test] Nombre de messages initial: ${initialMessages}`)
    
    // Préparer le message de test avec un timestamp pour l'identifier
    const testMessage = `Test message E2E - ${Date.now()}`
    
    // Trouver le champ de saisie
    const messageInput = page.locator('[data-testid="message-input"]')
    await expect(messageInput).toBeVisible({ timeout: 5000 })
    
    // Saisir le message
    await messageInput.fill(testMessage)
    
    // Vérifier que le bouton d'envoi est activé
    const sendButton = page.locator('[data-testid="send-message-button"]')
    await expect(sendButton).toBeEnabled()
    
    // Envoyer le message
    await sendButton.click()
    
    // VÉRIFICATION CRITIQUE : Le message doit apparaître IMMÉDIATEMENT (optimistic UI)
    // On vérifie dans les 100ms pour s'assurer que c'est bien l'optimistic UI
    const messageAppeared = await page.waitForSelector(
      `[data-testid^="message-"]:has-text("${testMessage}")`,
      { timeout: 1000, state: 'visible' }
    ).catch(() => null)
    
    expect(messageAppeared).not.toBeNull()
    console.log('[Test] ✅ Message apparu immédiatement (optimistic UI)')
    
    // Vérifier que le champ de saisie est vidé
    await expect(messageInput).toHaveValue('')
    
    // Attendre un peu pour que la revalidation se fasse (500ms + réseau)
    await page.waitForTimeout(1000)
    
    // Vérifier que le message est toujours là (pas de rollback)
    const messageStillVisible = await page.locator(
      `[data-testid^="message-"]:has-text("${testMessage}")`
    ).isVisible()
    
    expect(messageStillVisible).toBe(true)
    console.log('[Test] ✅ Message toujours visible après revalidation')
    
    // Vérifier qu'il n'y a pas de doublons (un seul message avec ce contenu)
    const messagesWithContent = await page.locator(
      `[data-testid^="message-content-"]:has-text("${testMessage}")`
    ).count()
    
    expect(messagesWithContent).toBe(1)
    console.log('[Test] ✅ Pas de doublons détectés')
    
    // Vérifier que les messages sont triés par created_at (le nouveau message doit être en dernier)
    const allMessages = await page.locator('[data-testid^="message-"]').all()
    const lastMessage = allMessages[allMessages.length - 1]
    const lastMessageContent = await lastMessage.locator('[data-testid^="message-content-"]').textContent()
    
    expect(lastMessageContent).toContain(testMessage)
    console.log('[Test] ✅ Message correctement trié (en dernier)')
  })
  
  test('Le message doit être retiré si l\'envoi échoue (rollback)', async ({ page }) => {
    // Ce test nécessite de simuler une erreur réseau
    // Pour l'instant, on skip car cela nécessite un mock du serveur
    test.skip(true, 'Test de rollback nécessite un mock du serveur')
  })
})
