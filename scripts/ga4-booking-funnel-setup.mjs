#!/usr/bin/env node
/**
 * Configures GA4 custom dimensions + marks booking_completed as a key event.
 *
 * Prerequisites: ADC with analytics.edit scope + Analytics Admin API enabled.
 *
 * Usage:
 *   node scripts/ga4-booking-funnel-setup.mjs [--property PROPERTY_ID] [--measurement G-CB834F9YGR] [--dry-run]
 */

import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const measurementId =
  args.find((a, i) => args[i - 1] === '--measurement') || 'G-CB834F9YGR'
const propertyIdArg = args.find((a, i) => args[i - 1] === '--property')

function token() {
  try {
    return execSync('gcloud auth application-default print-access-token', {
      encoding: 'utf8',
    }).trim()
  } catch {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
  }
}

async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      'x-goog-user-project':
        process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0984820810',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(`${method} ${url} → ${res.status}`)
    err.details = json
    throw err
  }
  return json
}

const DIMENSIONS = [
  {
    parameterName: 'step_number',
    displayName: 'Booking Step Number',
    scope: 'EVENT',
    description: 'Booking funnel step number (1-5)',
  },
  {
    parameterName: 'step_name',
    displayName: 'Booking Step Name',
    scope: 'EVENT',
    description: 'Booking funnel step name (stable English key)',
  },
  {
    parameterName: 'funnel_name',
    displayName: 'Funnel Name',
    scope: 'EVENT',
    description: 'Funnel identifier (booking)',
  },
  {
    parameterName: 'error_type',
    displayName: 'Booking Validation Error Type',
    scope: 'EVENT',
    description: 'Generic validation error classification (no PII)',
  },
]

async function main() {
  const summaries = await api(
    'https://analyticsadmin.googleapis.com/v1beta/accountSummaries'
  )
  const accounts = summaries.accountSummaries || []
  if (!accounts.length) {
    console.error('No GA4 accounts visible for this credential.')
    process.exit(1)
  }

  let propertyName = propertyIdArg
    ? `properties/${propertyIdArg.replace(/^properties\//, '')}`
    : null

  if (!propertyName) {
    outer: for (const acc of accounts) {
      for (const prop of acc.propertySummaries || []) {
        const propId = prop.property?.replace('properties/', '')
        const streams = await api(
          `https://analyticsadmin.googleapis.com/v1beta/properties/${propId}/dataStreams`
        )
        for (const stream of streams.dataStreams || []) {
          const mid = stream.webStreamData?.measurementId
          if (mid === measurementId) {
            propertyName = prop.property
            console.log('Matched property', {
              displayName: prop.displayName,
              property: prop.property,
              measurementId: mid,
              stream: stream.displayName,
            })
            break outer
          }
        }
      }
    }
  }

  if (!propertyName) {
    console.error(`Could not find property for measurement ${measurementId}`)
    console.log(
      'Visible properties:',
      accounts.flatMap((a) =>
        (a.propertySummaries || []).map((p) => ({
          account: a.displayName,
          property: p.property,
          name: p.displayName,
        }))
      )
    )
    process.exit(1)
  }

  const existing = await api(
    `https://analyticsadmin.googleapis.com/v1beta/${propertyName}/customDimensions`
  )
  const existingParams = new Set(
    (existing.customDimensions || []).map((d) => d.parameterName)
  )

  for (const dim of DIMENSIONS) {
    if (existingParams.has(dim.parameterName)) {
      console.log('Dimension exists:', dim.parameterName)
      continue
    }
    console.log(dryRun ? '[dry-run] Would create' : 'Creating', dim.parameterName)
    if (!dryRun) {
      await api(
        `https://analyticsadmin.googleapis.com/v1beta/${propertyName}/customDimensions`,
        { method: 'POST', body: dim }
      )
    }
  }

  // Key events (conversions): Admin API v1alpha conversionEvents / keyEvents
  const keyEventsUrl = `https://analyticsadmin.googleapis.com/v1alpha/${propertyName}/keyEvents`
  try {
    const keyEvents = await api(keyEventsUrl)
    const has = (keyEvents.keyEvents || []).some(
      (k) => k.eventName === 'booking_completed'
    )
    if (has) {
      console.log('Key event booking_completed already configured')
    } else {
      console.log(
        dryRun ? '[dry-run] Would create key event' : 'Creating key event',
        'booking_completed'
      )
      if (!dryRun) {
        await api(keyEventsUrl, {
          method: 'POST',
          body: { eventName: 'booking_completed' },
        })
      }
    }
  } catch (e) {
    console.warn(
      'Could not configure keyEvents via API (may need UI):',
      e.message
    )
    if (e.details) console.warn(JSON.stringify(e.details, null, 2))
  }

  console.log('\nGA4 Admin URL:')
  console.log(
    `https://analytics.google.com/analytics/web/#/p${propertyName.replace(
      'properties/',
      ''
    )}/admin`
  )
  console.log(
    'Funnel Exploration: Explore → Funnel exploration → steps = booking_form_started → booking_step_view (step_name) → booking_completed'
  )
}

main().catch((err) => {
  console.error(err.message)
  if (err.details) console.error(JSON.stringify(err.details, null, 2))
  process.exit(1)
})
