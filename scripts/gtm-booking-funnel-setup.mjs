#!/usr/bin/env node
/**
 * Configures GTM workspace "Booking | Funnel Tracking" for booking funnel events.
 *
 * Prerequisites:
 *   gcloud auth application-default login --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/tagmanager.edit.containers,https://www.googleapis.com/auth/tagmanager.edit.containerversions,https://www.googleapis.com/auth/analytics.edit"
 *   Accept Tag Manager API ToS in the GCP console if prompted.
 *
 * Usage:
 *   node scripts/gtm-booking-funnel-setup.mjs [--dry-run] [--container GTM-W6XLJMD5] [--ga4 G-CB834F9YGR]
 *
 * Does NOT publish. Creates a workspace + tags/triggers/variables only.
 */

import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const containerPublicId =
  args.find((a, i) => args[i - 1] === '--container') || 'GTM-W6XLJMD5'
const ga4MeasurementId =
  args.find((a, i) => args[i - 1] === '--ga4') || 'G-CB834F9YGR'
const workspaceName = 'Booking | Funnel Tracking'

function token() {
  try {
    return execSync('gcloud auth application-default print-access-token', {
      encoding: 'utf8',
    }).trim()
  } catch {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
  }
}

async function gtm(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://www.googleapis.com/tagmanager/v2/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(`GTM ${method} ${path} → ${res.status}`)
    err.details = json
    throw err
  }
  return json
}

const EVENTS = [
  {
    event: 'booking_form_started',
    tagName: 'Booking | Form Started',
    triggerName: 'Booking | CE - Form Started',
  },
  {
    event: 'booking_step_view',
    tagName: 'Booking | Step Viewed',
    triggerName: 'Booking | CE - Step Viewed',
  },
  {
    event: 'booking_step_completed',
    tagName: 'Booking | Step Completed',
    triggerName: 'Booking | CE - Step Completed',
  },
  {
    event: 'booking_validation_error',
    tagName: 'Booking | Validation Error',
    triggerName: 'Booking | CE - Validation Error',
  },
  {
    event: 'booking_completed',
    tagName: 'Booking | Confirmed',
    triggerName: 'Booking | CE - Confirmed',
  },
]

const DL_VARS = [
  { name: 'DLV - booking.step_number', key: 'step_number' },
  { name: 'DLV - booking.step_name', key: 'step_name' },
  { name: 'DLV - booking.funnel_name', key: 'funnel_name' },
  { name: 'DLV - booking.error_type', key: 'error_type' },
  { name: 'DLV - booking.chef_slug', key: 'chef_slug' },
  { name: 'DLV - booking.service_type', key: 'service_type' },
]

async function main() {
  console.log('Listing GTM accounts…')
  const accounts = await gtm('accounts')
  const accountList = accounts.account || []
  if (!accountList.length) {
    console.error('No GTM accounts visible for this credential.')
    process.exit(1)
  }

  let target = null
  for (const account of accountList) {
    const accountId = account.accountId
    const containers = await gtm(`accounts/${accountId}/containers`)
    for (const c of containers.container || []) {
      if (c.publicId === containerPublicId) {
        target = { account, container: c }
        break
      }
    }
    if (target) break
  }

  if (!target) {
    console.error(`Container ${containerPublicId} not found.`)
    console.log(
      'Accessible containers:',
      (
        await Promise.all(
          accountList.map(async (a) => {
            const cs = await gtm(`accounts/${a.accountId}/containers`)
            return (cs.container || []).map((c) => ({
              account: a.name,
              publicId: c.publicId,
              name: c.name,
            }))
          })
        )
      ).flat()
    )
    process.exit(1)
  }

  const { account, container } = target
  const base = `accounts/${account.accountId}/containers/${container.containerId}`
  console.log('Found container', {
    account: account.name,
    container: container.name,
    publicId: container.publicId,
  })

  const workspaces = await gtm(`${base}/workspaces`)
  let workspace = (workspaces.workspace || []).find((w) => w.name === workspaceName)
  if (!workspace) {
    console.log(dryRun ? '[dry-run] Would create workspace' : 'Creating workspace…', workspaceName)
    if (!dryRun) {
      workspace = await gtm(`${base}/workspaces`, {
        method: 'POST',
        body: {
          name: workspaceName,
          description:
            'Booking funnel events from app.guidemytable.fr (dataLayer → GA4). Do not publish without review.',
        },
      })
    } else {
      workspace = { workspaceId: 'DRY_RUN' }
    }
  } else {
    console.log('Reusing workspace', workspace.workspaceId, workspace.name)
  }

  const ws = `${base}/workspaces/${workspace.workspaceId}`

  // Audit existing tags briefly
  if (!dryRun) {
    const existingTags = await gtm(`${ws}/tags`)
    const existingTriggers = await gtm(`${ws}/triggers`)
    const existingVars = await gtm(`${ws}/variables`)
    console.log('Workspace inventory', {
      tags: (existingTags.tag || []).length,
      triggers: (existingTriggers.trigger || []).length,
      variables: (existingVars.variable || []).length,
    })

    const byName = (list, name) => (list || []).find((x) => x.name === name)

    // Ensure GA4 config tag measurement id variable / reuse if present
    let ga4Config = byName(existingTags.tag, 'Booking | GA4 Configuration')
    if (!ga4Config) {
      // Prefer existing GA4 Configuration tags
      ga4Config = (existingTags.tag || []).find(
        (t) =>
          t.type === 'gaawc' ||
          /ga4.*config/i.test(t.name || '') ||
          /Google Analytics.*Configuration/i.test(t.name || '')
      )
    }

    const varIds = {}
    for (const v of DL_VARS) {
      let existing = byName(existingVars.variable, v.name)
      if (!existing) {
        console.log('Creating variable', v.name)
        existing = await gtm(`${ws}/variables`, {
          method: 'POST',
          body: {
            name: v.name,
            type: 'v',
            parameter: [
              { type: 'integer', key: 'dataLayerVersion', value: '2' },
              { type: 'boolean', key: 'setDefaultValue', value: 'false' },
              { type: 'template', key: 'name', value: v.key },
            ],
          },
        })
      } else {
        console.log('Reusing variable', v.name)
      }
      varIds[v.key] = existing.variableId
    }

    if (!ga4Config) {
      console.log('Creating GA4 Configuration tag')
      ga4Config = await gtm(`${ws}/tags`, {
        method: 'POST',
        body: {
          name: 'Booking | GA4 Configuration',
          type: 'gaawc',
          parameter: [
            {
              type: 'template',
              key: 'measurementId',
              value: ga4MeasurementId,
            },
            { type: 'template', key: 'sendPageView', value: 'true' },
          ],
          firingTriggerId: ['2147479553'], // All Pages built-in
        },
      })
    } else {
      console.log('Reusing GA4 config tag', ga4Config.name)
    }

    for (const ev of EVENTS) {
      let trigger = byName(existingTriggers.trigger, ev.triggerName)
      if (!trigger) {
        console.log('Creating trigger', ev.triggerName)
        trigger = await gtm(`${ws}/triggers`, {
          method: 'POST',
          body: {
            name: ev.triggerName,
            type: 'customEvent',
            customEventFilter: [
              {
                type: 'equals',
                parameter: [
                  { type: 'template', key: 'arg0', value: '{{_event}}' },
                  { type: 'template', key: 'arg1', value: ev.event },
                ],
              },
            ],
          },
        })
      } else {
        console.log('Reusing trigger', ev.triggerName)
      }

      let tag = byName(existingTags.tag, ev.tagName)
      if (!tag) {
        console.log('Creating tag', ev.tagName)
        const eventParams = [
          {
            type: 'list',
            key: 'eventParameters',
            list: [
              {
                type: 'map',
                map: [
                  { type: 'template', key: 'name', value: 'funnel_name' },
                  {
                    type: 'template',
                    key: 'value',
                    value: '{{DLV - booking.funnel_name}}',
                  },
                ],
              },
              {
                type: 'map',
                map: [
                  { type: 'template', key: 'name', value: 'step_number' },
                  {
                    type: 'template',
                    key: 'value',
                    value: '{{DLV - booking.step_number}}',
                  },
                ],
              },
              {
                type: 'map',
                map: [
                  { type: 'template', key: 'name', value: 'step_name' },
                  {
                    type: 'template',
                    key: 'value',
                    value: '{{DLV - booking.step_name}}',
                  },
                ],
              },
              {
                type: 'map',
                map: [
                  { type: 'template', key: 'name', value: 'error_type' },
                  {
                    type: 'template',
                    key: 'value',
                    value: '{{DLV - booking.error_type}}',
                  },
                ],
              },
              {
                type: 'map',
                map: [
                  { type: 'template', key: 'name', value: 'service_type' },
                  {
                    type: 'template',
                    key: 'value',
                    value: '{{DLV - booking.service_type}}',
                  },
                ],
              },
            ],
          },
        ]

        tag = await gtm(`${ws}/tags`, {
          method: 'POST',
          body: {
            name: ev.tagName,
            type: 'gaawe',
            parameter: [
              {
                type: 'template',
                key: 'eventName',
                value: ev.event,
              },
              {
                type: 'template',
                key: 'measurementIdOverride',
                value: ga4MeasurementId,
              },
              ...eventParams,
            ],
            firingTriggerId: [String(trigger.triggerId)],
          },
        })
      } else {
        console.log('Reusing tag', ev.tagName)
      }
    }

    console.log('\nDone. Workspace ready — NOT published.')
    console.log(
      `Open: https://tagmanager.google.com/#/container/accounts/${account.accountId}/containers/${container.containerId}/workspaces/${workspace.workspaceId}`
    )
  } else {
    console.log('[dry-run] Would create variables, triggers and GA4 event tags for:', EVENTS.map((e) => e.event))
  }
}

main().catch((err) => {
  console.error(err.message)
  if (err.details) console.error(JSON.stringify(err.details, null, 2))
  process.exit(1)
})
