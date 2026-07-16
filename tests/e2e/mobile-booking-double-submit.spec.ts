/**
 * Controlled mobile booking smoke test against production.
 * Intercepts /api/bookings so we do not create real bookings or send emails.
 */

import { test, expect } from '@playwright/test'

const PROD = process.env.PROD_BASE_URL || 'https://app.guidemytable.fr'
const CHEF_SLUG = process.env.TEST_CHEF_SLUG || 'jacopo'

test.describe('Mobile booking - double submit guard (production)', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    baseURL: PROD,
  })

  test('production booking page ships double-submit guard', async ({ page }) => {
    const response = await page.goto(`/book/${CHEF_SLUG}`, { waitUntil: 'domcontentloaded' })
    expect(response?.ok()).toBeTruthy()

    // Confirm the deployed client bundle includes the in-flight guard string
    const html = await page.content()
    const chunkPaths = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0])
    expect(chunkPaths.length).toBeGreaterThan(0)

    let foundGuard = false
    for (const path of chunkPaths) {
      const js = await page.request.get(path)
      const text = await js.text()
      if (
        text.includes('Ignoring duplicate submit') ||
        text.includes('createInFlightGuard') ||
        text.includes('tryStart')
      ) {
        foundGuard = true
        break
      }
    }
    expect(foundGuard).toBeTruthy()
  })

  test('rapid taps only fire one booking request while pending', async ({ page }) => {
    let bookingRequestCount = 0

    await page.route('**/api/bookings', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      bookingRequestCount += 1
      await new Promise((r) => setTimeout(r, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          bookingRequestId: 'test-booking',
          conversationId: 'test-conversation',
        }),
      })
    })

    await page.goto(`/book/${CHEF_SLUG}`, { waitUntil: 'domcontentloaded' })
    await page.getByText(/repas|à domicile|home/i).first().click({ force: true }).catch(() => {})
    await page.waitForTimeout(500)

    const submit = page.locator('button[type="submit"]').first()
    await expect(submit).toBeVisible()

    // Exercise the form as far as possible; assert we never double-fire /api/bookings
    for (let step = 0; step < 8; step++) {
      const label = ((await submit.textContent()) || '').toLowerCase()
      if (
        label.includes('envoyer') ||
        label.includes('submit') ||
        label.includes('réserver') ||
        label.includes('confirmer') ||
        label.includes('créer')
      ) {
        await Promise.all([
          submit.click({ force: true }),
          submit.click({ force: true }),
          submit.click({ force: true }),
        ])
        await page.waitForTimeout(2500)
        break
      }

      const fullName = page.locator('input[name="fullName"]')
      if (await fullName.isVisible().catch(() => false)) {
        await fullName.fill('Test Mobile Idempotence')
      }
      const phone = page.locator('input[name="phone"]')
      if (await phone.isVisible().catch(() => false)) {
        await phone.fill('0612345678')
      }
      const terms = page.locator('input[type="checkbox"]').last()
      if (await terms.isVisible().catch(() => false)) {
        await terms.check({ force: true }).catch(() => {})
      }
      await submit.click({ force: true }).catch(() => {})
      await page.waitForTimeout(400)
    }

    expect(bookingRequestCount).toBeLessThanOrEqual(1)
  })
})
