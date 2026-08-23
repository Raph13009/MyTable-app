/**
 * Relance d'inactivité chef : un seul envoi à J+1 (jour civil suivant),
 * jamais les jours suivants.
 *
 * Le cron tourne une fois par jour ; on cible les demandes pending créées
 * hier (fuseau Europe/Paris), chef + contact@guidemytable.fr.
 */

export const CHEF_INACTIVITY_REMINDER_TIMEZONE = 'Europe/Paris'

function formatYmdInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addDaysToYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Minuit Europe/Paris pour une date civile YYYY-MM-DD, en UTC. */
export function parisMidnightUtc(ymd: string): Date {
  const wanted = `${ymd} 00:00:00`
  for (const offset of ['+02:00', '+01:00'] as const) {
    const date = new Date(`${ymd}T00:00:00${offset}`)
    if (date.toLocaleString('sv-SE', { timeZone: CHEF_INACTIVITY_REMINDER_TIMEZONE }) === wanted) {
      return date
    }
  }
  throw new Error(`Unable to resolve midnight in ${CHEF_INACTIVITY_REMINDER_TIMEZONE} for ${ymd}`)
}

/**
 * Fenêtre created_at des demandes à relancer : [hier 00:00, aujourd'hui 00:00)
 * en Europe/Paris.
 */
export function getChefInactivityReminderCreatedAtRange(now: Date = new Date()): {
  fromInclusive: string
  toExclusive: string
} {
  const todayYmd = formatYmdInTimeZone(now, CHEF_INACTIVITY_REMINDER_TIMEZONE)
  const yesterdayYmd = addDaysToYmd(todayYmd, -1)
  return {
    fromInclusive: parisMidnightUtc(yesterdayYmd).toISOString(),
    toExclusive: parisMidnightUtc(todayYmd).toISOString(),
  }
}
