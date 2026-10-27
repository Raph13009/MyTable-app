/**
 * Verifies booking funnel events land on window.dataLayer without PII.
 * Requires local app + seeded chef-demo (see AGENTS.md).
 */
import { test, expect, type Page } from '@playwright/test'

type DataLayerEvent = Record<string, unknown> & { event?: string }

async function getDataLayer(page: Page): Promise<DataLayerEvent[]> {
  return page.evaluate(() => (window as any).dataLayer || [])
}

async function eventsNamed(page: Page, name: string): Promise<DataLayerEvent[]> {
  const layer = await getDataLayer(page)
  return layer.filter((e) => e && e.event === name)
}

test.describe('Booking funnel dataLayer tracking', () => {
  test('fires step_view, form_started, step_completed, validation_error without PII', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      ;(window as any).dataLayer = []
    })

    const response = await page.goto('/book/chef-demo')
    test.skip(!response || response.status() >= 400, 'chef-demo unavailable in this environment')

    await expect(page.locator('text=Type de service').or(page.locator('[aria-current="step"]'))).toBeVisible({
      timeout: 15000,
    })

    // Initial step view
    await expect.poll(async () => (await eventsNamed(page, 'booking_step_view')).length).toBeGreaterThan(0)
    const firstView = (await eventsNamed(page, 'booking_step_view'))[0]
    expect(firstView.step_number).toBe(1)
    expect(firstView.step_name).toBe('service_type')
    expect(firstView.funnel_name).toBe('booking')

    // Start + complete step 1 via service type
    const serviceRadio = page.locator('input[value="repas_domicile"]')
    await expect(serviceRadio).toBeVisible()
    await serviceRadio.check({ force: true })

    await expect.poll(async () => (await eventsNamed(page, 'booking_form_started')).length).toBe(1)
    await expect
      .poll(async () => (await eventsNamed(page, 'booking_step_completed')).length)
      .toBeGreaterThan(0)

    // Land on step 2 then trigger validation error
    await expect.poll(async () => {
      const views = await eventsNamed(page, 'booking_step_view')
      return views.some((v) => v.step_number === 2)
    }).toBeTruthy()

    const nextBtn = page.getByRole('button', { name: /suivant|continuer|next/i }).first()
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click()
    }

    await expect
      .poll(async () => (await eventsNamed(page, 'booking_validation_error')).length)
      .toBeGreaterThan(0)

    const validation = (await eventsNamed(page, 'booking_validation_error'))[0]
    expect(validation.step_number).toBe(2)
    expect(validation.step_name).toBe('service_details')
    expect(validation.error_type).toBeTruthy()
    expect(Array.isArray(validation.error_fields)).toBeTruthy()

    // Back navigation should re-fire step_view for step 1
    const backBtn = page.getByRole('button', { name: /retour|précédent|back/i }).first()
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click()
      await expect
        .poll(async () => {
          const views = await eventsNamed(page, 'booking_step_view')
          return views.filter((v) => v.step_number === 1).length
        })
        .toBeGreaterThan(1)
    }

    const serialized = JSON.stringify(await getDataLayer(page))
    expect(serialized).not.toMatch(/@gmail\.|@yahoo\.|@hotmail\./i)
    expect(serialized).not.toMatch(/"email"\s*:/)
    expect(serialized).not.toMatch(/"phone"\s*:/)
    expect(serialized).not.toMatch(/"fullName"\s*:/)
  })

  test('mobile viewport still pushes step_view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      ;(window as any).dataLayer = []
    })

    const response = await page.goto('/book/chef-demo')
    test.skip(!response || response.status() >= 400, 'chef-demo unavailable in this environment')

    await expect.poll(async () => (await eventsNamed(page, 'booking_step_view')).length).toBeGreaterThan(0)
  })
})
